// Cliente do AniList (GraphQL público e gratuito, sem chave). Limite: ~90 pedidos por minuto; ao receber 429,
// espera o tempo pedido e tenta de novo. Só roda no servidor: as páginas leem do MySQL.
import { cleanDescription, streamersFrom, type Season } from "~/lib/anime";

const URL = "https://graphql.anilist.co";

export type AniMedia = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null; userPreferred: string | null };
  coverImage: { extraLarge: string | null; large: string | null; color: string | null } | null;
  bannerImage: string | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  status: string | null;
  format: string | null;
  season: string | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  genres: string[] | null;
  studios: { nodes: { name: string }[] } | null;
  popularity: number | null;
  favourites: number | null;
  averageScore: number | null;
  isAdult: boolean | null;
  trailer: { id: string | null; site: string | null } | null;
  externalLinks: { site: string | null; type: string | null }[] | null;
  nextAiringEpisode: { airingAt: number; episode: number } | null;
  characters?: {
    edges: {
      role: string;
      node: { id: number; name: { full: string | null }; image: { large: string | null } | null };
      voiceActors: { name: { full: string | null }; image: { large: string | null } | null }[];
    }[];
  };
};

const MEDIA = `id title { romaji english native userPreferred } coverImage { extraLarge large color } bannerImage
  description(asHtml: false) episodes duration status format season seasonYear startDate { year month day }
  genres studios(isMain: true) { nodes { name } } popularity favourites averageScore isAdult
  trailer { id site } externalLinks { site type } nextAiringEpisode { airingAt episode }`;

const CHARACTERS = `characters(sort: [ROLE, RELEVANCE], perPage: 12) { edges { role
  node { id name { full } image { large } } voiceActors(language: JAPANESE) { name { full } image { large } } } }`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}, attempt = 0): Promise<T> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429 && attempt < 3) {
    const wait = Math.min(65, Number(res.headers.get("retry-after")) || 30);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return gql<T>(query, variables, attempt + 1);
  }
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string; status?: number }[] } | null;
  if (!res.ok || !body?.data) {
    const msg = body?.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(`AniList: ${msg}`), { status: res.status });
  }
  return body.data;
}

type PageOf = { Page: { pageInfo: { hasNextPage: boolean }; media: AniMedia[] } };

