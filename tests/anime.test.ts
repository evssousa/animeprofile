// Animes: conversão do AniList, gravação, consultas e a tarefa de sincronização (AniList falso, MySQL descartável).
import { createDB } from "mysql-memory-server";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { brDay, cleanDescription, currentSeason, streamersFrom } from "~/lib/anime";
import { createPool, query, setPool } from "~/server/db.server";
import { mediaToRow, type AniMedia } from "~/server/anime/anilist.server";
import { getCharacter, splitAbout } from "~/server/anime/characters.server";
import { canFetchRemote, RemoteUnavailable, resetRemoteGuard } from "~/server/anime/remote-guard.server";
import { airingBetween, animeIdsForSitemap, getAnime, importSynopses, seasonAnimes, syncAnimes, trendingAnimes, upsertMedia } from "~/server/anime/anime.server";

let server: Awaited<ReturnType<typeof createDB>>;
let pool: mysql.Pool;
const env = { ...process.env };
const NOW = new Date("2026-11-14T15:00:00Z"); // sexta, 12:00 em Brasília (temporada de outono)

function media(id: number, extra: Partial<AniMedia> = {}): AniMedia {
  return {
    id,
    title: { romaji: `Anime ${id}`, english: `Anime ${id} EN`, native: null, userPreferred: `Anime ${id}` },
    coverImage: { extraLarge: `https://img.example/${id}.jpg`, large: null, color: "#ff0000" },
    bannerImage: null,
    description: "Uma história.<br><br>Com <i>marcação</i> e [link](https://anilist.co/character/1).",
    episodes: 12,
    duration: 24,
    status: "RELEASING",
    format: "TV",
    season: "FALL",
    seasonYear: 2026,
    startDate: { year: 2026, month: 10, day: 4 },
    genres: ["Action"],
    studios: { nodes: [{ name: "MAPPA" }] },
    popularity: 1000 - id,
    favourites: 10,
    averageScore: 80,
    isAdult: false,
    trailer: { id: "abc123", site: "youtube" },
    externalLinks: [{ site: "Crunchyroll", type: "STREAMING" }],
    nextAiringEpisode: { airingAt: Math.floor(NOW.getTime() / 1000) + 3600, episode: 7 },
    ...extra,
  };
}

// AniList falso: responde conforme o tipo de consulta.
const fakeAniList = vi.fn(async (_url: string, init?: RequestInit) => {
  const { query: q, variables } = JSON.parse(String(init?.body));
  const page = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (q.includes("airingSchedules")) {
    const at = Math.floor(NOW.getTime() / 1000);
    return page({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [
      { airingAt: at + 3600, episode: 7, media: media(1) },
      { airingAt: at + 2 * 86400, episode: 3, media: media(3, { externalLinks: [] }) },
      { airingAt: at + 7200, episode: 1, media: media(99, { isAdult: true }) },
    ] } });
  }
  if (q.includes("TRENDING_DESC")) return page({ Page: { pageInfo: { hasNextPage: false }, media: [media(3, { externalLinks: [] }), media(2), media(1)] } });
  if (q.includes("seasonYear: $year")) return page({ Page: { pageInfo: { hasNextPage: false }, media: [media(1), media(2), media(3)] } });
  if (q.includes("Character(id: $id")) {
    if (variables.id === 404) return page({ Character: null });
    return page({ Character: {
      id: variables.id, name: { full: "Maomao", native: "猫猫", alternative: ["Mao"] }, image: { large: "https://img.example/m.jpg" },
      description: "Uma boticária.\n~!Ela é filha de Lakan.!~ Gosta de venenos.", gender: "Female", dateOfBirth: { year: null, month: 3, day: 14 },
      age: "17", bloodType: null, favourites: 50000,
      media: { edges: [
        { characterRole: "MAIN", voiceActors: [{ id: 7, name: { full: "Aoi Yuuki", native: "悠木碧" }, image: { large: null } }], node: { id: 1, title: { userPreferred: "Kusuriya" }, coverImage: { large: null, color: null }, format: "TV", seasonYear: 2023, isAdult: false } },
        { characterRole: "MAIN", voiceActors: [{ id: 7, name: { full: "Aoi Yuuki", native: "悠木碧" }, image: { large: null } }], node: { id: 2, title: { userPreferred: "Kusuriya 2" }, coverImage: null, format: "TV", seasonYear: 2025, isAdult: false } },
        { characterRole: "MAIN", voiceActors: [], node: { id: 3, title: { userPreferred: "Adulto" }, coverImage: null, format: "OVA", seasonYear: 2024, isAdult: true } },
      ] },
    } });
  }
  if (q.includes("Media(id: $id")) {
    if (variables.id === 404) return page({ Media: null });
    return page({ Media: { ...media(variables.id), characters: { edges: [
      { role: "MAIN", node: { id: 10, name: { full: "Herói" }, image: { large: "https://img.example/h.jpg" } }, voiceActors: [{ name: { full: "Dublador" }, image: { large: null } }] },
    ] } } });
  }
  return page({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
});

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  pool = createPool({ ...config, connectionLimit: 4 });
  setPool(pool);
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  vi.stubGlobal("fetch", fakeAniList);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  process.env = env;
  setPool(undefined);
  await pool?.end();
  await server?.stop();
});

