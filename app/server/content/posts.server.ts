// Leitura de notícias e artigos. Só aparece o que está publicado e com data de publicação já passada.
import { hasDatabase, iso, query } from "../db.server";

export type PostType = "news" | "article";

export type PostCard = {
  id: string;
  type: PostType;
  slug: string;
  url: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  /** Largura real da capa (null se não foi medida). */
  imageWidth: number | null;
  publishedAt: string | null;
  readingMinutes: number;
  category: { name: string; slug: string } | null;
  author: { name: string; slug: string; kind: "ai" | "user"; avatar: string | null; url: string } | null;
};

export type PostFull = PostCard & {
  html: string;
  updatedAt: string | null;
  isAi: boolean;
  focusKeyword: string | null;
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  authorBio: string | null;
  anilistId: number | null;
};

export const postUrl = (type: PostType, slug: string) => `${type === "article" ? "/artigos" : "/noticias"}/${slug}`;
export const authorUrl = (kind: string, slug: string) => (kind === "ai" ? `/autores/${slug}` : `/u/${slug}`);

export const VISIBLE = "p.status = 'published' AND p.published_at IS NOT NULL AND p.published_at <= UTC_TIMESTAMP(3)";

// Categoria principal: a primeira do mesmo tipo da matéria (notícia ou artigo), por nome.
const CARD_COLUMNS = `
  p.id, p.post_type, p.slug, p.title, p.excerpt, p.featured_image, p.image_width, p.published_at, p.reading_minutes,
  (SELECT c.name FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id ORDER BY c.kind = p.post_type DESC, c.name LIMIT 1) AS cat_name,
  (SELECT c.slug FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id ORDER BY c.kind = p.post_type DESC, c.name LIMIT 1) AS cat_slug,
  a.name AS author_name, a.slug AS author_slug, a.kind AS author_kind, a.avatar_url AS author_avatar`;

type CardRow = {
  id: string;
  post_type: PostType;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image: string | null;
  image_width: number | null;
  published_at: string | null;
  reading_minutes: number;
  cat_name: string | null;
  cat_slug: string | null;
  author_name: string | null;
  author_slug: string | null;
  author_kind: "ai" | "user" | null;
  author_avatar: string | null;
};

function toCard(r: CardRow): PostCard {
  return {
    id: r.id,
    type: r.post_type,
    slug: r.slug,
    url: postUrl(r.post_type, r.slug),
    title: r.title,
    excerpt: r.excerpt,
    image: r.featured_image,
    imageWidth: r.image_width == null ? null : Number(r.image_width),
    publishedAt: iso(r.published_at) ?? null,
    readingMinutes: Number(r.reading_minutes) || 1,
    category: r.cat_name && r.cat_slug ? { name: r.cat_name, slug: r.cat_slug } : null,
    author:
      r.author_name && r.author_slug && r.author_kind
        ? { name: r.author_name, slug: r.author_slug, kind: r.author_kind, avatar: r.author_avatar, url: authorUrl(r.author_kind, r.author_slug) }
        : null,
  };
}

export type ListFilter = { type?: PostType; categoryId?: string; tagId?: string; authorId?: string; anilistId?: number; search?: string; excludeIds?: string[] };

function where(f: ListFilter): { sql: string; params: unknown[] } {
  const parts = [VISIBLE];
  const params: unknown[] = [];
  if (f.type) {
    parts.push("p.post_type = ?");
    params.push(f.type);
  }
  if (f.categoryId) {
    parts.push("EXISTS (SELECT 1 FROM post_categories pc WHERE pc.post_id = p.id AND pc.category_id = ?)");
    params.push(f.categoryId);
  }
  if (f.tagId) {
    parts.push("EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id = ?)");
    params.push(f.tagId);
  }
  if (f.anilistId) {
    parts.push("p.anilist_id = ?");
    params.push(f.anilistId);
  }
  if (f.authorId) {
    parts.push("p.author_id = ?");
    params.push(f.authorId);
  }
  if (f.search) {
    // Todos os termos precisam aparecer no título ou no resumo. A collation ignora acento e maiúscula.
    for (const term of f.search.split(/\s+/).filter((t) => t.length > 1).slice(0, 6)) {
      parts.push("(p.title LIKE ? OR p.excerpt LIKE ?)");
      const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      params.push(like, like);
    }
  }
  if (f.excludeIds?.length) {
    parts.push(`p.id NOT IN (${f.excludeIds.map(() => "?").join(", ")})`);
    params.push(...f.excludeIds);
  }
  return { sql: parts.join(" AND "), params };
}

