// Lista de posts do painel: abas, filtros, ordem, paginação e exclusão (só rascunhos).
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, query, setPool } from "~/server/db.server";
import { excluirRascunhos, lerFiltros, listarPosts, POR_PAGINA } from "~/server/admin/posts.server";

let server: Awaited<ReturnType<typeof createDB>>;
const f = (qs = "") => lerFiltros(new URLSearchParams(qs));
const id = (n: number) => `pppppppp-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });

  await exec("INSERT INTO post_authors (id, kind, slug, name) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'ai', 'lia', 'Lia')");
  await exec("INSERT INTO categories (id, name, slug, kind) VALUES ('cccccccc-0000-4000-8000-000000000001', 'Animes e Mangás', 'animes', 'news')");
  const post = (n: number, o: { type?: string; status?: string; origin?: string; source?: string | null; pub?: string | null; views?: number; titulo?: string; author?: boolean }) =>
    exec("INSERT INTO posts (id, post_type, slug, status, title, content_html, origin, source_url, author_id, views_count, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '<p>x</p>', ?, ?, ?, ?, ?, '2026-11-01 10:00:00', '2026-11-01 10:00:00')", [
      id(n), o.type ?? "news", `materia-${n}`, o.status ?? "published", o.titulo ?? `Matéria ${n}`, o.origin ?? "old", o.source ?? null, o.author ? "aaaaaaaa-0000-4000-8000-000000000001" : null, o.views ?? 0, o.pub === undefined ? "2026-11-10 10:00:00" : o.pub,
    ]);
  await post(1, { origin: "old", views: 500, titulo: "Sakamoto Days arco final" });
  await post(2, { origin: "robo", author: true, views: 10, pub: "2026-11-18 12:00:00" });
  await post(3, { origin: "robo", source: "agenda de animes (semana)", pub: "2026-11-17 12:00:00" });
  await post(4, { status: "draft", origin: "painel", pub: null, titulo: "Rascunho do painel" });
  await post(5, { status: "draft", origin: "painel", pub: null, type: "article" });
  await post(6, { status: "scheduled", origin: "painel", pub: "2026-12-01 09:00:00" });
  await exec("INSERT INTO post_categories (post_id, category_id) VALUES (?, 'cccccccc-0000-4000-8000-000000000001')", [id(1)]);
  await exec("INSERT INTO post_tags (post_id, tag_id) SELECT ?, id FROM tags LIMIT 0", [id(4)]);
});
afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("filtros do endereço", () => {
  it("ignora valores inválidos e limpa o que não é identificador", () => {
    expect(f("status=lixo&tipo=x&origem=y&ordem=z&pagina=-3")).toMatchObject({ status: "todos", tipo: "", origem: "", ordem: "recentes", pagina: 1 });
    expect(f("autor=abc'; DROP--").autor).toBe("abcDROP--");
    expect(f("status=draft&tipo=article&origem=agenda&ordem=vistas&pagina=3&q=%20 one ")).toMatchObject({ status: "draft", tipo: "article", origem: "agenda", ordem: "vistas", pagina: 3, q: "one" });
  });
});

describe("lista", () => {
  it("conta as abas, separa a agenda do robô e mostra autor, categoria e vistas", async () => {
    const l = await listarPosts(f());
    expect(l.total).toBe(6);
    expect(l.contagens).toEqual({ todos: 6, published: 3, scheduled: 1, draft: 2 });
    const m1 = l.itens.find((p) => p.id === id(1))!;
    expect(m1).toMatchObject({ categoria: "Animes e Mangás", vistas: 500, origem: "old", url: "/noticias/materia-1" });
    expect(l.itens.find((p) => p.id === id(2))).toMatchObject({ origem: "robo", autor: "Lia" });
    expect(l.itens.find((p) => p.id === id(3))?.origem).toBe("agenda");
    expect(l.itens.find((p) => p.id === id(5))).toMatchObject({ tipo: "article", url: "/artigos/materia-5" });
    expect(l.autores).toEqual([{ id: "aaaaaaaa-0000-4000-8000-000000000001", nome: "Lia" }]);
  });

  it("filtra por aba, tipo, origem, autor e busca por título ou endereço; as abas contam com os mesmos filtros", async () => {
    expect((await listarPosts(f("status=draft"))).itens.map((p) => p.id).sort()).toEqual([id(4), id(5)]);
    expect((await listarPosts(f("tipo=article"))).itens.map((p) => p.id)).toEqual([id(5)]);
    expect((await listarPosts(f("origem=agenda"))).itens.map((p) => p.id)).toEqual([id(3)]);
    expect((await listarPosts(f("origem=robo"))).itens.map((p) => p.id)).toEqual([id(2)]); // sem a agenda
    expect((await listarPosts(f("autor=aaaaaaaa-0000-4000-8000-000000000001"))).itens.map((p) => p.id)).toEqual([id(2)]);
    expect((await listarPosts(f("q=sakamoto"))).itens.map((p) => p.id)).toEqual([id(1)]);
    expect((await listarPosts(f("q=materia-6"))).itens.map((p) => p.id)).toEqual([id(6)]); // pelo endereço
    expect((await listarPosts(f("q=%25"))).total).toBe(0); // % não vira curinga
    const comFiltro = await listarPosts(f("tipo=news&status=draft"));
    expect(comFiltro.contagens).toMatchObject({ todos: 5, draft: 1, published: 3, scheduled: 1 });
  });

  it("ordena (recentes, antigas, mais vistas) e pagina em 25", async () => {
    expect((await listarPosts(f("status=published&ordem=vistas"))).itens[0].id).toBe(id(1));
    expect((await listarPosts(f("status=published&ordem=recentes"))).itens[0].id).toBe(id(2));
    expect((await listarPosts(f("status=published&ordem=antigos"))).itens[0].id).toBe(id(1));
    for (let n = 100; n < 130; n++) await exec("INSERT INTO posts (id, post_type, slug, status, title, content_html, published_at, created_at, updated_at) VALUES (?, 'news', ?, 'published', 'x', '<p>x</p>', '2026-10-01', '2026-10-01', '2026-10-01')", [id(n), `m-${n}`]);
    const p2 = await listarPosts(f("pagina=2"));
    expect(p2).toMatchObject({ pagina: 2, paginas: 2, total: 36 });
    expect(p2.itens).toHaveLength(36 - POR_PAGINA);
    expect((await listarPosts(f("pagina=99"))).pagina).toBe(2); // passou do fim: vai para a última
    await exec("DELETE FROM posts WHERE slug LIKE 'm-%'");
  });
});

describe("excluir", () => {
  it("só apaga rascunhos (com os vínculos); publicado e agendado ficam, ids estranhos são ignorados", async () => {
    const n = await excluirRascunhos([id(4), id(1), id(6), "'; DROP TABLE posts; --", id(4)]);
    expect(n).toBe(1);
    const restam = await query<{ id: string }>("SELECT id FROM posts ORDER BY id");
    expect(restam.map((r) => r.id)).toEqual([id(1), id(2), id(3), id(5), id(6)]);
    expect(await excluirRascunhos([])).toBe(0);
    expect(await excluirRascunhos([id(1)])).toBe(0); // publicado: nada
  });
});
