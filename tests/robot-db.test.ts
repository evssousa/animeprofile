// Robô de notícias (parte já feita): a importação do site antigo não apaga o que o robô publicou, e o spoiler sobrevive à limpeza.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, query, setPool } from "~/server/db.server";
import { applySnapshot, type OldSnapshot } from "~/server/content/import-old.server";
import { sanitizePostHtml } from "~/server/content/sanitize.server";

let server: Awaited<ReturnType<typeof createDB>>;
const U = "aaaaaaaa-0000-4000-8000-000000000001";
const snap = (n: number) =>
  ({
    posts: Array.from({ length: n }, (_, i) => ({
      id: `bbbbbbbb-0000-4000-8000-00000000000${i + 1}`, slug: `velha-${i + 1}`, post_type: "news", status: "published", title: `Velha ${i + 1}`, excerpt: "x", content: { html: "<p>texto</p>" },
      featured_image: null, author_id: U, ai_author_id: null, is_ai_generated: false, anilist_id: null, focus_keyword: null, views_count: 1,
      published_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    })),
    categories: [{ id: "c1", name: "Cat", slug: "cat", kind: "news", description: null, color: null }],
    tags: [{ id: "t1", name: "Tag", slug: "tag" }],
    ai_news_authors: [],
    profiles: [{ id: U, username: "ana", display_name: "Ana", avatar_url: null, bio: null }],
    post_categories: [{ post_id: "bbbbbbbb-0000-4000-8000-000000000001", category_id: "c1" }],
    post_tags: [{ post_id: "bbbbbbbb-0000-4000-8000-000000000001", tag_id: "t1" }],
    tag_redirects: [],
  }) as unknown as OldSnapshot;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
});

afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("importação com o robô ligado", () => {
  it("matéria do robô (e os vínculos dela) sobrevivem a uma nova importação; as do site antigo saem se sumirem", async () => {
    await applySnapshot(snap(2));
    await query(
      "INSERT INTO posts (id, post_type, slug, status, title, content_html, origin, published_at, created_at, updated_at) VALUES ('rrrrrrrr-0000-4000-8000-000000000001', 'news', 'do-robo', 'published', 'Do robô', '<p>x</p>', 'robo', NOW(3), NOW(3), NOW(3))",
    );
    await query("INSERT INTO post_categories (post_id, category_id) VALUES ('rrrrrrrr-0000-4000-8000-000000000001', 'c1')");
    await query("INSERT INTO post_tags (post_id, tag_id) VALUES ('rrrrrrrr-0000-4000-8000-000000000001', 't1')");

    await applySnapshot(snap(1)); // a matéria velha 2 saiu do site antigo
    const slugs = (await query<{ slug: string }>("SELECT slug FROM posts ORDER BY slug")).map((r) => r.slug);
    expect(slugs).toEqual(["do-robo", "velha-1"]);
    const [c] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM post_categories WHERE post_id = 'rrrrrrrr-0000-4000-8000-000000000001'");
    const [t] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM post_tags WHERE post_id = 'rrrrrrrr-0000-4000-8000-000000000001'");
    expect([Number(c.n), Number(t.n)]).toEqual([1, 1]);
    const [old] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM post_categories WHERE post_id = 'bbbbbbbb-0000-4000-8000-000000000001'");
    expect(Number(old.n)).toBe(1);
  });
  it("o spoiler (details) sobrevive à limpeza do HTML", () => {
    const html = sanitizePostHtml('<details class="spoiler-box"><summary>Spoiler</summary><p>Segredo</p></details><script>x()</script>');
    expect(html).toContain('<details class="spoiler-box">');
    expect(html).toContain("<summary>Spoiler</summary>");
    expect(html).not.toContain("script");
  });
});
