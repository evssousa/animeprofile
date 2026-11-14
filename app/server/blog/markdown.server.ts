// Markdown do blog (texto de usuário): HTML cru vira texto, o resultado passa pela limpeza restrita.
import { Marked } from "marked";
import { sanitizeUserHtml } from "../content/sanitize.server";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Instância própria (não usar o `marked` global, que é o das páginas de texto do site).
const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // No site antigo o HTML cru aparecia como texto, nunca como tag.
    html(token) {
      return escapeHtml(token.text);
    },
  },
});

export function markdownToHtml(md: string): string {
  return sanitizeUserHtml(marked.parse(md, { async: false }) as string);
}
