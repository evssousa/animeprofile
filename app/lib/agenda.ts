// Agenda de animes da semana (matéria publicada toda segunda às 9h, em Brasília), a partir do catálogo de animes do
// banco. Funções puras, sem banco, para testar. A tarefa que publica fica em app/server/agenda/agenda.server.ts.

const TZ = "America/Sao_Paulo";
const WEEK = 7 * 24 * 3600;
const BRT_OFFSET_H = 3; // Brasília é UTC-3 (sem horário de verão)

export type AgendaSource = {
  anilistId: number;
  title: string;
  popularity: number;
  /** Total de episódios, se o AniList souber. */
  episodes: number | null;
  /** Próximo episódio conhecido e quando ele vai ao ar (segundos UTC). */
  nextEpisode: number;
  nextAiringAt: number;
  cover: string | null;
  banner: string | null;
  /** Nomes de exibição ("Crunchyroll", "Prime Video"...). */
  streamers: string[];
};

export type AgendaItem = {
  anilistId: number;
  title: string;
  episode: number;
  airingAt: number; // segundos (UTC)
  premiere: boolean;
  popularity: number;
  cover: string | null;
  banner: string | null;
  streamers: string[];
};

/** Segunda 00:00 → domingo 23:59:59 (Brasília) da semana de `now`, em segundos UTC. */
export function weekBounds(now: Date): { start: number; end: number } {
  const local = new Date(now.getTime() - BRT_OFFSET_H * 3600_000);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = segunda
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
  const start = startLocal / 1000 + BRT_OFFSET_H * 3600;
  return { start, end: start + WEEK - 1 };
}

/**
 * Episódios da semana: projeta o próximo episódio conhecido em passos de 7 dias (anime semanal).
 * Se o catálogo estiver um pouco desatualizado (episódio já passou), anda para frente; se o episódio
 * conhecido for depois da semana, volta (desde que não fique antes do 1º).
 */
export function agendaForWeek(rows: AgendaSource[], start: number, end: number): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const r of rows) {
    if (!r.nextAiringAt || !r.nextEpisode) continue;
    let t = r.nextAiringAt;
    let ep = r.nextEpisode;
    while (t < start) {
      t += WEEK;
      ep += 1;
    }
    while (t - WEEK >= start && ep - 1 >= 1) {
      t -= WEEK;
      ep -= 1;
    }
    if (t > end) continue;
    if (r.episodes && ep > r.episodes) continue;
    out.push({
      anilistId: r.anilistId,
      title: r.title,
      episode: ep,
      airingAt: t,
      premiere: ep === 1,
      popularity: r.popularity ?? 0,
      cover: r.cover,
      banner: r.banner,
      streamers: r.streamers,
    });
  }
  return out.sort((a, b) => a.airingAt - b.airingAt || b.popularity - a.popularity);
}

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Agrupa por dia (segunda a domingo, horário de Brasília). */
export function groupByDay(items: AgendaItem[], start: number): { day: string; date: string; items: AgendaItem[] }[] {
  return DAY_NAMES.map((day, i) => {
    const dayStart = start + i * 86400;
    return { day, date: fmtDate(dayStart), items: items.filter((it) => it.airingAt >= dayStart && it.airingAt < dayStart + 86400) };
  }).filter((d) => d.items.length > 0);
}

export function fmtDate(sec: number): string {
  return new Date(sec * 1000).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}
