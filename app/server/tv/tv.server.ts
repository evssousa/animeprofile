// Otaku TV: vídeos das matérias (YouTube dentro do texto) e trailers da temporada (guardados com os animes).
// As aberturas e encerramentos (AnimeThemes) vêm direto do navegador: a API deles é lenta e às vezes cai.
import { SEASON_PT, currentSeason } from "~/lib/anime";
import { VISIBLE, postUrl, type PostType } from "../content/posts.server";
import { hasDatabase, iso, query, tx } from "../db.server";

export type TvVideo = {
  id: string; // id do YouTube
  title: string;
  subtitle: string;
  badge: string;
  date: string | null;
  excerpt: string | null;
  postUrl: string | null;
  animeId: number | null;
  animeUrl: string | null;
};

const YT = /(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/g;

/** Ids de vídeo do YouTube (sem repetir) que aparecem num texto HTML. */
export function youtubeIds(html: string): string[] {
  return [...new Set([...html.matchAll(YT)].map((m) => m[1]))];
}

/** Refaz post_videos a partir do texto de todas as matérias. */
export async function rebuildPostVideos() {
  const rows = await query<{ id: string; content_html: string }>("SELECT id, content_html FROM posts WHERE content_html LIKE '%youtu%'");
  const pairs = rows.flatMap((r) => youtubeIds(r.content_html).map((v) => [v, r.id]));
  await tx(async (conn) => {
    await conn.query("DELETE FROM post_videos");
    for (let i = 0; i < pairs.length; i += 500) {
      const chunk = pairs.slice(i, i + 500);
      await conn.query(`INSERT IGNORE INTO post_videos (video_id, post_id) VALUES ${chunk.map(() => "(?, ?)").join(", ")}`, chunk.flat());
    }
  });
  return { materiasComVideo: new Set(pairs.map((p) => p[1])).size, videos: new Set(pairs.map((p) => p[0])).size };
}

type PostVideoRow = { video_id: string; title: string; excerpt: string | null; post_type: PostType; slug: string; published_at: string; anilist_id: number | null };

const fromPost = (r: PostVideoRow): TvVideo => ({
  id: r.video_id,
  title: r.title,
  subtitle: r.post_type === "article" ? "Artigo" : "Notícia",
  badge: r.post_type === "article" ? "Artigo" : "Notícia",
  date: iso(r.published_at) ?? null,
  excerpt: r.excerpt,
  postUrl: postUrl(r.post_type, r.slug),
  animeId: r.anilist_id == null ? null : Number(r.anilist_id),
  animeUrl: r.anilist_id == null ? null : `/animes/${r.anilist_id}`,
});

const paginate = <T>(all: T[], page: number, perPage: number) => {
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const current = Math.min(Math.max(1, page), pages);
  return { items: all.slice((current - 1) * perPage, current * perPage), total: all.length, page: current, pages };
};

const likeOf = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/** Vídeos das matérias publicadas, do mais novo para o mais antigo (cada vídeo uma vez, na matéria mais recente). */
export async function listPostVideos(q: string, page: number, perPage = 24) {
  if (!hasDatabase()) return paginate<TvVideo>([], 1, perPage);
  const rows = await query<PostVideoRow>(
    `SELECT v.video_id, p.title, p.excerpt, p.post_type, p.slug, p.published_at, p.anilist_id
     FROM post_videos v JOIN posts p ON p.id = v.post_id WHERE ${VISIBLE} ${q ? "AND p.title LIKE ?" : ""}
     ORDER BY p.published_at DESC`,
    q ? [likeOf(q)] : [],
  );
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.video_id) ? false : seen.add(r.video_id)));
  return paginate(unique.map(fromPost), page, perPage);
}

/** Trailers dos animes da temporada atual, dos mais populares para os menos. */
export async function listTrailers(q: string, page: number, perPage = 24) {
  const season = currentSeason();
  const label = `${SEASON_PT[season.season]} ${season.year}`;
  if (!hasDatabase()) return { ...paginate<TvVideo>([], 1, perPage), label };
  const rows = await query<{ anilist_id: number; title: string; trailer_youtube: string }>(
    `SELECT anilist_id, title, trailer_youtube FROM anime_catalog
     WHERE season = ? AND season_year = ? AND is_adult = 0 AND trailer_youtube IS NOT NULL ${q ? "AND title LIKE ?" : ""} ORDER BY popularity DESC`,
    q ? [season.season, season.year, likeOf(q)] : [season.season, season.year],
  );
  const all: TvVideo[] = rows.map((r) => ({
    id: r.trailer_youtube,
    title: r.title,
    subtitle: `Trailer · ${label}`,
    badge: "Trailer",
    date: null,
    excerpt: null,
    postUrl: null,
    animeId: Number(r.anilist_id),
    animeUrl: `/animes/${r.anilist_id}`,
  }));
  return { ...paginate(all, page, perPage), label };
}

/** Um vídeo pelo id do YouTube (link `/otaku-tv?v=...`): a matéria mais recente que o tem, ou o trailer de um anime. */
export async function findVideo(id: string): Promise<TvVideo | null> {
  if (!hasDatabase() || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const [post] = await query<PostVideoRow>(
    `SELECT v.video_id, p.title, p.excerpt, p.post_type, p.slug, p.published_at, p.anilist_id
     FROM post_videos v JOIN posts p ON p.id = v.post_id WHERE v.video_id = ? AND ${VISIBLE} ORDER BY p.published_at DESC LIMIT 1`,
    [id],
  );
  if (post) return fromPost(post);
  const [anime] = await query<{ anilist_id: number; title: string }>("SELECT anilist_id, title FROM anime_catalog WHERE trailer_youtube = ? AND is_adult = 0 LIMIT 1", [id]);
  return anime
    ? { id, title: anime.title, subtitle: "Trailer", badge: "Trailer", date: null, excerpt: null, postUrl: null, animeId: Number(anime.anilist_id), animeUrl: `/animes/${anime.anilist_id}` }
    : null;
}

/** Os vídeos mais recentes das matérias, para a página inicial. */
export async function latestTvVideos(limit = 5) {
  return (await listPostVideos("", 1, limit)).items;
}
