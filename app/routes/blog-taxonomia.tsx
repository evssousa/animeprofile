// Categoria ou tag do blog (/blog/categoria/:slug e /blog/tag/:slug). O id da rota diz qual.
import { data } from "react-router";
import type { Route } from "./+types/blog-taxonomia";
import { BlogRow, BlogSidebar } from "~/components/blog";
import { PageHeader } from "~/components/PageHeader";
import { Pagination } from "~/components/posts";
import { routePath } from "~/lib/route-path";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { blogSidebar, blogTaxonomy, listBlogPosts } from "~/server/blog/blog.server";

const kindOf = (request: Request) => (routePath(request).startsWith("/blog/categoria/") ? ("categoria" as const) : ("tag" as const));

export async function loader({ params, request }: Route.LoaderArgs) {
  const kind = kindOf(request);
  const info = await blogTaxonomy(kind, params.slug);
  if (!info) throw data(null, { status: 404 });
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("pagina")) || 1);
  const filter = kind === "categoria" ? { categorySlug: params.slug } : { tagSlug: params.slug };
  const [list, side] = await Promise.all([listBlogPosts(filter, page), blogSidebar()]);
  return { kind, slug: params.slug, name: info.name, total: info.total, list, side, now: new Date().toISOString() };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Não encontrado | Anime Profile" }];
  const label = d.kind === "categoria" ? "Categoria" : "Tag";
  const path = `/blog/${d.kind}/${d.slug}`;
  return seo({
    title: `${label}: ${d.name} — Blog`,
    description: `Posts do blog da comunidade ${d.kind === "categoria" ? "na categoria" : "com a tag"} ${d.name}.`,
    path,
    noindex: d.total < 3 || d.list.page > 1,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: `${label}: ${d.name}`, url: absoluteUrl(path), inLanguage: "pt-BR" },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Blog", item: absoluteUrl("/blog") }, { "@type": "ListItem", position: 2, name: d.name, item: absoluteUrl(path) }] },
      ],
    },
  });
}

export default function BlogTaxonomy({ loaderData }: Route.ComponentProps) {
  const { kind, slug, name, total, list, side, now } = loaderData;
  return (
    <>
      <PageHeader label={kind === "categoria" ? "Categoria do blog" : "Tag do blog"} title={kind === "tag" ? `#${name}` : name} intro={`${total} ${total === 1 ? "post" : "posts"}`} />
      <div className="mx-auto grid max-w-[1328px] gap-10 px-4 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-14">
        <section aria-label="Posts" className="flex min-w-0 flex-col gap-4">
          {list.items.map((p) => (
            <BlogRow key={p.id} post={p} now={now} />
          ))}
          <Pagination page={list.page} pages={list.pages} basePath={`/blog/${kind}/${slug}`} />
        </section>
        <aside aria-label="Mais do blog">
          <BlogSidebar {...side} />
        </aside>
      </div>
    </>
  );
}
