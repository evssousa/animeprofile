// Monta os blocos da barra lateral de cada página (docs/plano-sidebars.md). Consultas iguais para todo mundo passam por
// cache em memória de 5 a 10 min; a matéria aberta é tirada em JS depois (assim o cache serve todas as matérias).
import { timeAgo } from "~/lib/format";
import { SIDEBAR_PRESETS, type Labeled, type SideBlockData, type SideBlockSpec, type SidebarPage } from "~/lib/sidebar";
import type { AnimeFull } from "./anime/anime.server";
import { blogBestOfWeek, blogMostCommented, blogSidebar, listBlogPosts } from "./blog/blog.server";
import { cached } from "./cache.server";
import {
  categoriesOfTag,
  latestComments,
  latestPosts,
  listCategories,
  mostCommentedSince,
  mostRead,
  mostReadSince,
  relatedTags,
  trendingPosts,
  trendingTags,
  type CommentItem,
  type PostCard,
  type PostType,
} from "./content/posts.server";

const FIVE = 5 * 60_000;
const TEN = 10 * 60_000;

export type SidebarContext = {
  now: Date;
  /** Tipo da página (notícias, artigos) ou da matéria aberta. */
  type?: PostType;
  /** Matéria aberta: nunca aparece nas listas da lateral. */
  excludeId?: string;
  anilistId?: number | null;
  anime?: AnimeFull | null;
  toc?: { id: string; text: string }[];
  categoryId?: string;
  categorySlug?: string;
  tagId?: string;
};

const without = <T extends { id: string }>(items: T[], id?: string) => (id ? items.filter((i) => i.id !== id) : items);

