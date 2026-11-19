// Tela Notícias IA: o que o painel lê e faz com o robô (candidatos, aprovação, fontes, termos, horários, autores, configuração, rodadas).
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, query, setPool } from "~/server/db.server";
import {
  alternarTermo, apagarTermo, descartarCandidato, descartarRascunho, ensaiarEndereco, guiaEditorial, iniciarRodada, ligarFonte, listarAutoresIA, listarCandidatos, listarFontes, listarHorarios, listarRascunhos, listarRodadas, listarTermos,
  motivosDescarte24h, previewHtml, publicarRascunho, rodadaEmAndamento, salvarAutorIA, salvarConfig, salvarFonte, salvarGuia, salvarHorarios, salvarTermo, statusRobo, visaoGeral,
} from "~/server/robot/painel.server";
import { getConfig } from "~/server/robot/config.server";

let server: Awaited<ReturnType<typeof createDB>>;
const AUTOR = "aaaaaaaa-0000-4000-8000-000000000001";
const CAT = "cccccccc-0000-4000-8000-000000000001";
const POST_OK = "pppppppp-0000-4000-8000-000000000001";
const POST_INCOMPLETO = "pppppppp-0000-4000-8000-000000000002";

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  delete process.env.GEMINI_API_KEY;

  await exec("INSERT INTO post_authors (id, kind, slug, name) VALUES (?, 'ai', 'lia', 'Lia')", [AUTOR]);
  await exec("INSERT INTO ai_news_authors (author_id, category_name, specialty, auto_publish, active) VALUES (?, 'Animes e Mangás', 'anime', 0, 1)", [AUTOR]);
  await exec("INSERT INTO categories (id, name, slug, kind) VALUES (?, 'Animes e Mangás', 'animes-e-mangas', 'news'), ('cccccccc-0000-4000-8000-000000000002', 'Games', 'games', 'news')", [CAT]);
  await exec("INSERT INTO ai_news_sources (id, name, base_url, rss_url, priority, active, fail_streak, last_status) VALUES ('ssssssss-0000-4000-8000-000000000001', 'Fonte A', 'https://a.example', NULL, 9, 1, 3, 'failed')");

  const longo = `<p>${"palavra ".repeat(60)}</p>`;
  const post = (id: string, slug: string, titulo: string, html: string, capa: string | null) =>
    exec("INSERT INTO posts (id, post_type, slug, status, title, content_html, featured_image, author_id, origin, reading_minutes, created_at, updated_at) VALUES (?, 'news', ?, 'draft', ?, ?, ?, ?, 'robo', 1, NOW(3), NOW(3))", [id, slug, titulo, html, capa, AUTOR]);
  await post(POST_OK, "rascunho-ok", "Rascunho completo do robô", longo, "/media/robo/x.webp");
  await post(POST_INCOMPLETO, "rascunho-curto", "Rascunho incompleto do robô", "<p>pouco</p>", null);
  await exec("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [POST_OK, CAT]);

  const cand = (hash: string, titulo: string, status: string, score: number, motivo: string | null, post: string | null = null, resultado: string | null = null) =>
    exec("INSERT INTO ai_news_candidates (source_id, dedup_hash, title, source_url, score, status, discard_reason, post_id, result_json) VALUES ('ssssssss-0000-4000-8000-000000000001', ?, ?, 'https://a.example/x', ?, ?, ?, ?, ?)", [hash, titulo, score, status, motivo, post, resultado]);
  await cand("h1", "Na fila 1", "pending", 80, null);
  await cand("h2", "Na fila 2", "pending", 60, null);
  await cand("h3", "Descartada", "discarded", 10, "Muito parecida com recente");
  await cand("h4", "Falhou", "failed", 5, "Muito parecida com recente");
  await cand("h5", "Do rascunho", "draft", 70, null, POST_OK);
  await cand("h6", "Ensaio", "rehearsal", 50, null, null, JSON.stringify({ article: { title: "Texto de ensaio <b>x</b>", titleVariants: [], focusKeyword: "kw", metaDescription: "m", excerpt: "e", html: "<p>corpo</p><script>x</script>", tags: ["a"], categorySlug: "animes-e-mangas", animeFocus: "main" }, cover: { url: "/media/robo/c.webp", width: 1, height: 1 }, check: { ok: true, author: "Lia" } }));
  await exec("INSERT INTO ai_news_runs (started_at, finished_at, status, mode, limit_n, generated_count, discarded, failed, report) VALUES (UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 'finished', 'ensaio', 1, 1, 0, 0, '{\"ok\":true}')");
});
afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("estado do robô", () => {
  it("visão geral: modo, teto, horários (padrão se vazio), fontes e últimas rodadas", async () => {
    const g = await visaoGeral();
    expect(g).toMatchObject({ modo: "desligado", hoje: 2, teto: 10, chave: false, rodando: false });
    expect(g.horarios.map((h) => h.hora)).toEqual([8, 10, 12, 14, 16, 18, 20, 22]);
    expect(g.rodadas[0]).toMatchObject({ status: "finished", modo: "ensaio", geradas: 1 });
    expect(g.motivos).toEqual([{ motivo: "Muito parecida com recente", n: 2 }]);
    expect((await statusRobo()).fontes).toEqual({ total: 1, ativas: 1, falhando: 1 });
  });

  it("a prévia mostra o texto do ensaio com o HTML limpo", async () => {
    const [c] = await query<{ id: number }>("SELECT id FROM ai_news_candidates WHERE dedup_hash = 'h6'");
    const html = (await previewHtml(c.id))!;
    expect(html).toContain("Texto de ensaio &lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<script");
    expect(await previewHtml(999999)).toBeNull();
  });
});

