// Conteúdo: importação do retrato do site antigo e as consultas das páginas.
import { createDB } from "mysql-memory-server";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { redirectFor, redirectInfo } from "../redirects.mjs";
import { createPool, setPool } from "~/server/db.server";
import { applySnapshot, mapPost, validateSnapshot, type OldSnapshot } from "~/server/content/import-old.server";
import { readingMinutes, sanitizePostHtml } from "~/server/content/sanitize.server";
import { isWideImage } from "~/lib/images";
import { timeAgo } from "~/lib/format";
import { findVideo, listAnimeVideos, listPostVideos, listShelves, youtubeIds } from "~/server/tv/tv.server";
import { rssFeed, sitemapArticles, sitemapIndex, sitemapNews, sitemapStatic, sitemapTaxonomy } from "~/server/seo/feeds.server";
import { getPost, getTag, latestComments, latestPosts, postComments, withToc, listCategories, listPosts, mostRead, relatedPosts, trendingTags } from "~/server/content/posts.server";

let server: Awaited<ReturnType<typeof createDB>>;
let pool: mysql.Pool;
const env = { ...process.env };

const now = Date.now();
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

// O retrato do "site antigo", como o script de exportação envia.
const OLD: Record<string, unknown[]> = {
  posts: [
    { id: "00000000-0000-4000-8000-000000000001", slug: "sakamoto-days-arco-final", post_type: "news", status: "published", title: "SAKAMOTO DAYS entra no arco final", excerpt: "O mangá chega ao clímax.", content: { html: '<p>Texto <script>alert(1)</script><a href="https://jump.example/x">fonte</a></p><iframe src="https://www.youtube.com/embed/AAAAAAAAAAA"></iframe><iframe src="https://www.youtube.com/embed/BBBBBBBBBBB"></iframe><iframe src="https://evil.example/x"></iframe>' }, featured_image: "https://img.example/s.webp", image_width: 1600, image_height: 900, author_id: null, ai_author_id: "a0000000-0000-4000-8000-000000000001", is_ai_generated: true, anilist_id: 1, focus_keyword: "sakamoto days", views_count: 50, published_at: ago(1), created_at: ago(2), updated_at: ago(1) },
    { id: "00000000-0000-4000-8000-000000000002", slug: "onde-assistir-jujutsu-kaisen", post_type: "article", status: "published", title: "Onde assistir Jujutsu Kaisen", excerpt: "Guia completo de streaming.", content: { html: "<p>" + "palavra ".repeat(900) + "</p>" }, featured_image: null, author_id: "u0000000-0000-4000-8000-000000000001", ai_author_id: null, is_ai_generated: false, anilist_id: null, focus_keyword: null, views_count: 900, published_at: ago(3), created_at: ago(3), updated_at: ago(3) },
    { id: "00000000-0000-4000-8000-000000000003", slug: "bleach-arte-ichigo", post_type: "news", status: "published", title: "Bleach: arte inédita de Ichigo", excerpt: "Tite Kubo compartilha ilustração.", content: { html: '<p>Ichigo</p><iframe src="https://www.youtube.com/embed/AAAAAAAAAAA"></iframe>' }, featured_image: "https://img.example/b.webp", image_width: 800, image_height: 450, author_id: null, ai_author_id: "a0000000-0000-4000-8000-000000000001", is_ai_generated: true, anilist_id: null, focus_keyword: null, views_count: 10, published_at: ago(2), created_at: ago(2), updated_at: ago(2) },
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
  profiles: [
    { id: "u0000000-0000-4000-8000-000000000001", username: "redacao_ap", display_name: "Redação AP", avatar_url: null, bio: null },
    { id: "u0000000-0000-4000-8000-000000000002", username: "kaiju", display_name: "Kaiju", avatar_url: null, bio: null },
  ],
  post_comments: [
    { id: "m0000000-0000-4000-8000-000000000001", post_id: "00000000-0000-4000-8000-000000000001", author_id: "u0000000-0000-4000-8000-000000000002", parent_id: null, content: "Que arco final!", created_at: ago(0.5) },
    { id: "m0000000-0000-4000-8000-000000000002", post_id: "00000000-0000-4000-8000-000000000001", author_id: "u0000000-0000-4000-8000-000000000001", parent_id: "m0000000-0000-4000-8000-000000000001", content: "Também acho.", created_at: ago(0.2) },
    { id: "m0000000-0000-4000-8000-000000000003", post_id: "00000000-0000-4000-8000-000000000004", author_id: "u0000000-0000-4000-8000-000000000002", parent_id: null, content: "Em matéria agendada", created_at: ago(0.1) },
  ],
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
    expect(html).toContain("youtube.com/embed/AAAAAAAAAAA");
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
    expect(first).toMatchObject({ materias: 4, categorias: 2, tags: 2, autores: 3, comentarios: 3, puladas: [] }); // autores: IA, a redação e quem comentou
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

  it("matéria editada no painel (edited_at) não é sobrescrita, apagada nem religada pela importação", async () => {
    await importOld();
    await pool.query("UPDATE posts SET title = 'Editado no painel', edited_at = UTC_TIMESTAMP(3) WHERE slug = 'bleach-arte-ichigo'");
    await pool.query("DELETE FROM post_tags WHERE post_id = '00000000-0000-4000-8000-000000000003'");
    await importOld();
    expect((await getPost("bleach-arte-ichigo"))?.title).toBe("Editado no painel");
    expect((await getPost("bleach-arte-ichigo"))?.tags).toEqual([]); // os vínculos dela não foram refeitos
    const removed = OLD.posts.splice(2, 1);
    await importOld();
    expect((await getPost("bleach-arte-ichigo"))?.title).toBe("Editado no painel"); // saiu do antigo, mas é do painel: fica
    OLD.posts.splice(2, 0, ...removed);
    await pool.query("UPDATE posts SET edited_at = NULL WHERE slug = 'bleach-arte-ichigo'");
    await importOld(); // volta ao normal
    expect((await getPost("bleach-arte-ichigo"))?.title).toBe("Bleach: arte inédita de Ichigo");
  });
});

