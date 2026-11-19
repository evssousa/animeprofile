// Dados do topo com banco: sugestões da busca (animes, matérias, quizzes), painel "Agora" e a faixa da equipe em /api/eu.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { clearCache } from "~/server/cache.server";
import { createPool, exec, setPool } from "~/server/db.server";
import { hashPassword, login, resetLoginLimits } from "~/server/admin/auth.server";
import { agora, sugestoes } from "~/server/topo.server";
import { loader as eu } from "~/routes/api.eu";
import { diaBrasilia } from "~/visitas/core/dia";
import { visitantesHoje } from "~/visitas/server/consultas.server";

let server: Awaited<ReturnType<typeof createDB>>;
const AGORA = new Date("2026-11-19T18:00:00Z"); // 15h em Brasília

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });

  await exec("INSERT INTO anime_catalog (anilist_id, title, title_english, format, season_year, popularity, is_adult) VALUES (1, 'One Piece', NULL, 'TV', 1999, 900, 0), (2, 'Frieren', 'Frieren: Beyond Journey''s End', 'TV', 2023, 500, 0), (3, 'One Adulto', NULL, 'TV', 2020, 999, 1)");
  await exec("INSERT INTO anime_airing (anilist_id, episode, airing_at) VALUES (1, 1100, '2026-11-19 21:00:00'), (2, 30, '2026-11-19 12:00:00'), (2, 31, '2026-11-20 15:00:00')");
  const post = (id: string, slug: string, titulo: string, pub: string) =>
    exec("INSERT INTO posts (id, post_type, slug, status, title, content_html, published_at, created_at, updated_at) VALUES (?, 'news', ?, 'published', ?, '<p>x</p>', ?, ?, ?)", [id, slug, titulo, pub, pub, pub]);
  await post("pppppppp-0000-4000-8000-000000000001", "one-piece-novo", "One Piece volta com capítulo especial", "2026-11-19 16:30:00");
  await post("pppppppp-0000-4000-8000-000000000002", "frieren", "Frieren ganha trailer", "2026-11-18 10:00:00");
  await exec("INSERT INTO quizzes (id, slug, title, kind, data, questions_count, status, published_at) VALUES ('qqqqqqqq-0000-4000-8000-000000000001', 'qual-one-piece', 'Qual personagem de One Piece é você?', 'personalidade', '{}', 5, 'published', '2026-11-01 10:00:00'), ('qqqqqqqq-0000-4000-8000-000000000002', 'rascunho-one', 'One rascunho', 'personalidade', '{}', 5, 'draft', NULL)");
  await exec("INSERT INTO visit_daily (day, pageviews, entries, visitors) VALUES (?, 300, 100, 1234)", [diaBrasilia()]);

  Object.assign(process.env, { ADMIN_EMAIL: "dono@exemplo.com", ADMIN_PASSWORD_HASH: await hashPassword("uma senha bem comprida 123"), SESSION_SECRET: "t".repeat(40) });
});
afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("sugestões da busca", () => {
  it("acha anime (só do banco, sem adulto), matérias publicadas e quizzes publicados", async () => {
    clearCache();
    const s = await sugestoes("One");
    expect(s.animes.map((a) => a.titulo)).toEqual(["One Piece"]);
    expect(s.animes[0]).toMatchObject({ url: "/animes/1", info: "1999 · TV" });
    expect(s.posts.map((p) => p.titulo)).toEqual(["One Piece volta com capítulo especial"]);
    expect(s.quizzes.map((z) => z.titulo)).toEqual(["Qual personagem de One Piece é você?"]); // o rascunho fica de fora
  });

  it("procura também pelo título em inglês e ignora % e _ do termo", async () => {
    clearCache();
    expect((await sugestoes("beyond journey")).animes.map((a) => a.id)).toEqual([2]);
    const curinga = await sugestoes("%%");
    expect(curinga.animes).toEqual([]);
  });

  it("com menos de 2 letras devolve só as tags em alta (nada de consulta pesada)", async () => {
    clearCache();
    const s = await sugestoes("o");
    expect(s).toMatchObject({ animes: [], posts: [], quizzes: [] });
    expect(Array.isArray(s.emAlta)).toBe(true);
  });
});

describe('painel "Agora"', () => {
  it("mostra a última notícia e só os episódios que ainda vão ao ar hoje (a partir de agora)", async () => {
    clearCache();
    const a = await agora(AGORA);
    expect(a.noticias[0].titulo).toBe("One Piece volta com capítulo especial");
    expect(a.amanha).toBe(false);
    expect(a.noAr.map((e) => [e.titulo, e.episodio, e.horario])).toEqual([["One Piece", 1100, "18:00"]]); // o ep. das 9h de Brasília já passou
    expect(a.hoje).toBe(1);
  });

  it("sem episódios restantes hoje, mostra os de amanhã", async () => {
    clearCache();
    const a = await agora(new Date("2026-11-20T01:30:00Z")); // 22h30 de 19/11 em Brasília: nada mais hoje
    expect(a.amanha).toBe(true);
    expect(a.noAr.map((e) => e.titulo)).toEqual(["Frieren"]);
  });
});

describe("faixa da equipe em /api/eu", () => {
  const req = (cookie?: string) => new Request("https://animeprofile.com.br/api/eu", { headers: cookie ? { cookie } : {} });
  const chamar = (r: Request) => eu({ request: r } as never) as Promise<Response>;

  it("visitantes de hoje vêm de uma consulta só", async () => {
    expect(await visitantesHoje(diaBrasilia())).toBe(1234);
    expect(await visitantesHoje("2000-01-01")).toBe(0);
  });

  it("admin recebe `painel` (robô e visitas); sem sessão, nem o marcador forjado recebe", async () => {
    resetLoginLimits();
    const r = await login(new Request("https://animeprofile.com.br/login", { method: "POST", headers: { "x-forwarded-for": "9.9.9.9" } }), "dono@exemplo.com", "uma senha bem comprida 123");
    if (!r.ok) throw new Error("login falhou");
    const sessao = r.cookies[0].split(";")[0];
    const admin = await (await chamar(req(`${sessao}; ap_logado=admin`))).json();
    expect(admin.painel).toMatchObject({ visitasHoje: 1234, robo: { teto: 10 } });
    const forjado = await (await chamar(req("ap_logado=admin"))).json();
    expect(forjado).toEqual({ logado: false });
  });
});
