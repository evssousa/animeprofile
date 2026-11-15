import { hasBodyImage } from "./html-guard";

// Checagem automática de qualidade das notícias geradas (plano §3.2.8) — pura,
// roda sobre o JSON do Gemini antes do `import`. Aproximada por natureza
// (detecção de idioma e de encheção são heurísticas, não garantias).

export type QualityIssue = { code: string; message: string };
export type QualityResult = { ok: true } | { ok: false; issues: QualityIssue[] };

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(s: string): string {
  return stripAccents(s).toLowerCase();
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Marcas típicas de texto gerado por IA sem edição humana (plano §3.2.1).
const BANNED_PHRASES = [
  "em um mundo onde",
  "vale ressaltar que",
  "vale lembrar que",
  "em suma",
  "em resumo",
  "nao e a toa que",
  "prepare-se",
  "fique ligado",
  "sem sombra de duvidas",
  "mergulhe",
  "nesta materia vamos",
  "confira tudo abaixo",
  "os fas estao enlouquecendo",
];

const CLICKBAIT_PATTERNS = [
  /voc[eê]\s+n[aã]o\s+vai\s+(a?creditar|imaginar)/i,
  /chocante/i,
  /finalmente\s*!/i,
];

const RUMOR_TERMS_PT = ["rumor", "rumores", "vazamento", "vazou", "boato", "boatos", "nao confirmado", "nao confirmada"];
const RUMOR_TERMS_SOURCE = ["rumor", "rumour", "leak", "leaked", "reportedly", "allegedly", "unconfirmed", "vazamento", "vazou", "boato"];

const MIN_TITLE_LEN = 30;
const MAX_TITLE_LEN = 70;
// Prompt pede 380+ (poucas notícias por dia, mais completas); a margem cobre a contagem aproximada.
// Antes 280 (e 180 antes disso).
const MIN_BODY_WORDS = 350;
const MIN_SECTIONS = 2;
const PARAGRAPH_SIMILARITY_THRESHOLD = 0.7;

function hasCjkRun(text: string, minRun = 4): boolean {
  // Hiragana, Katakana, CJK Unified Ideographs, Hangul.
  const re = new RegExp(`[\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7a3]{${minRun},}`);
  return re.test(text);
}

const ENGLISH_FUNCTION_WORDS = [
  "the", "and", "with", "that", "which", "have", "this", "from", "were", "was",
  "will", "would", "their", "about", "into", "such", "when", "where", "there",
];

/** Very rough heuristic: a long sentence dense with common English function words. */
function hasEnglishSentence(plainText: string): boolean {
  const sentences = plainText.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const words = s.trim().split(/\s+/);
    if (words.length < 6) continue;
    const lower = normalize(s);
    const hits = ENGLISH_FUNCTION_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(lower)).length;
    // Portuguese marker chars (ç, ã, õ, á, é, í, ó, ú with accent) — their absence in a
    // longer sentence, combined with several English function words, is a strong signal.
    const hasPtAccents = /[çãõáéíóúâêô]/i.test(s);
    if (hits >= 3 && !hasPtAccents) return true;
  }
  return false;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function paragraphTexts(html: string): string[] {
  const matches = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  return matches.map((p) => stripHtmlTags(p)).filter((t) => t.length > 0);
}

/**
 * A palavra-chave está no começo do texto: no 1º ou no 2º parágrafo (o 1º às vezes é uma frase curta de
 * abertura), ou todas as palavras dela aparecem no 1º, em qualquer ordem ("trailer de Frieren" com a
 * palavra-chave "Frieren trailer"). Antes só valia a frase exata no 1º parágrafo e boas notícias caíam.
 */
export function keywordInLead(paragraphs: string[], focusKeyword: string): boolean {
  const kw = normalize(focusKeyword).trim();
  if (!kw) return true;
  const [first = "", second = ""] = paragraphs.map(normalize);
  if (first.includes(kw) || second.includes(kw)) return true;
  const words = kw.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const firstWords = new Set(first.split(/[^a-z0-9]+/));
  return words.length > 0 && words.every((w) => firstWords.has(w));
}