describe("redirecionamentos do que saiu", () => {
  it("leva cada endereço antigo para o lugar certo", () => {
    expect(redirectFor("/faca-parte")).toBe("/contato");
    expect(redirectFor("/news")).toBe("/noticias");
    expect(redirectFor("/news", "?tipo=noticias&pagina=2")).toBe("/noticias?tipo=noticias&pagina=2");
    expect(redirectFor("/noticias")).toBeNull();
    expect(redirectFor("/noticias", "?tipo=blog")).toBe("/blog");
    expect(redirectFor("/news", "?tipo=blog&pagina=2")).toBe("/blog");
    expect(redirectFor("/noticias", "?tipo=noticias")).toBeNull();
    expect(redirectFor("/noticias/uma-materia")).toBeNull();
    expect(redirectFor("/clas/meu-cla")).toBe("/ranking");
    expect(redirectFor("/comunidades")).toBe("/feed");
    expect(redirectFor("/fig-battle/deck")).toBe("/figurinhas");
    expect(redirectFor("/en/news/algum-slug")).toBe("/noticias/algum-slug");
    expect(redirectFor("/en/quiz", "?x=1")).toBe("/quiz?x=1");
    expect(redirectFor("/en")).toBe("/");
    expect(redirectFor("/noticias/qualquer")).toBeNull();
    expect(redirectFor("/entrar")).toBeNull();
    expect(redirectFor("/privacidade")).toBe("/legal/privacidade");
    expect(redirectFor("/en/articles/algum-artigo")).toBe("/artigos/algum-artigo");
    expect(redirectInfo("/animes/ranking")).toEqual({ to: "/animes", status: 302 });
    expect(redirectInfo("/ajuda/123")).toEqual({ to: "/contato", status: 302 });
    expect(redirectInfo("/reportar-bug")).toEqual({ to: "/contato", status: 302 });
    expect(redirectInfo("/links")).toEqual({ to: "/", status: 302 });
    expect(redirectInfo("/privacidade")?.status).toBe(301);
  });
});

describe("sitemaps e RSS", () => {
  it("índice, páginas fixas, todas as matérias e Google News (só 48 h)", async () => {
    await importOld(); // o teste anterior tirou e devolveu uma matéria
    expect(sitemapIndex()).toContain("/sitemap-news.xml</loc>");
    expect(sitemapStatic()).toContain("/legal/termos</loc>");
    const all = await sitemapArticles();
    expect(all).toContain("/noticias/sakamoto-days-arco-final</loc>");
    expect(all).toContain("/artigos/onde-assistir-jujutsu-kaisen</loc>");
    expect(all).not.toContain("materia-do-futuro");
    const news = await sitemapNews();
    expect(news).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(news).toContain("sakamoto-days-arco-final"); // publicada há 1 dia
    expect(news).not.toContain("bleach-arte-ichigo"); // publicada há 2 dias: fora da janela de 48 h
  });

  it("taxonomia: categorias com matéria, tags com 3+ matérias e autores de IA", async () => {
    const tax = await sitemapTaxonomy();
    expect(tax).toContain("/categoria/animes-e-mangas</loc>");
    expect(tax).not.toContain("/tag/jump</loc>"); // só 2 matérias
    expect(tax).toContain("/autores/lia</loc>");
  });

  it("RSS com título, link e texto escapado", async () => {
    const rss = await rssFeed();
    expect(rss).toContain("<rss version=\"2.0\"");
    expect(rss).toContain("<title>SAKAMOTO DAYS entra no arco final</title>");
    expect(rss).not.toContain("Agendada");
  });
});