/** Animes de uma temporada, do mais popular para o menos (até `maxPages` páginas de 50). */
export async function fetchSeason(season: Season, year: number, maxPages = 4): Promise<AniMedia[]> {
  const out: AniMedia[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await gql<PageOf>(
      `query ($season: MediaSeason, $year: Int, $page: Int) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage }
        media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA} } } }`,
      { season, year, page },
    );
    out.push(...d.Page.media);
    if (!d.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

/** Em alta nesta semana (ordem do AniList, que mede a atividade recente). */
export async function fetchTrending(perPage = 50): Promise<AniMedia[]> {
  const d = await gql<PageOf>(`query ($perPage: Int) { Page(perPage: $perPage) { pageInfo { hasNextPage }
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA} } } }`, { perPage });
  return d.Page.media;
}

export type AiringRow = { airingAt: number; episode: number; media: AniMedia };

/** Episódios que vão ao ar entre `from` e `to` (segundos Unix). */
export async function fetchAiring(from: number, to: number, maxPages = 10): Promise<AiringRow[]> {
  const out: AiringRow[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: AiringRow[] } }>(
      `query ($from: Int, $to: Int, $page: Int) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { airingAt episode media { ${MEDIA} } } } }`,
      { from, to, page },
    );
    out.push(...d.Page.airingSchedules.filter((a) => a.media && !a.media.isAdult));
    if (!d.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

/** Ficha completa (com personagens). null se o anime não existe no AniList. */
export async function fetchDetails(id: number): Promise<AniMedia | null> {
  try {
    const d = await gql<{ Media: AniMedia | null }>(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA} ${CHARACTERS} } }`, { id });
    return d.Media;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/** Busca por nome (para a busca de animes). */
export async function searchAniList(search: string, perPage = 24): Promise<AniMedia[]> {
  const d = await gql<PageOf>(`query ($search: String, $perPage: Int) { Page(perPage: $perPage) { pageInfo { hasNextPage }
    media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA} } } }`, { search, perPage });
  return d.Page.media;
}

const sqlDate = (unix: number) => new Date(unix * 1000).toISOString().replace("T", " ").replace("Z", "");

/** Converte o anime do AniList na linha de anime_catalog (sem a sinopse em português, que é nossa). */
export function mediaToRow(m: AniMedia) {
  const sd = m.startDate;
  const start = sd?.year && sd.month && sd.day ? `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(sd.day).padStart(2, "0")}` : null;
  return {
    anilist_id: m.id,
    title: (m.title.userPreferred || m.title.english || m.title.romaji || m.title.native || `Anime ${m.id}`).slice(0, 300),
    title_english: m.title.english?.slice(0, 300) ?? null,
    title_native: m.title.native?.slice(0, 300) ?? null,
    cover_url: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    cover_color: m.coverImage?.color ?? null,
    banner_url: m.bannerImage,
    format: m.format,
    status: m.status,
    episodes: m.episodes,
    duration: m.duration,
    season: m.season,
    season_year: m.seasonYear,
    start_date: start,
    genres: JSON.stringify(m.genres ?? []),
    studios: JSON.stringify((m.studios?.nodes ?? []).map((s) => s.name)),
    popularity: m.popularity ?? 0,
    favourites: m.favourites ?? 0,
    average_score: m.averageScore,
    synopsis_en: cleanDescription(m.description) || null,
    trailer_youtube: m.trailer?.site === "youtube" && m.trailer.id ? m.trailer.id : null,
    streamers: JSON.stringify(streamersFrom(m.externalLinks)),
    is_adult: m.isAdult ? 1 : 0,
    next_episode: m.nextAiringEpisode?.episode ?? null,
    next_airing_at: m.nextAiringEpisode ? sqlDate(m.nextAiringEpisode.airingAt) : null,
  };
}

/** Personagens principais com o dublador japonês (guardados em anime_catalog.characters). */
export function charactersOf(m: AniMedia) {
  return (m.characters?.edges ?? []).map((e) => ({
    id: e.node.id,
    name: e.node.name.full ?? "",
    image: e.node.image?.large ?? null,
    role: e.role === "MAIN" ? "Principal" : e.role === "SUPPORTING" ? "Coadjuvante" : "Figurante",
    voice: e.voiceActors[0] ? { name: e.voiceActors[0].name.full ?? "", image: e.voiceActors[0].image?.large ?? null } : null,
  }));
}

export const airingSqlDate = sqlDate;

export type AniCharacter = {
  id: number;
  name: { full: string | null; native: string | null; alternative: string[] | null };
  image: { large: string | null } | null;
  description: string | null;
  gender: string | null;
  dateOfBirth: { year: number | null; month: number | null; day: number | null } | null;
  age: string | null;
  bloodType: string | null;
  favourites: number | null;
  media: {
    edges: {
      characterRole: string;
      voiceActors: { id: number; name: { full: string | null; native: string | null }; image: { large: string | null } | null }[];
      node: { id: number; title: { userPreferred: string | null }; coverImage: { large: string | null; color: string | null } | null; format: string | null; seasonYear: number | null; isAdult: boolean | null };
    }[];
  } | null;
};

/** Ficha do personagem com os animes em que aparece e os dubladores japoneses. null se não existe. */
export async function fetchCharacter(id: number): Promise<AniCharacter | null> {
  try {
    const d = await gql<{ Character: AniCharacter | null }>(
      `query ($id: Int) { Character(id: $id) { id name { full native alternative } image { large } description(asHtml: false)
        gender dateOfBirth { year month day } age bloodType favourites
        media(type: ANIME, sort: POPULARITY_DESC, perPage: 25) { edges { characterRole
          voiceActors(language: JAPANESE) { id name { full native } image { large } }
          node { id title { userPreferred } coverImage { large color } format seasonYear isAdult } } } } }`,
      { id },
    );
    return d.Character;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
