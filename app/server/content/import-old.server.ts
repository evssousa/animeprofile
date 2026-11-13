// Cópia do conteúdo do site antigo (Supabase) para o MySQL, pela API pública de leitura.
//
// Usa só a chave pública (a mesma que o navegador de qualquer visitante do site antigo recebe), então
// enxerga exatamente o que é público: matérias publicadas, categorias, tags e autores. Pode rodar
// quantas vezes for preciso: grava com "insere ou atualiza" e apaga o que saiu do site antigo.
// Mantém o endereço de teste em dia e, na virada, faz a importação final do conteúdo.
import type { PoolConnection } from "mysql2/promise";
import { query, tx } from "../db.server";
import { readingMinutes, sanitizePostHtml } from "./sanitize.server";

type OldPost = {
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
type OldCategory = { id: string; name: string; slug: string; kind: string; description: string | null; color: string | null };
type OldTag = { id: string; name: string; slug: string };
type OldAiAuthor = { id: string; name: string; slug: string; avatar_url: string | null; signature: string | null };
type OldProfile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null };

const PAGE = 1000;

export function oldSourceConfigured() {
  return Boolean(process.env.OLD_SUPABASE_URL && process.env.OLD_SUPABASE_KEY);
}

async function fetchAll<T>(table: string, select: string, filter = ""): Promise<T[]> {
  const base = process.env.OLD_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.OLD_SUPABASE_KEY!;
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${base}/rest/v1/${table}?select=${select}${filter}&order=id&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
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

export async function importOldContent() {
  if (!oldSourceConfigured()) return { pulado: "sem OLD_SUPABASE_URL/OLD_SUPABASE_KEY" };

  const [posts, categories, tags, aiAuthors, postCats, postTags, tagRedirects] = await Promise.all([
    fetchAll<OldPost>(
      "posts",
      "id,slug,post_type,status,title,excerpt,content,featured_image,author_id,ai_author_id,is_ai_generated,anilist_id,focus_keyword,views_count,published_at,created_at,updated_at",
      "&status=eq.published",
    ),
    fetchAll<OldCategory>("categories", "id,name,slug,kind,description,color"),
    fetchAll<OldTag>("tags", "id,name,slug"),
    fetchAll<OldAiAuthor>("ai_news_authors", "id,name,slug,avatar_url,signature"),
    fetchAll<{ post_id: string; category_id: string }>("post_categories", "post_id,category_id"),
    fetchAll<{ post_id: string; tag_id: string }>("post_tags", "post_id,tag_id"),
    fetchAll<{ old_slug: string; tag_id: string }>("tag_redirects", "old_slug,tag_id").catch(() => []),
  ]);

  // Autores humanos: só os perfis que assinam alguma matéria publicada.
  const aiIds = new Set(aiAuthors.map((a) => a.id));
  const userIds = [...new Set(posts.filter((p) => !p.ai_author_id && p.author_id && !aiIds.has(p.author_id)).map((p) => p.author_id!))];
  const profiles: OldProfile[] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    profiles.push(...(await fetchAll<OldProfile>("profiles", "id,username,display_name,avatar_url,bio", `&id=in.(${userIds.slice(i, i + 100).join(",")})`)));
  }

  const postRows = posts.map(mapPost);
  const postIds = new Set(postRows.map((p) => p.id));
  const authors = [
    ...aiAuthors.map((a) => ({ id: a.id, kind: "ai", slug: a.slug, name: a.name, avatar_url: a.avatar_url, bio: a.signature })),
    ...profiles.filter((p) => p.username).map((p) => ({ id: p.id, kind: "user", slug: p.username!, name: p.display_name || p.username!, avatar_url: p.avatar_url, bio: p.bio })),
  ];

  const skipped: string[] = [];
  await tx(async (conn) => {
    await upsert(conn, "post_authors", authors, ["id"]);
    await upsert(conn, "categories", categories, ["id"]);
    await upsert(conn, "tags", tags, ["id"]);
    for (const row of postRows) {
      try {
        await upsert(conn, "posts", [row], ["id"]);
      } catch (err) {
        skipped.push(`${row.slug}: ${(err as Error).message.slice(0, 80)}`);
        postIds.delete(row.id);
      }
    }
    await replaceLinks(conn, "post_categories", "category_id", postCats.filter((r) => postIds.has(r.post_id)).map((r) => ({ post_id: r.post_id, id: r.category_id })));
    await replaceLinks(conn, "post_tags", "tag_id", postTags.filter((r) => postIds.has(r.post_id)).map((r) => ({ post_id: r.post_id, id: r.tag_id })));
    await conn.query("DELETE FROM tag_redirects");
    await upsert(conn, "tag_redirects", tagRedirects, ["old_slug"]);
    // O que deixou de estar publicado no site antigo sai daqui também.
    const [existing] = await conn.query<import("mysql2/promise").RowDataPacket[]>("SELECT id FROM posts");
    const gone = existing.map((r) => r.id as string).filter((id) => !postIds.has(id));
    for (let i = 0; i < gone.length; i += 500) await conn.query("DELETE FROM posts WHERE id IN (?)", [gone.slice(i, i + 500)]);
  });

  const [count] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'");
  return {
    materias: Number(count?.n ?? 0),
    categorias: categories.length,
    tags: tags.length,
    autores: authors.length,
    puladas: skipped.slice(0, 10),
  };
}
