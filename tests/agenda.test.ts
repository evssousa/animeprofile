import { describe, expect, it } from "vitest";
import { agendaCoverCandidates, agendaForWeek, agendaSlug, buildAgendaPost, groupByDay, isAgendaSlug, pickAgendaCover, weekBounds, type AgendaSource } from "~/lib/agenda";

// Quarta, 15/10/2026 12:00 em Brasília (15:00 UTC).
const NOW = new Date("2026-10-15T15:00:00Z");
const { start, end } = weekBounds(NOW);
const at = (iso: string) => Date.parse(iso) / 1000;

const row = (id: number, title: string, airingIso: string, episode: number, extra: Partial<AgendaSource> = {}, popularity = 1000): AgendaSource => ({
  anilistId: id,
  title,
  popularity,
  episodes: null,
  nextEpisode: episode,
  nextAiringAt: at(airingIso),
  cover: null,
  banner: null,
  streamers: [],
  ...extra,
});

describe("agenda da semana", () => {
  it("semana de segunda 00:00 a domingo 23:59 em Brasília", () => {
    expect(new Date(start * 1000).toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(new Date((end + 1) * 1000).toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });

  it("projeta o episódio semanal, também quando o catálogo está atrasado ou adiantado", () => {
    const items = agendaForWeek(
      [
        row(1, "Na semana", "2026-10-16T15:00:00Z", 5),
        row(2, "Catálogo atrasado", "2026-10-05T15:00:00Z", 3), // já passou: vira ep 4 em 12/10
        row(3, "Catálogo adiantado", "2026-10-21T15:00:00Z", 8), // próxima semana: vira ep 7 em 14/10
        row(4, "Estreia", "2026-10-17T14:00:00Z", 1),
        row(5, "Acabou", "2026-10-05T15:00:00Z", 12, { episodes: 12 }), // ep 13 não existe
        row(6, "Sem próximo", "2026-10-30T15:00:00Z", 1), // estreia só depois
      ],
      start,
      end,
    );
    expect(items.map((i) => [i.anilistId, i.episode])).toEqual([
      [2, 4],
      [3, 7],
      [1, 5],
      [4, 1],
    ]);
    expect(items.find((i) => i.anilistId === 4)!.premiere).toBe(true);
  });

  it("agrupa por dia e monta a matéria com links e horários de Brasília", () => {
    const items = agendaForWeek(
      [row(10, "Frieren", "2026-10-17T14:00:00Z", 1, { streamers: ["Crunchyroll"] }, 9000), row(11, "Dandadan", "2026-10-16T15:30:00Z", 3)],
      start,
      end,
    );
    expect(groupByDay(items, start).map((d) => d.day)).toEqual(["Sexta", "Sábado"]);
    const post = buildAgendaPost(items, start);
    expect(post.title).toBe("Agenda de animes da semana: episódios de 12/10 a 18/10");
    expect(post.slug).toBe("agenda-de-animes-12-10-a-18-10-2026");
    expect(isAgendaSlug(post.slug)).toBe(true);
    expect(post.html).toContain('<a href="/animes/10">Frieren</a>');
    expect(post.html).toContain("<strong>11:00</strong>"); // 14:00 UTC = 11:00 em Brasília
    expect(post.html).toContain("Estreias da semana");
    expect(post.html).toContain("Crunchyroll");
    expect(agendaSlug(start)).toBe(post.slug);
  });

  it("escapa o título do anime no HTML", () => {
    const items = agendaForWeek([row(12, 'Frieren & "Amigos" <b>', "2026-10-16T15:30:00Z", 3)], start, end);
    const html = buildAgendaPost(items, start).html;
    expect(html).toContain("Frieren &amp; &quot;Amigos&quot; &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("agenda: capa que gira a cada semana", () => {
  const items = (n: number) =>
    agendaForWeek(
      Array.from({ length: n }, (_, i) => row(100 + i, `Anime ${i}`, "2026-10-16T15:00:00Z", 2, { banner: `https://img/${i}.jpg`, cover: `https://cover/${i}.jpg` }, 10_000 - i)),
      start,
      end,
    );

  it("as candidatas são os banners dos mais populares, sem repetir", () => {
    expect(agendaCoverCandidates(items(12))).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `https://img/${i}.jpg`));
    const semBanner = agendaForWeek([row(1, "A", "2026-10-16T15:00:00Z", 2, { cover: "https://c/a.jpg" }, 5), row(2, "B", "2026-10-16T15:00:00Z", 2, { banner: "https://b/b.jpg" }, 4)], start, end);
    expect(agendaCoverCandidates(semBanner)).toEqual(["https://b/b.jpg", "https://c/a.jpg"]);
  });

  it("a ordem de tentativa muda de uma semana para a outra", () => {
    const cands = agendaCoverCandidates(items(8));
    const WEEK = 7 * 24 * 3600;
    const firsts = Array.from({ length: 8 }, (_, w) => pickAgendaCover(cands, start + w * WEEK, null)[0]);
    expect(new Set(firsts).size).toBe(8); // 8 semanas seguidas, 8 capas diferentes
    expect(pickAgendaCover(cands, start, null)).toHaveLength(8);
  });

  it("nunca repete a capa da semana anterior (ela vai para o fim da fila)", () => {
    const cands = agendaCoverCandidates(items(5));
    const first = pickAgendaCover(cands, start, null)[0];
    const next = pickAgendaCover(cands, start, first);
    expect(next[0]).not.toBe(first);
    expect(next.at(-1)).toBe(first);
    expect(next).toHaveLength(5);
  });

  it("sem candidatas devolve vazio; com uma só, devolve a própria", () => {
    expect(pickAgendaCover([], start, null)).toEqual([]);
    expect(pickAgendaCover(["https://a.jpg"], start, "https://a.jpg")).toEqual(["https://a.jpg"]);
  });
});