export async function listPosts(f: ListFilter, page = 1, perPage = 24) {
  if (!hasDatabase()) return { items: [] as PostCard[], total: 0, page: 1, pages: 1 };
  const w = where(f);
  const [count] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts p WHERE ${w.sql}`, w.params);
  const total = Number(count?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const rows = await query<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id WHERE ${w.sql} ORDER BY p.published_at DESC LIMIT ? OFFSET ?`,
    [...w.params, perPage, (current - 1) * perPage],
  );
  return { items: rows.map(toCard), total, page: current, pages };
}

export async function latestPosts(f: ListFilter, limit: number) {
  return (await listPosts(f, 1, limit)).items;
}

/** Mais lidas (contador de visualizações herdado do site antigo). */
export async function mostRead(limit: number, type?: PostType) {
  if (!hasDatabase()) return [];
  const w = where({ type });
  const rows = await query<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id WHERE ${w.sql} ORDER BY p.views_count DESC, p.published_at DESC LIMIT ?`,
    [...w.params, limit],
  );
  return rows.map(toCard);
}

export async function getPost(slug: string): Promise<PostFull | null> {
  if (!hasDatabase()) return null;
  const rows = await query<CardRow & { content_html: string; updated_at: string; is_ai_generated: number; focus_keyword: string | null; author_bio: string | null; anilist_id: number | null }>(
    `SELECT ${CARD_COLUMNS}, p.content_html, p.updated_at, p.is_ai_generated, p.focus_keyword, a.bio AS author_bio, p.anilist_id
     FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id WHERE ${VISIBLE} AND p.slug = ? LIMIT 1`,
    [slug],
  );
  const r = rows[0];
  if (!r) return null;
  const [categories, tags] = await Promise.all([
    query<{ name: string; slug: string }>(
      "SELECT c.name, c.slug FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = ? ORDER BY c.kind = ? DESC, c.name",
      [r.id, r.post_type],
    ),
    query<{ name: string; slug: string }>("SELECT t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.name LIMIT 20", [r.id]),
  ]);
  return {
    ...toCard(r),
    html: r.content_html,
    updatedAt: iso(r.updated_at) ?? null,
    isAi: Boolean(r.is_ai_generated),
    focusKeyword: r.focus_keyword,
    categories,
    tags,
    authorBio: r.author_bio,
    anilistId: r.anilist_id == null ? null : Number(r.anilist_id),
  };
}

/** Relacionadas: mesma categoria principal; se faltar, as mais recentes do mesmo tipo. */
export async function relatedPosts(post: PostFull, limit = 4) {
  const items: PostCard[] = [];
  if (post.category) {
    const [cat] = await query<{ id: string }>("SELECT id FROM categories WHERE slug = ?", [post.category.slug]);
    if (cat) items.push(...(await latestPosts({ categoryId: cat.id, excludeIds: [post.id] }, limit)));
  }
  if (items.length < limit) items.push(...(await latestPosts({ type: post.type, excludeIds: [post.id, ...items.map((i) => i.id)] }, limit - items.length)));
  return items;
}

export async function getCategory(slug: string) {
  if (!hasDatabase()) return null;
  const [c] = await query<{ id: string; name: string; slug: string; kind: string; description: string | null }>(
    "SELECT id, name, slug, kind, description FROM categories WHERE slug = ?",
    [slug],
  );
  return c ?? null;
}

export async function listCategories(kind?: PostType) {
  if (!hasDatabase()) return [];
  return query<{ name: string; slug: string; kind: string; total: number }>(
    `SELECT c.name, c.slug, c.kind, COUNT(p.id) AS total FROM categories c
     JOIN post_categories pc ON pc.category_id = c.id JOIN posts p ON p.id = pc.post_id AND ${VISIBLE}
     ${kind ? "WHERE c.kind = ?" : ""} GROUP BY c.id ORDER BY total DESC`,
    kind ? [kind] : [],
  );
}

/** Tag pelo slug; se for um slug antigo de tag renomeada, devolve `redirectTo`. */
export async function getTag(slug: string) {
  if (!hasDatabase()) return null;
  const [t] = await query<{ id: string; name: string; slug: string }>("SELECT id, name, slug FROM tags WHERE slug = ?", [slug]);
  if (t) return { ...t, redirectTo: null as string | null };
  const [r] = await query<{ slug: string }>("SELECT t.slug FROM tag_redirects tr JOIN tags t ON t.id = tr.tag_id WHERE tr.old_slug = ?", [slug]);
  return r ? { id: "", name: "", slug: r.slug, redirectTo: r.slug } : null;
}

/** Tags com mais matérias nos últimos 60 dias (seção "Em alta"). */
export async function trendingTags(limit = 14) {
  if (!hasDatabase()) return [];
  return query<{ name: string; slug: string; total: number }>(
    `SELECT t.name, t.slug, COUNT(*) AS total FROM post_tags pt JOIN tags t ON t.id = pt.tag_id JOIN posts p ON p.id = pt.post_id
     WHERE ${VISIBLE} AND p.published_at > UTC_TIMESTAMP(3) - INTERVAL 60 DAY GROUP BY t.id ORDER BY total DESC, t.name LIMIT ?`,
    [limit],
  );
}

export async function getAiAuthor(slug: string) {
  if (!hasDatabase()) return null;
  const [a] = await query<{ id: string; name: string; slug: string; avatar_url: string | null; bio: string | null }>(
    "SELECT id, name, slug, avatar_url, bio FROM post_authors WHERE kind = 'ai' AND slug = ?",
    [slug],
  );
  return a ?? null;
}

// ------------------------------------------------------------------------------------------- comentários

export type CommentItem = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  author: { name: string; slug: string; avatar: string | null; url: string };
  post?: { title: string; url: string };
};

type CommentRow = {
  id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  a_name: string;
  a_slug: string;
  a_avatar: string | null;
  p_title?: string;
  p_type?: PostType;
  p_slug?: string;
};

const toComment = (r: CommentRow): CommentItem => ({
  id: r.id,
  parentId: r.parent_id,
  content: r.content,
  createdAt: iso(r.created_at)!,
  author: { name: r.a_name, slug: r.a_slug, avatar: r.a_avatar, url: authorUrl("user", r.a_slug) },
  ...(r.p_slug && r.p_type ? { post: { title: r.p_title!, url: postUrl(r.p_type, r.p_slug) } } : {}),
});

/** Comentários de uma matéria, do mais antigo ao mais novo (respostas logo abaixo de quem responderam). */
export async function postComments(postId: string) {
  if (!hasDatabase()) return [];
  const rows = await query<CommentRow>(
    `SELECT c.id, c.parent_id, c.content, c.created_at, a.name AS a_name, a.slug AS a_slug, a.avatar_url AS a_avatar
     FROM post_comments c JOIN post_authors a ON a.id = c.author_id WHERE c.post_id = ? ORDER BY c.created_at`,
    [postId],
  );
  const all = rows.map(toComment);
  const roots = all.filter((c) => !c.parentId || !all.some((p) => p.id === c.parentId));
  return roots.map((r) => ({ ...r, replies: all.filter((c) => c.parentId === r.id) }));
}

/** Últimos comentários das matérias do tipo (barra lateral). */
export async function latestComments(type: PostType, limit = 5) {
  if (!hasDatabase()) return [];
  const rows = await query<CommentRow>(
    `SELECT c.id, c.parent_id, c.content, c.created_at, a.name AS a_name, a.slug AS a_slug, a.avatar_url AS a_avatar,
            p.title AS p_title, p.post_type AS p_type, p.slug AS p_slug
     FROM post_comments c JOIN post_authors a ON a.id = c.author_id JOIN posts p ON p.id = c.post_id
     WHERE ${VISIBLE} AND p.post_type = ? ORDER BY c.created_at DESC LIMIT ?`,
    [type, limit],
  );
  return rows.map(toComment);
}

/** Mais lidas dos últimos 30 dias do tipo, sem a matéria aberta ("Em alta" da barra lateral). */
export async function trendingPosts(type: PostType, excludeId: string, limit = 5) {
  if (!hasDatabase()) return [];
  const w = where({ type, excludeIds: [excludeId] });
  const rows = await query<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id
     WHERE ${w.sql} AND p.published_at > UTC_TIMESTAMP(3) - INTERVAL 30 DAY ORDER BY p.views_count DESC LIMIT ?`,
    [...w.params, limit],
  );
  return rows.map(toCard);
}

/** Índice da matéria: dá um id a cada subtítulo (h2) do texto e devolve a lista para o "Nesta matéria". */
export function withToc(html: string) {
  const toc: { id: string; text: string }[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (_all, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let id = text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "secao";
    while (used.has(id)) id += "-2";
    used.add(id);
    toc.push({ id, text });
    return `<h2${attrs.replace(/\sid="[^"]*"/, "")} id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}
