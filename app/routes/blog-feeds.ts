// RSS do blog: /blog/rss.xml (todos) e /blog/u/:username/rss.xml (de um autor).
import { data } from "react-router";
import type { Route } from "./+types/blog-feeds";
import { blogRss } from "~/server/seo/feeds.server";

export async function loader({ params }: Route.LoaderArgs) {
  const xml = await blogRss(params.username);
  if (xml == null) throw data(null, { status: 404 });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
