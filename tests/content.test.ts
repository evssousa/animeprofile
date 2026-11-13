// Conteúdo: importação do retrato do site antigo e as consultas das páginas.
import { createDB } from "mysql-memory-server";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { redirectFor } from "../redirects.mjs";
import { createPool, setPool } from "~/server/db.server";
import { applySnapshot, mapPost, validateSnapshot, type OldSnapshot } from "~/server/content/import-old.server";
import { readingMinutes, sanitizePostHtml } from "~/server/content/sanitize.server";
import { isWideImage } from "~/lib/images";
import { getPost, getTag, latestPosts, listCategories, listPosts, mostRead, relatedPosts, trendingTags } from "~/server/content/posts.server";

let server: Awaited<ReturnType<typeof createDB>>;
let pool: mysql.Pool;
const env = { ...process.env };

const now = Date.now();
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

// O retrato do "site antigo", como o script de exportação envia.
const OLD: Record<string, unknown[]> = {
  posts: [
    { id: "00000000-0000-4000-8000-000000000001", slug: "sakamoto-days-arco-final", post_type: "news", status: "published", title: "SAKAMOTO DAYS entra no arco final", excerpt: "O mangá chega ao clímax.", content: { html: '<p>Texto <script>alert(1)</script><a href="https://jump.example/x">fonte</a></p><iframe src="https://www.youtube.com/embed/abc"></iframe><iframe src="https://evil.example/x"></iframe>' }, featured_image: "https://img.example/s.webp", image_width: 1600, image_height: 900, author_id: null, ai_author_id: "a0000000-0000-4000-8000-000000000001", is_ai_generated: true, anilist_id: 1, focus_keyword: "sakamoto days", views_count: 50, published_at: ago(1), created_at: ago(2), updated_at: ago(1) },
    { id: "00000000-0000-4000-8000-000000000002", slug: "onde-assistir-jujutsu-kaisen", post_type: "article", status: "published", title: "Onde assistir Jujutsu Kaisen", excerpt: "Guia completo de streaming.", content: { html: "<p>" + "palavra ".repeat(900) + "</p>" }, featured_image: null, author_id: "u0000000-0000-4000-8000-000000000001", ai_author_id: null, is_ai_generated: false, anilist_id: null, focus_keyword: null, views_count: 900, published_at: ago(3), created_at: ago(3), updated_at: ago(3) },
    { id: "00000000-0000-4000-8000-000000000003", slug: "bleach-arte-ichigo", post_type: "news", status: "published", title: "Bleach: arte inédita de Ichigo", excerpt: "Tite Kubo compartilha ilustração.", content: { html: "<p>Ichigo</p>" }, featured_image: "https://img.example/b.webp", image_width: 800, image_height: 450, author_id: null, ai_author_id: "a0000000-0000-4000-8000-000000000001", is_ai_generated: true, anilist_id: null, focus_keyword: null, views_count: 10, published_at: ago(2), created_at: ago(2), updated_at: ago(2) },
    { id: "00000000-0000-4000-8000-000000000004", slug: "materia-do-futuro", post_type: "news", status: "published", title: "Agendada", excerpt: null, content: { html: "<p>x</p>" }, featured_image: null, author_id: null, ai_author_id: null, is_ai_generated: false, anilist_id: null, focus_keyword: null, views_count: 0, published_at: new Date(now + 86_400_000).toISOString(), created_at: ago(1), updated_at: ago(1) },
  ],
  categories: [
    { id: "c0000000-0000-4000-8000-000000000001", name: "Animes e Mangás", slug: "animes-e-mangas", kind: "news", description: null, color: null },
    { id: "c0000000-0000-4000-8000-000000000002", name: "Onde Assistir", slug: "onde-assistir", kind: "article", description: "Guias de streaming.", color: null },
  ],
  tags: [
    { id: "t0000000-0000-4000-8000-000000000001", name: "Bleach", slug: "bleach" },
    { id: "t0000000-0000-4000-8000-000000000002", name: "Jump", slug: "jump" },
  ],
  ai_news_authors: [{ id: "a0000000-0000-4000-8000-000000000001", name: "Lia", slug: "lia", avatar_url: null, signature: "Redação de games." }],
  post_categories: [
    { post_id: "00000000-0000-4000-8000-000000000001", category_id: "c0000000-0000-4000-8000-000000000001" },
    { post_id: "00000000-0000-4000-8000-000000000003", category_id: "c0000000-0000-4000-8000-000000000001" },
    { post_id: "00000000-0000-4000-8000-000000000002", category_id: "c0000000-0000-4000-8000-000000000002" },
  ],
  post_tags: [
    { post_id: "00000000-0000-4000-8000-000000000003", tag_id: "t0000000-0000-4000-8000-000000000001" },
    { post_id: "00000000-0000-4000-8000-000000000001", tag_id: "t0000000-0000-4000-8000-000000000002" },
    { post_id: "00000000-0000-4000-8000-000000000003", tag_id: "t0000000-0000-4000-8000-000000000002" },
  ],
  tag_redirects: [{ old_slug: "bleach-anime", tag_id: "t0000000-0000-4000-8000-000000000001" }],
  profiles: [{ id: "u0000000-0000-4000-8000-000000000001", username: "redacao_ap", display_name: "Redação AP", avatar_url: null, bio: null }],
};

const importOld = () => applySnapshot(OLD as unknown as OldSnapshot);

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  pool = createPool({ ...config, connectionLimit: 4 });
  setPool(pool);
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
});

