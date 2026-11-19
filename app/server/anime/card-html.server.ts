// Card "Sobre o anime" das matérias (como no site antigo): banner, pôster, dados, sinopse curta, gêneros, streamings e o link para a
// página do anime. Gerado no servidor como HTML (vale para a matéria e para os cards colocados no texto pelo editor), então
// funciona sem JavaScript e conta como link interno. Tudo que vem do banco passa por `esc`.
import { cleanDescription, FORMAT_PT, genrePt, SEASON_PT, STATUS_PT, STREAMERS } from "~/lib/anime";
import { getAnime, type AnimeFull } from "./anime.server";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const https = (u: string | null) => (u && /^https:\/\//i.test(u) ? esc(u) : null);

export function animeCardHtml(a: AnimeFull): string {
  const titulo = esc(a.title);
  const detalhes = [
    a.format ? (FORMAT_PT[a.format] ?? a.format) : null,
    a.episodes ? `${a.episodes} ep.` : null,
    a.status ? (STATUS_PT[a.status] ?? a.status) : null,
    a.season && a.seasonYear ? `${SEASON_PT[a.season] ?? a.season} ${a.seasonYear}` : null,
    a.studios[0] ?? null,
  ].filter((x): x is string => !!x);
  const sinopse = cleanDescription(a.synopsis).split("\n").find((p) => p.trim().length > 0) ?? "";
  const banner = https(a.banner);
  const capa = https(a.cover);
  const generos = a.genres.slice(0, 3).map((g) => `<span class="anc-tag">${esc(genrePt(g))}</span>`).join("");
  const streams = a.streamers.map((k) => `<span class="anc-stream" style="background:${STREAMERS[k].color}">${esc(STREAMERS[k].label)}</span>`).join("");
  return (
    `<a href="/animes/${a.id}" class="anime-news-card" data-anime-card-render="${a.id}">` +
    `<span class="anc-banner">${banner ? `<img src="${banner}" alt="" loading="lazy">` : ""}<span class="anc-shade"></span>` +
    `<span class="anc-kicker">Sobre o anime</span><span class="anc-title">${titulo}</span></span>` +
    `<span class="anc-body">${capa ? `<img class="anc-cover" src="${capa}" alt="${titulo}" loading="lazy" width="80" height="112">` : ""}` +
    `<span class="anc-info">${detalhes.length ? `<span class="anc-meta">${detalhes.map(esc).join(" · ")}</span>` : ""}` +
    `${sinopse ? `<span class="anc-syn">${esc(sinopse)}</span>` : ""}` +
    `<span class="anc-tags">${generos}${streams}</span></span></span>` +
    `<span class="anc-cta">Ver página completa do anime →</span></a>`
  );
}

const EMBED = /<div\b[^>]*data-anime-card="(\d+)"[^>]*>[\s\S]*?<\/div>/gi;

/** Troca, no texto da matéria, cada card colocado pelo editor (`<div data-anime-card="ID">`) pelo card completo. Sem o anime no banco, fica o link simples. */
export async function injetarCardsAnime(html: string): Promise<string> {
  const ids = [...new Set([...html.matchAll(EMBED)].map((m) => Number(m[1])))].slice(0, 8);
  if (!ids.length) return html;
  const cards = new Map<number, string>();
  await Promise.all(
    ids.map(async (id) => {
      const a = await getAnime(id, { remote: false }).catch(() => null);
      if (a) cards.set(id, animeCardHtml(a));
    }),
  );
  return html.replace(EMBED, (todo, id) => cards.get(Number(id)) ?? todo);
}
