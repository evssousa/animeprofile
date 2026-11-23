// Blog de um autor (/blog/u/:username). Filtros ?categoria= e ?tag= no servidor.
import { AdSlot } from "~/components/ads/AdSlot";
import { data, Link } from "react-router";
import type { Route } from "./+types/blog-author";
import { BlogAvatar, BlogTile } from "~/components/blog";
import { PageHeader } from "~/components/PageHeader";
import { Pagination } from "~/components/posts";
import { blogAuthorUrl } from "~/lib/blog";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { blogAuthor, listBlogPosts } from "~/server/blog/blog.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const author = await blogAuthor(params.username);
  if (!author) throw data(null, { status: 404 });
  const url = new URL(request.url);
  const categoria = url.searchParams.get("categoria") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const [list, all] = await Promise.all([
    listBlogPosts({ authorSlug: author.slug, categorySlug: categoria || undefined, tagSlug: tag || undefined }, page, 12),
    categoria || tag ? listBlogPosts({ authorSlug: author.slug }, 1, 1) : null,
  ]);
  return { author, list, categoria, tag, totalPosts: all ? all.total : list.total };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Autor não encontrado | Anime Profile" }];
  const a = d.author;
  const path = blogAuthorUrl(a.slug);
  return seo({
    title: `Blog de ${a.name}`,
    description: `Posts de @${a.slug} no blog do Anime Profile.`,
    path,
    image: a.avatar_url,
    noindex: d.totalPosts === 0 || Boolean(d.categoria || d.tag),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "ProfilePage", mainEntity: { "@type": "Person", name: a.name, url: absoluteUrl(path), ...(a.avatar_url ? { image: a.avatar_url } : {}) } },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Blog", item: absoluteUrl("/blog") }, { "@type": "ListItem", position: 2, name: a.name, item: absoluteUrl(path) }] },
      ],
    },
  });
}

export default function BlogAuthor({ loaderData }: Route.ComponentProps) {
  const { author, list, categoria, tag, totalPosts } = loaderData;
  const base = blogAuthorUrl(author.slug);
  const chip = (active: boolean) => `rounded-full px-3 py-1.5 text-[0.82rem] font-semibold ${active ? "bg-ink text-paper" : "border border-line bg-surface hover:bg-sunken"}`;
  return (
    <>
      <PageHeader label="Blog da comunidade" title={`Blog de ${author.name}`} intro={author.bio ?? undefined}>
        <div className="mt-6 flex items-center gap-3 text-white/80">
          <BlogAvatar src={author.avatar_url} name={author.name} size="size-12" />
          <span>
            @{author.slug} · {totalPosts} {totalPosts === 1 ? "post" : "posts"} ·{" "}
            <a href={`${base}/rss.xml`} className="underline">
              RSS
            </a>
          </span>
        </div>
      </PageHeader>
      <div className="mx-auto grid max-w-[1328px] gap-10 px-4 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-14">
        <section aria-label="Posts do autor" className="min-w-0">
          {list.items.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {list.items.map((p) => (
                <BlogTile key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-soft">{categoria || tag ? "Nenhum post nesse filtro." : "Este autor ainda não publicou nada no blog."}</p>
          )}
          <div className="mt-8">
            {list.items.length > 0 && <AdSlot slot="list" />}
            <Pagination page={list.page} pages={list.pages} basePath={base} query={{ ...(categoria ? { categoria } : {}), ...(tag ? { tag } : {}) }} />
          </div>
        </section>
        {(author.categories.length > 0 || author.tags.length > 0) && (
          <aside aria-label="Filtros" className="flex flex-col gap-6">
            {author.categories.length > 0 && (
              <div>
                <h2 className="text-[1.05rem] font-extrabold">Categorias</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={base} className={chip(!categoria && !tag)}>
                    Todos
                  </Link>
                  {author.categories.map((c) => (
                    <Link key={c.slug} to={`${base}?categoria=${c.slug}`} className={chip(c.slug === categoria)}>
                      {c.name} <span className="opacity-60">{c.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {author.tags.length > 0 && (
              <div>
                <h2 className="text-[1.05rem] font-extrabold">Tags</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {author.tags.map((t) => (
                    <Link key={t.slug} to={`${base}?tag=${t.slug}`} className={chip(t.slug === tag)}>
                      #{t.name} <span className="opacity-60">{t.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
