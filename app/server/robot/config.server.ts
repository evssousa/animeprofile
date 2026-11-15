// Configuração do robô lida do banco: modo, teto do dia, horários, fontes, autores e termos.
import { exec, json, query } from "../db.server";
import { DEFAULT_GEMINI_MODEL, DEFAULT_NON_ANIME_MAX_PCT, isAllowedGeminiModel, type GeminiModel } from "./constants";
import { startOfBrasiliaDay } from "./text";

export type RoboMode = "desligado" | "ensaio" | "rascunho" | "publicar";
export const ROBO_MODES: RoboMode[] = ["desligado", "ensaio", "rascunho", "publicar"];

export type RoboConfig = {
  modo: RoboMode;
  limiteDia: number;
  foraDeAnimePct: number;
  imagensCorpo: number;
  modelo: GeminiModel;
  chamadasDiaPorModelo: number;
};

const DEFAULTS: RoboConfig = { modo: "desligado", limiteDia: 10, foraDeAnimePct: DEFAULT_NON_ANIME_MAX_PCT, imagensCorpo: 3, modelo: DEFAULT_GEMINI_MODEL, chamadasDiaPorModelo: 40 };

/** Horários padrão (Brasília) quando a tabela de horários está vazia: 1 matéria em cada. */
export const DEFAULT_SLOT_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];

const int = (v: unknown, min: number, max: number, fallback: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback);

export async function getConfig(): Promise<RoboConfig> {
  const [row] = await query<{ value: unknown }>("SELECT value FROM system_config WHERE name = 'robo'");
  const v = json<Partial<RoboConfig>>(row?.value, {});
  return {
    modo: ROBO_MODES.includes(v.modo as RoboMode) ? (v.modo as RoboMode) : "desligado",
    limiteDia: int(v.limiteDia, 0, 30, DEFAULTS.limiteDia),
    foraDeAnimePct: int(v.foraDeAnimePct, 0, 100, DEFAULTS.foraDeAnimePct),
    imagensCorpo: int(v.imagensCorpo, 1, 10, DEFAULTS.imagensCorpo),
    modelo: isAllowedGeminiModel(v.modelo) ? v.modelo : DEFAULTS.modelo,
    chamadasDiaPorModelo: int(v.chamadasDiaPorModelo, 1, 1000, DEFAULTS.chamadasDiaPorModelo),
  };
}

/** Mescla os campos no `robo` (sem apagar os outros). */
export async function setConfig(patch: Partial<RoboConfig>): Promise<RoboConfig> {
  const next = { ...(await getConfig()), ...patch };
  await exec("INSERT INTO system_config (name, value) VALUES ('robo', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE value = VALUES(value)", [JSON.stringify(next)]);
  return next;
}

/** O guia editorial fica no banco (o repositório é público). */
export async function getGuide(): Promise<string> {
  const [row] = await query<{ value: unknown }>("SELECT value FROM system_config WHERE name = 'robo.guia'");
  return String(json<{ texto?: string }>(row?.value, {}).texto ?? "");
}

export async function setGuide(texto: string) {
  await exec("INSERT INTO system_config (name, value) VALUES ('robo.guia', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE value = VALUES(value)", [JSON.stringify({ texto })]);
}

export async function activeSlots(): Promise<Map<number, number>> {
  const rows = await query<{ hour: number; posts: number }>("SELECT hour, posts FROM ai_news_schedule_slots WHERE active = 1");
  if (!rows.length) return new Map(DEFAULT_SLOT_HOURS.map((h) => [h, 1]));
  return new Map(rows.map((r) => [Number(r.hour), Number(r.posts)]));
}

/** Matérias do robô criadas desde 0h de Brasília. */
export async function roboPostsToday(now = new Date()): Promise<number> {
  const [r] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM posts WHERE origin = 'robo' AND created_at >= ?", [startOfBrasiliaDay(now).toISOString().replace("T", " ").replace("Z", "")]);
  return Number(r?.n ?? 0);
}

/** Cota da hora, limitada pelo que falta do teto do dia. */
export async function computeSlotLimit(hour: number, cfg: RoboConfig, now = new Date()): Promise<number> {
  const quota = (await activeSlots()).get(hour) ?? 0;
  return Math.max(0, Math.min(quota, cfg.limiteDia - (await roboPostsToday(now))));
}

export type Source = { id: string; name: string; baseUrl: string; rssUrl: string | null };
export async function activeSources(): Promise<Source[]> {
  const rows = await query<{ id: string; name: string; base_url: string; rss_url: string | null }>("SELECT id, name, base_url, rss_url FROM ai_news_sources WHERE active = 1 ORDER BY priority DESC, name");
  return rows.map((r) => ({ id: r.id, name: r.name, baseUrl: r.base_url, rssUrl: r.rss_url }));
}

export type Author = { id: string; name: string; categoryName: string; specialty: string | null; autoPublish: boolean };
export async function activeAuthors(): Promise<Author[]> {
  const rows = await query<{ id: string; name: string; category_name: string; specialty: string | null; auto_publish: number }>(
    "SELECT a.author_id AS id, p.name, a.category_name, a.specialty, a.auto_publish FROM ai_news_authors a JOIN post_authors p ON p.id = a.author_id AND p.kind = 'ai' WHERE a.active = 1",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, categoryName: r.category_name, specialty: r.specialty, autoPublish: !!r.auto_publish }));
}

/** Categorias de notícia que têm pelo menos um autor de IA ativo. */
export async function allowedCategories(): Promise<{ id: string; slug: string; name: string }[]> {
  return query("SELECT c.id, c.slug, c.name FROM categories c WHERE c.kind = 'news' AND EXISTS (SELECT 1 FROM ai_news_authors a WHERE a.active = 1 AND a.category_name = c.name) ORDER BY c.name");
}

export async function terms(kind: "block" | "topic"): Promise<{ term: string; weight: number }[]> {
  const rows = await query<{ term: string; weight: number }>("SELECT term, weight FROM ai_news_terms WHERE kind = ? AND active = 1", [kind]);
  return rows.map((r) => ({ term: r.term.toLowerCase(), weight: Number(r.weight) }));
}

/** Chamadas ao Gemini deste modelo nas últimas 24 h (inclusive as que deram 429). */
export async function modelCallsLast24h(model: string): Promise<number> {
  const [r] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM ai_news_usage WHERE model = ? AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR", [model]);
  return Number(r?.n ?? 0);
}

export async function recordUsage(u: { runId: number | null; candidateId: number | null; model: string; status: number; inputTokens: number; outputTokens: number }) {
  await exec("INSERT INTO ai_news_usage (run_id, candidate_id, model, status_code, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?, ?)", [u.runId, u.candidateId, u.model, u.status, u.inputTokens, u.outputTokens]);
}
