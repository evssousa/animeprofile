// Blog da comunidade (só leitura): listas, post, autor, categoria, tag, lateral, importação e dados dos feeds.
// Só aparece o que está publicado e com data já passada.
import type { RowDataPacket } from "mysql2/promise";
import { blogAuthorUrl, blogUrl, stripMarkdown, type BlogCardData } from "~/lib/blog";
import { hasDatabase, iso, query, tx } from "../db.server";
import { toSqlDate, upsert } from "../content/import-old.server";
import { readingMinutes } from "../content/sanitize.server";
import { withToc } from "../content/posts.server";
import type { CommentItem } from "../content/posts.server";
import { markdownToHtml } from "./markdown.server";

const VISIBLE_BLOG = "b.status = 'published' AND b.published_at IS NOT NULL AND b.published_at <= UTC_TIMESTAMP(3)";

type CardRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  views_count: number;
  likes_count: number;
  claps_count: number;
  comments_count: number;
  reading_minutes: number;
  a_slug: string;
  a_name: string;
  a_avatar: string | null;
};

const CARD_COLS = `b.id, b.slug, b.title, b.excerpt, b.cover_url, b.published_at, b.views_count, b.likes_count, b.claps_count, b.comments_count,
  b.reading_minutes, a.slug AS a_slug, a.name AS a_name, a.avatar_url AS a_avatar`;
const FROM = "FROM blog_posts b JOIN post_authors a ON a.id = b.author_id AND a.kind = 'user'";

const toCard = (r: CardRow): BlogCardData => ({
  id: r.id,
  slug: r.slug,
  url: blogUrl(r.a_slug, r.slug),
  title: r.title,
  excerpt: r.excerpt,
  coverUrl: r.cover_url,
  publishedAt: iso(r.published_at) ?? null,
  views: Number(r.views_count),
  likes: Number(r.likes_count),
  claps: Number(r.claps_count),
  comments: Number(r.comments_count),
  readingMinutes: Number(r.reading_minutes) || 1,
  author: { slug: r.a_slug, name: r.a_name, avatarUrl: r.a_avatar, url: blogAuthorUrl(r.a_slug) },
});

export type BlogOrder = "recentes" | "populares" | "comentados";
const ORDERS: Record<BlogOrder, string> = {
  recentes: "b.published_at DESC",
  populares: "(b.likes_count + b.claps_count) DESC, b.views_count DESC, b.published_at DESC",
  comentados: "b.comments_count DESC, b.published_at DESC",
};

export type BlogFilter = { order?: BlogOrder; q?: string; categorySlug?: string; tagSlug?: string; authorSlug?: string; excludeIds?: string[] };

function where(f: BlogFilter) {
  const parts = [VISIBLE_BLOG];
  const params: unknown[] = [];
  if (f.categorySlug) {
    parts.push("EXISTS (SELECT 1 FROM blog_post_categories x JOIN blog_categories c ON c.id = x.category_id WHERE x.blog_post_id = b.id AND c.slug = ?)");
    params.push(f.categorySlug);
  }
  if (f.tagSlug) {
    parts.push("EXISTS (SELECT 1 FROM blog_post_tags x JOIN blog_tags t ON t.id = x.tag_id WHERE x.blog_post_id = b.id AND t.slug = ?)");
    params.push(f.tagSlug);
  }
  if (f.authorSlug) {
    parts.push("a.slug = ?");
    params.push(f.authorSlug);
  }
  for (const term of (f.q ?? "").split(/\s+/).filter((t) => t.length > 1).slice(0, 6)) {
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    parts.push("(b.title LIKE ? OR b.excerpt LIKE ? OR a.slug LIKE ?)");
    params.push(like, like, like);
  }
  if (f.excludeIds?.length) {
    parts.push(`b.id NOT IN (${f.excludeIds.map(() => "?").join(", ")})`);
    params.push(...f.excludeIds);
  }
  return { sql: parts.join(" AND "), params };
}

