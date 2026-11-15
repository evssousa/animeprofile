// Robô de notícias com banco: configuração, publicação, bloqueios, cota, deduplicação e seleção.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, query, setPool } from "~/server/db.server";
import { applyRoboConfig } from "~/server/robot/config-import.server";
import { computeSlotLimit, getConfig, getGuide, setConfig } from "~/server/robot/config.server";
import { publishArticle, type PublishInput } from "~/server/robot/publish.server";
import { runRobot } from "~/server/robot/run.server";
import { ingestItems, scoreCandidates, selectForRun } from "~/server/robot/select.server";
import { oldSourceHash } from "~/server/robot/text";

let server: Awaited<ReturnType<typeof createDB>>;
const A1 = "aaaaaaaa-1111-4000-8000-000000000001"; // Animes e Mangás, especialista em mangás
const A2 = "aaaaaaaa-1111-4000-8000-000000000002"; // Animes e Mangás, especialista em animes
const A3 = "aaaaaaaa-1111-4000-8000-000000000003"; // Games
const SRC = "s1111111-0000-4000-8000-000000000001";
const IMG = "/media/robo/aaaaaaaaaaaaaaaaaaaaaaaa.webp";
let n = 100;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  await query("INSERT INTO categories (id, name, slug, kind) VALUES ('cat-anime', 'Animes e Mangás', 'animes-e-mangas', 'news'), ('cat-games', 'Games', 'games', 'news')");
  for (const [id, slug] of [[A1, "ia-mangas"], [A2, "ia-animes"], [A3, "ia-games"]]) await query("INSERT INTO post_authors (id, kind, slug, name) VALUES (?, 'ai', ?, ?)", [id, slug, slug]);
});

afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

function input(over: { title: string; source?: string; category?: string; otaku?: boolean; extra?: string; mode?: "publicar" | "rascunho" }): PublishInput {
  const id = ++n;
  const source = over.source ?? `https://fonte${id}.example/noticia-${id}`;
  return {
    candidate: { id, title: over.title, sourceUrl: source },
    article: {
      title: over.title, titleVariants: [], focusKeyword: "Frieren", metaDescription: "m".repeat(100), excerpt: "e".repeat(80),
      html: `<p>Texto sobre Frieren e ${over.extra ?? "nada"}.</p><figure><img src="${IMG}" alt="x"></figure><p>Fonte: <a href="${source}">x</a></p>`,
      tags: ["Frieren", "Anime novo"], categorySlug: over.category ?? "animes-e-mangas", animeFocus: "main", animeTitle: "Frieren", otakuRelated: over.otaku ?? true,
    },
    cover: { url: IMG, width: 1280, height: 720 }, bodyImages: [IMG], anilistId: 154587, mode: over.mode ?? "publicar", runId: null, slot: null,
  };
}
const reason = (r: Awaited<ReturnType<typeof publishArticle>>) => (r.ok ? "" : r.reason);

