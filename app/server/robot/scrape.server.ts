// Leitura da matéria original: fetch direto + Readability. Sem Firecrawl (decisão do dono).
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { botFetch, readLimited } from "./net.server";

export type ScrapeResult = { bodyHtml: string; textContent: string; ogImage: string | null; rawHtml: string; links: string[] };

/** Troca src/href relativos por absolutos, para a extração de imagens e links não precisar adivinhar a base. */
export function absolutizeUrls(html: string, baseUrl: string): string {
  return html.replace(/(src|href)=(["'])([^"']+)\2/gi, (full, attr: string, q: string, url: string) => {
    if (/^(https?:|data:|mailto:|tel:|#|javascript:)/i.test(url)) return full;
    try {
      return `${attr}=${q}${new URL(url, baseUrl).toString()}${q}`;
    } catch {
      return full;
    }
  });
}

export function extractOgImage(html: string, baseUrl: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (!m) return null;
  try {
    return new URL(m[1], baseUrl).toString();
  } catch {
    return null;
  }
}

const hrefs = (html: string) => [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]))].slice(0, 200);
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Nunca lança: devolve null se a página não abrir. */
export async function scrapePage(url: string): Promise<ScrapeResult | null> {
  try {
    const res = await botFetch(url, { timeoutMs: 20_000 });
    if (!res?.ok) return null;
    const buf = await readLimited(res, 4 * 1024 * 1024);
    if (!buf?.length) return null;
    const rawHtml = absolutizeUrls(buf.toString("utf8"), url);
    let bodyHtml = rawHtml;
    let textContent = plain(rawHtml);
    try {
      const { document } = parseHTML(rawHtml);
      const article = new Readability(document as unknown as Document).parse();
      if (article?.content) {
        bodyHtml = article.content;
        textContent = article.textContent?.trim() || textContent;
      }
    } catch {
      /* fica com o HTML cru */
    }
    return { bodyHtml, textContent, ogImage: extractOgImage(rawHtml, url), rawHtml, links: hrefs(rawHtml) };
  } catch {
    return null;
  }
}
