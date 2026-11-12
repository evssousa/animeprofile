import { SITE, absoluteUrl } from "./site";

type SeoInput = { title: string; description?: string; path: string; type?: "website" | "article"; noindex?: boolean };

/** Metatags padrão de uma página: título, descrição, canonical, Open Graph e Twitter. */
export function seo({ title, description, path, type = "website", noindex }: SeoInput) {
  const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
  const url = absoluteUrl(path);
  return [
    { title: fullTitle },
    ...(description ? [{ name: "description", content: description }] : []),
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:site_name", content: SITE.name },
    { property: "og:title", content: fullTitle },
    ...(description ? [{ property: "og:description", content: description }] : []),
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:locale", content: "pt_BR" },
    { name: "twitter:card", content: "summary" },
    ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
  ];
}
