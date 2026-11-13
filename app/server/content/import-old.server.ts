// Importação do conteúdo do site antigo (notícias, artigos, categorias, tags e autores).
//
// O site novo não fala com o Supabase. Quem lê o site antigo é o script `scripts/exportar-conteudo-antigo.mjs`,
// rodado no computador do desenvolvedor: ele lê a API pública do site antigo e envia o "retrato" (snapshot)
// compactado para POST /api/importar/conteudo (protegido pelo CRON_TOKEN). Aqui o retrato é gravado no MySQL.
//
// Pode rodar quantas vezes for preciso: grava com "insere ou atualiza" e apaga o que saiu do site antigo.
// Na virada do domínio, uma última exportação traz o que foi publicado depois.
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { query, tx } from "../db.server";
import { readingMinutes, sanitizePostHtml } from "./sanitize.server";

export type OldPost = {
  id: string;
  slug: string;
  post_type: "news" | "article";
  status: string;
  title: string;
  excerpt: string | null;
  content: { html?: string } | null;
  featured_image: string | null;
  author_id: string | null;
  ai_author_id: string | null;
  is_ai_generated: boolean;
  anilist_id: number | null;
  focus_keyword: string | null;
  views_count: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** O que o script de exportação envia: as linhas como vêm da API do site antigo. */
export type OldSnapshot = {
  posts: OldPost[];
  categories: { id: string; name: string; slug: string; kind: string; description: string | null; color: string | null }[];
  tags: { id: string; name: string; slug: string }[];
  ai_news_authors: { id: string; name: string; slug: string; avatar_url: string | null; signature: string | null }[];
  profiles: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null }[];
  post_categories: { post_id: string; category_id: string }[];
  post_tags: { post_id: string; tag_id: string }[];
  tag_redirects: { old_slug: string; tag_id: string }[];
};

/** Confere o formato antes de gravar qualquer coisa. */
export function validateSnapshot(s: unknown): s is OldSnapshot {
  if (!s || typeof s !== "object") return false;
  const keys: (keyof OldSnapshot)[] = ["posts", "categories", "tags", "ai_news_authors", "profiles", "post_categories", "post_tags", "tag_redirects"];
  return keys.every((k) => Array.isArray((s as Record<string, unknown>)[k]));
}

/** ISO do Supabase → DATETIME(3) em UTC. */
export function toSqlDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace("T", " ").replace("Z", "");
}

/** Transforma a matéria do site antigo na linha da tabela posts. */
export function mapPost(p: OldPost) {
  const html = sanitizePostHtml(p.content?.html ?? "");
  return {
    id: p.id,
    post_type: p.post_type === "article" ? "article" : "news",
    slug: p.slug,
    status: p.status,
    title: p.title,
    excerpt: p.excerpt,
    content_html: html,
    featured_image: p.featured_image,
    author_id: p.ai_author_id ?? p.author_id,
    is_ai_generated: p.is_ai_generated ? 1 : 0,
    anilist_id: p.anilist_id,
    focus_keyword: p.focus_keyword,
    views_count: p.views_count ?? 0,
    reading_minutes: readingMinutes(html),
    published_at: toSqlDate(p.published_at),
    created_at: toSqlDate(p.created_at),
    updated_at: toSqlDate(p.updated_at),
  };
}

async function upsert(conn: PoolConnection, table: string, rows: Record<string, unknown>[], keys: string[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const updates = cols.filter((c) => !keys.includes(c)).map((c) => `${c} = VALUES(${c})`);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ")}
      ON DUPLICATE KEY UPDATE ${updates.length ? updates.join(", ") : `${keys[0]} = ${keys[0]}`}`;
    await conn.query(sql, chunk.flatMap((r) => cols.map((c) => r[c])));
  }
}

async function replaceLinks(conn: PoolConnection, table: "post_categories" | "post_tags", col: string, rows: { post_id: string; id: string }[]) {
  await conn.query(`DELETE FROM ${table}`);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await conn.query(`INSERT IGNORE INTO ${table} (post_id, ${col}) VALUES ${chunk.map(() => "(?, ?)").join(", ")}`, chunk.flatMap((r) => [r.post_id, r.id]));
  }
}

export async function applySnapshot(s: OldSnapshot) {
  const posts = s.posts.filter((p) => p.status === "published");
  const postRows = posts.map(mapPost);
  const postIds = new Set(postRows.map((p) => p.id));
  const authorIds = new Set(postRows.map((p) => p.author_id).filter(Boolean));
  const authors = [
    ...s.ai_news_authors.map((a) => ({ id: a.id, kind: "ai", slug: a.slug, name: a.name, avatar_url: a.avatar_url, bio: a.signature })),
    ...s.profiles
      .filter((p) => p.username && authorIds.has(p.id))
      .map((p) => ({ id: p.id, kind: "user", slug: p.username!, name: p.display_name || p.username!, avatar_url: p.avatar_url, bio: p.bio })),
  ];

  const skipped: string[] = [];
  await tx(async (conn) => {
    await upsert(conn, "post_authors", authors, ["id"]);
    await upsert(conn, "categories", s.categories, ["id"]);
    await upsert(conn, "tags", s.tags, ["id"]);
    for (const row of postRows) {
      try {
        await upsert(conn, "posts", [row], ["id"]);
      } catch (err) {
        skipped.push(`${row.slug}: ${(err as Error).message.slice(0, 80)}`);
        postIds.delete(row.id);
      }
    }
    await replaceLinks(conn, "post_categories", "category_id", s.post_categories.filter((r) => postIds.has(r.post_id)).map((r) => ({ post_id: r.post_id, id: r.category_id })));
    await replaceLinks(conn, "post_tags", "tag_id", s.post_tags.filter((r) => postIds.has(r.post_id)).map((r) => ({ post_id: r.post_id, id: r.tag_id })));
    await conn.query("DELETE FROM tag_redirects");
    await upsert(conn, "tag_redirects", s.tag_redirects, ["old_slug"]);
    // O que deixou de estar publicado no site antigo sai daqui também.
    const [existing] = await conn.query<RowDataPacket[]>("SELECT id FROM posts");
    const gone = existing.map((r) => r.id as string).filter((id) => !postIds.has(id));
    for (let i = 0; i < gone.length; i += 500) await conn.query("DELETE FROM posts WHERE id IN (?)", [gone.slice(i, i + 500)]);
  });

  const [count] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'");
  return {
    materias: Number(count?.n ?? 0),
    categorias: s.categories.length,
    tags: s.tags.length,
    autores: authors.length,
    puladas: skipped.slice(0, 10),
  };
}
