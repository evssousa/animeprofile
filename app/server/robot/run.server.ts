// Uma rodada do robô de notícias: coleta RSS → pontuação → seleção → (por candidato) leitura, mídia, AniList, Gemini,
// qualidade → publicação (ou ensaio). Roda dentro do cron do próprio site; nada de GitHub Actions.
import { exec, query } from "../db.server";
import { findAnimeContext } from "./anilist-context.server";
import { GeneratedArticle, ARTICLE_JSON_SCHEMA, parseGeminiJson } from "./contract";
import { activeSources, allowedCategories, computeSlotLimit, getConfig, getGuide, modelCallsLast24h, recordUsage, type RoboConfig } from "./config.server";
import { BACKUP_POOL, MAX_QUALITY_ATTEMPTS, MIN_TIME_FOR_CANDIDATE_MS, RSS_CONCURRENCY, RUN_BUDGET_MS, RUN_LOCK_MINUTES } from "./constants";
import { GeminiError } from "./gemini.server";
import { enforceSeoHtml, ensureAtLeastOneImage } from "./html";
import { collectAndValidateMedia, localizeImages, replaceImageUrls } from "./media.server";
import { ModelChain, newsModelChain } from "./model-chain";
import { buildRetryInstruction, buildSystemPrompt, buildUserPrompt } from "./prompt";
import { checkPublishable, publishArticle } from "./publish.server";
import { autoFixArticle, checkQuality } from "./quality";
import { fetchSourceItems } from "./rss.server";
import { scrapePage } from "./scrape.server";
import { ingestItems, scoreCandidates, selectForRun } from "./select.server";
import { brasiliaHour, dedupHash, normalizeSpoilerBoxes, stripHtml } from "./text";

export type RunOptions = {
  /** Ensaio: gera e guarda o texto para conferir, mas não cria matéria. */
  rehearsal?: boolean;
  /** Ignora o horário e o teto do dia (disparo manual). */
  force?: boolean;
  limit?: number;
  /** Ensaio de um endereço só, sem coletar feeds. */
  url?: string;
  log?: (msg: string) => void;
};

type Cand = { id: number; title: string; summary: string | null; content: string | null; source_url: string; image_url: string | null; video_url: string | null; source_name: string | null };
type Outcome = "published" | "draft" | "rehearsed" | "discarded" | "failed";

/** Rodadas "running" há mais de 20 min morreram (reinício do app, por exemplo): fecha e devolve os candidatos à fila. */
export async function expireStaleRuns(): Promise<number> {
  const stale = await query<{ id: number }>("SELECT id FROM ai_news_runs WHERE status = 'running' AND started_at < UTC_TIMESTAMP(3) - INTERVAL ? MINUTE", [RUN_LOCK_MINUTES]);
  for (const r of stale) {
    await exec("UPDATE ai_news_runs SET status = 'expired', finished_at = UTC_TIMESTAMP(3) WHERE id = ?", [r.id]);
    await exec("UPDATE ai_news_candidates SET status = 'pending', run_id = NULL WHERE run_id = ? AND status = 'selected'", [r.id]);
  }
  return stale.length;
}

const setCandidate = (id: number, status: string, reason: string | null = null) =>
  exec("UPDATE ai_news_candidates SET status = ?, discard_reason = ? WHERE id = ?", [status, reason?.slice(0, 500) ?? null, id]);

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "Fonte";
  }
};

