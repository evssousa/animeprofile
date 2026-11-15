// Contexto verificado de anime para o prompt (1 busca no AniList; aceita só se o nome bater).
import { FORMAT_PT, SEASON_PT, STATUS_PT } from "~/lib/anime";
import { searchAniList, type AniMedia } from "../anime/anilist.server";
import type { AnilistContextForPrompt } from "./prompt";

const normalizeTitle = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Aceita o resultado só se algum título for igual à busca, ou um contiver o outro com ≥ 60% de sobreposição. */
export function isConfidentMatch(query: string, media: Pick<AniMedia, "title">): boolean {
  const qn = normalizeTitle(query);
  if (!qn) return false;
  for (const c of [media.title.romaji, media.title.english, media.title.userPreferred]) {
    const cn = c ? normalizeTitle(c) : "";
    if (!cn) continue;
    if (cn === qn) return true;
    const shorter = cn.length <= qn.length ? cn : qn;
    const longer = cn.length <= qn.length ? qn : cn;
    if (longer.startsWith(shorter) && shorter.length >= 4) return true;
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.6) return true;
  }
  return false;
}

/** Nome provável da obra: o começo do título da fonte, antes de ":", "-" ou "|". */
export function guessAnimeQuery(candidateTitle: string): string {
  const cut = candidateTitle.split(/[:\-–|]/)[0]?.trim();
  return cut && cut.length >= 3 ? cut : candidateTitle.trim();
}

export type AnilistContextResult = { anilistId: number; context: AnilistContextForPrompt } | null;

/** Nunca lança: qualquer falha vira null e o texto sai sem o bloco "Para o fã brasileiro". */
export async function findAnimeContext(candidateTitle: string): Promise<AnilistContextResult> {
  const query = guessAnimeQuery(candidateTitle);
  try {
    const media = await searchAniList(query, 5);
    const m = media.find((x) => isConfidentMatch(query, x));
    if (!m) return null;
    return {
      anilistId: m.id,
      context: {
        title: m.title.english ?? m.title.romaji ?? m.title.userPreferred ?? query,
        format: m.format ? (FORMAT_PT[m.format] ?? m.format) : null,
        episodes: m.episodes ?? null,
        statusLabel: STATUS_PT[m.status ?? ""] ?? "Desconhecido",
        seasonLabel: m.season && m.seasonYear ? `${SEASON_PT[m.season] ?? m.season} ${m.seasonYear}` : null,
        studio: m.studios?.nodes?.[0]?.name ?? null,
        streamers: (m.externalLinks ?? []).filter((l) => l.type === "STREAMING" && l.site).map((l) => l.site as string).slice(0, 5),
      },
    };
  } catch {
    return null;
  }
}