export async function listBlogPosts(f: BlogFilter = {}, page = 1, perPage = 20) {
  if (!hasDatabase()) return { items: [] as BlogCardData[], total: 0, page: 1, pages: 1 };
  const w = where(f);
  const [count] = await query<{ n: number }>(`SELECT COUNT(*) AS n ${FROM} WHERE ${w.sql}`, w.params);
  const total = Number(count?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const rows = await query<CardRow>(`SELECT ${CARD_COLS} ${FROM} WHERE ${w.sql} ORDER BY ${ORDERS[f.order ?? "recentes"]} LIMIT ? OFFSET ?`, [...w.params, perPage, (current - 1) * perPage]);
  return { items: rows.map(toCard), total, page: current, pages };
}

export type BlogPostFull = BlogCardData & {
  html: string;
  toc: { id: string; text: string }[];
  contentMd: string;
  updatedAt: string | null;
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  promotedArticleSlug: string | null;
};

export async function getBlogPost(slug: string): Promise<BlogPostFull | null> {
  if (!hasDatabase()) return null;
  const [r] = await query<CardRow & { content_html: string; content_md: string; updated_at: string; promoted_post_id: string | null }>(
    `SELECT ${CARD_COLS}, b.content_html, b.content_md, b.updated_at, b.promoted_post_id ${FROM} WHERE ${VISIBLE_BLOG} AND b.slug = ? LIMIT 1`,
    [slug],
  );
  if (!r) return null;
  const [categories, tags, promoted] = await Promise.all([
    query<{ name: string; slug: string }>("SELECT c.name, c.slug FROM blog_post_categories x JOIN blog_categories c ON c.id = x.category_id WHERE x.blog_post_id = ? ORDER BY c.name", [r.id]),
    query<{ name: string; slug: string }>("SELECT t.name, t.slug FROM blog_post_tags x JOIN blog_tags t ON t.id = x.tag_id WHERE x.blog_post_id = ? ORDER BY t.name LIMIT 20", [r.id]),
    r.promoted_post_id ? query<{ slug: string }>("SELECT slug FROM posts WHERE id = ? AND status = 'published'", [r.promoted_post_id]) : Promise.resolve([]),
  ]);
  const { html, toc } = withToc(r.content_html);
  return { ...toCard(r), html, toc, contentMd: r.content_md, updatedAt: iso(r.updated_at) ?? null, categories, tags, promotedArticleSlug: promoted[0]?.slug ?? null };
}

export type BlogComment = CommentItem & { replies: CommentItem[] };

export async function blogComments(postId: string): Promise<BlogComment[]> {
  if (!hasDatabase()) return [];
  const rows = await query<{ id: string; parent_id: string | null; content: string; created_at: string; a_name: string; a_slug: string; a_avatar: string | null }>(
    `SELECT c.id, c.parent_id, c.content, c.created_at, a.name AS a_name, a.slug AS a_slug, a.avatar_url AS a_avatar
     FROM blog_post_comments c JOIN post_authors a ON a.id = c.author_id WHERE c.blog_post_id = ? ORDER BY c.created_at`,
    [postId],
  );
  const all: CommentItem[] = rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    content: r.content,
    createdAt: iso(r.created_at)!,
    author: { name: r.a_name, slug: r.a_slug, avatar: r.a_avatar, url: blogAuthorUrl(r.a_slug) },
  }));
  const roots = all.filter((c) => !c.parentId || !all.some((p) => p.id === c.parentId));
  return roots.map((r) => ({ ...r, replies: all.filter((c) => c.parentId === r.id) }));
}

/** Relacionados: tag ou categoria em comum, depois o mesmo autor, depois os recentes. */
export async function relatedBlogPosts(post: Pick<BlogPostFull, "id" | "author" | "tags" | "categories">, limit = 3) {
  const items: BlogCardData[] = [];
  const add = async (f: BlogFilter) => {
    if (items.length >= limit) return;
    const got = await listBlogPosts({ ...f, excludeIds: [post.id, ...items.map((i) => i.id)] }, 1, limit - items.length);
    items.push(...got.items);
  };
  for (const t of post.tags.slice(0, 3)) await add({ tagSlug: t.slug });
  for (const c of post.categories.slice(0, 2)) await add({ categorySlug: c.slug });
  await add({ authorSlug: post.author.slug });
  await add({});
  return items;
}

