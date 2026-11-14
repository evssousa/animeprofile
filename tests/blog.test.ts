// Blog: Markdown seguro, importação, listas, post promovido, sitemap e RSS (MySQL descartável).
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { stripMarkdown } from "~/lib/blog";
import { createPool, query, setPool } from "~/server/db.server";
import { applySnapshot, type OldSnapshot } from "~/server/content/import-old.server";
import { markdownToHtml } from "~/server/blog/markdown.server";
import { blogAuthor, blogComments, blogSidebar, blogTaxonomy, getBlogPost, listBlogPosts, relatedBlogPosts } from "~/server/blog/blog.server";
import { blogRss, sitemapBlog } from "~/server/seo/feeds.server";

let server: Awaited<ReturnType<typeof createDB>>;
const env = { ...process.env };

const U1 = "aaaaaaaa-0000-4000-8000-000000000001";
const U2 = "aaaaaaaa-0000-4000-8000-000000000002";
const post = (n: number, author: string, extra: object = {}) => ({
  id: `bbbbbbbb-0000-4000-8000-00000000000${n}`, author_id: author, slug: `post-${n}`, title: `Post número ${n}`, content: `# Título\n\nTexto **forte** ${n}\nsegunda linha`,
  excerpt: "Um **resumo**", cover_url: null, focus_keyword: null, status: "published", promoted_post_id: null, views_count: n * 10, likes_count: n, claps_count: 0,
  bookmarks_count: 0, comments_count: n === 2 ? 5 : 0, quality_score: 0, published_at: `2026-01-0${n}T00:00:00Z`, created_at: `2026-01-0${n}T00:00:00Z`, updated_at: `2026-01-0${n}T00:00:00Z`, ...extra,
});
const base = (blog: object): OldSnapshot =>
  ({
    posts: [], categories: [], tags: [], ai_news_authors: [], post_categories: [], post_tags: [], tag_redirects: [],
    profiles: [
      { id: U1, username: "ana", display_name: "Ana", avatar_url: null, bio: null },
      { id: U2, username: "beto", display_name: "Beto", avatar_url: null, bio: null },
    ],
    ...blog,
  }) as unknown as OldSnapshot;

const full = {
  blog_posts: [post(1, U1), post(2, U1, { promoted_post_id: "pppppppp-0000-4000-8000-000000000001" }), post(3, U2), post(4, U2, { content: ["nao", "texto"] })],
  blog_categories: [{ id: "c1", user_id: U1, name: "Opinião", slug: "opiniao" }, { id: "c2", user_id: U2, name: "Opiniões", slug: "opiniao" }],
  blog_tags: [{ id: "t1", user_id: U1, name: "Shonen", slug: "shonen" }],
  blog_post_categories: [{ blog_post_id: post(1, U1).id, category_id: "c1" }, { blog_post_id: post(3, U2).id, category_id: "c2" }],
  blog_post_tags: [{ blog_post_id: post(1, U1).id, tag_id: "t1" }, { blog_post_id: post(3, U2).id, tag_id: "t1" }],
  blog_post_comments: [
    { id: "k1", blog_post_id: post(1, U1).id, author_id: U2, parent_id: null, content: "Legal!", created_at: "2026-02-01T00:00:00Z" },
    { id: "k2", blog_post_id: post(1, U1).id, author_id: U1, parent_id: "k1", content: "Obrigada", created_at: "2026-02-02T00:00:00Z" },
    { id: "k3", blog_post_id: post(1, U1).id, author_id: "desconhecido", parent_id: null, content: "x", created_at: "2026-02-02T00:00:00Z" },
  ],
};

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
});

afterAll(async () => {
  process.env = env;
  setPool(undefined);
  await server?.stop();
});

