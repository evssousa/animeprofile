// Publicação de uma matéria do robô: regras de bloqueio + gravação numa transação só (post, categoria, tags, candidato).
import { randomUUID } from "node:crypto";
import { clearCache } from "../cache.server";
import { readingMinutes, sanitizePostHtml } from "../content/sanitize.server";
import { query, sqlDate, tx } from "../db.server";
import { activeAuthors, allowedCategories, getConfig, type Author, type RoboConfig } from "./config.server";
import { GAMES_CATEGORY_SLUG, LISTICLE_RE, gameTiedToAnime, isAnimeCategory, nonAnimeAllowed, nonAnimeDailyLimit } from "./constants";
import type { GeneratedArticle } from "./contract";
import { checkArticleHtml, hasBodyImage } from "./html-guard";
import { isSourceUsed } from "./select.server";
import { ensureSlug, makeSlug, startOfBrasiliaDay, titleSimilarity } from "./text";

/** Palavras-chave da especialidade de um autor (a persona antiga dizia "especialista em ..."). */
function specialtyTerms(prompt: string | null): string[] {
  if (!prompt) return [];
  const out = new Set<string>();
  const m = prompt.match(/especialista em ([^.,;:\n]+)/i);
  const base = m ? m[1].toLowerCase().split(/\s*(?:,|\be\b|&|\/)\s*/).map((t) => t.trim()).filter(Boolean) : [];
  for (const t of base) {
    out.add(t);
    if (/mang/.test(t)) ["mangá", "manga", "mangás", "mangas", "mangaká", "mangaka", "capítulo", "capitulo", "capítulos", "capitulos", "scan", "oneshot", "one-shot", "serialização", "serializacao", "editora", "shueisha", "kodansha", "shogakukan", "shonen jump", "weekly shonen", "light novel"].forEach((x) => out.add(x));
    if (/anim/.test(t)) ["anime", "animes", "episódio", "episodio", "episódios", "episodios", "temporada", "temporadas", "estúdio", "estudio", "estúdios", "estudios", "dublagem", "dublado", "legendado", "ova", "cour", "opening", "ending", "abertura", "encerramento", "crunchyroll"].forEach((x) => out.add(x));
    if (/event/.test(t)) ["evento", "eventos", "convenção", "convencao", "feira", "cwb", "anime friends", "anime summit", "ccxp", "comic con", "expo", "festival"].forEach((x) => out.add(x));
    if (/app|mobile|jogo/.test(t)) ["app", "apps", "aplicativo", "aplicativos", "mobile", "android", "ios", "google play", "app store", "apk", "gacha mobile"].forEach((x) => out.add(x));
  }
  return [...out];
}

/** Vários autores na mesma categoria: vence quem mais casa com o conteúdo; no empate, quem publicou há mais tempo. */
export async function pickAuthor(candidates: Author[], g: { title: string; excerpt: string; tags: string[]; html: string }): Promise<Author | null> {
  if (candidates.length <= 1) return candidates[0] ?? null;
  const hay = `${g.title} ${g.excerpt} ${g.tags.join(" ")} ${g.html}`.toLowerCase();
  const scored = candidates.map((a) => {
    let score = 0;
    for (const t of specialtyTerms(a.specialty)) {
      if (t.length < 3) continue;
      const hits = hay.match(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
      if (hits) score += hits.length;
    }
    return { author: a, score };
  });
  scored.sort((x, y) => y.score - x.score);
  const tied = scored.filter((s) => s.score === scored[0].score);
  if (scored[0].score > 0 && tied.length === 1) return scored[0].author;
  const last = await query<{ author_id: string; at: string }>(
    "SELECT author_id, MAX(COALESCE(published_at, created_at)) AS at FROM posts WHERE author_id IN (?) GROUP BY author_id",
    [tied.map((t) => t.author.id)],
  );
  const at = new Map(last.map((r) => [r.author_id, Date.parse(String(r.at).replace(" ", "T") + "Z") || 0]));
  tied.sort((a, b) => (at.get(a.author.id) ?? 0) - (at.get(b.author.id) ?? 0));
  return tied[0].author;
}

/** Já existe matéria publicada nos últimos 30 dias com título parecido (≥ 80% das palavras)? */
export async function isSimilarToRecent(title: string, threshold = 0.8): Promise<boolean> {
  const rows = await query<{ title: string }>("SELECT title FROM posts WHERE status = 'published' AND published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY LIMIT 1000");
  return rows.some((r) => titleSimilarity(title, r.title) >= threshold);
}

export type PublishInput = {
  candidate: { id: number; title: string; sourceUrl: string };
  article: GeneratedArticle;
  cover: { url: string; width: number | null; height: number | null };
  bodyImages: string[];
  anilistId?: number;
  /** publicar | rascunho. O ensaio não passa por aqui. */
  mode: "publicar" | "rascunho";
  runId: number | null;
  slot: string | null;
};
export type PublishResult = { ok: true; postId: string; slug: string; status: "published" | "draft"; authorId: string } | { ok: false; kind: "discarded" | "failed"; reason: string };

const reject = (kind: "discarded" | "failed", reason: string): PublishResult => ({ ok: false, kind, reason });

export type Check = { ok: true; category: { id: string; slug: string; name: string }; author: Author } | { ok: false; kind: "discarded" | "failed"; reason: string };

/** Todas as regras de bloqueio, sem gravar nada (usada na publicação e na prévia do ensaio). */
export async function checkPublishable(input: Pick<PublishInput, "candidate" | "article" | "bodyImages">, cfg?: RoboConfig, now = new Date()): Promise<Check> {
  const config = cfg ?? (await getConfig());
  const { article, candidate } = input;
  if (LISTICLE_RE.test(candidate.title) || LISTICLE_RE.test(article.title)) return reject("discarded", 'Bloqueado: título em formato de lista (ex.: "Top 5", "As 10 melhores").') as never;

  const category = (await allowedCategories()).find((c) => c.slug === article.categorySlug);
  if (!category) return reject("discarded", `Categoria "${article.categorySlug}" não é permitida para autores de IA.`) as never;
  if (!isAnimeCategory(category.slug) && article.otakuRelated === false) return reject("discarded", "Fora do universo otaku (game/filme/série sem ligação com anime ou cultura japonesa).") as never;

  if (category.slug === GAMES_CATEGORY_SLUG && !gameTiedToAnime(article)) return reject("discarded", "Game sem ligação com anime ou mangá: esse conteúdo é do Respawnou.") as never;

  if (!isAnimeCategory(category.slug)) {
    const since = sqlDate(startOfBrasiliaDay(now));
    const [r] = await query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM posts p WHERE p.origin = 'robo' AND p.created_at >= ? AND NOT EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id AND c.slug = 'animes-e-mangas')",
      [since],
    );
    const nonAnimeToday = Number(r?.n ?? 0);
    if (!nonAnimeAllowed({ dailyCap: config.limiteDia, maxPct: config.foraDeAnimePct, nonAnimeToday })) {
      return reject("discarded", `Cota de hoje para notícias fora de anime atingida (${nonAnimeToday} de ${nonAnimeDailyLimit(config.limiteDia, config.foraDeAnimePct)}).`) as never;
    }
  }

  const inCategory = (await activeAuthors()).filter((a) => a.categoryName.toLowerCase() === category.name.toLowerCase());
  const author = await pickAuthor(inCategory, article);
  if (!author) return reject("discarded", `Sem autor de IA ativo para a categoria "${article.categorySlug}".`) as never;

  if (await isSourceUsed(candidate.sourceUrl)) return reject("discarded", "Fonte já usada nos últimos 7 dias.") as never;
  if (await isSimilarToRecent(article.title)) return reject("discarded", "Bloqueado por semelhança de 80% ou mais com matéria publicada recentemente.") as never;

  const guard = checkArticleHtml(article.html);
  if (!guard.ok) return reject("failed", guard.reason) as never;
  if (!hasBodyImage(article.html, input.bodyImages)) return reject("failed", "O HTML final não contém nenhuma das imagens do corpo.") as never;
  return { ok: true, category, author };
}

