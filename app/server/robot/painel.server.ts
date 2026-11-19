// Tudo o que a tela "Notícias IA" do painel lê e faz com o robô de notícias. O painel chama estas funções direto (nunca passa pelo
// CRON_TOKEN no navegador); /api/robo/* continua existindo para scripts e usa `statusRobo` e `previewHtml` daqui.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { STATUS_CANDIDATO, type StatusCandidato } from "~/lib/robo-painel";
import { trackRun } from "../cron/runner.server";
import { sanitizePostHtml } from "../content/sanitize.server";
import { exec, hasDatabase, iso, json, query } from "../db.server";
import { carregarPost, salvarPost } from "../admin/posts-edit.server";
import { excluirRascunhos } from "../admin/posts.server";
import { activeAuthors, activeSlots, DEFAULT_SLOT_HOURS, getConfig, getGuide, roboPostsToday, setConfig, setGuide, ROBO_MODES, type RoboConfig } from "./config.server";
import { ALLOWED_GEMINI_MODELS, RUN_LOCK_MINUTES } from "./constants";
import { fetchSourceItems } from "./rss.server";
import { expireStaleRuns, runRobot } from "./run.server";
import { brasiliaHour } from "./text";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ───────────── Estado geral (o mesmo de /api/robo/status) ─────────────

