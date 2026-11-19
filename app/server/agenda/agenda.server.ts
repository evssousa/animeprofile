// Agenda semanal de animes: toda segunda às 9h (Brasília) a tarefa `agenda-semanal` monta a matéria da semana a partir do
// catálogo de animes (anime_catalog, mantido pela tarefa animes-anilist) e publica. Se a matéria da semana já existe,
// atualiza o texto. A capa **gira a cada semana** entre os banners dos animes mais populares (nunca a mesma duas vezes seguidas).
import { randomUUID } from "node:crypto";
import { STREAMERS, type StreamerKey } from "~/lib/anime";
import { agendaCoverCandidates, agendaForWeek, buildAgendaPost, pickAgendaCover, weekBounds, type AgendaSource } from "~/lib/agenda";
import { clearCache } from "../cache.server";
import { readingMinutes, sanitizePostHtml } from "../content/sanitize.server";
import { exec, hasDatabase, json, query, sqlDate, tx } from "../db.server";
import { localizeImages } from "../robot/media.server";
import { makeSlug } from "../robot/text";

const MIN_ITEMS = 5;
const TAGS = ["Agenda da semana", "Lançamentos"];

type CatalogRow = {
  anilist_id: number;
  title: string;
  popularity: number;
  episodes: number | null;
  next_episode: number;
  next_at: number | string;
  cover_url: string | null;
  banner_url: string | null;
  streamers: unknown;
};

/** Anime do catálogo que ainda vai ao ar, com o próximo episódio conhecido. */
async function loadSources(): Promise<AgendaSource[]> {
  const rows = await query<CatalogRow>(
    `SELECT anilist_id, title, popularity, episodes, next_episode, UNIX_TIMESTAMP(next_airing_at) AS next_at, cover_url, banner_url, streamers
     FROM anime_catalog
     WHERE status IN ('RELEASING', 'NOT_YET_RELEASED') AND is_adult = 0 AND next_airing_at IS NOT NULL AND next_episode IS NOT NULL
     ORDER BY popularity DESC LIMIT 400`,
  );
  return rows.map((r) => ({
    anilistId: Number(r.anilist_id),
    title: r.title,
    popularity: Number(r.popularity) || 0,
    episodes: r.episodes == null ? null : Number(r.episodes),
    nextEpisode: Number(r.next_episode),
    nextAiringAt: Math.floor(Number(r.next_at)),
    cover: r.cover_url,
    banner: r.banner_url,
    streamers: json<string[]>(r.streamers, []).flatMap((k) => (STREAMERS[k as StreamerKey] ? [STREAMERS[k as StreamerKey].label] : [])),
  }));
}

type PostConn = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

async function ensureTag(conn: PostConn, name: string): Promise<string | null> {
  const slug = makeSlug(name, 60);
  if (!slug) return null;
  const [found] = (await conn.query("SELECT id FROM tags WHERE slug = ? LIMIT 1", [slug])) as unknown as [{ id: string }[]];
  if (found[0]?.id) return found[0].id;
  const id = randomUUID();
  await conn.query("INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", [id, name.slice(0, 160), slug]);
  return id;
}

/** Monta e publica (ou atualiza) a agenda da semana de `now`. Devolve um resumo curto para o histórico do cron. */
export async function publishWeeklyAgenda(now = new Date()): Promise<Record<string, unknown>> {
  if (!hasDatabase()) return { pulou: "sem banco" };
  const { start, end } = weekBounds(now);
  const items = agendaForWeek(await loadSources(), start, end).slice(0, 80);
  if (items.length < MIN_ITEMS) return { pulou: `poucos episódios (${items.length})` };

  const post = buildAgendaPost(items, start);
  const html = sanitizePostHtml(post.html);
  const [existing] = await query<{ id: string; source_url: string | null }>("SELECT id, source_url FROM posts WHERE slug = ? LIMIT 1", [post.slug]);
  const [previous] = await query<{ source_url: string | null; author_id: string | null; is_ai_generated: number }>(
    "SELECT source_url, author_id, is_ai_generated FROM posts WHERE slug LIKE 'agenda-de-animes-%' AND slug <> ? ORDER BY published_at DESC LIMIT 1",
    [post.slug],
  );

  // Capa: só escolhe de novo quando a matéria ainda não tem uma capa da agenda (source_url guarda o banner de origem).
  let cover: { source: string; url: string; width: number; height: number } | null = null;
  if (!existing || !existing.source_url) {
    for (const source of pickAgendaCover(agendaCoverCandidates(items), start, previous?.source_url ?? null).slice(0, 4)) {
      const local = (await localizeImages([source], () => {})).get(source);
      if (local) {
        cover = { source, ...local };
        break;
      }
    }
  }

  const when = sqlDate(new Date());
  if (existing) {
    await exec(
      `UPDATE posts SET title = ?, excerpt = ?, content_html = ?, reading_minutes = ?, updated_at = ?
         ${cover ? ", featured_image = ?, image_width = ?, image_height = ?, source_url = ?" : ""} WHERE id = ?`,
      [post.title, post.excerpt, html, readingMinutes(html), when, ...(cover ? [cover.url, cover.width, cover.height, cover.source.slice(0, 600)] : []), existing.id],
    );
    clearCache();
    return { atualizada: post.slug, episodios: items.length, capa: cover?.source ?? existing.source_url ?? "mantida" };
  }

  const [category] = await query<{ id: string }>("SELECT id FROM categories WHERE slug = 'animes-e-mangas' LIMIT 1");
  const [fallback] = previous?.author_id ? [] : await query<{ id: string }>("SELECT id FROM post_authors WHERE kind = 'ai' ORDER BY name LIMIT 1");
  const authorId = previous?.author_id ?? fallback?.id ?? null;
  const id = randomUUID();
  await tx(async (conn) => {
    await conn.query(
      `INSERT INTO posts (id, post_type, slug, status, title, excerpt, content_html, featured_image, image_width, image_height, author_id, is_ai_generated, origin, source_url,
         focus_keyword, reading_minutes, published_at, created_at, updated_at)
       VALUES (?, 'news', ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, 'robo', ?, 'agenda de animes', ?, ?, ?, ?)`,
      [id, post.slug, post.title, post.excerpt, html, cover?.url ?? null, cover?.width ?? null, cover?.height ?? null, authorId, previous?.is_ai_generated ?? 0, cover?.source.slice(0, 600) ?? null, readingMinutes(html), when, when, when],
    );
    if (category) await conn.query("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [id, category.id]);
    for (const name of TAGS) {
      const tagId = await ensureTag(conn as unknown as PostConn, name);
      if (tagId) await conn.query("INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
    }
  });
  clearCache();
  return { criada: post.slug, episodios: items.length, capa: cover?.source ?? "sem capa" };
}
