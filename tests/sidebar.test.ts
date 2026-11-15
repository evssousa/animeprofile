// Barras laterais: cache em memória, consultas novas e os blocos de cada página (MySQL descartável).
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { SIDEBAR_PRESETS } from "~/lib/sidebar";
import { createPool, setPool } from "~/server/db.server";
import { cached, clearCache } from "~/server/cache.server";
import { applySnapshot, type OldSnapshot } from "~/server/content/import-old.server";
import { categoriesOfTag, mostCommentedSince, relatedTags } from "~/server/content/posts.server";
import { loadSidebar } from "~/server/sidebar.server";

let server: Awaited<ReturnType<typeof createDB>>;

const U = "aaaaaaaa-0000-4000-8000-000000000001";
const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
const post = (n: number, type: "news" | "article", extra: object = {}) => ({
  id: `bbbbbbbb-0000-4000-8000-00000000000${n}`, slug: `materia-${n}`, post_type: type, status: "published", title: `Matéria ${n}`, excerpt: "resumo",
  content: { html: "<h2>Parte</h2><p>texto</p>" }, featured_image: n % 2 ? `https://img.test/${n}.jpg` : null, author_id: U, ai_author_id: null, is_ai_generated: false,
  anilist_id: n <= 3 ? 20 : null, focus_keyword: null, views_count: n * 100, published_at: day(n), created_at: day(n), updated_at: day(n), ...extra,
});
const snap = {
  posts: [1, 2, 3, 4, 5, 6].map((n) => post(n, n === 6 ? "article" : "news")),
  categories: [{ id: "c1", name: "Lançamentos", slug: "lancamentos", kind: "news", description: null, color: null }, { id: "c2", name: "Games", slug: "games", kind: "news", description: null, color: null }],
  tags: [{ id: "t1", name: "Naruto", slug: "naruto" }, { id: "t2", name: "Shonen", slug: "shonen" }, { id: "t3", name: "Rara", slug: "rara" }],
  ai_news_authors: [],
  profiles: [{ id: U, username: "ana", display_name: "Ana", avatar_url: null, bio: null }],
  post_categories: [1, 2, 3, 4].map((n) => ({ post_id: post(n, "news").id, category_id: n === 4 ? "c2" : "c1" })),
  post_tags: [
    ...[1, 2, 3].flatMap((n) => [{ post_id: post(n, "news").id, tag_id: "t1" }, { post_id: post(n, "news").id, tag_id: "t2" }]),
    { post_id: post(4, "news").id, tag_id: "t3" },
  ],
  tag_redirects: [],
  post_comments: [
    { id: "k1", post_id: post(2, "news").id, author_id: U, parent_id: null, content: "a", created_at: day(1) },
    { id: "k2", post_id: post(2, "news").id, author_id: U, parent_id: null, content: "b", created_at: day(1) },
    { id: "k3", post_id: post(3, "news").id, author_id: U, parent_id: null, content: "c", created_at: day(60) },
  ],
} as unknown as OldSnapshot;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  await applySnapshot(snap);
});

afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("cache", () => {
  it("guarda dentro do TTL, junta pedidos iguais e não guarda erro", async () => {
    vi.useFakeTimers();
    clearCache();
    const fn = vi.fn(async () => Math.random());
    const [a, b] = await Promise.all([cached("k", 1000, fn), cached("k", 1000, fn)]);
    expect(a).toBe(b);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await cached("k", 1000, fn)).toBe(a);
    vi.advanceTimersByTime(1500);
    await cached("k", 1000, fn);
    expect(fn).toHaveBeenCalledTimes(2);
    await expect(cached("e", 1000, async () => Promise.reject(new Error("x")))).rejects.toThrow();
    expect(await cached("e", 1000, async () => 7)).toBe(7);
    clearCache();
    await cached("k", 1000, fn);
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
  it("passa de 300 chaves e a mais antiga sai", async () => {
    clearCache();
    const fn = vi.fn(async () => 1);
    for (let i = 0; i < 301; i++) await cached(`c${i}`, 60_000, fn);
    await cached("c0", 60_000, fn);
    expect(fn).toHaveBeenCalledTimes(302);
  });
});

describe("consultas", () => {
  it("mais comentadas conta só a janela", async () => {
    const r = await mostCommentedSince(30, 5);
    expect(r.map((p) => [p.slug, p.comments])).toEqual([["materia-2", 2]]);
  });
  it("tags relacionadas ignoram a própria tag e as de 1 aparição", async () => {
    expect((await relatedTags({ tagId: "t1" }, 14, "t1")).map((t) => t.slug)).toEqual(["shonen"]);
    expect((await relatedTags({ categoryId: "c1" }, 14)).map((t) => t.slug).sort()).toEqual(["naruto", "shonen"]);
  });
  it("categorias da tag", async () => {
    expect((await categoriesOfTag("t1", 6)).map((c) => c.slug)).toEqual(["lancamentos"]);
  });
});

describe("blocos", () => {
  it("todo bloco dos presets é tratado e a matéria aberta nunca aparece", async () => {
    clearCache();
    const now = new Date();
    for (const page of Object.keys(SIDEBAR_PRESETS) as (keyof typeof SIDEBAR_PRESETS)[]) {
      const blocks = await loadSidebar(page, { now, type: "news", excludeId: post(1, "news").id, anilistId: 20, categoryId: "c1", categorySlug: "lancamentos", toc: [{ id: "a", text: "A" }, { id: "b", text: "B" }] });
      for (const b of page === "materia" ? blocks : []) {
        if (b.kind === "posts") expect(b.items.some((p) => p.id === post(1, "news").id)).toBe(false);
        if (b.kind === "featured") expect(b.post.id).not.toBe(post(1, "news").id);
      }
    }
    const mat = await loadSidebar("materia", { now, type: "news", excludeId: post(1, "news").id, anilistId: 20, toc: [{ id: "a", text: "A" }, { id: "b", text: "B" }] });
    expect(mat.map((b) => b.key)).toEqual(["anime", "destaque", "ultimas", "comentarios", "indice", "emAlta"]);
    const anime = mat[0];
    expect(anime.kind === "anime" && anime.guide.map((g) => g.url)).not.toContain(`/noticias/materia-1`);
  });
  it("a central tira os blocos vazios (sem blog nem comentários do mês, só os que têm dados)", async () => {
    const blocks = await loadSidebar("central", { now: new Date(), type: undefined });
    const keys = blocks.map((b) => b.key);
    expect(keys).toContain("maisLidasMes");
    expect(keys).not.toContain("doBlog");
    expect(blocks.every((b) => (b.kind === "posts" ? b.items.length > 0 : true))).toBe(true);
  });
});