export function fmtTime(sec: number): string {
  return new Date(sec * 1000).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function agendaSlug(start: number): string {
  const end = start + WEEK - 1;
  const y = new Date(end * 1000).toLocaleDateString("pt-BR", { timeZone: TZ, year: "numeric" });
  return `agenda-de-animes-${fmtDate(start).replace("/", "-")}-a-${fmtDate(end).replace("/", "-")}-${y}`;
}

export const isAgendaSlug = (slug: string) => slug.startsWith("agenda-de-animes-");

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Título, resumo e texto (HTML) da matéria da semana. */
export function buildAgendaPost(items: AgendaItem[], start: number): { title: string; excerpt: string; html: string; slug: string } {
  const end = start + WEEK - 1;
  const range = `${fmtDate(start)} a ${fmtDate(end)}`;
  const days = groupByDay(items, start);
  const premieres = items.filter((i) => i.premiere);
  const top = [...items].sort((a, b) => b.popularity - a.popularity);
  const title = `Agenda de animes da semana: episódios de ${range}`;
  const excerpt = `${items.length} episódios na semana de ${range}${premieres.length ? `, com ${premieres.length} estreia${premieres.length > 1 ? "s" : ""}` : ""}: dia, horário de Brasília e onde assistir.`;
  const highlights = top.slice(0, 3).map((i) => `<a href="/animes/${i.anilistId}">${esc(i.title)}</a>`);
  const where = (i: AgendaItem) => (i.streamers.length ? ` · ${esc(i.streamers.join(", "))}` : "");
  const parts: string[] = [
    `<p>Esta é a agenda de animes da semana de ${range}, com ${items.length} episódios em exibição no Japão.</p>`,
    `<p>O dia e o horário estão em <strong>horário de Brasília</strong>, que é quando o episódio costuma chegar legendado às plataformas de streaming. Entre os destaques da semana estão ${highlights.join(", ")}.</p>`,
  ];
  if (premieres.length) {
    parts.push(
      `<h2>Estreias da semana</h2>`,
      `<ul>${premieres.map((i) => `<li><a href="/animes/${i.anilistId}">${esc(i.title)}</a> — ${DAY_NAMES[Math.floor((i.airingAt - start) / 86400)]?.toLowerCase() ?? ""}, ${fmtDate(i.airingAt)}, às ${fmtTime(i.airingAt)}${where(i)}</li>`).join("")}</ul>`,
    );
  }
  for (const d of days) {
    parts.push(
      `<h2>${d.day} (${d.date})</h2>`,
      `<ul>${d.items.map((i) => `<li><strong>${fmtTime(i.airingAt)}</strong> — <a href="/animes/${i.anilistId}">${esc(i.title)}</a>, episódio ${i.episode}${i.premiere ? " (estreia)" : ""}${where(i)}</li>`).join("")}</ul>`,
    );
  }
  parts.push(
    `<h2>Como usar a agenda</h2>`,
    `<p>Os horários são os da exibição original no Japão, convertidos para Brasília.</p>`,
    `<p>A versão legendada costuma sair no mesmo dia, poucas horas depois, e a dublada tem calendário próprio. Abra a página de cada anime para ver os detalhes e onde assistir. Atrasos e pausas de última hora podem acontecer.</p>`,
  );
  return { title, excerpt: excerpt.slice(0, 260), html: parts.join("\n"), slug: agendaSlug(start) };
}

/** Imagens candidatas à capa: o banner (largo) dos animes mais populares da semana; sem banner, a capa em pé. Sem repetir endereço. */
export function agendaCoverCandidates(items: AgendaItem[], limit = 8): string[] {
  const top = [...items].sort((a, b) => b.popularity - a.popularity);
  const seenAnime = new Set<number>();
  const banners: string[] = [];
  const covers: string[] = [];
  for (const i of top) {
    if (seenAnime.has(i.anilistId)) continue;
    seenAnime.add(i.anilistId);
    if (i.banner) banners.push(i.banner);
    else if (i.cover) covers.push(i.cover);
    if (banners.length >= limit) break;
  }
  return [...new Set([...banners, ...covers])].slice(0, limit);
}

/**
 * Ordem em que as capas devem ser tentadas: **gira a cada semana** (para a capa não ser sempre a do anime mais popular) e
 * deixa por último a da semana anterior (`previous`), para duas semanas seguidas nunca terem a mesma imagem.
 */
export function pickAgendaCover(candidates: string[], weekStart: number, previous: string | null): string[] {
  if (candidates.length === 0) return [];
  const week = Math.floor(weekStart / WEEK);
  const from = ((week % candidates.length) + candidates.length) % candidates.length;
  const rotated = [...candidates.slice(from), ...candidates.slice(0, from)];
  if (!previous || candidates.length < 2) return rotated;
  return [...rotated.filter((u) => u !== previous), ...rotated.filter((u) => u === previous)];
}
