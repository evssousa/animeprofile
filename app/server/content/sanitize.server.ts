// Limpeza do HTML das matérias. Roda na gravação (importação e, depois, no editor do admin), então a
// página só exibe HTML já seguro.
import sanitizeHtml from "sanitize-html";

const VIDEO_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"];

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
      "a", "ul", "ol", "li", "blockquote", "q", "cite", "code", "pre", "span", "div",
      "figure", "figcaption", "img", "picture", "source", "iframe",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "details", "summary",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading"],
      source: ["srcset", "type", "media"],
      iframe: ["src", "title", "width", "height", "allow", "allowfullscreen", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      "*": ["class", "id", "data-align"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowedIframeHostnames: VIDEO_HOSTS,
    transformTags: {
      // Links externos abrem em outra aba, sem passar referência.
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href ?? "") && !/^https?:\/\/(www\.)?animeprofile\.com\.br/i.test(attribs.href ?? "");
        return { tagName, attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { loading: "lazy", ...attribs } }),
    },
  });
}

/** Minutos de leitura (200 palavras por minuto, mínimo 1). */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Limpeza do HTML gerado a partir do Markdown de usuários (blog): mais restrita que a das matérias. */
export function sanitizeUserHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "del", "blockquote", "code", "pre", "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title", "loading"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    transformTags: {
      // A página já tem o seu h1.
      h1: "h2",
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?animeprofile\.com\.br/i.test(href);
        const base: Record<string, string> = { href, ...(attribs.title ? { title: attribs.title } : {}) };
        return { tagName, attribs: external ? { ...base, target: "_blank", rel: "nofollow ugc noopener noreferrer" } : base };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}
