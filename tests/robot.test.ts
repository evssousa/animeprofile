// Robô de notícias: funções puras, rede com fetch falso e conversão de imagem.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LISTICLE_RE, gameTiedToAnime, looksLikeAnime, nonAnimeAllowed, nonAnimeDailyLimit } from "~/server/robot/constants";
import { dedupHash, ensureSlug, makeSlug, normalizeSpoilerBoxes, startOfBrasiliaDay, brasiliaHour, titleSimilarity } from "~/server/robot/text";
import { buildSystemPrompt, buildUserPrompt } from "~/server/robot/prompt";
import { GeneratedArticle, parseGeminiJson } from "~/server/robot/contract";
import { autoFixArticle, checkQuality, trimTitle } from "~/server/robot/quality";
import { checkArticleHtml } from "~/server/robot/html-guard";
import { enforceSeoHtml, splitLongParagraphs } from "~/server/robot/html";
import { GeminiError, generateWithGemini } from "~/server/robot/gemini.server";
import { ModelChain } from "~/server/robot/model-chain";
import { isPrivateIp, isSafeUrlShape } from "~/server/robot/net.server";
import { parseFeed } from "~/server/robot/rss.server";
import { extractMedia, imageSizeFromBytes, pickCover } from "~/server/robot/media";
import { isConfidentMatch, guessAnimeQuery } from "~/server/robot/anilist-context.server";

const words = (n: number, seed = 0) => Array.from({ length: n }, (_, i) => `termo${seed}n${i}`).join(" ");
const goodHtml = (img = "https://f.example/a.jpg") =>
  `<p>Frieren ganha nova temporada e a produção confirmou o retorno do estúdio. ${words(60, 1)}.</p><h2>O que mostra o trailer</h2><p>${words(120, 2)}. Segundo a fonte, ${words(50, 3)}.</p>` +
  `<figure><img src="${img}" alt="x"></figure><h2>Quando estreia no Brasil</h2><p>${words(110, 4)}. Outro trecho diferente ${words(30, 5)}.</p><h2>Mais sobre Frieren</h2><p>${words(100, 6)} ${words(20, 7)}.</p>`;