afterAll(async () => {
  process.env = env;
  setPool(undefined);
  await pool?.end();
  await server?.stop();
});

describe("limpeza do HTML", () => {
  it("tira script e iframe de fora, mantém YouTube e abre links externos em outra aba", () => {
    const html = sanitizePostHtml((OLD.posts[0] as { content: { html: string } }).content.html);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("evil.example");
    expect(html).toContain("youtube.com/embed/abc");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("calcula minutos de leitura", () => {
    expect(readingMinutes("<p>" + "a ".repeat(900) + "</p>")).toBe(5);
    expect(readingMinutes("<p>oi</p>")).toBe(1);
  });
  it("mapeia a matéria antiga: autor de IA tem prioridade, datas em UTC", () => {
    const row = mapPost(OLD.posts[0] as Parameters<typeof mapPost>[0]);
    expect(row.author_id).toBe("a0000000-0000-4000-8000-000000000001");
    expect(row.published_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});

describe("importação e consultas", () => {
  it("recusa retrato com formato errado", () => {
    expect(validateSnapshot({ posts: [] })).toBe(false);
    expect(validateSnapshot(OLD)).toBe(true);
  });

  it("importa tudo e pode rodar de novo sem duplicar", async () => {
    const first = await importOld();
    expect(first).toMatchObject({ materias: 4, categorias: 2, tags: 2, autores: 2, puladas: [] });
    const again = await importOld();
    expect(again).toMatchObject({ materias: 4 });
  });

  it("listas mostram só o que já foi publicado, da mais nova para a mais antiga", async () => {
    const all = await listPosts({}, 1, 10);
    expect(all.total).toBe(3);
    expect(all.items.map((p) => p.slug)).toEqual(["sakamoto-days-arco-final", "bleach-arte-ichigo", "onde-assistir-jujutsu-kaisen"]);
    expect((await listPosts({ type: "article" })).items.map((p) => p.url)).toEqual(["/artigos/onde-assistir-jujutsu-kaisen"]);
    expect(await getPost("materia-do-futuro")).toBeNull();
  });

  it("matéria completa: categorias, tags, autor e HTML limpo", async () => {
    const p = await getPost("sakamoto-days-arco-final");
    expect(p).toMatchObject({ url: "/noticias/sakamoto-days-arco-final", category: { slug: "animes-e-mangas" }, author: { name: "Lia", url: "/autores/lia" }, isAi: true });
    expect(p!.tags.map((t) => t.slug)).toEqual(["jump"]);
    expect(p!.html).not.toContain("<script");
    const related = await relatedPosts(p!, 4);
    expect(related[0].slug).toBe("bleach-arte-ichigo");
    const human = await getPost("onde-assistir-jujutsu-kaisen");
    expect(human!.author).toMatchObject({ name: "Redação AP", url: "/u/redacao_ap" });
    expect(human!.readingMinutes).toBe(5);
  });

  it("busca sem acento, mais lidas, categorias, tags em alta e redirecionamento de tag", async () => {
    expect((await listPosts({ search: "materia ICHIGO" })).total).toBe(0);
    expect((await listPosts({ search: "arte ichigo" })).items[0].slug).toBe("bleach-arte-ichigo");
    expect((await listPosts({ search: "manga" })).items.map((p) => p.slug)).toEqual(["sakamoto-days-arco-final"]);
    expect((await mostRead(1))[0].slug).toBe("onde-assistir-jujutsu-kaisen");
    expect((await listCategories("news")).map((c) => [c.slug, Number(c.total)])).toEqual([["animes-e-mangas", 2]]);
    expect((await trendingTags(5))[0]).toMatchObject({ slug: "jump" });
    expect(await getTag("bleach-anime")).toMatchObject({ redirectTo: "bleach" });
    expect((await latestPosts({ excludeIds: ["00000000-0000-4000-8000-000000000001"] }, 5)).length).toBe(2);
  });

  it("capas com resolução boa são reconhecidas para a capa grande", async () => {
    const [sakamoto, bleach] = await latestPosts({ type: "news" }, 2);
    expect([sakamoto.imageWidth, isWideImage(sakamoto)]).toEqual([1600, true]);
    expect([bleach.imageWidth, isWideImage(bleach)]).toEqual([800, false]);
    expect(isWideImage({ image: null, imageWidth: 2000 })).toBe(false);
  });

  it("o que sai do site antigo sai daqui também", async () => {
    const removed = OLD.posts.splice(2, 1);
    await importOld();
    expect(await getPost("bleach-arte-ichigo")).toBeNull();
    OLD.posts.splice(2, 0, ...removed);
  });
});

describe("redirecionamentos do que saiu", () => {
  it("leva cada endereço antigo para o lugar certo", () => {
    expect(redirectFor("/faca-parte")).toBe("/contato");
    expect(redirectFor("/clas/meu-cla")).toBe("/ranking");
    expect(redirectFor("/comunidades")).toBe("/feed");
    expect(redirectFor("/fig-battle/deck")).toBe("/figurinhas");
    expect(redirectFor("/en/news/algum-slug")).toBe("/noticias/algum-slug");
    expect(redirectFor("/en/quiz", "?x=1")).toBe("/quiz?x=1");
    expect(redirectFor("/en")).toBe("/");
    expect(redirectFor("/noticias/qualquer")).toBeNull();
    expect(redirectFor("/entrar")).toBeNull();
  });
});
