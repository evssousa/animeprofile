// Operação do robô de notícias. Tudo protegido pelo CRON_TOKEN (cabeçalho x-cron-token ou ?token=); sem token, 404.
//   GET  /api/robo/status                        modo, chave, fontes, autores, horários, uso do Gemini, últimas rodadas
//   GET  /api/robo/modo?valor=desligado|ensaio|rascunho|publicar[&limiteDia=N]
//   GET  /api/robo/ensaio?limite=1..3            roda agora em modo ensaio (202); não cria matéria
//   GET  /api/robo/url?u=<endereço>              ensaio de um endereço só (202)
//   GET  /api/robo/previa?id=<candidato>         página para conferir o texto gerado (ensaio ou rascunho)
//   POST /api/robo/config                        recebe a configuração do site antigo (JSON, gzip opcional)
import { timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { Route } from "./+types/api.robo";
import { hasDatabase, json, query } from "~/server/db.server";
import { trackRun } from "~/server/cron/runner.server";
import { sanitizePostHtml } from "~/server/content/sanitize.server";
import { activeAuthors, activeSlots, getConfig, getGuide, roboPostsToday, setConfig, ROBO_MODES, type RoboMode } from "~/server/robot/config.server";
import { applyRoboConfig, type RoboConfigInput } from "~/server/robot/config-import.server";
import { ALLOWED_GEMINI_MODELS } from "~/server/robot/constants";
import { runRobot } from "~/server/robot/run.server";
import { brasiliaHour } from "~/server/robot/text";

function authorized(request: Request) {
  const expected = process.env.CRON_TOKEN;
  if (!expected || expected.length < 24) return false;
  const given = request.headers.get("x-cron-token") ?? new URL(request.url).searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const notFound = () => new Response("Not Found", { status: 404 });
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function status() {
  const cfg = await getConfig();
  const [sources, authors, slots, today, usage, runs, byCat] = await Promise.all([
    query<{ active: number; failing: number; total: number }>("SELECT SUM(active) AS active, SUM(active = 1 AND fail_streak >= 3) AS failing, COUNT(*) AS total FROM ai_news_sources"),
    activeAuthors(),
    activeSlots(),
    roboPostsToday(),
    query<{ model: string; n: number; erros: number }>("SELECT model, COUNT(*) AS n, SUM(status_code <> 200) AS erros FROM ai_news_usage WHERE created_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR GROUP BY model"),
    query<{ id: number; started_at: string; finished_at: string | null; status: string; mode: string; limit_n: number; generated_count: number; discarded: number; failed: number; report: unknown }>(
      "SELECT id, started_at, finished_at, status, mode, limit_n, generated_count, discarded, failed, report FROM ai_news_runs ORDER BY id DESC LIMIT 10",
    ),
    query<{ origin: string; n: number }>("SELECT origin, COUNT(*) AS n FROM posts GROUP BY origin"),
  ]);
  const porCategoria: Record<string, { autores: number; semAutoPublicar: number }> = {};
  for (const a of authors) {
    const c = (porCategoria[a.categoryName] ??= { autores: 0, semAutoPublicar: 0 });
    c.autores++;
    if (!a.autoPublish) c.semAutoPublicar++;
  }
  return {
    modo: cfg.modo,
    config: cfg,
    chave: Boolean(process.env.GEMINI_API_KEY),
    guia: (await getGuide()).length > 0,
    modelos: ALLOWED_GEMINI_MODELS,
    fontes: { total: Number(sources[0]?.total ?? 0), ativas: Number(sources[0]?.active ?? 0), falhando: Number(sources[0]?.failing ?? 0) },
    autoresPorCategoria: porCategoria,
    horarios: Object.fromEntries([...slots].sort((a, b) => a[0] - b[0])),
    horaAgora: brasiliaHour(),
    materiasDoRoboHoje: today,
    materiasPorOrigem: Object.fromEntries(byCat.map((r) => [r.origin, Number(r.n)])),
    chamadasGemini24h: usage.map((u) => ({ modelo: u.model, chamadas: Number(u.n), erros: Number(u.erros) })),
    ultimasRodadas: runs.map((r) => ({ ...r, report: json(r.report, null) })),
  };
}

async function preview(id: number) {
  const [row] = await query<{ id: number; title: string; status: string; source_url: string; result_json: string | null; discard_reason: string | null }>(
    "SELECT id, title, status, source_url, result_json, discard_reason FROM ai_news_candidates WHERE id = ? AND status IN ('rehearsal', 'draft', 'discarded')",
    [id],
  );
  if (!row?.result_json) return null;
  const r = JSON.parse(row.result_json) as {
    article: { title: string; titleVariants: string[]; focusKeyword: string; metaDescription: string; excerpt: string; html: string; tags: string[]; categorySlug: string; animeFocus: string };
    cover: { url: string; width: number | null; height: number | null };
    check: { ok: boolean; category?: string; author?: string; reason?: string };
  };
  const a = r.article;
  const html = sanitizePostHtml(a.html);
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prévia #${row.id}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#1a1a1a}table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}td:first-child{width:150px;font-weight:600;background:#f6f6f6}img{max-width:100%;height:auto;border-radius:8px}.ok{color:#0a7a2f}.no{color:#b00020}details.spoiler-box{border:1px solid #ccc;border-radius:8px;padding:8px 12px}</style></head><body>
<h1>${esc(a.title)}</h1><img src="${esc(r.cover.url)}" alt="capa">
<table>
<tr><td>Palavras</td><td>${words}</td></tr>
<tr><td>Palavra-chave</td><td>${esc(a.focusKeyword)}</td></tr>
<tr><td>Variantes de título</td><td>${a.titleVariants.map(esc).join("<br>") || "-"}</td></tr>
<tr><td>Meta description</td><td>${esc(a.metaDescription)} (${a.metaDescription.length})</td></tr>
<tr><td>Resumo</td><td>${esc(a.excerpt)}</td></tr>
<tr><td>Categoria / autor</td><td>${esc(a.categorySlug)} / ${esc(r.check.author ?? "-")}</td></tr>
<tr><td>Tags</td><td>${a.tags.map(esc).join(", ")}</td></tr>
<tr><td>Capa</td><td>${esc(r.cover.url)} (${r.cover.width ?? "?"}×${r.cover.height ?? "?"})</td></tr>
<tr><td>Fonte</td><td><a href="${esc(row.source_url)}">${esc(row.source_url)}</a></td></tr>
<tr><td>Publicável?</td><td class="${r.check.ok ? "ok" : "no"}">${r.check.ok ? "sim" : "não: " + esc(r.check.reason)}</td></tr>
</table><hr>${html}</body></html>`;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!authorized(request) || !hasDatabase()) return notFound();
  const url = new URL(request.url);

  if (params.acao === "status") return Response.json(await status(), { headers });

  if (params.acao === "modo") {
    const valor = url.searchParams.get("valor") as RoboMode | null;
    if (!valor || !ROBO_MODES.includes(valor)) return Response.json({ error: `valor deve ser um de: ${ROBO_MODES.join(", ")}` }, { status: 400, headers });
    const patch: { modo: RoboMode; limiteDia?: number } = { modo: valor };
    const limite = url.searchParams.get("limiteDia");
    if (limite !== null) {
      const n = Number(limite);
      if (!Number.isInteger(n) || n < 1 || n > 15) return Response.json({ error: "limiteDia deve ser um inteiro de 1 a 15" }, { status: 400, headers });
      patch.limiteDia = n;
    }
    return Response.json(await setConfig(patch), { headers });
  }

  if (params.acao === "ensaio" || params.acao === "url") {
    const endereco = url.searchParams.get("u") ?? "";
    if (params.acao === "url" && !/^https?:\/\//i.test(endereco)) return Response.json({ error: "informe ?u=<endereço completo>" }, { status: 400, headers });
    const limit = Math.min(3, Math.max(1, Number(url.searchParams.get("limite")) || 1));
    const opts = params.acao === "url" ? { rehearsal: true, force: true, url: endereco } : { rehearsal: true, force: true, limit };
    const wait = url.searchParams.get("wait") === "1";
    const running = trackRun("robo-ensaio", () => runRobot(opts));
    if (!wait) {
      running.catch((err) => console.error("[robo] ensaio falhou:", err));
      return Response.json({ iniciado: params.acao }, { status: 202, headers });
    }
    return Response.json(await running, { headers });
  }

  if (params.acao === "previa") {
    const page = await preview(Number(url.searchParams.get("id")));
    return page ? new Response(page, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } }) : notFound();
  }
  return notFound();
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST" || params.acao !== "config" || !authorized(request) || !hasDatabase()) return notFound();
  let body: RoboConfigInput;
  try {
    const raw = Buffer.from(await request.arrayBuffer());
    const text = request.headers.get("content-encoding") === "gzip" || raw[0] === 0x1f ? gunzipSync(raw, { maxOutputLength: 20 * 1024 * 1024 }) : raw;
    body = JSON.parse(text.toString("utf8"));
  } catch {
    return Response.json({ error: "corpo inválido (esperado JSON, de preferência com gzip)" }, { status: 400, headers });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "formato inesperado" }, { status: 400, headers });
  return Response.json(await applyRoboConfig(body), { headers });
}
