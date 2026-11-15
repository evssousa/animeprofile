// Texto: slugs, hashes de deduplicação, limpeza de HTML e semelhança de títulos (portado de ai-news/utils.server.ts).
import { createHash } from "node:crypto";

/** Slug sem dependência: sem acento, minúsculas, só [a-z0-9] separado por "-". Corta no fim de uma palavra. */
export function makeSlug(text: string, max = 75) {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > max ? s.slice(0, max).replace(/-[^-]*$/, "") : s;
}

/**
 * Endereço do post: o título, com a palavra-chave na frente só quando o título não a contém
 * (evita "naruto-naruto-revela…").
 */
export function ensureSlug(title: string, focusKeyword: string) {
  const t = makeSlug(title, 200);
  const k = makeSlug(focusKeyword, 200);
  const titleWords = new Set(t.split("-"));
  const kwWords = k ? k.split("-") : [];
  const hasKeyword = kwWords.length > 0 && kwWords.filter((w) => titleWords.has(w)).length / kwWords.length >= 0.6;
  const full = hasKeyword || !k ? t : `${k}-${t}`;
  return makeSlug(full.replace(/-/g, " ")) || makeSlug(title) || k;
}

const hostOf = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** sha1(título normalizado | host): a mesma notícia da mesma fonte entra uma vez só. */
export function dedupHash(title: string, sourceUrl: string) {
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha1").update(norm(title) + "|" + hostOf(sourceUrl)).digest("hex");
}

/** Hash dos endereços já usados pelo site antigo (config importada). */
export const oldSourceHash = (url: string) => createHash("sha1").update("fonte-antiga|" + url).digest("hex");

export function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(s: string | undefined | null): string {
  if (!s) return "";
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Similaridade de títulos por palavras (Jaccard, palavras com mais de 3 letras). */
export function titleSimilarity(a: string, b: string): number {
  const toks = (s: string) => new Set(s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((t) => t.length > 3));
  const A = toks(a);
  const B = toks(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Bloco de spoiler no formato do site: <details class="spoiler-box"><summary>…</summary><div class="spoiler-content">…</div></details>.
 * A IA às vezes esquece a div; aqui o miolo ganha a div.
 */
export function normalizeSpoilerBoxes(html: string): string {
  return html.replace(
    /(<details\b[^>]*class="[^"]*\bspoiler-box\b[^"]*"[^>]*>)\s*(<summary\b[^>]*>[\s\S]*?<\/summary>)?([\s\S]*?)<\/details>/gi,
    (full, open: string, summary: string | undefined, inner: string) => {
      if (/^\s*<div\b[^>]*class="[^"]*\bspoiler-content\b/i.test(inner)) return full;
      return `${open}${summary ?? "<summary>Contém spoiler · toque para ver</summary>"}<div class="spoiler-content">${inner.trim()}</div></details>`;
    },
  );
}

/** Hora (00–23) e início do dia em Brasília (UTC-3 fixo, sem horário de verão desde 2019). */
export function brasiliaHour(now = new Date()): number {
  return new Date(now.getTime() - 3 * 3600_000).getUTCHours();
}
export function startOfBrasiliaDay(now = new Date()): Date {
  const b = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 3, 0, 0));
}