export async function statusRobo() {
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

/** Página HTML de conferência do texto gerado no ensaio ou do rascunho (candidato). */
export async function previewHtml(id: number): Promise<string | null> {
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

// ───────────── Visão geral ─────────────

export type Rodada = { id: number; inicio: string; fim: string | null; status: string; modo: string; limite: number; geradas: number; descartadas: number; falhas: number; relatorio: unknown };

const toRodada = (r: { id: number; started_at: string; finished_at: string | null; status: string; mode: string; limit_n: number; generated_count: number; discarded: number; failed: number; report: unknown }): Rodada => ({
  id: Number(r.id),
  inicio: iso(r.started_at)!,
  fim: iso(r.finished_at) ?? null,
  status: r.status,
  modo: r.mode,
  limite: Number(r.limit_n),
  geradas: Number(r.generated_count),
  descartadas: Number(r.discarded),
  falhas: Number(r.failed),
  relatorio: json(r.report, null),
});

export async function visaoGeral() {
  const [st, rodadas, motivos, rodando] = await Promise.all([
    statusRobo(),
    query<Parameters<typeof toRodada>[0]>("SELECT id, started_at, finished_at, status, mode, limit_n, generated_count, discarded, failed, report FROM ai_news_runs ORDER BY id DESC LIMIT 10"),
    motivosDescarte24h(),
    rodadaEmAndamento(),
  ]);
  return {
    modo: st.config.modo,
    config: st.config,
    chave: st.chave,
    hoje: st.materiasDoRoboHoje,
    teto: st.config.limiteDia,
    horaAgora: st.horaAgora,
    horarios: Object.entries(st.horarios).map(([h, n]) => ({ hora: Number(h), posts: Number(n) })),
    gemini: st.chamadasGemini24h.map((g) => ({ ...g, limite: st.config.chamadasDiaPorModelo })),
    modelos: [...st.modelos],
    rodadas: rodadas.map(toRodada),
    motivos,
    rodando,
  };
}

export async function motivosDescarte24h(): Promise<{ motivo: string; n: number }[]> {
  const rows = await query<{ motivo: string; n: number }>(
    "SELECT discard_reason AS motivo, COUNT(*) AS n FROM ai_news_candidates WHERE status IN ('discarded', 'failed') AND discard_reason IS NOT NULL AND updated_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR GROUP BY discard_reason ORDER BY n DESC LIMIT 8",
  );
  return rows.map((r) => ({ motivo: r.motivo, n: Number(r.n) }));
}

/** Há uma rodada em andamento? (as que passaram de 20 min são dadas como mortas e fechadas) */
export async function rodadaEmAndamento(): Promise<boolean> {
  await expireStaleRuns().catch(() => 0);
  const [r] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM ai_news_runs WHERE status = 'running' AND started_at >= UTC_TIMESTAMP(3) - INTERVAL ? MINUTE", [RUN_LOCK_MINUTES]);
  return Number(r?.n ?? 0) > 0;
}

export type Disparo = "ensaio" | "rodada";

/** Começa uma rodada sem esperar (ela leva de 1 a 3 minutos). */
export async function iniciarRodada(tipo: Disparo): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (await rodadaEmAndamento()) return { ok: false, erro: "Já tem uma rodada em andamento." };
  const cfg = await getConfig();
  if (!process.env.GEMINI_API_KEY) return { ok: false, erro: "Falta a chave do Gemini no servidor (GEMINI_API_KEY)." };
  if (tipo === "rodada" && cfg.modo === "desligado") return { ok: false, erro: "O robô está desligado. Escolha um modo antes de rodar." };
  const opts = tipo === "ensaio" ? { rehearsal: true, force: true, limit: 1 } : { force: true };
  trackRun("robo-painel", () => runRobot(opts)).catch((e) => console.error("[robo] rodada do painel falhou:", e));
  return { ok: true };
}

export async function ensaiarEndereco(url: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!/^https?:\/\//i.test(url) || url.length > 600) return { ok: false, erro: "Use um endereço completo (https://...)." };
  if (await rodadaEmAndamento()) return { ok: false, erro: "Já tem uma rodada em andamento." };
  if (!process.env.GEMINI_API_KEY) return { ok: false, erro: "Falta a chave do Gemini no servidor (GEMINI_API_KEY)." };
  trackRun("robo-painel", () => runRobot({ rehearsal: true, force: true, url })).catch((e) => console.error("[robo] ensaio do painel falhou:", e));
  return { ok: true };
}

// ───────────── Configuração ─────────────

const Config = z.object({
  modo: z.enum(ROBO_MODES as [string, ...string[]]).optional(),
  limiteDia: z.coerce.number().int().min(1).max(15).optional(),
  foraDeAnimePct: z.coerce.number().int().min(0).max(100).optional(),
  imagensCorpo: z.coerce.number().int().min(1).max(10).optional(),
  modelo: z.enum(ALLOWED_GEMINI_MODELS).optional(),
  chamadasDiaPorModelo: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function salvarConfig(bruto: unknown): Promise<{ ok: true; config: RoboConfig } | { ok: false; erro: string }> {
  const r = Config.safeParse(bruto);
  if (!r.success) return { ok: false, erro: "Algum valor está fora do limite. Confira os campos." };
  const patch = Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined)) as Partial<RoboConfig>;
  return { ok: true, config: await setConfig(patch) };
}

export async function salvarGuia(texto: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const t = texto.replace(/\r\n/g, "\n");
  if (t.length > 60_000) return { ok: false, erro: "O guia passou de 60 mil caracteres." };
  await setGuide(t);
  return { ok: true };
}

export async function guiaEditorial() {
  return getGuide();
}

// ───────────── Candidatos ─────────────


export type Candidato = { id: number; titulo: string; url: string; fonte: string | null; nota: number; status: string; motivo: string | null; criadoEm: string; temPrevia: boolean };

export async function listarCandidatos(status: StatusCandidato, pagina: number) {
  const por = 25;
  const [cont, [tot]] = await Promise.all([
    query<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM ai_news_candidates WHERE created_at >= UTC_TIMESTAMP(3) - INTERVAL 3 DAY GROUP BY status"),
    query<{ n: number }>("SELECT COUNT(*) AS n FROM ai_news_candidates WHERE status = ? AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 3 DAY", [status]),
  ]);
  const total = Number(tot?.n ?? 0);
  const paginas = Math.max(1, Math.ceil(total / por));
  const p = Math.min(Math.max(1, pagina), paginas);
  const rows = await query<{ id: number; title: string; source_url: string; fonte: string | null; score: number; status: string; discard_reason: string | null; created_at: string; tem: number }>(
    `SELECT c.id, c.title, c.source_url, s.name AS fonte, c.score, c.status, c.discard_reason, c.created_at, (c.result_json IS NOT NULL) AS tem
     FROM ai_news_candidates c LEFT JOIN ai_news_sources s ON s.id = c.source_id
     WHERE c.status = ? AND c.created_at >= UTC_TIMESTAMP(3) - INTERVAL 3 DAY ORDER BY c.score DESC, c.id DESC LIMIT ? OFFSET ?`,
    [status, por, (p - 1) * por],
  );
  const contagens = Object.fromEntries(STATUS_CANDIDATO.map((s) => [s, 0])) as Record<StatusCandidato, number>;
  for (const c of cont) if (c.status in contagens) contagens[c.status as StatusCandidato] = Number(c.n);
  return {
    itens: rows.map((r): Candidato => ({ id: Number(r.id), titulo: r.title, url: r.source_url, fonte: r.fonte, nota: Number(r.score), status: r.status, motivo: r.discard_reason, criadoEm: iso(r.created_at)!, temPrevia: !!Number(r.tem) })),
    total,
    pagina: p,
    paginas,
    contagens,
  };
}

/** Descarta um candidato que ainda está na fila. */
export async function descartarCandidato(id: number): Promise<boolean> {
  const { affected } = await exec("UPDATE ai_news_candidates SET status = 'discarded', discard_reason = 'descartado no painel' WHERE id = ? AND status = 'pending'", [id]);
  return affected > 0;
}

// ───────────── Aprovação (rascunhos do robô) ─────────────

export type RascunhoRobo = { id: string; titulo: string; capa: string | null; autor: string | null; categoria: string | null; palavras: number; criadoEm: string };

export async function listarRascunhos(): Promise<RascunhoRobo[]> {
  const rows = await query<{ id: string; title: string; featured_image: string | null; autor: string | null; categoria: string | null; reading_minutes: number; created_at: string }>(
    `SELECT p.id, p.title, p.featured_image, a.name AS autor, p.reading_minutes, p.created_at,
            (SELECT c.name FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id ORDER BY c.name LIMIT 1) AS categoria
     FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id WHERE p.origin = 'robo' AND p.status = 'draft' ORDER BY p.created_at DESC LIMIT 100`,
  );
  return rows.map((r) => ({ id: r.id, titulo: r.title, capa: r.featured_image, autor: r.autor, categoria: r.categoria, palavras: Number(r.reading_minutes) * 200, criadoEm: iso(r.created_at)! }));
}

export async function contarRascunhos(): Promise<number> {
  const [r] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM posts WHERE origin = 'robo' AND status = 'draft'");
  return Number(r?.n ?? 0);
}

/** Publica o rascunho agora, com as mesmas regras do editor (checklist completo). */
export async function publicarRascunho(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = await carregarPost(id);
  if (!r || r.post.status !== "draft") return { ok: false, erro: "Esse rascunho não existe mais." };
  const p = r.post;
  const res = await salvarPost(
    { id: p.id, titulo: p.titulo, slug: p.slug, resumo: p.resumo, capa: p.capa, tipo: p.tipo, html: p.html, categoriaIds: p.categoriaIds, tagIds: p.tagIds, publicadoEm: null, palavraChave: p.palavraChave, autorId: p.autorId, atualizadoEm: p.atualizadoEm },
    "publish",
  );
  if (!res.ok) return { ok: false, erro: res.erro };
  await exec("UPDATE ai_news_candidates SET status = 'published' WHERE post_id = ?", [id]);
  return { ok: true };
}

export async function descartarRascunho(id: string): Promise<boolean> {
  const n = await excluirRascunhos([id]);
  if (n > 0) await exec("UPDATE ai_news_candidates SET status = 'discarded', discard_reason = 'descartado no painel', post_id = NULL WHERE post_id = ?", [id]);
  return n > 0;
}

// ───────────── Histórico ─────────────

export async function listarRodadas(pagina: number) {
  const por = 25;
  const [tot] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM ai_news_runs WHERE started_at >= UTC_TIMESTAMP(3) - INTERVAL 60 DAY");
  const total = Number(tot?.n ?? 0);
  const paginas = Math.max(1, Math.ceil(total / por));
  const p = Math.min(Math.max(1, pagina), paginas);
  const rows = await query<Parameters<typeof toRodada>[0]>(
    "SELECT id, started_at, finished_at, status, mode, limit_n, generated_count, discarded, failed, report FROM ai_news_runs WHERE started_at >= UTC_TIMESTAMP(3) - INTERVAL 60 DAY ORDER BY id DESC LIMIT ? OFFSET ?",
    [por, (p - 1) * por],
  );
  return { itens: rows.map(toRodada), total, pagina: p, paginas };
}

// ───────────── Fontes ─────────────

export type Fonte = { id: string; nome: string; site: string; rss: string | null; prioridade: number; ativa: boolean; ultimoStatus: string | null; ultimaBusca: string | null; falhasSeguidas: number };

export async function listarFontes(): Promise<Fonte[]> {
  const rows = await query<{ id: string; name: string; base_url: string; rss_url: string | null; priority: number; active: number; last_status: string | null; last_fetched_at: string | null; fail_streak: number }>(
    "SELECT id, name, base_url, rss_url, priority, active, last_status, last_fetched_at, fail_streak FROM ai_news_sources ORDER BY active DESC, priority DESC, name",
  );
  return rows.map((r) => ({ id: r.id, nome: r.name, site: r.base_url, rss: r.rss_url, prioridade: Number(r.priority), ativa: !!r.active, ultimoStatus: r.last_status, ultimaBusca: iso(r.last_fetched_at) ?? null, falhasSeguidas: Number(r.fail_streak) }));
}

export async function fontesFalhando(): Promise<number> {
  const [r] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM ai_news_sources WHERE active = 1 AND fail_streak >= 3");
  return Number(r?.n ?? 0);
}

const urlHttp = z.string().trim().url("Endereço inválido.").max(600).refine((u) => /^https?:\/\//i.test(u), "Use um endereço http ou https.");
const FonteEntrada = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{8,36}$/).nullable().optional(),
  nome: z.string().trim().min(2, "Dê um nome à fonte.").max(120),
  site: urlHttp,
  rss: z.union([z.literal(""), urlHttp]).optional(),
  prioridade: z.coerce.number().int().min(1).max(10),
});