// Correções que não precisam de outra chamada ao Gemini (cada chamada gasta a cota grátis do dia).
// Só frases com troca segura; as outras ("mergulhe", "prepare-se"...) continuam indo para a reescrita.
const BANNED_REPLACEMENTS: Record<string, string> = {
  "em um mundo onde": "num cenário em que",
  "vale ressaltar que": "",
  "vale lembrar que": "",
  "em suma": "no geral",
  "em resumo": "no geral",
  "nao e a toa que": "não por acaso,",
  "sem sombra de duvidas": "sem dúvida",
  "fique ligado": "acompanhe",
  "confira tudo abaixo": "veja os detalhes abaixo",
};

const ACCENT_CLASS: Record<string, string> = { a: "[aáàâã]", e: "[eéê]", i: "[ií]", o: "[oóôõ]", u: "[uúü]", c: "[cç]" };

/** Regex que acha a frase sem acento também na forma acentuada, sem diferenciar maiúsculas. */
function phraseRegex(phrase: string): RegExp {
  const body = [...phrase]
    .map((ch) => (ch === " " ? "\\s+" : ACCENT_CLASS[ch] ?? ch.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")))
    .join("");
  return new RegExp(`(?<!\\p{L})${body}(?!\\p{L})(\\s*,)?\\s*`, "giu");
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function replaceBanned(text: string, found: Set<string>): string {
  let out = text;
  for (const [phrase, repl] of Object.entries(BANNED_REPLACEMENTS)) {
    out = out.replace(phraseRegex(phrase), (match: string, comma: string | undefined) => {
      found.add(phrase);
      const capital = /^\p{Lu}/u.test(match);
      const trailing = /\s$/.test(match) ? " " : "";
      if (repl) return `${capital ? upperFirst(repl) : repl}${comma && !repl.endsWith(",") ? "," : ""}${trailing}`;
      // Frase só de enchimento: some, e a letra seguinte vira maiúscula se começava a frase.
      return capital ? "\u0000" : "";
    });
    out = out.replace(/\u0000(.)/gu, (_m, ch: string) => ch.toUpperCase());
  }
  return out;
}

const DANGLING_END = /(?:\s+(?:de|da|do|das|dos|e|em|no|na|nos|nas|com|para|pra|a|o|as|os|ao|que|por|sobre|um|uma))+$/i;

/** Corta um título longo no fim de uma palavra (sem deixar "de", "e", ":" pendurados). Null se ficar curto. */
export function trimTitle(title: string, max = MAX_TITLE_LEN): string | null {
  const t = title.trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max + 1);
  cut = cut.slice(0, Math.max(cut.lastIndexOf(" "), 0));
  for (let i = 0; i < 3; i++) cut = cut.replace(/[\s,;:–—-]+$/u, "").replace(DANGLING_END, "");
  return cut.length >= MIN_TITLE_LEN ? cut : null;
}

/**
 * Conserta sem chamar o Gemini de novo: troca as expressões de IA que têm troca segura e encurta o título
 * longo (primeiro tenta uma das variações de título que o próprio Gemini mandou). Devolve o que mudou.
 */
export function autoFixArticle<T extends { title: string; html: string; excerpt: string; metaDescription?: string; titleVariants?: string[] }>(
  article: T,
): { article: T; fixes: string[] } {
  const fixes: string[] = [];
  const found = new Set<string>();
  let next: T = {
    ...article,
    title: replaceBanned(article.title, found).trim(),
    html: replaceBanned(article.html, found),
    excerpt: replaceBanned(article.excerpt, found).trim(),
    ...(article.metaDescription !== undefined ? { metaDescription: replaceBanned(article.metaDescription, found).trim() } : {}),
  };
  if (found.size) fixes.push(`expressões trocadas: ${[...found].join(", ")}`);

  if (next.title.length > MAX_TITLE_LEN) {
    const fits = (t: string) => t.length >= MIN_TITLE_LEN && t.length <= MAX_TITLE_LEN && !t.trim().endsWith("?") && !CLICKBAIT_PATTERNS.some((re) => re.test(t));
    const variant = (next.titleVariants ?? []).map((v) => v.trim()).find(fits);
    const trimmed = variant ?? trimTitle(next.title);
    if (trimmed) {
      fixes.push(`título encurtado (${next.title.length} → ${trimmed.length})`);
      next = { ...next, title: trimmed };
    }
  }
  return { article: next, fixes };
}

export function checkQuality(
  article: { title: string; html: string; excerpt: string; focusKeyword: string },
  ctx: { sourceText: string; bodyImages: string[] },
): QualityResult {
  const issues: QualityIssue[] = [];
  const plainBody = stripHtmlTags(article.html);
  const normalizedBody = normalize(plainBody);
  const normalizedTitle = normalize(article.title);

  // Título
  if (article.title.length < MIN_TITLE_LEN || article.title.length > MAX_TITLE_LEN) {
    issues.push({ code: "title_length", message: `Título fora de 30–70 caracteres (${article.title.length}).` });
  }
  if (article.title === article.title.toUpperCase() && /[A-ZÀ-Ú]/.test(article.title)) {
    issues.push({ code: "title_caps", message: "Título em caixa alta." });
  }
  if (CLICKBAIT_PATTERNS.some((re) => re.test(article.title)) || article.title.trim().endsWith("?")) {
    issues.push({ code: "title_clickbait", message: "Título em formato de caça-clique." });
  }

  // Expressões proibidas
  const bannedFound = BANNED_PHRASES.filter((p) => normalizedBody.includes(p) || normalizedTitle.includes(p));
  if (bannedFound.length > 0) {
    issues.push({ code: "banned_phrases", message: `Expressões de texto de IA encontradas: ${bannedFound.join(", ")}.` });
  }

  // Idioma
  if (hasCjkRun(plainBody)) {
    issues.push({ code: "language_cjk", message: "Corpo contém trecho em japonês/chinês/coreano não traduzido." });
  }
  if (hasEnglishSentence(plainBody)) {
    issues.push({ code: "language_english", message: "Corpo contém frase inteira em inglês não traduzida." });
  }

  // Tamanho
  const wordCount = plainBody.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_BODY_WORDS) {
    issues.push({ code: "too_short", message: `Corpo com apenas ${wordCount} palavras (mínimo ${MIN_BODY_WORDS}).` });
  }

  // Estrutura
  const paragraphs = paragraphTexts(article.html);
  if (!keywordInLead(paragraphs, article.focusKeyword)) {
    issues.push({ code: "missing_keyword_in_lead", message: "O primeiro parágrafo não contém a palavra-chave." });
  }
  if (!/<h[23][^>]*>\s*Mais sobre\b/i.test(article.html)) {
    issues.push({ code: "missing_mais_sobre", message: "Falta a seção <h2>Mais sobre ...</h2> com contexto concreto." });
  }
  const sections = (article.html.match(/<h2\b/gi) ?? []).length;
  if (sections < MIN_SECTIONS) {
    issues.push({ code: "few_sections", message: `Só ${sections} subtítulo(s) <h2>; organize o texto em pelo menos ${MIN_SECTIONS} seções com <h2> informativo.` });
  }
  if (!hasBodyImage(article.html, ctx.bodyImages)) {
    issues.push({ code: "missing_body_image", message: "Nenhuma imagem do corpo enviada aparece no HTML." });
  }

  // Encheção — parágrafos quase idênticos
  const tokenSets = paragraphs.map((p) => new Set(normalize(p).split(/\W+/).filter((w) => w.length > 3)));
  outer: for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      if (paragraphs[i].length < 20 || paragraphs[j].length < 20) continue;
      if (jaccardSimilarity(tokenSets[i], tokenSets[j]) >= PARAGRAPH_SIMILARITY_THRESHOLD) {
        issues.push({ code: "repetitive_paragraphs", message: `Parágrafos ${i + 1} e ${j + 1} são quase idênticos.` });
        break outer;
      }
    }
  }

  // Rumor
  const sourceNorm = normalize(ctx.sourceText);
  const sourceMentionsRumor = RUMOR_TERMS_SOURCE.some((t) => sourceNorm.includes(t));
  if (sourceMentionsRumor) {
    const articleNorm = normalize(`${article.title} ${article.excerpt} ${plainBody}`);
    const articleMentionsRumor = RUMOR_TERMS_PT.some((t) => articleNorm.includes(t));
    if (!articleMentionsRumor) {
      issues.push({ code: "unflagged_rumor", message: "A fonte trata como rumor/vazamento, mas o texto apresenta como fato." });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true };
}