async function build(spec: SideBlockSpec, ctx: SidebarContext): Promise<SideBlockData | null> {
  const limit = spec.limit ?? 5;
  const common = { key: spec.block, sticky: spec.sticky, mobile: spec.mobile };
  const typeKey = ctx.type ?? "todos";
  const noticias = ctx.type !== "article";

  switch (spec.block) {
    case "anime": {
      if (!ctx.anilistId) return null;
      const items = await cached(`guia:${ctx.anilistId}`, TEN, () => latestPosts({ anilistId: ctx.anilistId! }, 8));
      const guide = without(items, ctx.excludeId)
        .slice(0, 6)
        .map((p) => ({ title: p.title, url: p.url, type: p.type }));
      if (!ctx.anime && !guide.length) return null;
      return { ...common, kind: "anime", anime: ctx.anime ?? null, guideTitle: ctx.anime ? `Mais sobre ${ctx.anime.title}` : "Mais sobre este anime", guide };
    }
    case "destaque":
    case "ultimas": {
      const recent = without(await cached(`recentes:${typeKey}`, FIVE, () => latestPosts({ type: ctx.type }, 12)), ctx.excludeId);
      const featured = recent.find((p) => p.image) ?? null;
      if (spec.block === "destaque") return featured ? { ...common, kind: "featured", post: featured } : null;
      const items = recent.filter((p) => p.id !== featured?.id).slice(0, limit);
      if (!items.length) return null;
      return {
        ...common,
        kind: "posts",
        title: noticias ? "Últimas notícias" : "Últimos artigos",
        items,
        more: noticias ? { to: "/noticias?tipo=noticias", text: "Ver tudo" } : { to: "/artigos", text: "Ver tudo" },
      };
    }
    case "comentarios": {
      const type = ctx.type ?? "news";
      const raw = await cached(`comentarios:${type}`, FIVE, () => latestComments(type, limit));
      if (!raw.length) return null;
      const items: Labeled<CommentItem>[] = raw.map((c) => ({ ...c, ago: timeAgo(c.createdAt, ctx.now) }));
      return { ...common, kind: "comments", items };
    }
    case "indice":
      return ctx.toc && ctx.toc.length > 1 ? { ...common, kind: "toc", items: ctx.toc } : null;
    case "emAlta": {
      const type = ctx.type ?? "news";
      const items = without(await cached(`emalta:${type}`, FIVE, () => trendingPosts(type, "", limit + 1)), ctx.excludeId).slice(0, limit);
      return items.length ? { ...common, kind: "posts", title: "Em alta", items, numbered: true } : null;
    }
    case "maisLidasMes": {
      const items = await cached(`lidas:${typeKey}`, FIVE, async () => {
        const month = await mostReadSince(30, limit, ctx.type);
        return month.length >= 3 ? { month: true, items: month } : { month: false, items: await mostRead(limit, ctx.type) };
      });
      if (!items.items.length) return null;
      const word = ctx.type === "article" ? "lidos" : "lidas";
      return { ...common, kind: "posts", title: items.month ? `Mais ${word} do mês` : `Mais ${word}`, items: items.items, numbered: true };
    }
    case "recentesOutroTipo": {
      const other: PostType = ctx.type === "article" ? "news" : "article";
      const items = await cached(`recentes:${other}`, FIVE, () => latestPosts({ type: other }, limit));
      if (!items.length) return null;
      return other === "article"
        ? { ...common, kind: "posts", title: "Artigos recentes", items, more: { to: "/artigos", text: "Ver tudo" } }
        : { ...common, kind: "posts", title: "Últimas notícias", items, more: { to: "/noticias?tipo=noticias", text: "Ver tudo" } };
    }
    case "doBlog": {
      const items = await cached("do-blog", FIVE, async () => (await listBlogPosts({ order: "recentes" }, 1, limit)).items);
      return items.length ? { ...common, kind: "blog", title: "Do blog", items, more: { to: "/blog", text: "Ver tudo" }, meta: items.map((p) => `@${p.author.slug}`) } : null;
    }
    case "assuntos": {
      const items = await cached("assuntos", FIVE, () => trendingTags(limit));
      return items.length ? { ...common, kind: "tags", title: "Assuntos do momento", items, hrefBase: "/tag/" } : null;
    }
    case "maisComentadasMes": {
      const items = await cached(`comentadas:${typeKey}`, FIVE, () => mostCommentedSince(30, limit, ctx.type));
      if (!items.length) return null;
      return {
        ...common,
        kind: "posts",
        title: "Mais comentadas do mês",
        items,
        meta: items.map((p) => (p.comments === 1 ? "1 comentário" : `${p.comments} comentários`)),
      };
    }
    case "assuntosRelacionados": {
      if (!ctx.categoryId && !ctx.tagId) return null;
      const items = await cached(`relacionados:${ctx.categoryId ?? ""}:${ctx.tagId ?? ""}`, TEN, () =>
        relatedTags(ctx.categoryId ? { categoryId: ctx.categoryId } : { tagId: ctx.tagId }, limit, ctx.tagId ?? ""),
      );
      return items.length ? { ...common, kind: "tags", title: ctx.categoryId ? "Assuntos em alta aqui" : "Assuntos relacionados", items, hrefBase: "/tag/" } : null;
    }
    case "categorias": {
      if (ctx.tagId) {
        const items = await cached(`cats-tag:${ctx.tagId}`, TEN, () => categoriesOfTag(ctx.tagId!, 6));
        return items.length ? { ...common, kind: "categories", title: "Aparece em", items } : null;
      }
      const all = await cached("categorias", TEN, () => listCategories());
      const items = all.filter((c) => c.slug !== ctx.categorySlug && c.slug !== "sem-categoria").slice(0, 10);
      return items.length ? { ...common, kind: "categories", title: "Outras categorias", items } : null;
    }
    case "ctaCentral":
      return { ...common, kind: "cta", label: "Central de notícias", text: "Todas as notícias e artigos do dia, num lugar só.", link: { to: "/noticias", text: "Ir para a Central" } };
    case "blogDestaquesSemana": {
      const items = await cached("blog-semana", FIVE, () => blogBestOfWeek(limit));
      return items.length ? { ...common, kind: "blog", title: "Destaques da semana", items } : null;
    }
    case "blogMaisLidos": {
      const side = await cached("blog-sidebar", FIVE, () => blogSidebar());
      return side.mostRead.length ? { ...common, kind: "blog", title: "Mais lidos", items: side.mostRead.slice(0, limit) } : null;
    }
    case "blogMaisComentados": {
      const items = await cached("blog-comentados", FIVE, () => blogMostCommented(limit));
      return items.length ? { ...common, kind: "blog", title: "Mais comentados", items, meta: items.map((p) => (p.comments === 1 ? "1 comentário" : `${p.comments} comentários`)) } : null;
    }
    case "blogTags": {
      const side = await cached("blog-sidebar", FIVE, () => blogSidebar());
      return side.tags.length ? { ...common, kind: "tags", title: "Tags em alta", items: side.tags.slice(0, limit), hrefBase: "/blog/tag/" } : null;
    }
    case "blogAutores": {
      const side = await cached("blog-sidebar", FIVE, () => blogSidebar());
      return side.authors.length ? { ...common, kind: "authors", title: "Quem mais escreve", items: side.authors.slice(0, limit) } : null;
    }
  }
}

/** Blocos da página, na ordem do preset, sem os vazios. */
export async function loadSidebar(page: SidebarPage, ctx: SidebarContext): Promise<SideBlockData[]> {
  const blocks = await Promise.all(SIDEBAR_PRESETS[page].map((spec) => build(spec, ctx).catch((err) => {
    console.error(`[sidebar] bloco ${spec.block} falhou:`, (err as Error).message);
    return null;
  })));
  return blocks.filter((b): b is SideBlockData => b !== null);
}

export type { PostCard };
