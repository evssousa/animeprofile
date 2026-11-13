import { SITE, absoluteUrl } from "./site";

type SeoInput = {
  title: string;
  description?: string | null;
  path: string;
  type?: "website" | "article";
  image?: string | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
};

/** Metatags padrão de uma página: título, descrição, canonical, Open Graph, Twitter e JSON-LD. */
export function seo({ title, description, path, type = "website", image, publishedTime, modifiedTime, noindex, jsonLd }: SeoInput) {
  const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;
  const url = absoluteUrl(path);
  const img = image ? (image.startsWith("http") ? image : absoluteUrl(image)) : absoluteUrl("/logo-192.png");
  return [
    { title: fullTitle },
    ...(description ? [{ name: "description", content: description }] : []),
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:site_name", content: SITE.name },
    { property: "og:title", content: fullTitle },
    ...(description ? [{ property: "og:description", content: description }] : []),
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:image", content: img },
    { property: "og:locale", content: "pt_BR" },
    ...(publishedTime ? [{ property: "article:published_time", content: publishedTime }] : []),
    ...(modifiedTime ? [{ property: "article:modified_time", content: modifiedTime }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
    ...(jsonLd ? [{ "script:ld+json": jsonLd }] : []),
  ];
}
