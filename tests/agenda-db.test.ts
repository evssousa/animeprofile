// Agenda semanal com banco: publica a matéria da semana, atualiza sem duplicar e mantém o autor da semana anterior.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, query, setPool } from "~/server/db.server";
import { publishWeeklyAgenda } from "~/server/agenda/agenda.server";

let server: Awaited<ReturnType<typeof createDB>>;
// Quarta, 15/10/2026 12:00 em Brasília: a semana vai de 12/10 a 18/10.
const NOW = new Date("2026-10-15T15:00:00Z");
const WEEK_MS = 7 * 24 * 3600 * 1000;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  await query("INSERT INTO categories (id, name, slug, kind) VALUES ('cat-anime', 'Animes e Mangás', 'animes-e-mangas', 'news')");
  await query("INSERT INTO post_authors (id, kind, slug, name) VALUES ('aaaaaaaa-1111-4000-8000-000000000001', 'ai', 'maria', 'Maria')");
});

afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

const anime = (id: number, title: string, airing: string, episode: number, popularity: number) =>
  query(
    `INSERT INTO anime_catalog (anilist_id, title, banner_url, status, popularity, next_episode, next_airing_at, streamers, is_adult)
     VALUES (?, ?, ?, 'RELEASING', ?, ?, ?, '["crunchyroll","netflix"]', 0)`,
    [id, title, `https://img.invalid/${id}.jpg`, popularity, episode, airing],
  );

describe("agenda semanal com banco", () => {
  it("com poucos episódios, não publica nada", async () => {
    await anime(1, "Anime 1", "2026-10-16 15:00:00", 2, 900);
    await anime(2, "Anime 2", "2026-10-17 15:00:00", 3, 800);
    expect(await publishWeeklyAgenda(NOW)).toMatchObject({ pulou: expect.stringContaining("poucos episódios") });
    expect(await query("SELECT 1 FROM posts WHERE slug LIKE 'agenda-de-animes-%'")).toHaveLength(0);
  });

  it("publica a matéria da semana, na categoria de animes, com as tags e o autor", async () => {
    for (let i = 3; i <= 7; i++) await anime(i, `Anime ${i}`, `2026-10-${12 + (i % 7)} 15:00:00`, i, 1000 - i);
    const out = await publishWeeklyAgenda(NOW);
    expect(out).toMatchObject({ criada: "agenda-de-animes-12-10-a-18-10-2026", episodios: 7 });
    const [p] = await query<{ id: string; status: string; origin: string; title: string; author_id: string; content_html: string; post_type: string }>(
      "SELECT id, status, origin, title, author_id, content_html, post_type FROM posts WHERE slug = 'agenda-de-animes-12-10-a-18-10-2026'",
    );
    expect(p).toMatchObject({ status: "published", origin: "robo", post_type: "news", author_id: "aaaaaaaa-1111-4000-8000-000000000001" });
    expect(p.title).toBe("Agenda de animes da semana: episódios de 12/10 a 18/10");
    expect(p.content_html).toContain('<a href="/animes/1">Anime 1</a>');
    expect(p.content_html).toContain("Crunchyroll, Netflix");
    expect(await query("SELECT c.slug FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = ?", [p.id])).toEqual([{ slug: "animes-e-mangas" }]);
    const tags = await query<{ slug: string }>("SELECT t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.slug", [p.id]);
    expect(tags.map((t) => t.slug)).toEqual(["agenda-da-semana", "lancamentos"]);
  });

  it("rodar de novo na mesma semana atualiza a matéria, sem duplicar", async () => {
    await anime(8, "Anime novo", "2026-10-18 20:00:00", 1, 5000);
    const out = await publishWeeklyAgenda(NOW);
    expect(out).toMatchObject({ atualizada: "agenda-de-animes-12-10-a-18-10-2026", episodios: 8 });
    expect(await query("SELECT 1 FROM posts WHERE slug = 'agenda-de-animes-12-10-a-18-10-2026'")).toHaveLength(1);
    const [p] = await query<{ content_html: string }>("SELECT content_html FROM posts WHERE slug = 'agenda-de-animes-12-10-a-18-10-2026'");
    expect(p.content_html).toContain("Anime novo");
  });

  it("a semana seguinte é outra matéria, com o mesmo autor", async () => {
    const out = await publishWeeklyAgenda(new Date(NOW.getTime() + WEEK_MS));
    expect(out).toMatchObject({ criada: "agenda-de-animes-19-10-a-25-10-2026" });
    const rows = await query<{ slug: string; author_id: string }>("SELECT slug, author_id FROM posts WHERE slug LIKE 'agenda-de-animes-%' ORDER BY slug");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.author_id)).size).toBe(1);
  });
});
