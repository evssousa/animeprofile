// Animes no MySQL: gravação do que vem do AniList (tarefa "animes-anilist") e as consultas das páginas.
import { currentSeason, type Season, type StreamerKey } from "~/lib/anime";
import { exec, hasDatabase, iso, json, query, tx } from "../db.server";
import { RemoteUnavailable } from "./remote-guard.server";
import { airingSqlDate, charactersOf, fetchAiring, fetchDetails, fetchSeason, fetchTrending, mediaToRow, searchAniList, type AniMedia } from "./anilist.server";

export type AnimeCard = {
  id: number;
  url: string;
  title: string;
  cover: string | null;
  color: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  season: string | null;
  seasonYear: number | null;
  genres: string[];
  score: number | null;
  streamers: StreamerKey[];
  nextEpisode: number | null;
  nextAiringAt: string | null;
};

export type AnimeFull = AnimeCard & {
  titleEnglish: string | null;
  titleNative: string | null;
  banner: string | null;
  duration: number | null;
  startDate: string | null;
  studios: string[];
  popularity: number;
  favourites: number;
  synopsis: string | null;
  synopsisLang: "pt" | "en" | null;
  trailer: string | null;
  characters: ReturnType<typeof charactersOf>;
};

const CARD_COLS = `c.anilist_id, c.title, c.cover_url, c.cover_color, c.format, c.status, c.episodes, c.season, c.season_year,
  c.genres, c.average_score, c.streamers, c.next_episode, c.next_airing_at`;

type CardRow = {
  anilist_id: number;
  title: string;
  cover_url: string | null;
  cover_color: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  season: string | null;
  season_year: number | null;
  genres: unknown;
  average_score: number | null;
  streamers: unknown;
  next_episode: number | null;
  next_airing_at: string | null;
};

function toCard(r: CardRow): AnimeCard {
  return {
    id: Number(r.anilist_id),
    url: `/animes/${r.anilist_id}`,
    title: r.title,
    cover: r.cover_url,
    color: r.cover_color,
    format: r.format,
    status: r.status,
    episodes: r.episodes == null ? null : Number(r.episodes),
    season: r.season,
    seasonYear: r.season_year == null ? null : Number(r.season_year),
    genres: json<string[]>(r.genres, []),
    score: r.average_score == null ? null : Number(r.average_score),
    streamers: json<StreamerKey[]>(r.streamers, []),
    nextEpisode: r.next_episode == null ? null : Number(r.next_episode),
    nextAiringAt: iso(r.next_airing_at) ?? null,
  };
}

// ---------------------------------------------------------------------------------------------- gravação

const UPDATABLE = [
  "title", "title_english", "title_native", "cover_url", "cover_color", "banner_url", "format", "status", "episodes", "duration",
  "season", "season_year", "start_date", "genres", "studios", "popularity", "favourites", "average_score", "synopsis_en",
  "trailer_youtube", "streamers", "is_adult", "next_episode", "next_airing_at",
];

/** Insere ou atualiza animes vindos do AniList. Nunca apaga a sinopse em português nem os personagens. */
export async function upsertMedia(media: AniMedia[]) {
  const rows = [...new Map(media.map((m) => [m.id, mediaToRow(m)])).values()];
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await exec(
      `INSERT INTO anime_catalog (${cols.join(", ")}) VALUES ${chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ")}
       ON DUPLICATE KEY UPDATE ${UPDATABLE.map((c) => `${c} = VALUES(${c})`).join(", ")}`,
      chunk.flatMap((r) => cols.map((c) => (r as Record<string, unknown>)[c])),
    );
  }
  return rows.length;
}

/**
 * Tarefa "animes-anilist" (a cada 6 h): temporada atual, em alta nesta semana e os episódios dos próximos 8 dias.
 * São ~15 pedidos ao AniList, bem abaixo do limite.
 */
