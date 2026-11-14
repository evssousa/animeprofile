// /categoria/<slug>, /tag/<slug> e /autores/<slug> (autores de IA): a mesma página de lista, com filtro.
import { data, redirect } from "react-router";
import type { Route } from "./+types/taxonomia";
import { PageHeader } from "~/components/PageHeader";
import { Pagination, PostGrid } from "~/components/posts";
import { routePath } from "~/lib/route-path";
import { seo } from "~/lib/seo";
import { getAiAuthor, getCategory, getTag, listPosts, type ListFilter } from "~/server/content/posts.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const path = routePath(request);
  const kind = path.split("/")[1] as "categoria" | "tag" | "autores";
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const slug = params.slug;
  let filter: ListFilter;
  let head: { label: string; title: string; intro?: string; avatar?: string | null };

  if (kind === "categoria") {
    const c = await getCategory(slug);
    if (!c) throw data(null, { status: 404 });
    filter = { categoryId: c.id };
    head = { label: c.kind === "article" ? "Artigos" : "Notícias", title: c.name, intro: c.description ?? undefined };
  } else if (kind === "tag") {
    const t = await getTag(slug);
    if (!t) throw data(null, { status: 404 });
    if (t.redirectTo) throw redirect(`/tag/${t.redirectTo}`, 301);
    filter = { tagId: t.id };
    head = { label: "Assunto", title: `#${t.name}`, intro: `Todas as notícias e artigos sobre ${t.name}.` };
  } else {
    const a = await getAiAuthor(slug);
    if (!a) throw data(null, { status: 404 });
    filter = { authorId: a.id };
    head = { label: "Autor da redação", title: a.name, intro: a.bio ?? "Autor de IA da redação do Anime Profile. Todo texto passa por revisão humana.", avatar: a.avatar_url };
  }

  const list = await listPosts(filter, page, 24);
  if (page > list.pages && list.total > 0) throw data(null, { status: 404 });
  return { kind, path, head, list };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Página não encontrada | Anime Profile" }];
  const page = d.list.page;
  return seo({
    title: page > 1 ? `${d.head.title}: página ${page}` : d.head.title,
    description: d.head.intro ?? `Notícias e artigos: ${d.head.title}.`,
    path: page > 1 ? `${d.path}?pagina=${page}` : d.path,
    // Tags com poucas matérias não entram no Google (página rala).
    noindex: d.kind === "tag" && d.list.total < 3,
  });
}

export default function Taxonomia({ loaderData }: Route.ComponentProps) {
  const { path, head, list } = loaderData;
  return (
    <>
      <PageHeader label={head.label} title={head.title} intro={head.intro}>
        <p className="mt-5 text-[0.9rem] text-white/60">{list.total === 1 ? "1 matéria" : `${list.total.toLocaleString("pt-BR")} matérias`}</p>
      </PageHeader>
      <div className="mx-auto flex max-w-[1328px] flex-col gap-12 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        {list.items.length ? <PostGrid posts={list.items} /> : <p className="text-ink-soft">Ainda não há matérias aqui.</p>}
        <Pagination page={list.page} pages={list.pages} basePath={path} />
      </div>
    </>
  );
}
