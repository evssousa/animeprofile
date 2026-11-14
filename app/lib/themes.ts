// Aberturas e encerramentos (AnimeThemes, https://api.animethemes.moe). Chamado pelo navegador: a API é lenta
// (6 a 10 s) e às vezes cai, então nunca pode travar a página no servidor.

export type ThemeItem = {
  key: string;
  src: string; // .webm
  title: string;
  subtitle: string;
  thumb: string;
  type: "OP" | "ED";
  anilistId: number | null;
};

type AtVideo = { link?: string };
type AtTheme = { id: number; type: string; slug?: string; song?: { title?: string | null } | null; animethemeentries?: { videos?: AtVideo[] }[] };
export type AtAnime = {
  id: number;
  name: string;
  images?: { facet?: string; link?: string }[];
  resources?: { site?: string; external_id?: number | null }[];
  animethemes?: AtTheme[];
};

/** Cada abertura/encerramento com vídeo vira um item (OP1, OP2, ED1...). */
export function themeItems(animes: AtAnime[]): ThemeItem[] {
  const out: ThemeItem[] = [];
  for (const a of animes) {
    const thumb = a.images?.find((i) => i.facet === "Large Cover")?.link ?? a.images?.[0]?.link ?? "";
    const anilistId = a.resources?.find((r) => r.site === "AniList")?.external_id ?? null;
    for (const t of a.animethemes ?? []) {
      if (t.type !== "OP" && t.type !== "ED") continue;
      const video = t.animethemeentries?.flatMap((e) => e.videos ?? []).find((v) => v.link);
      if (!video?.link) continue;
      const label = t.slug ?? t.type;
      out.push({
        key: `th:${a.id}:${t.id}`,
        src: video.link,
        title: `${a.name}: ${t.song?.title?.trim() || label}`,
        subtitle: `${t.type === "OP" ? "Abertura" : "Encerramento"} ${label.replace(/^(OP|ED)/, "")}`.trim(),
        thumb,
        type: t.type,
        anilistId,
      });
    }
  }
  return out;
}

// Só os campos usados: a resposta cai pela metade.
const INCLUDE =
  "animethemes.song,animethemes.animethemeentries.videos,images,resources" +
  "&fields[anime]=id,name&fields[animetheme]=id,type,slug&fields[song]=title&fields[video]=link" +
  "&fields[image]=facet,link&fields[resource]=site,external_id";
const SEASON: Record<string, string> = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`AnimeThemes respondeu ${res.status}`);
  return (await res.json()) as T;
}

/** Aberturas e encerramentos dos animes de uma temporada (uma página de 20 animes). */
export async function fetchSeasonThemes(season: string, year: number, page: number, signal?: AbortSignal) {
  const url =
    `https://api.animethemes.moe/anime?filter[year]=${year}&filter[season]=${SEASON[season] ?? season}` +
    `&include=${INCLUDE}&page[size]=20&page[number]=${page}&sort=name`;
  const json = await get<{ anime?: AtAnime[]; links?: { next?: string | null } }>(url, signal);
  return { items: themeItems(json.anime ?? []), hasMore: !!json.links?.next };
}

/** Busca aberturas e encerramentos de qualquer anime pelo nome. */
export async function searchThemes(q: string, signal?: AbortSignal) {
  const url = `https://api.animethemes.moe/search?q=${encodeURIComponent(q)}&fields[search]=anime&limit[anime]=6&include[anime]=${INCLUDE}`;
  const json = await get<{ search?: { anime?: AtAnime[] } }>(url, signal);
  return themeItems(json.search?.anime ?? []);
}
