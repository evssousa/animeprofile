// Listas: /news (tudo), /noticias e /artigos. ?pagina=N para paginar; categorias levam a /categoria/<slug>.
import { data } from "react-router";
import type { Route } from "./+types/posts-list";
import { PageHeader } from "~/components/PageHeader";
import { Chips, Pagination, PostGrid, PostOverlay, PostRow } from "~/components/posts";
import { seo } from "~/lib/seo";
import { listCategories, listPosts, mostRead, type PostType } from "~/server/content/posts.server";

const PAGES: Record<string, { type?: PostType; label: string; title: string; intro: string; description: string }> = {
  "/news": {
    label: "Central de notícias",
    title: "O pulso do universo otaku",
    intro: "Notícias, artigos e guias sobre animes, mangás, games e cultura pop japonesa, num lugar só.",
    description: "Notícias e artigos de anime, mangá e cultura otaku em português, atualizados todos os dias.",
  },
  "/noticias": {
    type: "news",
    label: "Notícias",
    title: "O que está acontecendo agora",
    intro: "Lançamentos, temporadas, indústria e tudo o que movimenta o mundo dos animes e mangás.",
    description: "As últimas notícias de anime, mangá, games e cultura otaku em português.",
  },
  "/artigos": {
    type: "article",
    label: "Artigos",
    title: "Guias, listas e indicações",
    intro: "Onde assistir, ordem para maratonar, curiosidades e listas para o verdadeiro otaku.",
    description: "Guias, listas, indicações e curiosidades sobre animes e mangás.",
  },
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/news";
  const cfg = PAGES[path];
  if (!cfg) throw data(null, { status: 404 });
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const [list, categories, top] = await Promise.all([listPosts({ type: cfg.type }, page, 24), listCategories(cfg.type), page === 1 ? mostRead(5, cfg.type) : []]);
  if (page > list.pages && list.total > 0) throw data(null, { status: 404 });
  return { path, cfg, list, categories: categories.slice(0, 12), top };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Página não encontrada | Anime Profile" }];
  const page = d.list.page;
  return seo({
    title: page > 1 ? `${d.cfg.label}: página ${page}` : d.cfg.label === "Central de notícias" ? "Notícias e artigos de anime" : d.cfg.label,
    description: d.cfg.description,
    path: page > 1 ? `${d.path}?pagina=${page}` : d.path,
  });
}

export default function PostsList({ loaderData }: Route.ComponentProps) {
  const { path, cfg, list, categories, top } = loaderData;
  const first = list.page === 1;
  const [lead, ...rest] = list.items;
  const tabs = [
    { label: "Tudo", to: "/news" },
    { label: "Notícias", to: "/noticias" },
    { label: "Artigos", to: "/artigos" },
  ];
  return (
    <>
      <PageHeader label={cfg.label} title={cfg.title} intro={cfg.intro}>
        <div className="mt-7 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <a
              key={t.to}
              href={t.to}
              aria-current={t.to === path ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-[0.88rem] font-semibold ${t.to === path ? "bg-white text-night" : "bg-white/12 text-white hover:bg-white/20"}`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto flex max-w-[1328px] flex-col gap-12 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        {categories.length > 0 && <Chips items={categories.map((c) => ({ label: c.name, to: `/categoria/${c.slug}` }))} />}

        {list.items.length === 0 ? (
          <p className="text-ink-soft">Ainda não há matérias publicadas aqui.</p>
        ) : first && lead ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <PostOverlay post={lead} className="min-h-[420px]" titleClass="text-[1.7rem] sm:text-[2.1rem]" />
            {top.length > 0 && (
              <aside className="rounded-[18px] border border-line bg-surface p-5">
                <h2 className="text-[1.05rem] font-extrabold">Mais lidas</h2>
                <ol className="mt-4 flex flex-col gap-4">
                  {top.map((p, i) => (
                    <li key={p.id}>
                      <PostRow post={p} index={i + 1} />
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </div>
        ) : null}

        <PostGrid posts={first ? rest : list.items} />
        <Pagination page={list.page} pages={list.pages} basePath={path} />
      </div>
    </>
  );
}