export async function salvarFonte(bruto: unknown): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = FonteEntrada.safeParse(bruto);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? "Confira os campos." };
  const f = r.data;
  if (f.id) {
    const { affected } = await exec("UPDATE ai_news_sources SET name = ?, base_url = ?, rss_url = ?, priority = ? WHERE id = ?", [f.nome, f.site, f.rss || null, f.prioridade, f.id]);
    if (!affected) return { ok: false, erro: "Fonte não encontrada." };
  } else {
    await exec("INSERT INTO ai_news_sources (id, name, base_url, rss_url, priority, active) VALUES (?, ?, ?, ?, ?, 1)", [randomUUID(), f.nome, f.site, f.rss || null, f.prioridade]);
  }
  return { ok: true };
}

export async function ligarFonte(id: string, ativa: boolean) {
  await exec("UPDATE ai_news_sources SET active = ?, fail_streak = IF(?, 0, fail_streak) WHERE id = ?", [ativa ? 1 : 0, ativa ? 1 : 0, id]);
}

/** Testa a fonte agora: quantos itens o feed devolve (não mexe no histórico de falhas). */
export async function testarFonte(id: string): Promise<{ ok: true; status: string; itens: number; primeiros: string[] } | { ok: false; erro: string }> {
  const [s] = await query<{ base_url: string; rss_url: string | null }>("SELECT base_url, rss_url FROM ai_news_sources WHERE id = ?", [id]);
  if (!s) return { ok: false, erro: "Fonte não encontrada." };
  try {
    const r = await fetchSourceItems({ baseUrl: s.base_url, rssUrl: s.rss_url }, 10);
    return { ok: true, status: r.status, itens: r.items.length, primeiros: r.items.slice(0, 3).map((i) => i.title) };
  } catch (e) {
    return { ok: false, erro: String((e as Error)?.message ?? e).slice(0, 160) };
  }
}