export async function blogAuthor(username: string) {
  if (!hasDatabase()) return null;
  const [a] = await query<{ id: string; name: string; slug: string; avatar_url: string | null; bio: string | null }>(
    "SELECT id, name, slug, avatar_url, bio FROM post_authors WHERE kind = 'user' AND slug = ? LIMIT 1",
    [username],
  );
  if (!a) return null;
  const [categories, tags] = await Promise.all([
    query<{ name: string; slug: string; total: number }>(
      `SELECT c.name, c.slug, COUNT(*) AS total FROM blog_posts b JOIN blog_post_categories x ON x.blog_post_id = b.id JOIN blog_categories c ON c.id = x.category_id
       WHERE ${VISIBLE_BLOG} AND b.author_id = ? GROUP BY c.slug, c.name ORDER BY total DESC, c.name`,
      [a.id],
    ),
    query<{ name: string; slug: string; total: number }>(
      `SELECT t.name, t.slug, COUNT(*) AS total FROM blog_posts b JOIN blog_post_tags x ON x.blog_post_id = b.id JOIN blog_tags t ON t.id = x.tag_id
       WHERE ${VISIBLE_BLOG} AND b.author_id = ? GROUP BY t.slug, t.name ORDER BY total DESC, t.name LIMIT 30`,
      [a.id],
    ),
  ]);
  return { ...a, categories, tags };
}

/** Categoria ou tag pelo slug (junta as de autores diferentes). null se não há post visível. */
export async function blogTaxonomy(kind: "categoria" | "tag", slug: string) {
  if (!hasDatabase()) return null;
  const [link, table, col] = kind === "categoria" ? (["blog_post_categories", "blog_categories", "category_id"] as const) : (["blog_post_tags", "blog_tags", "tag_id"] as const);
  const rows = await query<{ name: string; n: number }>(
    `SELECT t.name, COUNT(*) AS n FROM ${table} t JOIN ${link} x ON x.${col} = t.id JOIN blog_posts b ON b.id = x.blog_post_id
     WHERE t.slug = ? AND ${VISIBLE_BLOG} GROUP BY t.name ORDER BY n DESC, t.name`,
    [slug],
  );
  if (!rows.length) return null;
  return { name: rows[0].name, total: rows.reduce((s, r) => s + Number(r.n), 0) };
}

export async function blogSidebar() {
  if (!hasDatabase()) return { mostRead: [] as BlogCardData[], tags: [] as { name: string; slug: string; total: number }[], authors: [] as { name: string; slug: string; avatarUrl: string | null; total: number }[] };
  const [mostRead, tags, authors] = await Promise.all([
    query<CardRow>(`SELECT ${CARD_COLS} ${FROM} WHERE ${VISIBLE_BLOG} ORDER BY b.views_count DESC, b.published_at DESC LIMIT 5`),
    query<{ name: string; slug: string; total: number }>(
      `SELECT MIN(t.name) AS name, t.slug, COUNT(*) AS total FROM blog_tags t JOIN blog_post_tags x ON x.tag_id = t.id JOIN blog_posts b ON b.id = x.blog_post_id
       WHERE ${VISIBLE_BLOG} GROUP BY t.slug ORDER BY total DESC, t.slug LIMIT 12`,
    ),
    query<{ name: string; slug: string; avatar_url: string | null; total: number }>(
      `SELECT a.name, a.slug, a.avatar_url, COUNT(*) AS total ${FROM} WHERE ${VISIBLE_BLOG} GROUP BY a.id ORDER BY total DESC, a.name LIMIT 5`,
    ),
  ]);
  return { mostRead: mostRead.map(toCard), tags, authors: authors.map((a) => ({ name: a.name, slug: a.slug, avatarUrl: a.avatar_url, total: Number(a.total) })) };
}

