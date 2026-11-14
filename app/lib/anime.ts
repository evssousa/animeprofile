// Rótulos e regras de animes que valem no servidor e no navegador (traduções do AniList, streamings, temporada).

export type Season = "WINTER" | "SPRING" | "SUMMER" | "FALL";

/** Temporada atual, pelo calendário de animes (jan–mar inverno, abr–jun primavera, jul–set verão, out–dez outono). */
export function currentSeason(now = new Date()): { season: Season; year: number } {
  const m = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  if (m <= 3) return { season: "WINTER", year };
  if (m <= 6) return { season: "SPRING", year };
  if (m <= 9) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

export const SEASON_PT: Record<string, string> = { WINTER: "Inverno", SPRING: "Primavera", SUMMER: "Verão", FALL: "Outono" };

export const FORMAT_PT: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV curta",
  MOVIE: "Filme",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Música",
};

export const STATUS_PT: Record<string, string> = {
  RELEASING: "Em lançamento",
  FINISHED: "Finalizado",
  NOT_YET_RELEASED: "Ainda não estreou",
  CANCELLED: "Cancelado",
  HIATUS: "Em hiato",
};

const GENRES_PT: Record<string, string> = {
  Action: "Ação",
  Adventure: "Aventura",
  Comedy: "Comédia",
  Drama: "Drama",
  Ecchi: "Ecchi",
  Fantasy: "Fantasia",
  Horror: "Terror",
  "Mahou Shoujo": "Garota mágica",
  Mecha: "Mecha",
  Music: "Música",
  Mystery: "Mistério",
  Psychological: "Psicológico",
  Romance: "Romance",
  "Sci-Fi": "Ficção científica",
  "Slice of Life": "Slice of life",
  Sports: "Esportes",
  Supernatural: "Sobrenatural",
  Thriller: "Suspense",
};
export const genrePt = (g: string) => GENRES_PT[g] ?? g;

/** Streamings mostrados para o público brasileiro (mesma lista do site antigo). */
export type StreamerKey = "netflix" | "crunchyroll" | "disney" | "prime" | "hbo";
export const STREAMERS: Record<StreamerKey, { label: string; color: string }> = {
  netflix: { label: "Netflix", color: "#e50914" },
  crunchyroll: { label: "Crunchyroll", color: "#f47521" },
  disney: { label: "Disney+", color: "#113ccf" },
  prime: { label: "Prime Video", color: "#00a8e1" },
  hbo: { label: "HBO Max", color: "#5822b4" },
};
const STREAMER_NEEDLES: [StreamerKey, string[]][] = [
  ["netflix", ["netflix"]],
  ["crunchyroll", ["crunchyroll"]],
  ["disney", ["disney"]],
  ["prime", ["prime video", "amazon prime"]],
  ["hbo", ["hbo", "max"]],
];

/** Streamings (da lista acima) onde o anime está, pelos links externos do AniList. */
export function streamersFrom(links: { site: string | null; type: string | null }[] | null | undefined): StreamerKey[] {
  const found = new Set<StreamerKey>();
  for (const l of links ?? []) {
    if (l.type && l.type !== "STREAMING") continue;
    const site = (l.site ?? "").toLowerCase();
    for (const [key, needles] of STREAMER_NEEDLES) if (needles.some((n) => site.includes(n))) found.add(key);
  }
  return [...found];
}

/** Descrição do AniList em texto: quebras de linha mantidas, tags e marcações tiradas. */
export function cleanDescription(d: string | null | undefined): string {
  if (!d) return "";
  return d
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/anilist\.co\/[^)]*\)/gi, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const animeUrl = (id: number) => `/animes/${id}`;

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" });
const dayLabelFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/** "14:30" no horário de Brasília. */
export const airTime = (iso: string) => timeFmt.format(new Date(iso));
/** "2026-11-14": o dia em Brasília (para agrupar o calendário). */
export const brDay = (d: Date | string) => dayKeyFmt.format(new Date(d));
/** "sexta-feira, 14 de novembro". */
export const brDayLabel = (d: Date | string) => dayLabelFmt.format(new Date(d));