describe("markdown", () => {
  it("HTML cru vira texto e links/imagens ficam seguros", () => {
    const html = markdownToHtml('# Oi\n\n<script>alert(1)</script>\n\n<iframe src="https://x.com"></iframe>\n\n[ext](https://outro.com) [int](https://animeprofile.com.br/x)\n\n![](javascript:alert(1))\n\nlinha 1\nlinha 2');
    expect(html).not.toMatch(/<script|<iframe|javascript:/i);
    expect(html).toContain("&lt;script");
    expect(html).toContain("<h2>Oi</h2>");
    expect(html).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(html).toMatch(/<a href="https:\/\/animeprofile\.com\.br\/x">int<\/a>/);
    expect(html).toContain("<br />");
  });
  it("stripMarkdown deixa só o texto", () => {
    expect(stripMarkdown("# Oi **mundo** [link](http://x.com) ~~x~~")).toBe("Oi mundo link x");
  });
});

describe("importação e leitura", () => {
  it("grava posts, ligações, comentários e autores; pula conteúdo inválido", async () => {
    const r = await applySnapshot(base(full));
    expect(r).toMatchObject({ blogPosts: 3, blogComentarios: 2 });
    expect(r.blogPulados).toHaveLength(1);
    const [a] = await query<{ kind: string }>("SELECT kind FROM post_authors WHERE slug = 'ana'");
    expect(a.kind).toBe("user");
    const p = await getBlogPost("post-1");
    expect(p).toMatchObject({ url: "/blog/ana/post-1", excerpt: "Um resumo", categories: [{ slug: "opiniao" }], tags: [{ slug: "shonen" }] });
    expect(p!.html).toContain("<h2");
    expect((await blogComments(p!.id))[0].replies).toHaveLength(1);
  });

  it("lista com ordem, busca, categoria juntando autores e autor", async () => {
    expect((await listBlogPosts({ order: "recentes" })).items.map((i) => i.slug)).toEqual(["post-3", "post-2", "post-1"]);
    expect((await listBlogPosts({ order: "comentados" })).items[0].slug).toBe("post-2");
    expect((await listBlogPosts({ q: "beto" })).items.map((i) => i.slug)).toEqual(["post-3"]);
    expect((await listBlogPosts({ categorySlug: "opiniao" })).total).toBe(2);
    expect((await listBlogPosts({ authorSlug: "ana" })).total).toBe(2);
    expect(await blogTaxonomy("categoria", "opiniao")).toMatchObject({ total: 2 });
    expect(await blogTaxonomy("tag", "nao-existe")).toBeNull();
    expect((await blogAuthor("ana"))?.categories[0]).toMatchObject({ slug: "opiniao", total: 1 });
    expect(await blogAuthor("ninguem")).toBeNull();
    expect((await blogSidebar()).mostRead[0].slug).toBe("post-3");
    const p1 = (await getBlogPost("post-1"))!;
    expect((await relatedBlogPosts(p1, 3))[0].slug).toBe("post-3");
  });

  it("post promovido só aponta para o artigo se ele estiver publicado", async () => {
    expect((await getBlogPost("post-2"))!.promotedArticleSlug).toBeNull();
    await query(
      "INSERT INTO posts (id, post_type, slug, status, title, content_html, published_at, created_at, updated_at) VALUES ('pppppppp-0000-4000-8000-000000000001', 'article', 'o-artigo', 'published', 'Artigo', '<p>x</p>', '2026-01-01', '2026-01-01', '2026-01-01')",
    );
    expect((await getBlogPost("post-2"))!.promotedArticleSlug).toBe("o-artigo");
    await query("DELETE FROM posts WHERE id = 'pppppppp-0000-4000-8000-000000000001'");
  });

  it("sitemap sem promovidos e RSS válido", async () => {
    const xml = await sitemapBlog();
    expect(xml).toContain("/blog/ana/post-1</loc>");
    expect(xml).not.toContain("post-2");
    expect(xml.match(/\/blog\/u\/ana</g)).toHaveLength(1);
    const rss = (await blogRss())!;
    expect(rss).toContain("<link>https://");
    expect(rss).toContain("/blog/beto/post-3</link>");
    expect(await blogRss("ana")).toContain("Blog de Ana");
    expect(await blogRss("ninguem")).toBeNull();
  });

  it("reimportar sem um post apaga o post e as ligações", async () => {
    await applySnapshot(base({ ...full, blog_posts: [post(1, U1)], blog_post_comments: [] }));
    expect((await listBlogPosts()).total).toBe(1);
    const [l] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM blog_post_tags");
    expect(Number(l.n)).toBe(1);
  });
});