describe("comentários, índice e tempo relativo", () => {
  it("comentários da matéria com respostas, e os últimos só de matérias visíveis", async () => {
    const list = await postComments("00000000-0000-4000-8000-000000000001");
    expect(list.map((c) => [c.author.name, c.content, c.replies.map((r) => r.content)])).toEqual([["Kaiju", "Que arco final!", ["Também acho."]]]);
    const side = await latestComments("news", 5);
    expect(side.map((c) => c.content)).toEqual(["Também acho.", "Que arco final!"]); // o da matéria agendada fica de fora
    expect(side[0].post?.url).toBe("/noticias/sakamoto-days-arco-final");
  });
  it("índice com ids nos subtítulos, sem repetir", () => {
    const r = withToc('<p>a</p><h2>Onde assistir?</h2><p>b</p><h2 id="x">Onde assistir?</h2>');
    expect(r.toc).toEqual([{ id: "onde-assistir", text: "Onde assistir?" }, { id: "onde-assistir-2", text: "Onde assistir?" }]);
    expect(r.html).toContain('<h2 id="onde-assistir-2">');
  });
  it("tempo relativo", () => {
    const now = new Date("2026-11-14T12:00:00Z");
    expect(timeAgo("2026-11-14T11:59:30Z", now)).toBe("agora");
    expect(timeAgo("2026-11-14T11:30:00Z", now)).toBe("há 30 min");
    expect(timeAgo("2026-11-14T09:00:00Z", now)).toBe("há 3 h");
    expect(timeAgo("2026-11-13T09:00:00Z", now)).toBe("há 1 dia");
    expect(timeAgo("2026-09-01T12:00:00Z", now)).toBe("1 de set. de 2026");
  });
});

describe("Otaku TV: vídeos das matérias", () => {
  it("acha os ids do YouTube em embed, youtu.be e watch, sem repetir", () => {
    expect(youtubeIds('<iframe src="https://www.youtube.com/embed/AAAAAAAAAAA"></iframe> https://youtu.be/BBBBBBBBBBB https://www.youtube.com/watch?v=CCCCCCCCCCC <iframe src="https://www.youtube-nocookie.com/embed/AAAAAAAAAAA">')).toEqual(["AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC"]);
    expect(youtubeIds("<p>sem vídeo</p>")).toEqual([]);
  });

  it("a importação monta a lista: vídeo repetido aparece uma vez, na matéria mais nova, e agendada fica fora", async () => {
    await importOld();
    const all = await listPostVideos("", 1);
    expect(all.items.map((v) => [v.id, v.title])).toEqual([
      ["AAAAAAAAAAA", "SAKAMOTO DAYS entra no arco final"],
      ["BBBBBBBBBBB", "SAKAMOTO DAYS entra no arco final"],
    ]);
    expect(all.items[0]).toMatchObject({ postUrl: "/noticias/sakamoto-days-arco-final", subtitle: "Notícia" });
    // a busca é pelo título: o mesmo vídeo aparece na matéria do Ichigo, que também o tem
    expect((await listPostVideos("ichigo", 1)).items.map((v) => [v.id, v.title])).toEqual([["AAAAAAAAAAA", "Bleach: arte inédita de Ichigo"]]);
    expect((await listPostVideos("naoexiste", 1)).total).toBe(0);
    expect((await listPostVideos("sakamoto", 1)).total).toBe(2);
  });

  it("abre um vídeo pelo id (com a matéria) e ignora ids inválidos", async () => {
    expect(await findVideo("BBBBBBBBBBB")).toMatchObject({ title: "SAKAMOTO DAYS entra no arco final", postUrl: "/noticias/sakamoto-days-arco-final" });
    expect(await findVideo("ZZZZZZZZZZZ")).toBeNull();
    expect(await findVideo("curto")).toBeNull();
  });

  it("a grade só traz vídeos de matérias de anime e as fileiras não repetem vídeo nem quebram a consulta", async () => {
    const anime = await listAnimeVideos("", 1, 100);
    const todos = await listPostVideos("", 1, 100);
    expect(anime.total).toBeLessThanOrEqual(todos.total);
    const shelves = await listShelves();
    for (const s of shelves) expect(new Set(s.items.map((i) => i.id)).size).toBe(s.items.length);
    const naGrade = new Set(anime.items.map((i) => i.id));
    for (const s of shelves) for (const i of s.items) expect(naGrade.has(i.id)).toBe(false);
  });
});
