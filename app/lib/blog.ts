// Tipos e textos do blog da comunidade que valem no servidor e no navegador.

export type BlogCardData = {
  id: string;
  slug: string;
  url: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  claps: number;
  comments: number;
  readingMinutes: number;
  author: { slug: string; name: string; avatarUrl: string | null; url: string };
};

export const blogUrl = (username: string, slug: string) => `/blog/${username}/${slug}`;
export const blogAuthorUrl = (username: string) => `/blog/u/${username}`;

/** Markdown → texto simples, para resumos e descrições. */
export function stripMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "");
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");
  s = s.replace(/(\*|_)(.*?)\1/g, "$2");
  s = s.replace(/~~(.*?)~~/g, "$1");
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, " ");
  return s.replace(/\s+/g, " ").trim();
}
