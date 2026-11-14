// Lista do blog da comunidade (/blog). Busca ?q=, ordem ?ordem=populares|comentados, paginação ?pagina=N.
import { Form, Link } from "react-router";
import { Rss, Search } from "lucide-react";
import type { Route } from "./+types/blog-list";
import { BlogRow, BlogSidebar } from "~/components/blog";
import { PageHeader } from "~/components/PageHeader";
import { Pagination } from "~/components/posts";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { blogSidebar, listBlogPosts, type BlogOrder } from "~/server/blog/blog.server";

const ORDER_LABEL: Record<BlogOrder, string> = { recentes: "Mais recentes", populares: "Mais curtidos", comentados: "Mais comentados" };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const o = url.searchParams.get("ordem");
  const order: BlogOrder = o === "populares" || o === "comentados" ? o : "recentes";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const [list, side] = await Promise.all([listBlogPosts({ order, q }, page), blogSidebar()]);
  return { list, side, order, q, now: new Date().toISOString() };
}

export const links: Route.LinksFunction = () => [{ rel: "alternate", type: "application/rss+xml", title: "Blog do Anime Profile", href: "/blog/rss.xml" }];

export function meta({ loaderData: d }: Route.MetaArgs) {
  return seo({
    title: "Blog dos usuários",
    description: "Posts da comunidade otaku: opiniões, listas e textos pessoais.",
    path: "/blog",
    noindex: Boolean(d?.q),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: "Blog dos usuários", url: absoluteUrl("/blog"), inLanguage: "pt-BR" },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") }] },
      ],
    },
  });
}

export default function BlogList({ loaderData }: Route.ComponentProps) {
  const { list, side, order, q, now } = loaderData;
  const href = (o: BlogOrder) => (o === "recentes" ? "/blog" : `/blog?ordem=${o}`);
  return (
    <>
      <PageHeader label="Blog da comunidade" title="Onde a sua voz ganha vida" intro="Opiniões, listas e textos pessoais de quem vive o universo otaku.">
        <a href="/blog/rss.xml" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-[0.88rem] font-semibold text-white hover:bg-white/20">
          <Rss className="size-4" aria-hidden /> RSS do blog
        </a>
      </PageHeader>
      <div className="mx-auto grid max-w-[1328px] gap-10 px-4 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-14">
        <section aria-label="Posts" className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav aria-label="Ordem" className="flex flex-wrap gap-2">
              {(Object.keys(ORDER_LABEL) as BlogOrder[]).map((o) => (
                <Link key={o} to={href(o)} aria-current={o === order ? "page" : undefined} className={`rounded-full px-4 py-2 text-[0.85rem] font-semibold ${o === order ? "bg-ink text-paper" : "border border-line bg-surface hover:bg-sunken"}`}>
                  {ORDER_LABEL[o]}
                </Link>
              ))}
            </nav>
            <Form method="get" role="search" className="relative w-full sm:w-64">
              {order !== "recentes" && <input type="hidden" name="ordem" value={order} />}
              <label>
                <span className="sr-only">Buscar no blog</span>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                <input type="search" name="q" defaultValue={q} placeholder="Buscar no blog" className="h-11 w-full rounded-[10px] border border-line bg-surface pr-4 pl-10 focus:border-ink-soft focus:outline-none" />
              </label>
            </Form>
          </div>
          {list.items.length ? (
            <div className="flex flex-col gap-4">
              {list.items.map((p) => (
                <BlogRow key={p.id} post={p} now={now} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-soft">{q ? `Nenhum post encontrado para “${q}”.` : "Ainda não há posts publicados."}</p>
          )}
          <Pagination page={list.page} pages={list.pages} basePath="/blog" query={{ ...(order !== "recentes" ? { ordem: order } : {}), ...(q ? { q } : {}) }} />
        </section>
        <aside aria-label="Mais do blog">
          <BlogSidebar {...side} />
        </aside>
      </div>
    </>
  );
}
