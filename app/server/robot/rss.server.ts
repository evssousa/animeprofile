// Leitura de RSS/Atom e descoberta do feed (portado de worker/rss.ts).
import { XMLParser } from "fast-xml-parser";
import { botFetch, readLimited } from "./net.server";
import { decodeEntities, stripHtml } from "./text";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

type RawItem = {
  title: unknown;
  link: unknown;
  description?: string;
  content?: string;
  pubDate?: string;
  enclosure?: { "@_url"?: string; "@_type"?: string };
  ["media:content"]?: { "@_url"?: string; "@_type"?: string };
  ["media:thumbnail"]?: { "@_url"?: string };
};

const textOf = (v: unknown): string => (typeof v === "string" ? v : v && typeof v === "object" ? String((v as { "#text"?: unknown })["#text"] ?? "") : "");

export function extractItems(parsed: unknown): RawItem[] {
  const root = parsed as Record<string, unknown>;
  const rss = root.rss as { channel?: { item?: RawItem | RawItem[] } } | undefined;
  if (rss?.channel?.item) return Array.isArray(rss.channel.item) ? rss.channel.item : [rss.channel.item];
  const feed = root.feed as { entry?: unknown } | undefined;
  if (feed?.entry) {
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    return entries.map((e) => {
      const en = e as Record<string, unknown>;
      const links = en.link as { "@_href"?: string } | { "@_href"?: string }[] | undefined;
      const link = Array.isArray(links) ? links[0]?.["@_href"] : links?.["@_href"];
      return {
        title: textOf(en.title),
        link: link ?? "",
        description: textOf(en.summary) || undefined,
        content: textOf(en.content) || undefined,
        pubDate: typeof en.published === "string" ? en.published : typeof en.updated === "string" ? en.updated : undefined,
      };
    });
  }
  return [];
}

function pickImage(item: RawItem, html: string | undefined): string | undefined {
  return item.enclosure?.["@_url"] ?? item["media:content"]?.["@_url"] ?? item["media:thumbnail"]?.["@_url"] ?? html?.match(/<img[^>]+src="([^"]+)"/i)?.[1];
}

export function pickVideo(item: RawItem, html: string | undefined): string | undefined {
  const type = item["media:content"]?.["@_type"];
  const url = item["media:content"]?.["@_url"];
  if (url && type && /video/i.test(type)) return url;
  const hay = (html ?? "") + " " + (item.description ?? "");
  const yt = hay.match(/(?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = hay.match(/(?:https?:)?\/\/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
  return vm ? `https://player.vimeo.com/video/${vm[1]}` : undefined;
}

const COMMON_RSS_PATHS = ["/feed", "/feed/", "/rss", "/rss/", "/feed.xml", "/rss.xml", "/index.xml", "/atom.xml", "/?feed=rss2", "/feed/rss2"];
const FEED_ACCEPT = { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" };

async function fetchFeedText(url: string): Promise<string | null> {
  try {
    const res = await botFetch(url, { headers: FEED_ACCEPT });
    if (!res?.ok) return null;
    const buf = await readLimited(res, 5 * 1024 * 1024);
    const text = buf?.toString("utf8");
    return text && /<(rss|feed)[\s>]/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

/** Tenta os caminhos comuns e o <link rel="alternate"> da página inicial. */
export async function discoverRssUrl(baseUrl: string): Promise<string | null> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  for (const p of COMMON_RSS_PATHS) if (await fetchFeedText(origin + p)) return origin + p;
  try {
    const res = await botFetch(baseUrl);
    if (!res?.ok) return null;
    const html = ((await readLimited(res, 2 * 1024 * 1024)) ?? Buffer.alloc(0)).toString("utf8");
    for (const m of html.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)) {
      if (!/type=["'](application\/rss\+xml|application\/atom\+xml)["']/i.test(m[0])) continue;
      const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      const abs = new URL(href, origin).toString();
      if (await fetchFeedText(abs)) return abs;
    }
  } catch {
    /* ignora */
  }
  return null;
}

const isHttp = (u: string | undefined | null): u is string => !!u && /^https?:\/\//i.test(u);

export type FetchedItem = { title: string; link: string; summary: string; content: string; imageUrl: string | null; videoUrl: string | null; publishedAt: string | null };
export type SourceFetchResult = { status: "ok" | "discovered" | "no_rss" | "failed"; discoveredRssUrl?: string; items: FetchedItem[] };

/** Converte o texto de um feed nos itens do robô (puro; usado também nos testes). */
export function parseFeed(text: string, limit = 10): FetchedItem[] {
  const items: FetchedItem[] = [];
  for (const it of extractItems(xml.parse(text)).slice(0, limit)) {
    const title = decodeEntities(stripHtml(textOf(it.title))).slice(0, 280);
    const link = textOf(it.link).trim();
    if (!title || !isHttp(link)) continue;
    const html = textOf(it.content ?? it.description ?? "");
    const image = pickImage(it, html);
    const video = pickVideo(it, html);
    const when = it.pubDate ? new Date(it.pubDate) : null;
    items.push({
      title,
      link,
      summary: stripHtml(textOf(it.description ?? it.content ?? "")).slice(0, 600),
      content: stripHtml(html).slice(0, 8000),
      imageUrl: isHttp(image) ? image : null,
      videoUrl: isHttp(video) ? video : null,
      publishedAt: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
    });
  }
  return items;
}

export async function fetchSourceItems(source: { baseUrl: string; rssUrl: string | null }, limit = 10): Promise<SourceFetchResult> {
  let rssUrl = source.rssUrl;
  let discovered: string | undefined;
  if (!rssUrl) {
    rssUrl = await discoverRssUrl(source.baseUrl);
    if (!rssUrl) return { status: "no_rss", items: [] };
    discovered = rssUrl;
  }
  try {
    const res = await botFetch(rssUrl, { headers: FEED_ACCEPT });
    if (!res?.ok) return { status: "failed", items: [] };
    const buf = await readLimited(res, 5 * 1024 * 1024);
    if (!buf) return { status: "failed", items: [] };
    return { status: discovered ? "discovered" : "ok", discoveredRssUrl: discovered, items: parseFeed(buf.toString("utf8"), limit) };
  } catch {
    return { status: "failed", items: [] };
  }
}