/** Para a home: os mais recentes que têm capa. */
export async function latestBlogWithCover(limit = 6) {
  if (!hasDatabase()) return [];
  const rows = await query<CardRow>(`SELECT ${CARD_COLS} ${FROM} WHERE ${VISIBLE_BLOG} AND b.cover_url IS NOT NULL ORDER BY b.published_at DESC LIMIT ?`, [limit]);
  return rows.map(toCard);
}

/** Dados dos feeds (RSS e sitemap): o XML é montado em seo/feeds.server.ts. */
export async function blogRssItems(username?: string) {
  if (!hasDatabase()) return null;
  if (username && !(await blogAuthor(username))) return null;
  const rows = await query<CardRow>(`SELECT ${CARD_COLS} ${FROM} WHERE ${VISIBLE_BLOG} ${username ? "AND a.slug = ?" : ""} ORDER BY b.published_at DESC LIMIT 50`, username ? [username] : []);
  return rows.map(toCard);
}

export async function blogForSitemap() {
  if (!hasDatabase()) return { posts: [], authors: [] };
  const [posts, authors] = await Promise.all([
    query<{ slug: string; a_slug: string; updated_at: string | null; published_at: string | null }>(
      `SELECT b.slug, a.slug AS a_slug, b.updated_at, b.published_at ${FROM} WHERE ${VISIBLE_BLOG} AND b.promoted_post_id IS NULL ORDER BY b.published_at DESC LIMIT 50000`,
    ),
    query<{ slug: string }>(`SELECT DISTINCT a.slug ${FROM} WHERE ${VISIBLE_BLOG} ORDER BY a.slug`),
  ]);
  return { posts, authors };
}

// --------------------------------------------------------------------------------------------- importação

export type OldBlogSnapshot = {
  blog_posts?: {
    id: string; author_id: string; slug: string; title: string; content: unknown; excerpt: string | null; cover_url: string | null; focus_keyword: string | null;
    status: string; promoted_post_id: string | null; views_count: number | null; likes_count: number | null; claps_count: number | null;
    bookmarks_count: number | null; comments_count: number | null; quality_score: number | null; published_at: string | null; created_at: string; updated_at: string;
  }[];
  blog_categories?: { id: string; user_id: string; name: string; slug: string }[];
  blog_tags?: { id: string; user_id: string; name: string; slug: string }[];
  blog_post_categories?: { blog_post_id: string; category_id: string }[];
  blog_post_tags?: { blog_post_id: string; tag_id: string }[];
  blog_post_comments?: { id: string; blog_post_id: string; author_id: string; parent_id: string | null; content: string; created_at: string }[];
};

async function replaceLinks(conn: import("mysql2/promise").PoolConnection, table: string, col: string, rows: [string, string][]) {
  await conn.query(`DELETE FROM ${table}`);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await conn.query(`INSERT IGNORE INTO ${table} (blog_post_id, ${col}) VALUES ${chunk.map(() => "(?, ?)").join(", ")}`, chunk.flat());
  }
}