export async function syncAnimes(now = new Date()) {
  const { season, year } = currentSeason(now);
  const from = Math.floor(now.getTime() / 1000) - 2 * 86400;
  const to = Math.floor(now.getTime() / 1000) + 8 * 86400;
  const seasonMedia = await fetchSeason(season, year);
  const trending = await fetchTrending(50);
  const airing = await fetchAiring(from, to);

  await upsertMedia([...seasonMedia, ...trending, ...airing.map((a) => a.media)]);
  await tx(async (conn) => {
    await conn.query("UPDATE anime_catalog SET trending_rank = NULL WHERE trending_rank IS NOT NULL");
    for (const [i, m] of trending.entries()) await conn.query("UPDATE anime_catalog SET trending_rank = ? WHERE anilist_id = ?", [i + 1, m.id]);
    await conn.query("DELETE FROM anime_airing WHERE airing_at < UTC_TIMESTAMP(3) - INTERVAL 2 DAY");
    for (let i = 0; i < airing.length; i += 200) {
      const chunk = airing.slice(i, i + 200);
      await conn.query(
        `INSERT INTO anime_airing (anilist_id, episode, airing_at) VALUES ${chunk.map(() => "(?, ?, ?)").join(", ")}
         ON DUPLICATE KEY UPDATE airing_at = VALUES(airing_at)`,
        chunk.flatMap((a) => [a.media.id, a.episode, airingSqlDate(a.airingAt)]),
      );
    }
  });
  return { temporada: `${season} ${year}`, animesDaTemporada: seasonMedia.length, emAlta: trending.length, episodes: airing.length };
}

/** Sinopses em português do site antigo (importação). Cria a linha se o anime ainda não estiver no catálogo. */
export async function importSynopses(rows: { anilist_id: number; title: string; synopsis_pt: string | null }[]) {
  const valid = rows.filter((r) => r.synopsis_pt?.trim());
  for (let i = 0; i < valid.length; i += 200) {
    const chunk = valid.slice(i, i + 200);
    await exec(
      `INSERT INTO anime_catalog (anilist_id, title, synopsis_pt) VALUES ${chunk.map(() => "(?, ?, ?)").join(", ")}
       ON DUPLICATE KEY UPDATE synopsis_pt = VALUES(synopsis_pt)`,
      chunk.flatMap((r) => [r.anilist_id, r.title.slice(0, 300), r.synopsis_pt!.trim()]),
    );
  }
  return valid.length;
}

// ---------------------------------------------------------------------------------------------- consultas

export async function seasonAnimes(limit = 48, offset = 0, ref = currentSeason()) {
  if (!hasDatabase()) return { season: ref.season as Season, year: ref.year, items: [] as AnimeCard[], total: 0 };
  const [count] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM anime_catalog WHERE season = ? AND season_year = ? AND is_adult = 0", [ref.season, ref.year]);
  const rows = await query<CardRow>(
    `SELECT ${CARD_COLS} FROM anime_catalog c WHERE c.season = ? AND c.season_year = ? AND c.is_adult = 0 ORDER BY c.popularity DESC LIMIT ? OFFSET ?`,
    [ref.season, ref.year, limit, offset],
  );
  return { season: ref.season, year: ref.year, items: rows.map(toCard), total: Number(count?.n ?? 0) };
}

/** Em alta nesta semana. Prefere os que estão em algum streaming do Brasil, como o site antigo. */
export async function trendingAnimes(limit = 10) {
  if (!hasDatabase()) return [];
  const rows = await query<CardRow & { trending_rank: number }>(
    `SELECT ${CARD_COLS}, c.trending_rank FROM anime_catalog c WHERE c.trending_rank IS NOT NULL AND c.is_adult = 0 ORDER BY c.trending_rank LIMIT 50`,
  );
  const cards = rows.map(toCard);
  return [...cards.filter((c) => c.streamers.length), ...cards.filter((c) => !c.streamers.length)].slice(0, limit);
}

export type AiringItem = { anime: AnimeCard; episode: number; airingAt: string };

/**
 * Episódios entre duas datas (calendário e "No ar hoje"), na ordem do horário.
 * Com `top`, pega só os N animes mais populares do período (home), ainda na ordem do horário.
 */
export async function airingBetween(from: Date, to: Date, top?: number): Promise<AiringItem[]> {
  if (!hasDatabase()) return [];
  const rows = await query<CardRow & { ep: number; at: string }>(
    `SELECT ${CARD_COLS}, a.episode AS ep, a.airing_at AS at FROM anime_airing a JOIN anime_catalog c ON c.anilist_id = a.anilist_id
     WHERE a.airing_at >= ? AND a.airing_at < ? AND c.is_adult = 0
     ORDER BY ${top ? "c.popularity DESC LIMIT ?" : "a.airing_at, c.popularity DESC"}`,
    top ? [from, to, top] : [from, to],
  );
  return rows
    .map((r) => ({ anime: toCard(r), episode: Number(r.ep), airingAt: iso(r.at)! }))
    .sort((a, b) => a.airingAt.localeCompare(b.airingAt));
}

