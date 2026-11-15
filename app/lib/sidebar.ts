// Barras laterais: tipos e a tabela de blocos por página (valem no servidor e no navegador, sem nada de servidor).
import type { AnimeFull } from "~/server/anime/anime.server";
import type { BlogCardData } from "~/lib/blog";
import type { CommentItem, PostCard } from "~/server/content/posts.server";

/** "há 3 h" fixo no servidor (sem diferença de hidratação): o texto vem calculado no loader. */
export type Labeled<T> = T & { ago: string };

export type SidebarPage = "materia" | "central" | "taxonomia" | "blog";

export type BlockKind =
  | "anime"
  | "destaque"
  | "ultimas"
  | "comentarios"
  | "indice"
  | "emAlta"
  | "maisLidasMes"
  | "recentesOutroTipo"
  | "doBlog"
  | "assuntos"
  | "maisComentadasMes"
  | "assuntosRelacionados"
  | "categorias"
  | "ctaCentral"
  | "blogDestaquesSemana"
  | "blogMaisLidos"
  | "blogMaisComentados"
  | "blogTags"
  | "blogAutores";

export type SideBlockSpec = { block: BlockKind; limit?: number; sticky?: boolean; mobile?: "show" | "hide" };

/** Os blocos de cada página, na ordem. Bloco sem itens some (nunca aparece "sem dados ainda"). */
export const SIDEBAR_PRESETS: Record<SidebarPage, SideBlockSpec[]> = {
  materia: [
    { block: "anime" },
    { block: "destaque" },
    { block: "ultimas", limit: 6 },
    { block: "comentarios", limit: 5 },
    { block: "indice", sticky: true, mobile: "hide" },
    { block: "emAlta", limit: 5, sticky: true },
  ],
  central: [
    { block: "maisLidasMes", limit: 5 },
    { block: "recentesOutroTipo", limit: 5 },
    { block: "doBlog", limit: 5 },
    { block: "assuntos", limit: 15 },
    { block: "maisComentadasMes", limit: 5 },
  ],
  taxonomia: [{ block: "assuntosRelacionados", limit: 14 }, { block: "categorias" }, { block: "maisLidasMes", limit: 5 }, { block: "ctaCentral" }],
  blog: [
    { block: "blogDestaquesSemana", limit: 5 },
    { block: "blogMaisLidos", limit: 5 },
    { block: "blogMaisComentados", limit: 5 },
    { block: "blogTags", limit: 12 },
    { block: "blogAutores", limit: 5 },
  ],
};

export type SideLink = { to: string; text: string };

type Common = { key: BlockKind; sticky?: boolean; mobile?: "show" | "hide" };

export type SideBlockData = Common &
  (
    | { kind: "anime"; anime: AnimeFull | null; guideTitle: string; guide: { title: string; url: string; type: "news" | "article" }[] }
    | { kind: "featured"; post: PostCard }
    | { kind: "posts"; title: string; items: PostCard[]; numbered?: boolean; more?: SideLink; meta?: string[] }
    | { kind: "comments"; items: Labeled<CommentItem>[] }
    | { kind: "toc"; items: { id: string; text: string }[] }
    | { kind: "tags"; title: string; items: { name: string; slug: string }[]; hrefBase: string }
    | { kind: "categories"; title: string; items: { name: string; slug: string; total: number }[] }
    | { kind: "blog"; title: string; items: BlogCardData[]; more?: SideLink; meta?: string[] }
    | { kind: "authors"; title: string; items: { name: string; slug: string; avatarUrl: string | null; total: number }[] }
    | { kind: "cta"; label: string; text: string; link: SideLink }
  );
