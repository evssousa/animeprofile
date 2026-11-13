// Busca em /busca?q=termo. Procura todos os termos no título e no resumo, sem diferenciar acento.
import { Form } from "react-router";
import { Search } from "lucide-react";
import type { Route } from "./+types/busca";
import { PageHeader } from "~/components/PageHeader";
import { Pagination, PostGrid } from "~/components/posts";
import { seo } from "~/lib/seo";
import { listPosts } from "~/server/content/posts.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const list = q.length >= 2 ? await listPosts({ search: q }, page, 24) : null;
  return { q, list };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  return seo({ title: d?.q ? `Busca: ${d.q}` : "Buscar", path: "/busca", noindex: true });
}

export default function Busca({ loaderData }: Route.ComponentProps) {
  const { q, list } = loaderData;
  return (
    <>
      <PageHeader label="Buscar" title={q ? `Resultados para “${q}”` : "O que você procura?"}>
        <Form method="get" role="search" className="mt-7 flex max-w-xl gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar no site</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/60" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Anime, mangá, personagem..."
              autoFocus={!q}
              className="h-12 w-full rounded-[10px] border border-white/15 bg-white/10 pr-4 pl-12 text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none"
            />
          </label>
          <button type="submit" className="rounded-[10px] bg-brand px-5 font-bold text-brand-ink hover:brightness-110">
            Buscar
          </button>
        </Form>
      </PageHeader>
      <div className="mx-auto flex max-w-[1328px] flex-col gap-10 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        {!list ? (
          <p className="text-ink-soft">Digite pelo menos 2 letras para buscar nas notícias e nos artigos.</p>
        ) : list.total === 0 ? (
          <p className="text-ink-soft">Nada encontrado para “{q}”. Tente outro termo, ou menos palavras.</p>
        ) : (
          <>
            <p className="text-ink-soft">{list.total === 1 ? "1 matéria encontrada" : `${list.total.toLocaleString("pt-BR")} matérias encontradas`}</p>
            <PostGrid posts={list.items} />
            <Pagination page={list.page} pages={list.pages} basePath="/busca" query={{ q }} />
          </>
        )}
      </div>
    </>
  );
}