// ───────────── Tópicos e bloqueios ─────────────

export type Termo = { id: number; tipo: "topic" | "block"; termo: string; peso: number; ativo: boolean };

export async function listarTermos(): Promise<Termo[]> {
  const rows = await query<{ id: number; kind: string; term: string; weight: number; active: number }>("SELECT id, kind, term, weight, active FROM ai_news_terms ORDER BY kind, weight DESC, term");
  return rows.map((r) => ({ id: Number(r.id), tipo: r.kind === "block" ? "block" : "topic", termo: r.term, peso: Number(r.weight), ativo: !!r.active }));
}

const TermoEntrada = z.object({ tipo: z.enum(["topic", "block"]), termo: z.string().trim().min(2, "Escreva o termo.").max(160), peso: z.coerce.number().int().min(1).max(100).optional() });

export async function salvarTermo(bruto: unknown): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = TermoEntrada.safeParse(bruto);
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? "Confira os campos." };
  const { tipo, termo } = r.data;
  const peso = tipo === "topic" ? (r.data.peso ?? 10) : 0;
  await exec("INSERT INTO ai_news_terms (kind, term, weight, active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE weight = VALUES(weight), active = 1", [tipo, termo.toLowerCase(), peso]);
  return { ok: true };
}

export async function apagarTermo(id: number) {
  await exec("DELETE FROM ai_news_terms WHERE id = ?", [id]);
}

