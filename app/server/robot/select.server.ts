// Coleta, pontuação e seleção dos candidatos (portado de score.server.ts, select.server.ts e freshness.ts, sem CTR nem "em alta").
import { exec, json, query, sqlDate } from "../db.server";
import { ANIME_PRIORITY_BOOST, looksLikeAnime } from "./constants";
import { terms } from "./config.server";
import { dedupHash, stripHtml } from "./text";
import type { FetchedItem } from "./rss.server";

const TOPIC_SATURATION_CAP = 2; // no máximo 2 matérias por tópico prioritário em 24 h
export const FRESH_HOURS = 6;
export const PENALTY_PER_HOUR = 2;

/** Nota descontada pela idade: até 6 h fica igual; depois perde 2 pontos por hora (a mais nova ganha). */
export function freshScore(c: { score: number | null; ref: string | null }, now = Date.now()): number {
  const at = c.ref ? Date.parse(c.ref.replace(" ", "T") + "Z") : NaN;
  const ageH = Number.isFinite(at) ? Math.max(0, (now - at) / 36e5) : 0;
  return (c.score ?? 0) - Math.max(0, ageH - FRESH_HOURS) * PENALTY_PER_HOUR;
}

/** Candidatos novos da fonte (só as últimas 24 h). O índice único do hash ignora os repetidos. */
export async function ingestItems(sourceId: string, items: FetchedItem[], now = Date.now()): Promise<{ inserted: number; duplicates: number; tooOld: number }> {
  const since = now - 24 * 3600_000;
  let inserted = 0;
  let duplicates = 0;
  let tooOld = 0;
  for (const it of items) {
    if (it.publishedAt && Date.parse(it.publishedAt) < since) {
      tooOld++;
      continue;
    }
    const r = await exec(
      "INSERT IGNORE INTO ai_news_candidates (source_id, dedup_hash, title, summary, content, source_url, image_url, video_url, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [sourceId, dedupHash(it.title, it.link), it.title.slice(0, 400), it.summary || null, stripHtml(it.content).slice(0, 8000), it.link.slice(0, 600), it.imageUrl?.slice(0, 600) ?? null, it.videoUrl?.slice(0, 600) ?? null, it.publishedAt ? sqlDate(new Date(it.publishedAt)) : null],
    );
    if (r.affected > 0) inserted++;
    else duplicates++;
  }
  return { inserted, duplicates, tooOld };
}

/**
 * O mesmo endereço da fonte já virou matéria nos últimos 7 dias (do robô, ou do site antigo, que botava o link da
 * fonte no fim do texto)? É o que impede repetir o que o site antigo publicou antes da virada.
 */
export async function isSourceUsed(url: string): Promise<boolean> {
  const rows = await query<{ x: number }>(
    `SELECT 1 AS x FROM ai_news_candidates WHERE source_url = ? AND status IN ('published', 'draft') AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY
     UNION ALL SELECT 1 FROM posts WHERE source_url = ? AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY
     UNION ALL SELECT 1 FROM posts WHERE published_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY AND LOCATE(?, content_html) > 0
     LIMIT 1`,
    [url, url, url],
  );
  return rows.length > 0;
}

type Pending = { id: number; title: string; summary: string | null; content: string | null; source_url: string; published_at: string | null };

/** Dá nota aos pendentes: lista negra e fonte já usada descartam; tópicos, novidade, tamanho e "parece anime" somam. */
export async function scoreCandidates(now = Date.now()): Promise<number> {
  const [topics, blocks] = await Promise.all([terms("topic"), terms("block")]);
  const pending = await query<Pending>("SELECT id, title, summary, content, source_url, published_at FROM ai_news_candidates WHERE status = 'pending' LIMIT 200");
  let scored = 0;
  for (const c of pending) {
    const hay = `${c.title} ${c.summary ?? ""}`.toLowerCase();
    if (blocks.some((b) => hay.includes(b.term))) {
      await exec("UPDATE ai_news_candidates SET status = 'discarded', score = 0, discard_reason = 'lista negra' WHERE id = ?", [c.id]);
      continue;
    }
    if (await isSourceUsed(c.source_url)) {
      await exec("UPDATE ai_news_candidates SET status = 'discarded', score = 0, discard_reason = 'fonte já usada' WHERE id = ?", [c.id]);
      continue;
    }
    const matched = topics.filter((t) => hay.includes(t.term));
    const popularity = matched.reduce((s, t) => s + t.weight, 0);
    let freshness = 5;
    if (c.published_at) {
      const age = (now - Date.parse(c.published_at.replace(" ", "T") + "Z")) / 36e5;
      freshness = age < 6 ? 25 : age < 24 ? 15 : age < 72 ? 5 : 0;
    }
    const trend = Math.min(20, (hay.split(/\s+/).length > 6 ? 10 : 5) + (c.content ? 5 : 0));
    const anime = looksLikeAnime(hay) ? ANIME_PRIORITY_BOOST : 0;
    const score = popularity + freshness + trend + anime;
    await exec("UPDATE ai_news_candidates SET score = ?, score_breakdown = ? WHERE id = ?", [
      score,
      JSON.stringify({ popularity, freshness, trend, anime_boost: anime, matched_topics: matched.map((t) => ({ topic: t.term, weight: t.weight })) }),
      c.id,
    ]);
    scored++;
  }
  return scored;
}

