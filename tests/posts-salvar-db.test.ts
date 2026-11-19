// Gravação de matérias pelo painel: criar, publicar, agendar, despublicar, conflito, endereço travado, HTML perigoso, versões e agendados.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, query, setPool } from "~/server/db.server";
import { carregarPost, criarCategoria, criarTag, lerVersao, publicarAgendados, salvarPost, type EntradaPost } from "~/server/admin/posts-edit.server";
import { getPost } from "~/server/content/posts.server";

let server: Awaited<ReturnType<typeof createDB>>;
const CAT = "cccccccc-0000-4000-8000-000000000001";
const AGORA = Date.parse("2026-11-19T15:00:00Z");
const texto = `<p>${"palavra ".repeat(60)}</p>`;
const base = (o: Partial<EntradaPost> = {}): EntradaPost => ({ id: null, titulo: "Um título para a matéria", slug: "", resumo: "", capa: "/media/painel/x.webp", tipo: "news", html: texto, categoriaIds: [CAT], tagIds: [], publicadoEm: null, palavraChave: "", autorId: null, atualizadoEm: null, ...o });

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  await exec("INSERT INTO categories (id, name, slug, kind) VALUES (?, 'Animes e Mangás', 'animes', 'news')", [CAT]);
});
afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("criar e publicar", () => {
  it("rascunho: só precisa de título; nasce com origem 'painel' e endereço do título", async () => {
    const r = await salvarPost(base({ titulo: "Rascunho curto", html: "<p>pouco</p>", capa: "", categoriaIds: [] }), "draft", AGORA);
    expect(r).toMatchObject({ ok: true, slug: "rascunho-curto", status: "draft", publicadoEm: null });
    const [row] = await query<{ origin: string; edited_at: string | null; status: string }>("SELECT origin, edited_at, status FROM posts WHERE slug = 'rascunho-curto'");
    expect(row.origin).toBe("painel");
    expect(row.edited_at).not.toBeNull();
    expect(await getPost("rascunho-curto")).toBeNull(); // rascunho não aparece no site
  });

  it("publicar recusa o que falta e devolve a lista; com tudo certo, vai ao ar e aparece no site", async () => {
    const falta = await salvarPost(base({ titulo: "Oi", slug: "falta-tudo", capa: "", categoriaIds: [] }), "publish", AGORA);
    expect(falta).toMatchObject({ ok: false, faltando: expect.arrayContaining(["Título", "Imagem de capa", "Pelo menos 1 categoria"]) });
    const r = await salvarPost(base({ slug: "materia-no-ar", palavraChave: "palavra" }), "publish", AGORA);
    expect(r).toMatchObject({ ok: true, status: "published", publicadoEm: new Date(AGORA).toISOString() });
    const p = await getPost("materia-no-ar");
    expect(p).toMatchObject({ title: "Um título para a matéria", categories: [{ slug: "animes" }] });
  });

  it("HTML perigoso sai limpo; vídeo do YouTube e spoiler continuam", async () => {
    const perigoso = `${texto}<script>alert(1)</script><iframe src="https://evil.example/x"></iframe><div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/AAAAAAAAAAA"></iframe></div><details class="spoiler-box"><summary>s</summary><div class="spoiler-content"><p>segredo</p></div></details>`;
    const r = await salvarPost(base({ slug: "html-perigoso", html: perigoso }), "publish", AGORA);
    expect(r.ok).toBe(true);
    const html = (await getPost("html-perigoso"))!.html;
    expect(html).not.toContain("<script");
    expect(html).not.toContain("evil.example");
    expect(html).toContain("youtube-nocookie.com/embed/AAAAAAAAAAA");
    expect(html).toContain("data-youtube-video");
    expect(html).toContain("spoiler-box");
  });

  it("endereço repetido é recusado", async () => {
    expect(await salvarPost(base({ slug: "materia-no-ar" }), "draft", AGORA)).toMatchObject({ ok: false, erro: expect.stringContaining("Já existe") });
  });
});