const DETAILS_MAX_AGE_MS = 3 * 86400_000;

/**
 * Ficha do anime. Lê do banco; se o anime não estiver guardado (link antigo, busca) ou a ficha completa estiver
 * velha, busca no AniList e guarda. Se o AniList falhar, mostra o que já tem.
 * `remote: false` (robôs, ou limite de buscas por minuto atingido) nunca busca: usa só o que está guardado.
 */
export async function getAnime(id: number, { remote = true }: { remote?: boolean } = {}): Promise<AnimeFull | null> {
  if (!hasDatabase() || !Number.isInteger(id) || id <= 0) return null;
  let row = await loadFull(id);
  const stale = !row || !row.details_at || Date.now() - new Date(iso(row.details_at)!).getTime() > DETAILS_MAX_AGE_MS;
  // Sem ficha guardada (ou só com a sinopse antiga) e sem cota para buscar agora: 503, não 404.
  if (!remote && (!row || !row.cover_url)) throw new RemoteUnavailable();
  if (stale && remote) {
    try {
      const media = await fetchDetails(id);
      if (!media) return null;
      if (media.isAdult) return null;
      await upsertMedia([media]);
      await exec("UPDATE anime_catalog SET characters = ?, details_at = UTC_TIMESTAMP(3) WHERE anilist_id = ?", [JSON.stringify(charactersOf(media)), id]);
      row = await loadFull(id);
    } catch (err) {
      console.error(`[anime] ficha ${id} no AniList falhou:`, (err as Error).message);
      if (!row) throw err;
    }
  }
  if (!row) return null;
  const synopsis = row.synopsis_pt?.trim() || row.synopsis_en?.trim() || null;
  return {
    ...toCard(row),
    titleEnglish: row.title_english,
    titleNative: row.title_native,
    banner: row.banner_url,
    duration: row.duration == null ? null : Number(row.duration),
    startDate: row.start_date,
    studios: json<string[]>(row.studios, []),
    popularity: Number(row.popularity),
    favourites: Number(row.favourites),
    synopsis,
    synopsisLang: row.synopsis_pt?.trim() ? "pt" : synopsis ? "en" : null,
    trailer: row.trailer_youtube,
    characters: json<ReturnType<typeof charactersOf>>(row.characters, []),
  };
}

async function loadFull(id: number) {
  const [r] = await query<
    CardRow & {
      title_english: string | null;
      title_native: string | null;
      banner_url: string | null;
      duration: number | null;
      start_date: string | null;
      studios: unknown;
      popularity: number;
      favourites: number;
      synopsis_en: string | null;
      synopsis_pt: string | null;
      trailer_youtube: string | null;
      characters: unknown;
      details_at: string | null;
    }
  >(
    `SELECT ${CARD_COLS}, c.title_english, c.title_native, c.banner_url, c.duration, c.start_date, c.studios, c.popularity, c.favourites,
            c.synopsis_en, c.synopsis_pt, c.trailer_youtube, c.characters, c.details_at
     FROM anime_catalog c WHERE c.anilist_id = ? AND c.is_adult = 0`,
    [id],
  );
  return r;
}

/** Busca de animes por nome: pergunta ao AniList e guarda o resultado (as próximas visitas leem do banco). */
export async function searchAnimes(q: string) {
  const media = await searchAniList(q, 24);
  await upsertMedia(media);
  return media.filter((m) => !m.isAdult).map((m) => toCard({ ...(mediaToRow(m) as unknown as CardRow), average_score: m.averageScore }));
}

/** Para o sitemap: animes com ficha no banco. */
export async function animeIdsForSitemap() {
  if (!hasDatabase()) return [];
  // Só fichas completas (vindas do AniList); as linhas criadas só com a sinopse antiga ficam de fora até alguém abrir.
  return query<{ anilist_id: number; synced_at: string }>(
    "SELECT anilist_id, synced_at FROM anime_catalog WHERE is_adult = 0 AND cover_url IS NOT NULL ORDER BY popularity DESC LIMIT 5000",
  );
}