describe("texto", () => {
  it("slug sem acento, e a palavra-chave só entra se o título não a tem", () => {
    expect(makeSlug("Ação & Aventura: O Retorno!")).toBe("acao-e-aventura-o-retorno");
    expect(ensureSlug("Naruto revela novo vilão", "Naruto")).toBe("naruto-revela-novo-vilao");
    expect(ensureSlug("Novo filme ganha data", "Frieren")).toBe("frieren-novo-filme-ganha-data");
  });
  it("hash ignora www e pontuação, e muda com a fonte", () => {
    expect(dedupHash("Frieren: Trailer!", "https://www.a.com/x")).toBe(dedupHash("frieren trailer", "https://a.com/y"));
    expect(dedupHash("Frieren trailer", "https://b.com/y")).not.toBe(dedupHash("Frieren trailer", "https://a.com/y"));
  });
  it("títulos parecidos passam de 0,8", () => {
    expect(titleSimilarity("Frieren ganha segunda temporada em janeiro", "Frieren ganha segunda temporada em janeiro!")).toBeGreaterThanOrEqual(0.8);
    expect(titleSimilarity("Frieren ganha segunda temporada", "One Piece revela capítulo especial")).toBeLessThan(0.3);
  });
  it("spoiler ganha a div de conteúdo", () => {
    const out = normalizeSpoilerBoxes('<details class="spoiler-box"><summary>S</summary><p>x</p></details>');
    expect(out).toContain('<div class="spoiler-content"><p>x</p></div>');
  });
  it("dia de Brasília começa às 03:00 UTC", () => {
    const now = new Date("2026-11-17T02:30:00Z"); // ainda dia 16 em Brasília
    expect(startOfBrasiliaDay(now).toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(brasiliaHour(now)).toBe(23);
  });
});

describe("regras de publicação", () => {
  it("bloqueia lista e deixa passar notícia", () => {
    expect(LISTICLE_RE.test("Top 5 animes da temporada")).toBe(true);
    expect(LISTICLE_RE.test("As 10 melhores aberturas")).toBe(true);
    expect(LISTICLE_RE.test("Frieren ganha segunda temporada")).toBe(false);
  });
  it("cota fora de anime: 33% de 10 = 3", () => {
    expect(nonAnimeDailyLimit(10, 33)).toBe(3);
    expect(nonAnimeAllowed({ dailyCap: 10, maxPct: 33, nonAnimeToday: 3 })).toBe(false);
    expect(nonAnimeAllowed({ dailyCap: 2, maxPct: 33, nonAnimeToday: 0 })).toBe(true);
    expect(looksLikeAnime("Crunchyroll anuncia novo anime")).toBe(true);
    expect(looksLikeAnime("Xbox anuncia novo anime")).toBe(false);
  });
});

describe("prompt e contrato", () => {
  it("sem guia editorial não monta o prompt", () => {
    expect(() => buildSystemPrompt("  ")).toThrow("guia editorial");
    expect(buildSystemPrompt("GUIA")).toContain("GUIA");
  });
  it("o prompt do usuário traz fonte, mídia e contexto verificado", () => {
    const p = buildUserPrompt({ candidateTitle: "T", candidateSummary: null, candidateContent: "C", sourceUrl: "https://a.com/x", categorySlugs: ["games"], trailer: "https://www.youtube.com/embed/abcdefghijk", extraVideos: [], bodyImages: ["https://a.com/i.jpg"], anilistContext: null, recentOpenings: [] });
    expect(p).toContain("FONTE: https://a.com/x");
    expect(p).toContain("TRAILER PRINCIPAL");
    expect(p).toContain("SEM CONTEXTO VERIFICADO");
  });
  it("lê JSON com cerca de código e valida o contrato", () => {
    const obj = { title: "Frieren ganha segunda temporada em 2026", focusKeyword: "Frieren", metaDescription: "m".repeat(100), excerpt: "e".repeat(80), html: "<p>" + "x".repeat(300) + "</p>", tags: ["a"], categorySlug: "animes-e-mangas", animeFocus: "main", animeTitle: "Frieren", otakuRelated: true };
    const parsed = parseGeminiJson("```json\n" + JSON.stringify(obj) + "\n```");
    expect(GeneratedArticle.safeParse(parsed).success).toBe(true);
    expect(GeneratedArticle.safeParse({ ...obj, animeFocus: "xx" }).success).toBe(false);
  });
});

describe("qualidade e HTML", () => {
  const base = { title: "Frieren ganha segunda temporada em janeiro", excerpt: "Resumo da notícia sobre Frieren.", focusKeyword: "Frieren" };
  it("aprova um texto completo", () => {
    const html = enforceSeoHtml({ html: goodHtml(), focusKeyword: "Frieren", sourceUrl: "https://f.example/n", sourceName: "Fonte", bodyImages: ["https://f.example/a.jpg"] });
    expect(html).toContain("Fonte: <a href=");
    expect(checkQuality({ ...base, html }, { sourceText: "texto", bodyImages: ["https://f.example/a.jpg"] })).toEqual({ ok: true });
  });
  it("reprova texto curto, expressão de IA e rumor tratado como fato", () => {
    const r = checkQuality({ ...base, html: "<p>Frieren. Vale ressaltar que sim.</p>" }, { sourceText: "leaked rumor", bodyImages: ["https://f.example/a.jpg"] });
    expect(r.ok).toBe(false);
    const codes = r.ok ? [] : r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["too_short", "banned_phrases", "few_sections", "missing_body_image", "unflagged_rumor"]));
  });
  it("conserta expressões trocáveis e encurta título longo sem chamar o Gemini", () => {
    const fixed = autoFixArticle({ title: "Frieren: o anime volta com tudo e promete uma temporada gigantesca para os fãs", html: "<p>Em suma, volta.</p>", excerpt: "x", titleVariants: ["Frieren volta com a segunda temporada em 2026"] });
    expect(fixed.article.title).toBe("Frieren volta com a segunda temporada em 2026");
    expect(fixed.article.html).toContain("No geral");
    expect(trimTitle("a".repeat(100))).toBeNull();
  });
  it("o filtro de HTML barra script, evento e iframe de fora", () => {
    expect(checkArticleHtml("<p>ok</p>").ok).toBe(true);
    expect(checkArticleHtml("<script>x()</script>").ok).toBe(false);
    expect(checkArticleHtml('<img src="a" onerror="x()">').ok).toBe(false);
    expect(checkArticleHtml('<iframe src="https://evil.com/x"></iframe>').ok).toBe(false);
    expect(checkArticleHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>').ok).toBe(true);
  });
});

