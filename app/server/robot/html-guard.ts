// Segunda barreira contra HTML malicioso vindo de uma fonte de terceiros através
// da IA (injeção de prompt) — plano §2.3. O DOMPurify na exibição (PostBlocks)
// já remove <script>/on*=, mas libera <iframe> de qualquer origem; aqui bloqueamos
// isso antes de o artigo ser gravado.

export type HtmlGuardResult = { ok: true } | { ok: false; reason: string };

const BANNED_TAG_RE = /<\s*(script|style|object|embed|form)\b/i;
const ON_ATTR_RE = /\son[a-z]+\s*=/i;
const JAVASCRIPT_PROTOCOL_RE = /=\s*["']?\s*javascript:/i;
const IFRAME_RE = /<iframe\b[^>]*>/gi;
const IFRAME_SRC_RE = /\bsrc\s*=\s*["']([^"']*)["']/i;

const ALLOWED_IFRAME_PREFIXES = [
  "https://www.youtube.com/embed/",
  "https://youtube.com/embed/",
  "https://www.youtube-nocookie.com/embed/",
  "https://youtube-nocookie.com/embed/",
  "https://player.vimeo.com/",
];

function isAllowedIframeSrc(src: string): boolean {
  return ALLOWED_IFRAME_PREFIXES.some((prefix) => src.toLowerCase().startsWith(prefix));
}

/** Rejects HTML that a source page could have used to inject a script or an
 * embed outside YouTube/Vimeo via prompt injection (plano §2.3). Pure — no I/O. */
export function checkArticleHtml(html: string): HtmlGuardResult {
  if (BANNED_TAG_RE.test(html)) {
    return { ok: false, reason: "HTML contém tag proibida (script/style/object/embed/form)" };
  }
  if (ON_ATTR_RE.test(html)) {
    return { ok: false, reason: "HTML contém atributo de evento (on*=)" };
  }
  if (JAVASCRIPT_PROTOCOL_RE.test(html)) {
    return { ok: false, reason: "HTML contém protocolo javascript:" };
  }
  for (const tag of html.match(IFRAME_RE) ?? []) {
    const src = tag.match(IFRAME_SRC_RE)?.[1] ?? "";
    if (!src || !isAllowedIframeSrc(src)) {
      return { ok: false, reason: `iframe fora de YouTube/Vimeo: ${src || "(sem src)"}` };
    }
  }
  return { ok: true };
}

/** Whether the HTML has at least one `<img>` whose `src` is one of the given body images. */
export function hasBodyImage(html: string, bodyImages: string[]): boolean {
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const set = new Set(bodyImages);
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(html))) {
    if (set.has(match[1])) return true;
  }
  return false;
}