describe("candidatos", () => {
  it("lista por status, com contagem de cada aba, nota mais alta primeiro", async () => {
    const l = await listarCandidatos("pending", 1);
    expect(l.itens.map((c) => [c.titulo, c.nota])).toEqual([["Na fila 1", 80], ["Na fila 2", 60]]);
    expect(l.contagens).toMatchObject({ pending: 2, discarded: 1, failed: 1, draft: 1, rehearsal: 1, published: 0 });
    expect((await listarCandidatos("rehearsal", 1)).itens[0].temPrevia).toBe(true);
  });

  it("descartar só vale para quem está na fila", async () => {
    const [{ id }] = await query<{ id: number }>("SELECT id FROM ai_news_candidates WHERE dedup_hash = 'h2'");
    expect(await descartarCandidato(id)).toBe(true);
    expect(await descartarCandidato(id)).toBe(false);
    const [{ id: feito }] = await query<{ id: number }>("SELECT id FROM ai_news_candidates WHERE dedup_hash = 'h3'");
    expect(await descartarCandidato(feito)).toBe(false);
    expect((await motivosDescarte24h()).find((m) => m.motivo === "descartado no painel")?.n).toBe(1);
  });
});

describe("aprovação dos rascunhos do robô", () => {
  it("lista os rascunhos, recusa publicar o incompleto e publica o completo (o candidato vira publicado)", async () => {
    expect((await listarRascunhos()).map((r) => r.titulo).sort()).toEqual(["Rascunho completo do robô", "Rascunho incompleto do robô"]);
    const falha = await publicarRascunho(POST_INCOMPLETO);
    expect(falha).toMatchObject({ ok: false, erro: expect.stringContaining("Falta para publicar") });
    expect(await publicarRascunho(POST_OK)).toEqual({ ok: true });
    const [p] = await query<{ status: string }>("SELECT status FROM posts WHERE id = ?", [POST_OK]);
    expect(p.status).toBe("published");
    const [c] = await query<{ status: string }>("SELECT status FROM ai_news_candidates WHERE dedup_hash = 'h5'");
    expect(c.status).toBe("published");
    expect(await publicarRascunho(POST_OK)).toMatchObject({ ok: false }); // já publicado
  });

  it("descartar apaga o rascunho e marca a notícia da fonte", async () => {
    expect(await descartarRascunho(POST_INCOMPLETO)).toBe(true);
    expect(await query("SELECT id FROM posts WHERE id = ?", [POST_INCOMPLETO])).toHaveLength(0);
    expect(await descartarRascunho(POST_OK)).toBe(false); // publicado nunca é apagado por aqui
  });
});

describe("fontes", () => {
  it("cria, edita, liga e desliga (ligar zera as falhas); recusa endereço inválido", async () => {
    expect(await salvarFonte({ nome: "Fonte B", site: "https://b.example", rss: "", prioridade: 4 })).toEqual({ ok: true });
    expect(await salvarFonte({ nome: "x", site: "https://b.example", prioridade: 4 })).toMatchObject({ ok: false });
    expect(await salvarFonte({ nome: "Fonte C", site: "javascript:alert(1)", prioridade: 4 })).toMatchObject({ ok: false });
    expect(await salvarFonte({ nome: "Fonte C", site: "https://c.example", prioridade: 11 })).toMatchObject({ ok: false });
    let fontes = await listarFontes();
    expect(fontes.map((f) => f.nome)).toEqual(["Fonte A", "Fonte B"]); // por prioridade
    const b = fontes.find((f) => f.nome === "Fonte B")!;
    expect(await salvarFonte({ id: b.id, nome: "Fonte B2", site: "https://b2.example", rss: "https://b2.example/rss", prioridade: 7 })).toEqual({ ok: true });
    await ligarFonte(b.id, false);
    fontes = await listarFontes();
    expect(fontes.find((f) => f.id === b.id)).toMatchObject({ nome: "Fonte B2", rss: "https://b2.example/rss", prioridade: 7, ativa: false });
    const a = fontes.find((f) => f.nome === "Fonte A")!;
    expect(a.falhasSeguidas).toBe(3);
    await ligarFonte(a.id, true);
    expect((await listarFontes()).find((f) => f.id === a.id)?.falhasSeguidas).toBe(0);
  });
});