async function uniqueSlug(title: string, keyword: string): Promise<string> {
  const base = ensureSlug(title, keyword) || `noticia-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 0; i < 5; i++) {
    if (!(await query("SELECT 1 FROM posts WHERE slug = ? LIMIT 1", [slug])).length) return slug;
    slug = `${base}-${Date.now().toString(36).slice(-4)}${i}`;
  }
  return slug;
}

export async function publishArticle(input: PublishInput): Promise<PublishResult> {
  const check = await checkPublishable(input);
  if (!check.ok) return reject(check.kind, check.reason);
  const { article, candidate } = input;
  const { category, author } = check;

  const html = sanitizePostHtml(article.html);
  const slug = await uniqueSlug(article.title, article.focusKeyword);
  const status = input.mode === "rascunho" || !author.autoPublish ? "draft" : "published";
  const id = randomUUID();
  const now = sqlDate(new Date());

  try {
    await tx(async (conn) => {
      await conn.query(
        `INSERT INTO posts (id, post_type, slug, status, title, excerpt, content_html, featured_image, image_width, image_height, author_id, is_ai_generated, origin, source_url,
           anilist_id, focus_keyword, reading_minutes, published_at, created_at, updated_at)
         VALUES (?, 'news', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'robo', ?, ?, ?, ?, ?, ?, ?)`,
        [id, slug, status, article.title, article.excerpt, html, input.cover.url, input.cover.width, input.cover.height, author.id, candidate.sourceUrl.slice(0, 600),
          article.animeFocus === "main" ? (input.anilistId ?? null) : null, article.focusKeyword, readingMinutes(html), status === "published" ? now : null, now, now],
      );
      await conn.query("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [id, category.id]);
      const tagIds = new Set<string>();
      for (const name of [article.focusKeyword, ...article.tags].slice(0, 8)) {
        const tslug = makeSlug(name, 60);
        if (!tslug) continue;
        const [[found]] = (await conn.query("SELECT id FROM tags WHERE slug = ? LIMIT 1", [tslug])) as unknown as [{ id: string }[]];
        let tagId = found?.id;
        if (!tagId) {
          const [[red]] = (await conn.query("SELECT tag_id FROM tag_redirects WHERE old_slug = ? LIMIT 1", [tslug])) as unknown as [{ tag_id: string }[]];
          tagId = red?.tag_id;
        }
        if (!tagId) {
          tagId = randomUUID();
          await conn.query("INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", [tagId, name.trim().slice(0, 160), tslug]);
        }
        tagIds.add(tagId);
      }
      for (const tagId of tagIds) await conn.query("INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
      await conn.query("UPDATE ai_news_candidates SET status = ?, post_id = ?, run_id = ?, discard_reason = NULL WHERE id = ?", [status === "published" ? "published" : "draft", id, input.runId, candidate.id]);
    });
  } catch (e) {
    return reject("failed", `Falha ao gravar: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
  }
  clearCache();
  return { ok: true, postId: id, slug, status, authorId: author.id };
}