describe("agendar, despublicar, versões e conflito", () => {
  it("agenda no futuro, publica quando a hora chega (tarefa) e a matéria passa a aparecer", async () => {
    const futuro = new Date(AGORA + 3_600_000).toISOString();
    const r = await salvarPost(base({ slug: "agendada", publicadoEm: futuro }), "schedule", AGORA);
    expect(r).toMatchObject({ ok: true, status: "scheduled", publicadoEm: futuro });
    expect(await getPost("agendada")).toBeNull();
    await exec("UPDATE posts SET published_at = '2026-01-01 00:00:00' WHERE slug = 'agendada'"); // a hora chegou
    expect(await publicarAgendados()).toBe(1);
    expect(await getPost("agendada")).not.toBeNull();
    expect(await publicarAgendados()).toBe(0);
  });

  it("despublicar volta a rascunho e mantém a data original; o endereço fica travado depois de publicado", async () => {
    const [{ id }] = await query<{ id: string }>("SELECT id FROM posts WHERE slug = 'materia-no-ar'");
    let atual = (await carregarPost(id))!.post;
    expect(atual.jaPublicado).toBe(true);
    const r = await salvarPost(base({ id, slug: "outro-endereco", titulo: "Título novo para a matéria", atualizadoEm: atual.atualizadoEm }), "unpublish", AGORA);
    expect(r).toMatchObject({ ok: true, status: "draft", slug: "materia-no-ar", publicadoEm: new Date(AGORA).toISOString() }); // endereço e data não mudam
    atual = (await carregarPost(id))!.post;
    expect(atual).toMatchObject({ status: "draft", titulo: "Título novo para a matéria", jaPublicado: true });
    expect(await getPost("materia-no-ar")).toBeNull();
  });

  it("cada gravação guarda a versão anterior (no máximo 20) e dá para ler uma versão", async () => {
    const [{ id }] = await query<{ id: string }>("SELECT id FROM posts WHERE slug = 'rascunho-curto'");
    for (let i = 0; i < 23; i++) {
      const cur = (await carregarPost(id))!.post;
      expect(await salvarPost(base({ id, titulo: `Versão número ${i + 1} do rascunho`, html: "<p>x</p>", capa: "", categoriaIds: [], atualizadoEm: cur.atualizadoEm }), "draft", AGORA)).toMatchObject({ ok: true });
    }
    const { versoes } = (await carregarPost(id))!;
    expect(versoes).toHaveLength(20);
    expect(versoes[0].salvaPor).toBe("painel");
    expect(await lerVersao(id, versoes[0].id)).toMatchObject({ titulo: "Versão número 22 do rascunho" });
    expect(await lerVersao("outro-post-qualquer", versoes[0].id)).toBeNull();
  });

  it("conflito: se o post mudou depois de aberto, recusa e avisa (409)", async () => {
    const [{ id }] = await query<{ id: string }>("SELECT id FROM posts WHERE title = 'Versão número 23 do rascunho'");
    const aberto = (await carregarPost(id))!.post;
    await exec("UPDATE posts SET title = 'Mudou por fora', updated_at = UTC_TIMESTAMP(3) + INTERVAL 1 SECOND WHERE id = ?", [id]); // robô, agenda ou outra aba
    const r = await salvarPost(base({ id, titulo: "Minha edição antiga", html: "<p>x</p>", capa: "", categoriaIds: [], atualizadoEm: aberto.atualizadoEm }), "draft", AGORA);
    expect(r).toMatchObject({ ok: false, conflito: true });
    expect((await carregarPost(id))!.post.titulo).toBe("Mudou por fora");
  });

  it("post inexistente e dados inválidos voltam como erro, nunca como exceção", async () => {
    expect(await salvarPost(base({ id: "00000000-0000-4000-8000-0000000000ff" }), "draft", AGORA)).toMatchObject({ ok: false });
    expect(await salvarPost({ titulo: "" }, "draft", AGORA)).toMatchObject({ ok: false });
    expect(await salvarPost(base({ titulo: "   " }), "draft", AGORA)).toMatchObject({ ok: false, erro: expect.stringContaining("título") });
  });
});

describe("categorias e tags", () => {
  it("criar categoria e tag reaproveita a que já existe", async () => {
    const c = await criarCategoria("Novidades do Mês", "news");
    expect(c).toMatchObject({ nova: true, slug: "novidades-do-mes" });
    expect(await criarCategoria("novidades do mês", "news")).toMatchObject({ id: c.id, nova: false });
    const t = await criarTag("#Dandadan");
    expect(t).toMatchObject({ nova: true, nome: "Dandadan" });
    expect(await criarTag("dandadan")).toMatchObject({ id: t.id, nova: false });
    await expect(criarTag("a")).rejects.toThrow();
  });

  it("só categorias e tags que existem viram vínculo", async () => {
    const t = await criarTag("Bleach");
    const r = await salvarPost(base({ slug: "com-tags", tagIds: [t.id, "tttttttt-0000-4000-8000-0000000000aa"], categoriaIds: [CAT, "cccccccc-0000-4000-8000-0000000000aa"] }), "draft", AGORA);
    if (!r.ok) throw new Error(r.erro);
    const { post } = (await carregarPost(r.id))!;
    expect(post.tagIds).toEqual([t.id]);
    expect(post.categoriaIds).toEqual([CAT]);
  });
});