describe("tópicos e bloqueios", () => {
  it("cria (em minúsculas, sem duplicar), muda o peso, liga/desliga e apaga", async () => {
    expect(await salvarTermo({ tipo: "topic", termo: "One Piece", peso: 40 })).toEqual({ ok: true });
    expect(await salvarTermo({ tipo: "topic", termo: "ONE PIECE", peso: 55 })).toEqual({ ok: true });
    expect(await salvarTermo({ tipo: "block", termo: "fofoca" })).toEqual({ ok: true });
    expect(await salvarTermo({ tipo: "block", termo: "x" })).toMatchObject({ ok: false });
    expect(await salvarTermo({ tipo: "topic", termo: "valido", peso: 500 })).toMatchObject({ ok: false });
    let t = await listarTermos();
    expect(t.map((x) => [x.tipo, x.termo, x.peso])).toEqual([["block", "fofoca", 0], ["topic", "one piece", 55]]);
    await alternarTermo(t[0].id, false);
    expect((await listarTermos())[0].ativo).toBe(false);
    await apagarTermo(t[0].id);
    t = await listarTermos();
    expect(t).toHaveLength(1);
  });
});

describe("horários, autores e configuração", () => {
  it("horários: 24 células, de 0 a 3, nunca tudo zerado; ao salvar passam a valer no lugar do padrão", async () => {
    const grade = Array(24).fill(0);
    expect(await salvarHorarios(grade)).toMatchObject({ ok: false, erro: expect.stringContaining("pelo menos um") });
    expect(await salvarHorarios(Array(24).fill(4))).toMatchObject({ ok: false });
    expect(await salvarHorarios([1, 2])).toMatchObject({ ok: false });
    grade[9] = 2;
    grade[15] = 1;
    expect(await salvarHorarios(grade)).toEqual({ ok: true, total: 3 });
    const h = await listarHorarios();
    expect(h.filter((x) => x.posts > 0)).toEqual([{ hora: 9, posts: 2 }, { hora: 15, posts: 1 }]);
    expect((await visaoGeral()).horarios.map((x) => x.hora)).toEqual([9, 15]);
  });

  it("autor de IA: muda categoria, especialidade, publica sozinho e ativo; categoria inexistente é recusada", async () => {
    expect(await salvarAutorIA({ id: AUTOR, categoria: "Games", especialidade: "jogos", publicaSozinho: true, ativo: false })).toEqual({ ok: true });
    const { autores, categorias } = await listarAutoresIA();
    expect(autores[0]).toMatchObject({ nome: "Lia", categoria: "Games", especialidade: "jogos", publicaSozinho: true, ativo: false });
    expect(categorias).toEqual(["Animes e Mangás", "Games"]);
    expect(await salvarAutorIA({ id: AUTOR, categoria: "Inventada", publicaSozinho: true, ativo: true })).toMatchObject({ ok: false });
  });

  it("configuração: valida limites e modelos; o guia é salvo no banco", async () => {
    expect(await salvarConfig({ modo: "ensaio", limiteDia: 12, imagensCorpo: 4, modelo: "gemini-2.5-flash", chamadasDiaPorModelo: 50 })).toMatchObject({ ok: true });
    expect(await getConfig()).toMatchObject({ modo: "ensaio", limiteDia: 12, imagensCorpo: 4, modelo: "gemini-2.5-flash", chamadasDiaPorModelo: 50 });
    expect(await salvarConfig({ limiteDia: 99 })).toMatchObject({ ok: false });
    expect(await salvarConfig({ modelo: "gpt-9" })).toMatchObject({ ok: false });
    expect(await salvarConfig({ modo: "voando" })).toMatchObject({ ok: false });
    expect(await salvarGuia("Regra 1\r\nRegra 2")).toEqual({ ok: true });
    expect(await guiaEditorial()).toBe("Regra 1\nRegra 2");
    expect(await salvarGuia("x".repeat(60_001))).toMatchObject({ ok: false });
  });
});

describe("rodadas", () => {
  it("histórico paginado; sem a chave do Gemini não começa rodada nem ensaio de endereço", async () => {
    const h = await listarRodadas(1);
    expect(h).toMatchObject({ total: 1, pagina: 1, paginas: 1 });
    expect(await rodadaEmAndamento()).toBe(false);
    expect(await iniciarRodada("ensaio")).toMatchObject({ ok: false, erro: expect.stringContaining("GEMINI_API_KEY") });
    expect(await ensaiarEndereco("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(await ensaiarEndereco("https://a.example/materia")).toMatchObject({ ok: false, erro: expect.stringContaining("GEMINI_API_KEY") });
  });

  it("não começa outra rodada enquanto uma está em andamento", async () => {
    process.env.GEMINI_API_KEY = "chave-falsa-de-teste";
    await exec("INSERT INTO ai_news_runs (started_at, status, mode, limit_n) VALUES (UTC_TIMESTAMP(3), 'running', 'ensaio', 1)");
    expect(await rodadaEmAndamento()).toBe(true);
    expect(await iniciarRodada("ensaio")).toEqual({ ok: false, erro: "Já tem uma rodada em andamento." });
    await exec("UPDATE ai_news_runs SET started_at = UTC_TIMESTAMP(3) - INTERVAL 30 MINUTE WHERE status = 'running'");
    expect(await rodadaEmAndamento()).toBe(false); // passou de 20 min: dada como morta e fechada
    delete process.env.GEMINI_API_KEY;
  });
});