describe("regras de anime", () => {
  it("temporada pelo mês e dia em Brasília", () => {
    expect(currentSeason(new Date("2026-02-10T12:00:00Z"))).toEqual({ season: "WINTER", year: 2026 });
    expect(currentSeason(new Date("2026-11-14T12:00:00Z"))).toEqual({ season: "FALL", year: 2026 });
    expect(brDay(new Date("2026-11-15T02:00:00Z"))).toBe("2026-11-14"); // 23:00 em Brasília ainda é dia 14
  });
  it("streamings do Brasil e descrição limpa", () => {
    expect(streamersFrom([{ site: "Netflix", type: "STREAMING" }, { site: "Twitter", type: "SOCIAL" }, { site: "Amazon Prime Video", type: "STREAMING" }])).toEqual(["netflix", "prime"]);
    expect(cleanDescription("A<br><br>B <i>c</i> [Nome](https://anilist.co/character/1)")).toBe("A\n\nB c Nome");
  });
  it("converte o anime do AniList na linha do banco", () => {
    const r = mediaToRow(media(1));
    expect(r).toMatchObject({ anilist_id: 1, title: "Anime 1", start_date: "2026-10-04", trailer_youtube: "abc123", streamers: '["crunchyroll"]', next_episode: 7 });
  });
});

