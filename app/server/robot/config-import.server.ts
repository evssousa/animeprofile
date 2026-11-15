// Grava no banco a configuração do robô vinda do site antigo (fontes, autores, termos, horários, ajustes e o guia
// editorial). O guia e as personas ficam no banco, nunca no repositório (público). Insere ou atualiza.
import { exec, query } from "../db.server";
import { isAllowedGeminiModel } from "./constants";
import { setConfig, setGuide } from "./config.server";
import { oldSourceHash } from "./text";

type Rec = Record<string, unknown>;
export type RoboConfigInput = {
  sources?: Rec[];
  authors?: Rec[];
  blacklist?: Rec[];
  topics?: Rec[];
  slots?: Rec[];
  settings?: Rec[];
  system_config?: Rec[];
  recent_sources?: unknown[];
  guia?: string;
};

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const flag = (v: unknown, fallback = 1) => (v === undefined || v === null ? fallback : v === false || v === 0 || v === "0" || v === "false" ? 0 : 1);
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Rec[]) : []);

export async function applyRoboConfig(input: RoboConfigInput) {
  const out = { fontes: 0, autores: 0, autoresIgnorados: 0, termos: 0, horarios: 0, fontesUsadas: 0, guia: false, ajustes: [] as string[] };

  for (const s of arr(input.sources)) {
    if (!s.id || !s.base_url) continue;
    await exec(
      `INSERT INTO ai_news_sources (id, name, base_url, rss_url, priority, active) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), base_url = VALUES(base_url), rss_url = COALESCE(VALUES(rss_url), rss_url), priority = VALUES(priority), active = VALUES(active)`,
      [str(s.id, 36), str(s.name, 120), str(s.base_url, 600), s.rss_url ? str(s.rss_url, 600) : null, Number(s.priority) || 5, flag(s.active)],
    );
    out.fontes++;
  }

  const aiAuthors = new Set((await query<{ id: string }>("SELECT id FROM post_authors WHERE kind = 'ai'")).map((r) => r.id));
  for (const a of arr(input.authors)) {
    if (!a.id || !aiAuthors.has(String(a.id))) {
      out.autoresIgnorados++;
      continue;
    }
    await exec(
      `INSERT INTO ai_news_authors (author_id, category_name, specialty, auto_publish, active) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE category_name = VALUES(category_name), specialty = VALUES(specialty), auto_publish = VALUES(auto_publish), active = VALUES(active)`,
      [str(a.id, 36), str(a.category, 120), a.system_prompt ? str(a.system_prompt, 20000) : null, flag(a.auto_publish), flag(a.active)],
    );
    out.autores++;
  }

  for (const b of arr(input.blacklist)) {
    if (!b.term) continue;
    await exec("INSERT INTO ai_news_terms (kind, term, weight, active) VALUES ('block', ?, 0, ?) ON DUPLICATE KEY UPDATE active = VALUES(active)", [str(b.term, 160), flag(b.active)]);
    out.termos++;
  }
  for (const t of arr(input.topics)) {
    if (!t.topic) continue;
    await exec("INSERT INTO ai_news_terms (kind, term, weight, active) VALUES ('topic', ?, ?, ?) ON DUPLICATE KEY UPDATE weight = VALUES(weight), active = VALUES(active)", [str(t.topic, 160), Number(t.weight) || 0, flag(t.active)]);
    out.termos++;
  }

  for (const s of arr(input.slots)) {
    const hour = Number(s.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const posts = Number(s.posts_per_slot ?? s.posts ?? 1);
    await exec("INSERT INTO ai_news_schedule_slots (hour, posts, active) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE posts = VALUES(posts), active = VALUES(active)", [hour, Number.isInteger(posts) && posts >= 0 ? posts : 1, flag(s.active)]);
    out.horarios++;
  }

  // Ajustes: só os campos conhecidos de system_config.robo; o modo nunca muda por aqui.
  const patch: Record<string, unknown> = {};
  const model = arr(input.settings).find((s) => s.key === "model")?.value;
  if (isAllowedGeminiModel(model)) patch.modelo = model;
  for (const r of arr(input.system_config)) {
    const n = Number(r.value_int);
    if (!Number.isFinite(n)) continue;
    if (r.key === "ai_news_daily_cap") patch.limiteDia = n;
    if (r.key === "ai_news_non_anime_max_pct") patch.foraDeAnimePct = n;
    if (r.key === "ai_news_body_image_limit") patch.imagensCorpo = n;
  }
  if (Object.keys(patch).length) {
    await setConfig(patch);
    out.ajustes = Object.keys(patch);
  }

  // Endereços que o site antigo já publicou nas últimas horas: só para não repetir a notícia.
  for (const url of input.recent_sources ?? []) {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) continue;
    const r = await exec("INSERT IGNORE INTO ai_news_candidates (dedup_hash, title, source_url, status) VALUES (?, ?, ?, 'published')", [oldSourceHash(url), "(fonte usada no site antigo)", url.slice(0, 600)]);
    out.fontesUsadas += r.affected;
  }

  if (typeof input.guia === "string" && input.guia.trim().length > 200) {
    await setGuide(input.guia.trim());
    out.guia = true;
  }
  return out;
}
