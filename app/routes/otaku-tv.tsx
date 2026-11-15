// Otaku TV (/otaku-tv): vídeos de anime num lugar só. Abas: das matérias, trailers da temporada e aberturas/encerramentos.
// O link `/otaku-tv?v=<id do YouTube>` abre o vídeo no player (usado também para compartilhar).
import { Form, Link } from "react-router";
import { Clapperboard, Music, Newspaper, Search } from "lucide-react";
import type { Route } from "./+types/otaku-tv";
import { ThemesTab, VideoCard, YoutubePlayer, ytThumb } from "~/components/otaku-tv";
import { SideCard } from "~/components/sidebar";
import { PageHeader } from "~/components/PageHeader";
import { Pagination } from "~/components/posts";
import { seo } from "~/lib/seo";
import { findVideo, listPostVideos, listTrailers } from "~/server/tv/tv.server";

type Tab = "materias" | "trailers" | "musicas";
const TABS: { value: Tab; label: string; icon: typeof Newspaper }[] = [
  { value: "materias", label: "Das matérias", icon: Newspaper },
  { value: "trailers", label: "Trailers da temporada", icon: Clapperboard },
  { value: "musicas", label: "Aberturas e encerramentos", icon: Music },
];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("tab");
  const tab: Tab = raw === "trailers" || raw === "musicas" ? raw : "materias";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const v = url.searchParams.get("v") ?? "";
  const selected = v ? await findVideo(v) : null;
  const generic = v && !selected && /^[A-Za-z0-9_-]{11}$/.test(v) ? { id: v, title: "Vídeo da Otaku TV", subtitle: "Otaku TV", badge: "Vídeo", date: null, excerpt: null, postUrl: null, animeId: null, animeUrl: null } : null;
  const list = tab === "materias" ? await listPostVideos(q, page) : tab === "trailers" ? await listTrailers(q, page) : null;
  return { tab, q, selected: selected ?? generic, list, label: list && "label" in list ? list.label : null };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  const tab = d?.tab ?? "materias";
  const titles: Record<Tab, string> = { materias: "Otaku TV: vídeos e trailers de anime", trailers: "Trailers de anime da temporada", musicas: "Aberturas e encerramentos de anime" };
  return seo({
    title: d?.selected ? d.selected.title : titles[tab],
    description: "Trailers, vídeos das matérias e aberturas e encerramentos dos animes, num lugar só.",
    path: tab === "materias" ? "/otaku-tv" : `/otaku-tv?tab=${tab}`,
    noindex: Boolean(d?.q) || (d?.list?.page ?? 1) > 1,
  });
}

export default function OtakuTv({ loaderData }: Route.ComponentProps) {
  const { tab, q, selected, list, label } = loaderData;
  const tabHref = (t: Tab) => (t === "materias" ? "/otaku-tv" : `/otaku-tv?tab=${t}`);
  const cardHref = (id: string) => `/otaku-tv?${new URLSearchParams({ ...(tab !== "materias" ? { tab } : {}), v: id }).toString()}`;
  return (
    <>
      <PageHeader label="Otaku TV" title="Trailers e vídeos fresquinhos" intro="Os vídeos que aparecem nas nossas matérias, os trailers da temporada e as aberturas e encerramentos dos animes.">
        <nav aria-label="Seções da Otaku TV" className="mt-7 flex flex-wrap gap-2">
          {TABS.map(({ value, label: l, icon: Icon }) => (
            <Link
              key={value}
              to={tabHref(value)}
              aria-current={value === tab ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.88rem] font-semibold ${value === tab ? "bg-white text-night" : "bg-white/12 text-white hover:bg-white/20"}`}
            >
              <Icon className="size-4" aria-hidden />
              {l}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="mx-auto flex max-w-[1328px] flex-col gap-10 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        {selected && tab !== "musicas" && (
          <section aria-labelledby="player" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <YoutubePlayer video={selected} autoplay />
            <div className="flex flex-col gap-3">
              <p className="text-[0.8rem] font-bold text-brand">{selected.subtitle}</p>
              <h2 id="player" className="text-[1.4rem] leading-tight font-extrabold">
                {selected.title}
              </h2>
              {selected.excerpt && <p className="line-clamp-4 text-ink-soft">{selected.excerpt}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.postUrl && (
                  <Link to={selected.postUrl} className="rounded-[9px] bg-brand px-4 py-2.5 text-[0.9rem] font-bold text-brand-ink hover:brightness-110">
                    Ler a matéria
                  </Link>
                )}
                {selected.animeUrl && (
                  <Link to={selected.animeUrl} className="rounded-[9px] border border-line bg-surface px-4 py-2.5 text-[0.9rem] font-semibold hover:bg-sunken">
                    Ver o anime
                  </Link>
                )}
              </div>
              {list && list.items.filter((v) => v.id !== selected.id).length > 0 && (
                <div className="mt-4">
                  <SideCard title="A seguir">
                    <ul className="flex flex-col gap-3">
                      {list.items
                        .filter((v) => v.id !== selected.id)
                        .slice(0, 5)
                        .map((v) => (
                          <li key={v.id}>
                            <Link to={cardHref(v.id)} className="-m-1.5 flex items-center gap-3 rounded-[10px] p-1.5 hover:bg-sunken">
                              <img src={ytThumb(v.id)} alt="" loading="lazy" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
                              <span className="min-w-0">
                                <span className="line-clamp-2 block text-[0.88rem] leading-snug font-semibold">{v.title}</span>
                                <span className="mt-0.5 block text-[0.78rem] text-ink-soft">{v.subtitle}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </SideCard>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "musicas" ? (
          <ThemesTab />
        ) : (
          <section aria-labelledby="lista" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="lista" className="text-[1.6rem] font-extrabold tracking-[-0.025em]">
                {tab === "trailers" ? `Trailers de ${label}` : q ? `Vídeos sobre “${q}”` : "Vídeos das matérias"}
              </h2>
              <Form method="get" role="search" className="relative w-full sm:w-72">
                {tab !== "materias" && <input type="hidden" name="tab" value={tab} />}
                <label>
                  <span className="sr-only">{tab === "trailers" ? "Filtrar trailers" : "Buscar nas matérias"}</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                  <input
                    type="search"
                    name="q"
                    defaultValue={q}
                    placeholder={tab === "trailers" ? "Filtrar trailers" : "Buscar nas matérias"}
                    className="h-11 w-full rounded-[10px] border border-line bg-surface pr-4 pl-10 focus:border-ink-soft focus:outline-none"
                  />
                </label>
              </Form>
            </div>
            {list && list.items.length > 0 ? (
              <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {list.items.map((video) => (
                  <VideoCard key={video.id} video={video} href={cardHref(video.id)} />
                ))}
              </div>
            ) : (
              <p className="text-ink-soft">{q ? `Nenhum vídeo encontrado para “${q}”.` : "Ainda não há vídeos aqui."}</p>
            )}
            {list && <Pagination page={list.page} pages={list.pages} basePath="/otaku-tv" query={{ ...(tab !== "materias" ? { tab } : {}), ...(q ? { q } : {}) }} />}
          </section>
        )}
      </div>
    </>
  );
}