describe("banco e tarefa", () => {
  it("a sincronização guarda temporada, em alta e episódios (sem conteúdo adulto)", async () => {
    const r = await syncAnimes(NOW);
    expect(r).toMatchObject({ temporada: "FALL 2026", animesDaTemporada: 3, emAlta: 3 });
    const [adult] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM anime_airing WHERE anilist_id = 99");
    expect(Number(adult.n)).toBe(0);
  });

  it("temporada por popularidade; em alta prefere quem está em streaming do Brasil", async () => {
    expect((await seasonAnimes(10, 0, { season: "FALL", year: 2026 })).items.map((a) => a.id)).toEqual([1, 2, 3]);
    expect((await trendingAnimes(10)).map((a) => a.id)).toEqual([2, 1, 3]); // o 3 é o 1º do AniList, mas sem streaming
  });

  it("no ar hoje e calendário pelo horário", async () => {
    const start = new Date(`${brDay(NOW)}T00:00:00-03:00`);
    const today = await airingBetween(start, new Date(start.getTime() + 86400_000));
    expect(today.map((t) => [t.anime.id, t.episode])).toEqual([[1, 7]]);
    const week = await airingBetween(start, new Date(start.getTime() + 7 * 86400_000));
    expect(week.map((t) => t.anime.id)).toEqual([1, 3]);
    // home: só os mais populares do período, mas na ordem do horário (o 1 é mais popular que o 3)
    expect((await airingBetween(start, new Date(start.getTime() + 7 * 86400_000), 1)).map((t) => t.anime.id)).toEqual([1]);
  });

  it("sinopse em português do site antigo não é apagada pela sincronização", async () => {
    expect(await importSynopses([{ anilist_id: 1, title: "Anime 1", synopsis_pt: "Uma história em português." }, { anilist_id: 500, title: "Antigo", synopsis_pt: null }])).toBe(1);
    await upsertMedia([media(1)]);
    const a = await getAnime(1);
    expect(a).toMatchObject({ synopsis: "Uma história em português.", synopsisLang: "pt", streamers: ["crunchyroll"] });
    // a linha criada só com a sinopse antiga (500) não entra no sitemap até ter ficha do AniList
    expect((await animeIdsForSitemap()).map((r) => Number(r.anilist_id))).not.toContain(500);
  });

  it("ficha busca no AniList o que falta (personagens) e guarda; 404 vira null", async () => {
    const a = await getAnime(2);
    expect(a?.characters).toEqual([{ id: 10, name: "Herói", image: "https://img.example/h.jpg", role: "Principal", voice: { name: "Dublador", image: null } }]);
    expect(a?.synopsisLang).toBe("en");
    const calls = fakeAniList.mock.calls.length;
    await getAnime(2); // já tem ficha recente: não pergunta de novo
    expect(fakeAniList.mock.calls.length).toBe(calls);
    expect(await getAnime(404)).toBeNull();
    expect(await getAnime(-1)).toBeNull();
  });
});

describe("personagens e proteção contra robôs", () => {
  it("separa os spoilers e limpa a marcação", () => {
    expect(splitAbout("A __Altura:__ 1,50 m\n~!segredo!~ fim")).toEqual([
      { text: "A Altura: 1,50 m", spoiler: false },
      { text: "segredo", spoiler: true },
      { text: "fim", spoiler: false },
    ]);
  });

  it("ficha do personagem: busca uma vez, guarda, sem anime adulto, dubladores sem repetir", async () => {
    resetRemoteGuard();
    const c = await getCharacter(55);
    expect(c).toMatchObject({ name: "Maomao", native: "猫猫", facts: [["Aniversário", "14 de março"], ["Idade", "17"], ["Gênero", "Feminino"], ["Favoritado por", "50.000 pessoas no AniList"]] });
    expect(c!.appearances.map((a) => a.id)).toEqual([1, 2]);
    expect(c!.voices).toEqual([{ id: 7, name: "Aoi Yuuki", native: "悠木碧", image: null }]);
    expect(c!.about.some((s) => s.spoiler)).toBe(true);
    const calls = fakeAniList.mock.calls.length;
    expect(await getCharacter(55, { remote: false })).toMatchObject({ name: "Maomao" }); // do banco
    expect(fakeAniList.mock.calls.length).toBe(calls);
    await expect(getCharacter(56, { remote: false })).rejects.toThrow(RemoteUnavailable); // não guardado e sem cota: 503
    expect(await getCharacter(404)).toBeNull();
  });

  it("cota por minuto: 20 buscas para pessoas e 5 para robôs", () => {
    resetRemoteGuard();
    const human = new Request("https://x/", { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36" } });
    const bot = new Request("https://x/", { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } });
    expect(Array.from({ length: 8 }, () => canFetchRemote(bot, 1000)).filter(Boolean).length).toBe(5);
    expect(Array.from({ length: 25 }, () => canFetchRemote(human, 1000)).filter(Boolean).length).toBe(20);
    expect(canFetchRemote(human, 62_000)).toBe(true); // minuto seguinte
  });

  it("sem cota, anime só com a sinopse antiga responde 503 (não 404)", async () => {
    await expect(getAnime(500, { remote: false })).rejects.toThrow(RemoteUnavailable);
  });
});
