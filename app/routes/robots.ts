import { absoluteUrl } from "~/lib/site";

export function loader() {
  // Endereço de teste: nada entra no Google.
  const body =
    process.env.SITE_NOINDEX === "1"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
