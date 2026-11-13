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
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
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