describe("Gemini e fila de modelos", () => {
  const okBody = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 10, totalTokenCount: 30 } };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  it("registra o uso e nunca põe a chave na mensagem de erro", async () => {
    const seen: number[] = [];
    const res = await generateWithGemini({ model: "m", system: "s", user: "u", apiKey: "SEGREDO", record: (u) => void seen.push(u.status), fetchImpl: (async () => json(okBody)) as typeof fetch });
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    const err = await generateWithGemini({ model: "m", system: "s", user: "u", apiKey: "SEGREDO", fetchImpl: (async () => json({ error: { message: "chave inválida" } }, 403)) as typeof fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(String(err.message)).not.toContain("SEGREDO");
    expect(seen).toEqual([200]);
  });
  it("429 com espera longa desiste sem dormir; 429 curto repete", async () => {
    const long = { error: { details: [{ retryDelay: "3600s" }] } };
    const e = await generateWithGemini({ model: "m", system: "s", user: "u", apiKey: "k", fetchImpl: (async () => json(long, 429)) as typeof fetch, sleepImpl: async () => { throw new Error("não devia dormir"); } }).catch((x) => x);
    expect(e.status).toBe(429);
    let n = 0;
    const slept: number[] = [];
    const ok = await generateWithGemini({ model: "m", system: "s", user: "u", apiKey: "k", fetchImpl: (async () => (n++ === 0 ? json({ error: {} }, 429) : json(okBody))) as typeof fetch, sleepImpl: async (ms) => void slept.push(ms) });
    expect(ok.text).toBe("{}");
    expect(slept).toEqual([20_000]);
  });
  it("na cota esgotada passa ao próximo modelo e, esgotando todos, sobe o 429", async () => {
    const calls: string[] = [];
    const chain = new ModelChain(["gemini-3-flash-preview", "gemini-3.5-flash"], {
      generate: (async ({ model }: { model: string }) => {
        calls.push(model);
        if (model === "gemini-3-flash-preview") throw new GeminiError("cota", 429, true);
        return { text: "ok", usage: { inputTokens: 1, outputTokens: 1 } };
      }) as never,
    });
    expect((await chain.generate({ system: "s", user: "u" })).model).toBe("gemini-3.5-flash");
    expect(calls).toEqual(["gemini-3-flash-preview", "gemini-3.5-flash"]);
    const dead = new ModelChain(["gemini-3-flash-preview"], { generate: (async () => { throw new GeminiError("cota", 429, true); }) as never });
    await expect(dead.generate({ system: "s", user: "u" })).rejects.toMatchObject({ status: 429 });
    expect(dead.exhausted()).toBe(true);
  });
  it("pula o modelo que já usou o limite do dia", async () => {
    const calls: string[] = [];
    const chain = new ModelChain(["gemini-3-flash-preview", "gemini-3.5-flash"], {
      canUse: async (m) => m !== "gemini-3-flash-preview",
      generate: (async ({ model }: { model: string }) => (calls.push(model), { text: "ok", usage: { inputTokens: 0, outputTokens: 0 } })) as never,
    });
    await chain.generate({ system: "s", user: "u" });
    expect(calls).toEqual(["gemini-3.5-flash"]);
  });
});

