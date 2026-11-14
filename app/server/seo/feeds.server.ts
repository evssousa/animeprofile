// Sitemaps e RSS. Mesmos endereços e regras do site antigo (docs/enderecos.md):
//   /sitemap.xml           índice, aponta para os sitemaps abaixo
//   /sitemap-static.xml    páginas fixas
//   /sitemap-news.xml      formato Google News: só notícias das últimas 48 h
//   /sitemap-articles.xml  todas as notícias e artigos
//   /sitemap-taxonomy.xml  categorias com matéria, tags com 3+ matérias e autores de IA
//   /rss.xml               as 30 matérias mais recentes (novo; o site antigo não tinha RSS de notícias)
// Os sitemaps de animes, quiz, blog e perfis entram aqui quando essas áreas existirem no site novo.
import { SITE, absoluteUrl } from "~/lib/site";
import { hasDatabase, iso, query } from "../db.server";
import { VISIBLE, latestPosts, postUrl, type PostType } from "../content/posts.server";

export const xmlEscape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Páginas fixas que já existem no site novo. Cada área nova acrescenta a sua aqui. */
export const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/noticias", changefreq: "hourly", priority: "0.9" },
  { path: "/artigos", changefreq: "daily", priority: "0.8" },
  { path: "/sobre", changefreq: "monthly", priority: "0.6" },
  { path: "/contato", changefreq: "monthly", priority: "0.4" },
  { path: "/como-instalar", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/termos", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/privacidade", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/cookies", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/dmca", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/menores", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/padroes-editoriais", changefreq: "monthly", priority: "0.4" },
];

export const SITEMAPS = ["/sitemap-static.xml", "/sitemap-news.xml", "/sitemap-articles.xml", "/sitemap-taxonomy.xml"];

const urlset = (body: string[], extraNs = "") =>
  [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNs}>`, ...body, `</urlset>`].join("\n");

const url = (path: string, opts: { lastmod?: string | null; changefreq?: string; priority?: string } = {}) =>
  [
    "  <url>",
    `    <loc>${xmlEscape(absoluteUrl(path))}</loc>`,
    opts.lastmod ? `    <lastmod>${xmlEscape(opts.lastmod)}</lastmod>` : "",
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>` : "",
    opts.priority ? `    <priority>${opts.priority}</priority>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");

export function sitemapIndex(now = new Date()) {
  const lastmod = now.toISOString();
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...SITEMAPS.map((p) => `  <sitemap>\n    <loc>${xmlEscape(absoluteUrl(p))}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`),
    `</sitemapindex>`,
  ].join("\n");
}

export function sitemapStatic() {
  return urlset(STATIC_PAGES.map((p) => url(p.path, p)));
}

export async function sitemapArticles() {
  const rows = hasDatabase()
    ? await query<{ post_type: PostType; slug: string; updated_at: string | null; published_at: string }>(
        `SELECT p.post_type, p.slug, p.updated_at, p.published_at FROM posts p WHERE ${VISIBLE} ORDER BY p.published_at DESC LIMIT 50000`,
      )
    : [];
  return urlset(rows.map((r) => url(postUrl(r.post_type, r.slug), { lastmod: iso(r.updated_at ?? r.published_at), changefreq: "weekly", priority: "0.8" })));
}

/** Google News: só notícias publicadas nas últimas 48 h (regra do Google). */
export async function sitemapNews() {
  const rows = hasDatabase()
    ? await query<{ slug: string; title: string; published_at: string }>(
        `SELECT p.slug, p.title, p.published_at FROM posts p WHERE ${VISIBLE} AND p.post_type = 'news'
         AND p.published_at > UTC_TIMESTAMP(3) - INTERVAL 48 HOUR ORDER BY p.published_at DESC LIMIT 1000`,
      )
    : [];
  const body = rows.map((r) =>
    [
      "  <url>",
      `    <loc>${xmlEscape(absoluteUrl(postUrl("news", r.slug)))}</loc>`,
      "    <news:news>",
      `      <news:publication>\n        <news:name>${xmlEscape(SITE.name)}</news:name>\n        <news:language>pt</news:language>\n      </news:publication>`,
      `      <news:publication_date>${iso(r.published_at)}</news:publication_date>`,
      `      <news:title>${xmlEscape(r.title)}</news:title>`,
      "    </news:news>",
      "  </url>",
    ].join("\n"),
  );
  return urlset(body, ` xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`);
}

export async function sitemapTaxonomy() {
  if (!hasDatabase()) return urlset([]);
  const [cats, tags, authors] = await Promise.all([
    query<{ slug: string }>(
      `SELECT DISTINCT c.slug FROM categories c JOIN post_categories pc ON pc.category_id = c.id JOIN posts p ON p.id = pc.post_id AND ${VISIBLE} ORDER BY c.slug`,
    ),
    // Tags com menos de 3 matérias ficam fora (páginas ralas; a própria página leva noindex).
    query<{ slug: string }>(
      `SELECT t.slug FROM tags t JOIN post_tags pt ON pt.tag_id = t.id JOIN posts p ON p.id = pt.post_id AND ${VISIBLE} GROUP BY t.id HAVING COUNT(*) >= 3 ORDER BY t.slug`,
    ),
    query<{ slug: string }>(`SELECT DISTINCT a.slug FROM post_authors a JOIN posts p ON p.author_id = a.id AND ${VISIBLE} WHERE a.kind = 'ai' ORDER BY a.slug`),
  ]);
  return urlset([
    ...cats.map((c) => url(`/categoria/${c.slug}`, { changefreq: "weekly", priority: "0.6" })),
    ...tags.map((t) => url(`/tag/${t.slug}`, { changefreq: "weekly", priority: "0.5" })),
    ...authors.map((a) => url(`/autores/${a.slug}`, { changefreq: "weekly", priority: "0.4" })),
  ]);
}

/** RSS 2.0 com as 30 matérias mais recentes (notícias e artigos). */
export async function rssFeed() {
  const posts = await latestPosts({}, 30);
  const items = posts.map((p) =>
    [
      "    <item>",
      `      <title>${xmlEscape(p.title)}</title>`,
      `      <link>${xmlEscape(absoluteUrl(p.url))}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(absoluteUrl(p.url))}</guid>`,
      p.publishedAt ? `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>` : "",
      p.category ? `      <category>${xmlEscape(p.category.name)}</category>` : "",
      p.author ? `      <dc:creator>${xmlEscape(p.author.name)}</dc:creator>` : "",
      p.excerpt ? `      <description>${xmlEscape(p.excerpt)}</description>` : "",
      p.image ? `      <enclosure url="${xmlEscape(p.image)}" type="image/${/\.png/i.test(p.image) ? "png" : /\.jpe?g/i.test(p.image) ? "jpeg" : "webp"}" length="0" />` : "",
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">`,
    "  <channel>",
    `    <title>${xmlEscape(SITE.name)}: notícias e artigos de anime</title>`,
    `    <link>${xmlEscape(SITE.url)}</link>`,
    `    <atom:link href="${xmlEscape(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml" />`,
    "    <description>Notícias, artigos e guias sobre animes, mangás e cultura otaku em português.</description>",
    "    <language>pt-BR</language>",
    ...items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
