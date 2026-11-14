// Sitemaps e RSS (app/server/seo/feeds.server.ts). Uma rota para todos: o endereço escolhe o arquivo.
import { data } from "react-router";
import type { Route } from "./+types/feeds";
import { routePath } from "~/lib/route-path";
import { rssFeed, sitemapArticles, sitemapIndex, sitemapNews, sitemapStatic, sitemapTaxonomy } from "~/server/seo/feeds.server";

const FILES: Record<string, { build: () => string | Promise<string>; type: string; maxAge: number }> = {
  "/sitemap.xml": { build: () => sitemapIndex(), type: "application/xml", maxAge: 3600 },
  "/sitemap-static.xml": { build: sitemapStatic, type: "application/xml", maxAge: 86400 },
  "/sitemap-news.xml": { build: sitemapNews, type: "application/xml", maxAge: 300 },
  "/sitemap-articles.xml": { build: sitemapArticles, type: "application/xml", maxAge: 3600 },
  "/sitemap-taxonomy.xml": { build: sitemapTaxonomy, type: "application/xml", maxAge: 3600 },
  "/rss.xml": { build: rssFeed, type: "application/rss+xml", maxAge: 600 },
};

export async function loader({ request }: Route.LoaderArgs) {
  const file = FILES[routePath(request)];
  if (!file) throw data(null, { status: 404 });
  return new Response(await file.build(), {
    headers: { "Content-Type": `${file.type}; charset=utf-8`, "Cache-Control": `public, max-age=${file.maxAge}` },
  });
}