describe("rede segura e feeds", () => {
  it("não aceita endereço interno", () => {
    for (const u of ["http://localhost/x", "http://127.0.0.1/x", "http://10.0.0.5/x", "http://169.254.169.254/x", "http://[::1]/x", "ftp://a.com/x", "https://a.com:8080/x", "https://u:p@a.com/x", "http://intranet/x", "http://a.internal/x"]) {
      expect(isSafeUrlShape(u), u).toBe(false);
    }
    expect(isSafeUrlShape("https://www.crunchyroll.com/news/x")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
  it("lê RSS e Atom, com imagem, vídeo e data", () => {
    const rss = `<rss><channel><item><title>Frieren &amp; amigos</title><link>https://a.com/1</link><description><![CDATA[<p>Resumo <img src="https://a.com/i.jpg"> https://youtu.be/abcdefghijk</p>]]></description><pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate></item><item><title>Sem link</title></item></channel></rss>`;
    const [a, ...rest] = parseFeed(rss);
    expect(rest).toHaveLength(0);
    expect(a).toMatchObject({ title: "Frieren & amigos", link: "https://a.com/1", imageUrl: "https://a.com/i.jpg", videoUrl: "https://www.youtube.com/embed/abcdefghijk", publishedAt: "2026-11-16T10:00:00.000Z" });
    const atom = `<feed><entry><title>Um</title><link href="https://b.com/2"/><summary>texto</summary><updated>2026-11-16T10:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom)[0]).toMatchObject({ title: "Um", link: "https://b.com/2" });
  });
});

describe("mídia", () => {
  it("extrai trailer, vídeos extras e imagens do corpo sem ícones", () => {
    const html = '<img src="https://a.com/logo.png"><img src="https://a.com/b.jpg"><img src="https://a.com/c.jpg"> https://www.youtube.com/watch?v=aaaaaaaaaaa https://youtu.be/bbbbbbbbbbb';
    const m = extractMedia({ html, imageLimit: 3 });
    expect(m.images).toEqual(["https://a.com/b.jpg", "https://a.com/c.jpg"]);
    expect(m.trailer).toBe("https://www.youtube.com/embed/aaaaaaaaaaa");
    expect(m.videos).toEqual(["https://www.youtube.com/embed/bbbbbbbbbbb"]);
  });
  it("mede PNG e escolhe a capa grande", async () => {
    const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(imageSizeFromBytes(png)).toEqual({ w: 640, h: 480 });
    expect(pickCover([{ w: 800 }, { w: 1600 }, { w: 1300 }])).toEqual({ w: 1600 });
    expect(pickCover([{ w: 800 }])).toEqual({ w: 800 });
  });
  it("AniList: aceita só nome que bate", () => {
    const t = (romaji: string) => ({ title: { romaji, english: null, native: null, userPreferred: null } });
    expect(isConfidentMatch("One Piece", t("One Piece: Egghead"))).toBe(true);
    expect(isConfidentMatch("One", t("Naruto"))).toBe(false);
    expect(guessAnimeQuery("Frieren: nova temporada")).toBe("Frieren");
  });
});

describe("imagem própria", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "robo-media-"));
    process.env.MEDIA_DIR = dir;
  });
  afterAll(async () => {
    delete process.env.MEDIA_DIR;
    await rm(dir, { recursive: true, force: true });
  });
  it("converte para WebP de 1280 px com miniatura de 640 px em /media/robo", async () => {
    const { localizeBuffer, mediaKey } = await import("~/server/robot/media.server");
    const src = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#369" } }).jpeg().toBuffer();
    const out = await localizeBuffer("https://a.com/x.jpg", src);
    const key = mediaKey("https://a.com/x.jpg");
    expect(out).toEqual({ url: `/media/robo/${key}.webp`, width: 1280, height: 640 });
    expect((await sharp(await readFile(join(dir, "robo", `${key}.webp`))).metadata()).width).toBe(1280);
    expect((await sharp(await readFile(join(dir, "robo", `${key}-640.webp`))).metadata()).width).toBe(640);
  });
});

describe("parágrafos curtos", () => {
  const sentence = (n: number) => `Esta é a frase número ${n} com algumas palavras para contar.`;
  const long = Array.from({ length: 12 }, (_, i) => sentence(i + 1)).join(" ");

  it("divide um parágrafo longo em vários de 2 a 3 frases, sem perder texto", () => {
    const out = splitLongParagraphs(`<p>${long}</p>`);
    const parts = [...out.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    expect(parts.length).toBeGreaterThanOrEqual(3);
    for (const p of parts) expect(p.split(/\s+/).length).toBeLessThanOrEqual(65);
    expect(parts.join(" ")).toBe(long);
  });

  it("não mexe em parágrafo curto, em título nem em link que atravessaria o corte", () => {
    const short = "<p>Uma frase curta. Outra frase curta.</p>";
    expect(splitLongParagraphs(short)).toBe(short);
    const linked = `<p>${sentence(1)} <a href="/tag/x">${sentence(2)} ${sentence(3)} ${sentence(4)} ${sentence(5)} ${sentence(6)} ${sentence(7)} ${sentence(8)}</a> ${sentence(9)}</p>`;
    const out = splitLongParagraphs(linked);
    expect((out.match(/<a\b/g) ?? []).length).toBe((out.match(/<\/a>/g) ?? []).length);
    for (const chunk of out.split("\n")) expect((chunk.match(/<a\b/g) ?? []).length).toBe((chunk.match(/<\/a>/g) ?? []).length);
  });

  it("o prompt do sistema traz a regra de parágrafos curtos", () => {
    expect(buildSystemPrompt("guia qualquer")).toContain("parágrafos CURTOS");
  });
});

describe("categoria Games: só jogos ligados a anime e mangá", () => {
  const base = { title: "Novo jogo chega ao PC", excerpt: "Um estúdio anuncia a data de lançamento do jogo de tiro para o PC e consoles.", html: "<p>O jogo de tiro chega em março com campanha cooperativa.</p>", animeTitle: null as string | null };

  it("jogo sem ligação com anime ou mangá é barrado (é do Respawnou)", () => {
    expect(gameTiedToAnime(base)).toBe(false);
    expect(gameTiedToAnime({ ...base, animeFocus: "none", animeTitle: null })).toBe(false);
  });

  it("jogo baseado em anime ou mangá passa", () => {
    expect(gameTiedToAnime({ ...base, title: "Jogo de Naruto ganha trailer", html: "<p>O jogo é baseado no mangá de Masashi Kishimoto.</p>" })).toBe(true);
    expect(gameTiedToAnime({ ...base, html: "<p>A colaboração com o anime Jujutsu Kaisen traz novos personagens.</p>" })).toBe(true);
    expect(gameTiedToAnime({ ...base, animeTitle: "Dragon Ball", animeFocus: "main" })).toBe(true);
  });

  it("o prompt do sistema traz a regra de Games e do Respawnou", () => {
    const p = buildSystemPrompt("guia qualquer");
    expect(p).toContain("REGRA DA CATEGORIA GAMES");
    expect(p).toContain("Respawnou");
  });
});