export async function alternarTermo(id: number, ativo: boolean) {
  await exec("UPDATE ai_news_terms SET active = ? WHERE id = ?", [ativo ? 1 : 0, id]);
}

// ───────────── Horários e limites ─────────────

/** As 24 horas do dia com a cota de cada uma (0 = sem rodada). Tabela vazia = padrão do robô. */
export async function listarHorarios(): Promise<{ hora: number; posts: number }[]> {
  const rows = await query<{ hour: number; posts: number }>("SELECT hour, posts FROM ai_news_schedule_slots WHERE active = 1");
  const mapa = rows.length ? new Map(rows.map((r) => [Number(r.hour), Number(r.posts)])) : new Map(DEFAULT_SLOT_HOURS.map((h) => [h, 1]));
  return Array.from({ length: 24 }, (_, hora) => ({ hora, posts: mapa.get(hora) ?? 0 }));
}

export async function salvarHorarios(posts: unknown): Promise<{ ok: true; total: number } | { ok: false; erro: string }> {
  const r = z.array(z.coerce.number().int().min(0).max(3)).length(24).safeParse(posts);
  if (!r.success) return { ok: false, erro: "Cada horário aceita de 0 a 3 matérias." };
  const total = r.data.reduce((a, b) => a + b, 0);
  if (total === 0) return { ok: false, erro: "Escolha pelo menos um horário (senão o robô nunca roda)." };
  await exec("DELETE FROM ai_news_schedule_slots");
  for (const [hora, n] of r.data.entries()) if (n > 0) await exec("INSERT INTO ai_news_schedule_slots (hour, posts, active) VALUES (?, ?, 1)", [hora, n]);
  return { ok: true, total };
}

// ───────────── Autores IA ─────────────

export type AutorIA = { id: string; nome: string; slug: string; categoria: string; especialidade: string | null; publicaSozinho: boolean; ativo: boolean };

export async function listarAutoresIA(): Promise<{ autores: AutorIA[]; categorias: string[] }> {
  const [rows, cats] = await Promise.all([
    query<{ id: string; name: string; slug: string; category_name: string; specialty: string | null; auto_publish: number; active: number }>(
      "SELECT a.author_id AS id, p.name, p.slug, a.category_name, a.specialty, a.auto_publish, a.active FROM ai_news_authors a JOIN post_authors p ON p.id = a.author_id AND p.kind = 'ai' ORDER BY a.active DESC, p.name",
    ),
    query<{ name: string }>("SELECT name FROM categories WHERE kind = 'news' ORDER BY name"),
  ]);
  return {
    autores: rows.map((r) => ({ id: r.id, nome: r.name, slug: r.slug, categoria: r.category_name, especialidade: r.specialty, publicaSozinho: !!r.auto_publish, ativo: !!r.active })),
    categorias: cats.map((c) => c.name),
  };
}

const AutorEntrada = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{8,36}$/),
  categoria: z.string().trim().min(2).max(120),
  especialidade: z.string().trim().max(4000).optional(),
  publicaSozinho: z.boolean(),
  ativo: z.boolean(),
});

export async function salvarAutorIA(bruto: unknown): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = AutorEntrada.safeParse(bruto);
  if (!r.success) return { ok: false, erro: "Confira a categoria e os campos." };
  const a = r.data;
  const [cat] = await query<{ id: string }>("SELECT id FROM categories WHERE name = ? AND kind = 'news'", [a.categoria]);
  if (!cat) return { ok: false, erro: "Essa categoria de notícia não existe." };
  const { affected } = await exec("UPDATE ai_news_authors SET category_name = ?, specialty = ?, auto_publish = ?, active = ? WHERE author_id = ?", [a.categoria, a.especialidade || null, a.publicaSozinho ? 1 : 0, a.ativo ? 1 : 0, a.id]);
  return affected ? { ok: true } : { ok: false, erro: "Autor não encontrado." };
}

// ───────────── Resumo do submenu ─────────────

export async function contadoresMenu() {
  if (!hasDatabase()) return { rascunhos: 0, fontesFalhando: 0 };
  const [rascunhos, falhando] = await Promise.all([contarRascunhos(), fontesFalhando()]);
  return { rascunhos, fontesFalhando: falhando };
}