/** Grava o blog do retrato. Precisa rodar depois de post_authors (os autores vêm do applySnapshot). */
export async function importBlog(s: OldBlogSnapshot) {
  const skipped: string[] = [];
  const known = new Set((await query<{ id: string }>("SELECT id FROM post_authors WHERE kind = 'user'")).map((r) => r.id));
  const rows: Record<string, unknown>[] = [];
  for (const p of s.blog_posts ?? []) {
    if (p.status !== "published") continue;
    if (typeof p.content !== "string" || !p.content.trim()) {
      skipped.push(`${p.slug}: conteúdo que não é texto`);
      continue;
    }
    if (!known.has(p.author_id)) {
      skipped.push(`${p.slug}: autor desconhecido`);
      continue;
    }
    const html = markdownToHtml(p.content);
    rows.push({
      id: p.id,
      author_id: p.author_id,
      slug: p.slug,
      title: p.title.slice(0, 300),
      excerpt: stripMarkdown(p.excerpt).slice(0, 300) || null,
      content_md: p.content,
      content_html: html,
      cover_url: p.cover_url,
      focus_keyword: p.focus_keyword,
      status: "published",
      promoted_post_id: p.promoted_post_id,
      views_count: p.views_count ?? 0,
      likes_count: p.likes_count ?? 0,
      claps_count: p.claps_count ?? 0,
      bookmarks_count: p.bookmarks_count ?? 0,
      comments_count: p.comments_count ?? 0,
      quality_score: p.quality_score ?? 0,
      reading_minutes: readingMinutes(html),
      published_at: toSqlDate(p.published_at),
      created_at: toSqlDate(p.created_at),
      updated_at: toSqlDate(p.updated_at),
    });
  }
  const ids = new Set(rows.map((r) => r.id as string));
  const cats = s.blog_categories ?? [];
  const tags = s.blog_tags ?? [];
  const comments = (s.blog_post_comments ?? []).filter((c) => ids.has(c.blog_post_id) && known.has(c.author_id) && c.content?.trim());

  await tx(async (conn) => {
    await upsert(conn, "blog_posts", rows, ["id"]);
    await upsert(conn, "blog_categories", cats, ["id"]);
    await upsert(conn, "blog_tags", tags, ["id"]);
    await replaceLinks(conn, "blog_post_categories", "category_id", (s.blog_post_categories ?? []).filter((r) => ids.has(r.blog_post_id)).map((r) => [r.blog_post_id, r.category_id]));
    await replaceLinks(conn, "blog_post_tags", "tag_id", (s.blog_post_tags ?? []).filter((r) => ids.has(r.blog_post_id)).map((r) => [r.blog_post_id, r.tag_id]));
    await conn.query("DELETE FROM blog_post_comments");
    await upsert(
      conn,
      "blog_post_comments",
      comments.map((c) => ({ id: c.id, blog_post_id: c.blog_post_id, author_id: c.author_id, parent_id: c.parent_id, content: c.content.trim().slice(0, 5000), created_at: toSqlDate(c.created_at) })),
      ["id"],
    );
    // O que saiu do site antigo sai daqui.
    const prune = async (table: string, keep: Set<string>) => {
      const [existing] = await conn.query<RowDataPacket[]>(`SELECT id FROM ${table}`);
      const gone = existing.map((r) => r.id as string).filter((id) => !keep.has(id));
      for (let i = 0; i < gone.length; i += 500) await conn.query(`DELETE FROM ${table} WHERE id IN (?)`, [gone.slice(i, i + 500)]);
    };
    await prune("blog_posts", ids);
    await prune("blog_categories", new Set(cats.map((c) => c.id)));
    await prune("blog_tags", new Set(tags.map((t) => t.id)));
  });
  return { posts: rows.length, comentarios: comments.length, pulados: skipped.slice(0, 10) };
}

// ------------------------------------------------------------------------------------- barras laterais

/** Destaques da semana: posts dos últimos 7 dias, pela nota de qualidade e leituras. Vazio se não houve post. */
export async function blogBestOfWeek(limit = 5) {
  if (!hasDatabase()) return [];
  const rows = await query<CardRow>(
    `SELECT ${CARD_COLS} ${FROM} WHERE ${VISIBLE_BLOG} AND b.published_at > UTC_TIMESTAMP(3) - INTERVAL 7 DAY
     ORDER BY b.quality_score DESC, b.views_count DESC, b.published_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toCard);
}

/** Mais comentados de sempre (com poucos posts, a janela de 7 dias ficaria quase sempre vazia). */
export async function blogMostCommented(limit = 5) {
  if (!hasDatabase()) return [];
  const rows = await query<CardRow>(
    `SELECT ${CARD_COLS} ${FROM} WHERE ${VISIBLE_BLOG} AND b.comments_count > 0 ORDER BY b.comments_count DESC, b.published_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toCard);
}