type Ranked = { id: number; title: string; score: number; status: string; source_id: string | null; ref: string | null; score_breakdown: unknown };

const primaryTopic = (breakdown: unknown): string | null => {
  const m = json<{ matched_topics?: { topic: string; weight: number }[] }>(breakdown, {}).matched_topics;
  return Array.isArray(m) && m.length ? [...m].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0].topic : null;
};

/**
 * Escolhe até `limit` candidatos: nota ≥ 60 (senão ≥ 20), no máximo 2 por tópico em 24 h, um por fonte e um por
 * tópico na primeira passada. Marca como `selected` e devolve os ids na ordem de prioridade.
 */
export async function selectForRun(limit: number, runId: number, now = Date.now()): Promise<number[]> {
  await exec("UPDATE ai_news_candidates SET status = 'discarded', discard_reason = 'velha (mais de 24 h)' WHERE status IN ('pending', 'selected') AND published_at IS NOT NULL AND published_at < UTC_TIMESTAMP(3) - INTERVAL 24 HOUR");
  const priority = (await terms("topic")).map((t) => t.term);
  const topicIn = (title: string) => priority.find((t) => title.toLowerCase().includes(t)) ?? null;

  const recent = await query<{ title: string }>("SELECT title FROM posts WHERE status = 'published' AND published_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR LIMIT 200");
  const count = new Map<string, number>();
  for (const p of recent) {
    const t = topicIn(p.title);
    if (t) count.set(t, (count.get(t) ?? 0) + 1);
  }
  const saturated = new Set([...count].filter(([, n]) => n >= TOPIC_SATURATION_CAP).map(([t]) => t));

  const rows = await query<Ranked>(
    `SELECT id, title, score, status, source_id, COALESCE(published_at, created_at) AS ref, score_breakdown FROM ai_news_candidates
     WHERE status IN ('pending', 'selected') AND COALESCE(published_at, created_at) >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR ORDER BY score DESC LIMIT 100`,
  );
  const ranked = rows
    .map((c) => ({ ...c, fresh: freshScore(c, now), topic: primaryTopic(c.score_breakdown) ?? topicIn(c.title) }))
    .sort((a, b) => b.fresh - a.fresh || (Date.parse(b.ref ?? "") || 0) - (Date.parse(a.ref ?? "") || 0));

  const manual = ranked.filter((c) => c.status === "selected");
  const auto = ranked.filter((c) => c.status === "pending");
  const strong = auto.filter((c) => c.fresh >= 60);
  const pool = [...manual, ...(strong.length ? strong : auto.filter((c) => c.fresh >= 20))];
  const filtered = pool.filter((c) => c.status === "selected" || !(c.topic && saturated.has(c.topic)));
  const work = filtered.length ? filtered : pool;

  const picked: number[] = [];
  const taken = new Set<number>();
  const sources = new Set<string>();
  const topics = new Set<string>();
  const take = (c: (typeof work)[number]) => (picked.push(c.id), taken.add(c.id));
  for (const c of work) {
    if (picked.length >= limit) break;
    if (c.source_id && sources.has(c.source_id)) continue;
    if (c.topic && topics.has(c.topic)) continue;
    if (c.source_id) sources.add(c.source_id);
    if (c.topic) topics.add(c.topic);
    take(c);
  }
  for (const c of work) {
    if (picked.length >= limit) break;
    if (taken.has(c.id) || (c.topic && topics.has(c.topic))) continue;
    if (c.topic) topics.add(c.topic);
    take(c);
  }
  for (const c of work) {
    if (picked.length >= limit) break;
    if (!taken.has(c.id)) take(c);
  }
  if (picked.length) await exec("UPDATE ai_news_candidates SET status = 'selected', run_id = ? WHERE id IN (?)", [runId, picked]);
  return picked;
}