export async function runRobot(opts: RunOptions = {}): Promise<Record<string, unknown>> {
  const log = opts.log ?? (() => {});
  const cfg = await getConfig();
  const rehearsal = !!opts.rehearsal || cfg.modo === "ensaio";
  if (cfg.modo === "desligado" && !opts.rehearsal) return { modo: "desligado" };

  await expireStaleRuns();
  const live = await query("SELECT id FROM ai_news_runs WHERE status = 'running' LIMIT 1");
  if (live.length) return { modo: cfg.modo, pulou: "já há uma rodada em andamento" };

  const hour = brasiliaHour();
  const limit = opts.force || opts.url ? Math.min(3, Math.max(1, opts.limit ?? 1)) : await computeSlotLimit(hour, cfg);
  if (limit === 0) return { modo: cfg.modo, hora: hour, cota: 0, pulou: "sem cota nesta hora (ou teto do dia atingido)" };
  if (!process.env.GEMINI_API_KEY) return { modo: cfg.modo, erro: "GEMINI_API_KEY ausente" };
  const guide = await getGuide();
  if (!guide.trim()) return { modo: cfg.modo, erro: "guia editorial não importado" };

  const startedAt = Date.now();
  const deadline = startedAt + RUN_BUDGET_MS;
  const mode = rehearsal ? "ensaio" : cfg.modo;
  const { insertId: runId } = await exec("INSERT INTO ai_news_runs (started_at, status, mode, slot, limit_n) VALUES (UTC_TIMESTAMP(3), 'running', ?, ?, ?)", [mode, String(hour).padStart(2, "0"), limit]);

  const report = { modo: mode, hora: hour, cota: limit, coletados: 0, novos: 0, publicados: [] as string[], ensaiados: [] as number[], descartados: [] as { titulo: string; motivo: string }[], falhas: 0, erros: [] as string[] };
  let generated = 0;
  let discarded = 0;
  let status: "finished" | "error" = "finished";
  try {
    if (opts.url) await candidateFromUrl(opts.url, runId);
    else {
      const sources = await activeSources();
      const queue = [...sources];
      await Promise.all(
        Array.from({ length: RSS_CONCURRENCY }, async () => {
          for (let s = queue.shift(); s; s = queue.shift()) {
            const r = await fetchSourceItems({ baseUrl: s.baseUrl, rssUrl: s.rssUrl }, 10);
            report.coletados += r.items.length;
            report.novos += (await ingestItems(s.id, r.items)).inserted;
            const failed = r.status === "failed" || r.status === "no_rss";
            await exec("UPDATE ai_news_sources SET last_status = ?, last_fetched_at = UTC_TIMESTAMP(3), fail_streak = IF(?, fail_streak + 1, 0), rss_url = COALESCE(?, rss_url) WHERE id = ?", [r.status, failed ? 1 : 0, r.discoveredRssUrl ?? null, s.id]);
            if (failed) report.erros.push(`Fonte "${s.name}": ${r.status}`);
          }
        }),
      );
      await scoreCandidates();
      await selectForRun(limit + BACKUP_POOL, runId);
    }

    const picked = await query<Cand>(
      `SELECT c.id, c.title, c.summary, c.content, c.source_url, c.image_url, c.video_url, s.name AS source_name FROM ai_news_candidates c
       LEFT JOIN ai_news_sources s ON s.id = c.source_id WHERE c.run_id = ? AND c.status = 'selected' ORDER BY c.score DESC, c.id`,
      [runId],
    );
    if (!picked.length) report.erros.push("Nenhum candidato disponível nesta rodada.");

    const categories = await allowedCategories();
    const recent = await query<{ title: string; excerpt: string | null }>("SELECT title, excerpt FROM posts WHERE is_ai_generated = 1 AND status = 'published' ORDER BY published_at DESC LIMIT 10");
    const openings = recent.map((p) => `${p.title}: ${(p.excerpt ?? "").split(/(?<=[.!?])\s/)[0] ?? ""}`.trim());

    let currentCandidate: number | null = null;
    const chain = new ModelChain(newsModelChain(cfg.modelo), {
      canUse: async (m) => (await modelCallsLast24h(m)) < cfg.chamadasDiaPorModelo,
      record: (u) => recordUsage({ runId, candidateId: currentCandidate, ...u }),
      log,
    });

    for (const cand of picked) {
      if (generated >= limit) break;
      if (Date.now() > deadline - MIN_TIME_FOR_CANDIDATE_MS) {
        report.erros.push("Tempo da rodada quase esgotado; o resto fica para a próxima.");
        break;
      }
      currentCandidate = cand.id;
      try {
        const res = await processCandidate({ cand, runId, cfg, guide, chain, categories, openings, rehearsal, log });
        if (res.outcome === "published" || res.outcome === "draft" || res.outcome === "rehearsed") {
          generated++;
          if (res.slug) report.publicados.push(res.slug);
          if (res.outcome === "rehearsed") report.ensaiados.push(cand.id);
        } else if (res.outcome === "discarded") {
          discarded++;
          if (report.descartados.length < 10) report.descartados.push({ titulo: cand.title.slice(0, 120), motivo: res.reason ?? "" });
        } else {
          report.falhas++;
          if (report.descartados.length < 10) report.descartados.push({ titulo: cand.title.slice(0, 120), motivo: res.reason ?? "falha" });
        }
        if (res.quotaExhausted || chain.exhausted()) {
          report.erros.push("Cota do Gemini esgotada em todos os modelos; encerrando a rodada.");
          break;
        }
      } catch (e) {
        report.falhas++;
        const msg = e instanceof Error ? e.message : String(e);
        report.erros.push(`Erro em "${cand.title.slice(0, 80)}": ${msg.slice(0, 200)}`);
        await setCandidate(cand.id, "failed", msg);
      }
    }
  } catch (e) {
    status = "error";
    report.erros.push(`Rodada interrompida: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
  } finally {
    await exec("UPDATE ai_news_candidates SET status = 'pending', run_id = NULL WHERE run_id = ? AND status = 'selected'", [runId]);
    await exec("UPDATE ai_news_runs SET status = ?, finished_at = UTC_TIMESTAMP(3), generated_count = ?, discarded = ?, failed = ?, report = ? WHERE id = ?", [status, generated, discarded, report.falhas, JSON.stringify(report), runId]);
  }
  return { ...report, segundos: Math.round((Date.now() - startedAt) / 1000) };
}

/** Ensaio de um endereço só: cria (ou reaproveita) o candidato a partir da página. */
async function candidateFromUrl(url: string, runId: number) {
  const page = await scrapePage(url);
  if (!page) throw new Error("não consegui abrir o endereço");
  const title = (page.rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? hostOf(url)).trim().slice(0, 280);
  await exec(
    `INSERT INTO ai_news_candidates (dedup_hash, title, content, source_url, image_url, status, run_id) VALUES (?, ?, ?, ?, ?, 'selected', ?)
     ON DUPLICATE KEY UPDATE status = 'selected', run_id = VALUES(run_id), post_id = NULL, discard_reason = NULL`,
    [dedupHash(title, url), title, stripHtml(page.textContent).slice(0, 8000), url.slice(0, 600), page.ogImage?.slice(0, 600) ?? null, runId],
  );
}

async function processCandidate(ctx: {
  cand: Cand;
  runId: number;
  cfg: RoboConfig;
  guide: string;
  chain: ModelChain;
  categories: { id: string; slug: string; name: string }[];
  openings: string[];
  rehearsal: boolean;
  log: (m: string) => void;
}): Promise<{ outcome: Outcome; reason?: string; slug?: string; quotaExhausted?: boolean }> {
  const { cand, chain, log } = ctx;
  const discard = async (reason: string, status: "discarded" | "failed" = "discarded") => {
    await setCandidate(cand.id, status, reason);
    return { outcome: status, reason } as const;
  };

  const page = await scrapePage(cand.source_url);
  const media = await collectAndValidateMedia({
    candidateImageUrl: cand.image_url,
    ogImage: page?.ogImage ?? null,
    candidateVideoUrl: cand.video_url,
    scrapedHtml: page?.bodyHtml,
    scrapedRawHtml: page?.rawHtml,
    scrapedLinks: page?.links,
    bodyImageLimit: ctx.cfg.imagensCorpo,
  });
  if (!media.ok) return discard(media.reason);

  const anilist = await findAnimeContext(cand.title);
  const system = buildSystemPrompt(ctx.guide);
  const base = buildUserPrompt({
    candidateTitle: cand.title,
    candidateSummary: cand.summary,
    candidateContent: cand.content,
    sourceUrl: cand.source_url,
    categorySlugs: ctx.categories.map((c) => c.slug),
    trailer: media.trailer,
    extraVideos: media.videos,
    bodyImages: media.bodyImages,
    anilistContext: anilist?.context ?? null,
    recentOpenings: ctx.openings,
  });

  let article: GeneratedArticle | null = null;
  let issues: string[] = [];
  const sourceName = cand.source_name ?? hostOf(cand.source_url);
  for (let attempt = 0; attempt < MAX_QUALITY_ATTEMPTS; attempt++) {
    let text: string;
    try {
      text = (await chain.generate({ system, user: attempt === 0 ? base : `${base}\n\n${buildRetryInstruction(issues)}` })).text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`Falha no Gemini em "${cand.title}": ${msg}`);
      await setCandidate(cand.id, "failed", `Gemini: ${msg}`);
      return { outcome: "failed", reason: `Gemini: ${msg.slice(0, 200)}`, quotaExhausted: e instanceof GeminiError && e.status === 429 };
    }
    let parsed: unknown;
    try {
      parsed = parseGeminiJson(text);
    } catch (e) {
      issues = [`Resposta não é um JSON válido: ${(e as Error).message}`];
      continue;
    }
    const z = GeneratedArticle.safeParse(parsed);
    if (!z.success) {
      issues = z.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`);
      continue;
    }
    let html = enforceSeoHtml({ html: z.data.html, focusKeyword: z.data.focusKeyword, sourceUrl: cand.source_url, sourceName, trailer: media.trailer, bodyImages: media.bodyImages, extraVideos: media.videos });
    html = normalizeSpoilerBoxes(ensureAtLeastOneImage(html, media.cover, z.data.focusKeyword));
    const fixed = autoFixArticle({ ...z.data, html });
    const q = checkQuality(fixed.article, { sourceText: `${cand.title} ${cand.summary ?? ""} ${cand.content ?? ""}`, bodyImages: media.bodyImages });
    if (q.ok) {
      article = fixed.article;
      break;
    }
    issues = q.issues.map((i) => i.message);
    log(`Qualidade falhou (tentativa ${attempt + 1}) em "${cand.title}": ${issues.join(" | ")}`);
  }
  if (!article) return discard(`Qualidade: ${issues.join(" | ")}`);

  // Anime em foco que o título da fonte não revelou: confirma pelo nome que o Gemini identificou.
  let found = anilist;
  if (article.animeFocus === "main" && !found && article.animeTitle) found = await findAnimeContext(article.animeTitle);
  const anilistId = article.animeFocus === "main" ? found?.anilistId : undefined;

  // Imagens próprias (WebP em /media/robo). Se alguma falhar, fica o endereço da fonte.
  const local = await localizeImages([media.cover, ...media.bodyImages], log);
  const urlMap = new Map([...local].map(([from, l]) => [from, l.url]));
  if (urlMap.size) article = { ...article, html: replaceImageUrls(article.html, urlMap) };
  const swap = (u: string) => urlMap.get(u) ?? u;
  const coverLocal = local.get(media.cover);
  const cover = { url: swap(media.cover), width: coverLocal?.width ?? media.coverW, height: coverLocal?.height ?? media.coverH };
  const bodyImages = media.bodyImages.map(swap);
  const candidate = { id: cand.id, title: cand.title, sourceUrl: cand.source_url };

  if (ctx.rehearsal) {
    const check = await checkPublishable({ candidate, article, bodyImages }, ctx.cfg);
    await exec("UPDATE ai_news_candidates SET status = 'rehearsal', result_json = ?, discard_reason = ? WHERE id = ?", [
      JSON.stringify({ article, cover, bodyImages, anilistId: anilistId ?? null, check: check.ok ? { ok: true, category: check.category.name, author: check.author.name } : check }),
      check.ok ? null : check.reason.slice(0, 500),
      cand.id,
    ]);
    return { outcome: "rehearsed" };
  }

  const res = await publishArticle({ candidate, article, cover, bodyImages, anilistId, mode: ctx.cfg.modo === "rascunho" ? "rascunho" : "publicar", runId: ctx.runId, slot: null });
  if (!res.ok) return discard(res.reason, res.kind);
  log(`${res.status === "published" ? "Publicado" : "Rascunho"}: /noticias/${res.slug}`);
  return { outcome: res.status === "published" ? "published" : "draft", slug: res.slug };
}

