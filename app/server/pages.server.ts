// Páginas de texto (institucionais e legais), escritas em Markdown em app/content/paginas/.
// Cada arquivo começa com um cabeçalho simples:
//
//   ---
//   title: Termos de Uso
//   description: frase para o Google
//   intro: frase de abertura, abaixo do título
//   updated: 2026-11-12        (opcional: mostra "Atualizado em")
//   toc: true                  (opcional: índice lateral com as seções)
//   ---
import { marked } from "marked";

const files = import.meta.glob("../content/paginas/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export type Page = {
  slug: string;
  title: string;
  description: string;
  intro?: string;
  updated?: string;
  toc: { id: string; text: string }[];
  html: string;
};

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parse(slug: string, raw: string): Page {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`página ${slug} sem cabeçalho`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const toc: Page["toc"] = [];
  let html = marked.parse(m[2], { async: false, gfm: true });
  // Âncoras nos h2 (índice lateral) e tabelas com rolagem própria no celular.
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_all, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "");
    const id = slugify(text);
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  html = html.replace(/<table>/g, '<div class="table-wrap" role="region" tabindex="0" aria-label="Tabela"><table>').replace(/<\/table>/g, "</table></div>");
  // Links externos abrem em outra aba.
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noreferrer"');
  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    intro: meta.intro || undefined,
    updated: meta.updated || undefined,
    toc: meta.toc === "true" ? toc : [],
    html,
  };
}

const PAGES = new Map<string, Page>();
for (const [path, raw] of Object.entries(files)) {
  const slug = path.split("/").pop()!.replace(/\.md$/, "");
  PAGES.set(slug, parse(slug, raw));
}

/** slug = nome do arquivo (ex.: "sobre", "legal-termos"). */
export function getPage(slug: string): Page | undefined {
  return PAGES.get(slug);
}

export function pageSlugs() {
  return [...PAGES.keys()];
}