describe("robô com banco", () => {
  it("importa a configuração do site antigo e ignora autor que não existe", async () => {
    const out = await applyRoboConfig({
      sources: [{ id: SRC, name: "Fonte 1", base_url: "https://fonte.example", rss_url: null, priority: 5, active: true }],
      authors: [
        { id: A1, category: "Animes e Mangás", system_prompt: "Você é especialista em mangás.", auto_publish: true, active: true },
        { id: A2, category: "Animes e Mangás", system_prompt: "Você é especialista em animes.", auto_publish: true, active: true },
        { id: A3, category: "Games", system_prompt: "especialista em jogos", auto_publish: true, active: true },
        { id: "inexistente", category: "Games", active: true },
      ],
      blacklist: [{ term: "Bloqueada", active: true }],
      topics: [{ topic: "Frieren", weight: 40, active: true }],
      slots: [{ hour: 10, posts_per_slot: 2, active: true }],
      settings: [{ key: "model", value: "gemini-3.5-flash" }],
      system_config: [{ key: "ai_news_daily_cap", value_int: 4 }],
      recent_sources: ["https://velha.example/ja-publicada"],
      guia: "G".repeat(300),
    });
    expect(out).toMatchObject({ fontes: 1, autores: 3, autoresIgnorados: 1, termos: 2, horarios: 1, fontesUsadas: 1, guia: true });
    expect(await getConfig()).toMatchObject({ modo: "desligado", limiteDia: 4, modelo: "gemini-3.5-flash" });
    expect((await getGuide()).length).toBe(300);
    await setConfig({ limiteDia: 10, modelo: "gemini-3-flash-preview" });
  });

  it("publica numa transação: matéria, categoria, tags (com a palavra-chave) e candidato", async () => {
    await query("INSERT INTO ai_news_candidates (id, dedup_hash, title, source_url, status) VALUES (101, 'h1', 'x', 'https://fonte101.example/noticia-101', 'selected')");
    const r = await publishArticle(input({ title: "Frieren ganha segunda temporada confirmada em janeiro" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p] = await query<Record<string, unknown>>("SELECT * FROM posts WHERE id = ?", [r.postId]);
    expect(p).toMatchObject({ origin: "robo", status: "published", is_ai_generated: 1, featured_image: IMG, image_width: 1280, anilist_id: 154587, source_url: "https://fonte101.example/noticia-101" });
    expect([A1, A2]).toContain(p.author_id);
    const [c] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM post_categories WHERE post_id = ?", [r.postId]);
    const tags = await query<{ slug: string }>("SELECT t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ?", [r.postId]);
    expect(Number(c.n)).toBe(1);
    expect(tags.map((t) => t.slug).sort()).toEqual(["anime-novo", "frieren"]);
    const [cand] = await query<{ status: string; post_id: string }>("SELECT status, post_id FROM ai_news_candidates WHERE id = 101");
    expect(cand).toMatchObject({ status: "published", post_id: r.postId });
  });

  it("rascunho fica invisível; lista, categoria e fora do universo otaku são bloqueados", async () => {
    const d = await publishArticle(input({ title: "Cobertura do evento de anime em Curitiba neste fim de semana", mode: "rascunho" }));
    expect(d.ok && d.status).toBe("draft");
    expect(reason(await publishArticle(input({ title: "Top 5 animes que você precisa assistir agora" })))).toMatch(/lista/i);
    expect(reason(await publishArticle(input({ title: "Notícia de categoria que não existe no site", category: "culinaria" })))).toMatch(/Categoria/);
    expect(reason(await publishArticle(input({ title: "Battlefield recebe atualização grande com novo mapa", category: "games", otaku: false })))).toMatch(/universo otaku/);
  });

  it("não repete a fonte (robô ou link no texto do site antigo) nem título parecido", async () => {
    const src = "https://fonte-repetida.example/x";
    expect((await publishArticle(input({ title: "Chainsaw Man anuncia filme novo com estúdio Mappa", source: src }))).ok).toBe(true);
    expect(reason(await publishArticle(input({ title: "Outro texto completamente diferente sobre bonecos colecionáveis", source: src })))).toMatch(/Fonte já usada/);
    await query("INSERT INTO posts (id, post_type, slug, status, title, content_html, published_at, created_at, updated_at) VALUES ('oooooooo-0000-4000-8000-000000000009', 'news', 'antiga-recente', 'published', 'Antiga recente', ?, NOW(3), NOW(3), NOW(3))", [`<p>texto</p><p>Fonte: <a href="https://velha-no-texto.example/y">x</a></p>`]);
    expect(reason(await publishArticle(input({ title: "Mais um título diferente sobre figuras colecionáveis raras", source: "https://velha-no-texto.example/y" })))).toMatch(/Fonte já usada/);
    expect(reason(await publishArticle(input({ title: "Chainsaw Man anuncia filme novo com estúdio Mappa!" })))).toMatch(/semelhança/);
  });

  it("cota fora de anime: com teto 10 e 33%, a 4ª notícia de games é descartada", async () => {
    await query("DELETE FROM posts WHERE origin = 'robo'");
    const titles = ["Persona anuncia remake com trilha sonora inédita", "Pokémon revela nova região para o próximo jogo principal", "Final Fantasy ganha edição de colecionador especial", "Monster Hunter confirma expansão gigante para o inverno"];
    const out = [];
    for (const t of titles) out.push(await publishArticle(input({ title: t, category: "games", extra: t })));
    expect(out.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(reason(out[3])).toMatch(/fora de anime/);
  });

  it("escolhe o autor pela especialidade", async () => {
    const m = await publishArticle(input({ title: "Shueisha revela capítulo especial da editora para leitores", extra: "mangá capítulo mangaká editora shueisha serialização" }));
    expect(m.ok && m.authorId).toBe(A1);
    const a = await publishArticle(input({ title: "Crunchyroll confirma dublagem e episódios da temporada", extra: "anime episódio temporada estúdio dublagem crunchyroll" }));
    expect(a.ok && a.authorId).toBe(A2);
  });

  it("a cota da hora respeita o teto do dia", async () => {
    await query("DELETE FROM posts WHERE origin = 'robo'");
    const cfg = await getConfig();
    expect(await computeSlotLimit(10, cfg)).toBe(2); // horário das 10 h = 2 matérias (importado)
    expect(await computeSlotLimit(11, cfg)).toBe(0); // hora fora da agenda
    await query("INSERT INTO posts (id, post_type, slug, status, title, content_html, origin, published_at, created_at, updated_at) VALUES ('rrrrrrrr-2222-4000-8000-000000000001', 'news', 'hoje-1', 'published', 'Hoje 1', 'x', 'robo', NOW(3), NOW(3), NOW(3))");
    expect(await computeSlotLimit(10, { ...cfg, limiteDia: 1 })).toBe(0);
    expect(await computeSlotLimit(10, { ...cfg, limiteDia: 2 })).toBe(1);
  });

  it("coleta sem repetir, descarta lista negra e fonte usada, e seleciona por nota", async () => {
    await query("DELETE FROM ai_news_candidates WHERE status <> 'published'");
    const now = new Date().toISOString();
    const item = (title: string, link: string) => ({ title, link, summary: "resumo longo sobre o assunto do dia", content: "conteúdo " + title, imageUrl: null, videoUrl: null, publishedAt: now });
    const items = [item("Frieren anuncia novo filme de anime", "https://s.example/1"), item("Notícia Bloqueada sobre algo", "https://s.example/2"), item("Algo sobre anime já usado", "https://velha.example/ja-publicada"), item("Clima do dia em Curitiba", "https://s.example/4")];
    expect(await ingestItems(SRC, items)).toEqual({ inserted: 4, duplicates: 0, tooOld: 0 });
    expect((await ingestItems(SRC, items)).duplicates).toBe(4);
    expect((await ingestItems(SRC, [{ ...item("Velha", "https://s.example/9"), publishedAt: "2020-01-01T00:00:00Z" }])).tooOld).toBe(1);
    await scoreCandidates();
    const rows = await query<{ title: string; status: string; discard_reason: string | null }>("SELECT title, status, discard_reason FROM ai_news_candidates WHERE status <> 'published' ORDER BY score DESC");
    expect(rows.find((r) => r.title.includes("Bloqueada"))).toMatchObject({ status: "discarded", discard_reason: "lista negra" });
    expect(rows.find((r) => r.title.includes("já usado"))).toMatchObject({ status: "discarded", discard_reason: "fonte já usada" });
    expect(rows[0].title).toBe("Frieren anuncia novo filme de anime"); // tópico prioritário + parece anime
    const { insertId } = await exec("INSERT INTO ai_news_runs (started_at, status, mode) VALUES (UTC_TIMESTAMP(3), 'running', 'ensaio')");
    const picked = await selectForRun(1, insertId);
    expect(picked).toHaveLength(1);
    expect((await query<{ status: string }>("SELECT status FROM ai_news_candidates WHERE id = ?", [picked[0]]))[0].status).toBe("selected");
    expect(oldSourceHash("https://velha.example/ja-publicada")).toHaveLength(40);
  });

  it("com o robô desligado a rodada não faz nada", async () => {
    await setConfig({ modo: "desligado" });
    expect(await runRobot({})).toEqual({ modo: "desligado" });
  });
});
