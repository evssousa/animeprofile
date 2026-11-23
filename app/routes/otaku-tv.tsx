// Otaku TV (/otaku-tv): vídeos de anime num lugar só, com cara de "YouTube" (docs/plano-otaku-tv.md).
// Palco escuro em cima (player + "A seguir"), grade e fileiras "Veja também" embaixo. Abas: das matérias, trailers da
// temporada e aberturas/encerramentos. `/otaku-tv?v=<id do YouTube>` abre o vídeo (parado: só toca depois de um clique).
import { AdSlot } from "~/components/ads/AdSlot";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams, type ShouldRevalidateFunctionArgs } from "react-router";
import { Clapperboard, Music, Newspaper } from "lucide-react";
import type { Route } from "./+types/otaku-tv";
import { EmptyStage, fromTheme, fromVideo, Info, Player, PlayerSkeleton, SearchForm, SearchInput, Shelf, Stage, StageHead, Tabs, TypeSwitch, UpNext, useThemes, VideoCard, ytThumb, type TvItem } from "~/components/otaku-tv";
import { Pagination } from "~/components/posts";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { cardHref, interleaveShelves, shelfCopy, upNext } from "~/lib/tv";
import { findVideo, listAnimeVideos, listShelves, listTrailers, type TvVideo } from "~/server/tv/tv.server";

type Tab = "materias" | "trailers" | "musicas";
const TABS = [
  { value: "materias", label: "Das matérias", href: "/otaku-tv", icon: Newspaper },
  { value: "trailers", label: "Trailers da temporada", href: "/otaku-tv?tab=trailers", icon: Clapperboard },
  { value: "musicas", label: "Aberturas e encerramentos", href: "/otaku-tv?tab=musicas", icon: Music },
];
const ID = /^[A-Za-z0-9_-]{11}$/;

export function links() {
  return [{ rel: "preconnect", href: "https://i.ytimg.com" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("tab");
  const tab: Tab = raw === "trailers" || raw === "musicas" ? raw : "materias";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const v = url.searchParams.get("v") ?? "";

  const list = tab === "materias" ? await listAnimeVideos(q, page) : tab === "trailers" ? await listTrailers(q, page) : null;
  const shelves = tab === "materias" && page === 1 && !q ? await listShelves(12) : [];

  // O vídeo do link: o que está na lista ou nas fileiras; senão a matéria/trailer que o tem; senão um genérico (tocável).
  let selected: TvVideo | null = null;
  if (tab !== "musicas" && ID.test(v)) {
    selected = [...(list?.items ?? []), ...shelves.flatMap((s) => s.items)].find((x) => x.id === v) ?? (await findVideo(v));
    selected ??= { id: v, title: "Vídeo da Otaku TV", subtitle: "Otaku TV", badge: "Vídeo", date: null, excerpt: null, postUrl: null, animeId: null, animeUrl: null };
  }
  return { tab, q, list, shelves, selected, label: list && "label" in list ? list.label : null };
}

/** Trocar só o vídeo (`v`) não refaz a lista: o clique no cartão é instantâneo e a lista não pisca. */
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const a = new URLSearchParams(currentUrl.search);
  const b = new URLSearchParams(nextUrl.search);
  a.delete("v");
  b.delete("v");
  return currentUrl.pathname === nextUrl.pathname && a.toString() === b.toString() ? false : defaultShouldRevalidate;
}

export function meta({ loaderData: d, location }: Route.MetaArgs) {
  const tab = d?.tab ?? "materias";
  const titles: Record<Tab, string> = { materias: "Otaku TV: vídeos e trailers de anime", trailers: "Trailers de anime da temporada", musicas: "Aberturas e encerramentos de anime" };
  const v = new URLSearchParams(location.search).get("v");
  const pool: TvVideo[] = d ? [...(d.list?.items ?? []), ...d.shelves.flatMap((s) => s.items), ...(d.selected ? [d.selected] : [])] : [];
  const current = v ? pool.find((x) => x.id === v) : null;
  const first = d?.list?.items[0];
  const path = tab === "materias" ? "/otaku-tv" : `/otaku-tv?tab=${tab}`;
  const itemList = (d?.list?.items ?? []).slice(0, 20).flatMap((x, i) => {
    const target = tab === "trailers" ? x.animeUrl : x.postUrl;
    return target ? [{ "@type": "ListItem", position: i + 1, url: absoluteUrl(target), name: x.title }] : [];
  });
  return seo({
    title: current ? `${current.title} · Otaku TV` : titles[tab],
    description: current?.excerpt || "Trailers, vídeos das matérias e aberturas e encerramentos dos animes, num lugar só.",
    path,
    image: current ? ytThumb(current.id) : first ? ytThumb(first.id) : null,
    noindex: Boolean(d?.q) || (d?.list?.page ?? 1) > 1,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: "Otaku TV", url: absoluteUrl(path), inLanguage: "pt-BR", ...(itemList.length ? { mainEntity: { "@type": "ItemList", itemListElement: itemList } } : {}) },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Otaku TV", item: absoluteUrl("/otaku-tv") },
          ],
        },
      ],
    },
  });
}

/** Quando a troca de vídeo veio de um clique nesta visita, rola até o player se ele estiver fora da tela. */
function useScrollToPlayer(trigger: string | null) {
  useEffect(() => {
    if (!trigger) return;
    const el = document.getElementById("player");
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [trigger]);
}

/** Vindo da home (`state.play`), o vídeo já toca; link aberto de fora ou recarregado mostra o pôster parado. */
function useArrivedToPlay() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [arrived] = useState(() => Boolean((loc.state as { play?: boolean } | null)?.play));
  useEffect(() => {
    if (arrived) navigate(`${loc.pathname}${loc.search}`, { replace: true, state: null, preventScrollReset: true });
    // só na primeira vez: limpa o `state` para o recarregar não tocar sozinho
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return arrived;
}

export default function OtakuTv({ loaderData }: Route.ComponentProps) {
  return loaderData.tab === "musicas" ? <MusicPage /> : <VideoPage data={loaderData} />;
}

function VideoPage({ data }: { data: Route.ComponentProps["loaderData"] }) {
  const { tab, q, list, shelves, selected, label } = data;
  const [params] = useSearchParams();
  const v = params.get("v");
  const arrived = useArrivedToPlay();

  const items = (list?.items ?? []).map(fromVideo);
  const shelfItems = shelves.map((s) => ({ ...s, items: s.items.map(fromVideo) }));
  const pool = [...items, ...shelfItems.flatMap((s) => s.items)];
  const initial = selected ? fromVideo(selected) : null;
  const current: TvItem | null = v ? (pool.find((i) => i.src === v) ?? (initial && initial.src === v ? initial : null)) : (items[0] ?? null);
  const [playId, setPlayId] = useState<string | null>(() => (arrived ? (current?.key ?? null) : null));
  useScrollToPlayer(playId);

  const page = list?.page ?? 1;
  const hrefFor = (i: TvItem) => cardHref({ tab, q, pagina: page }, i.src);
  const onPick = (i: TvItem) => setPlayId(i.key);

  const shelf = current ? shelfItems.find((s) => s.items.some((i) => i.key === current.key)) : undefined;
  const source = shelf ? [...shelf.items.slice(shelf.items.findIndex((i) => i.key === current!.key) + 1), ...items] : items;
  const queue = current ? upNext(source, shelf ? null : current.key, 12).filter((i) => i.key !== current.key) : [];

  const title = tab === "trailers" ? `Trailers de ${label}` : q ? `Vídeos sobre “${q}”` : "Vídeos das matérias";
  const placeholder = tab === "trailers" ? "Filtrar trailers" : "Buscar nas matérias";
  const blocks = interleaveShelves(items, shelfItems, 12);
  const emptyText = q ? `Nenhum vídeo encontrado para “${q}”.` : tab === "trailers" ? `Os trailers de ${label} ainda não chegaram.` : "Nenhum vídeo por aqui ainda.";

  return (
    <>
      <Stage>
        <StageHead search={<SearchForm tab={tab} q={q} placeholder={placeholder} />} />
        <Tabs tabs={TABS} current={tab} />
        {current ? (
          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <Player item={current} playing={playId === current.key} onPlay={() => setPlayId(current.key)} />
              <Info item={current} shareUrl={absoluteUrl(cardHref({ tab }, current.src))} />
              <div className="xl:hidden">
                <UpNext items={queue} variant="below" hrefFor={hrefFor} onPick={onPick} />
              </div>
            </div>
            <aside aria-label="A seguir" className="relative hidden xl:block">
              <UpNext items={queue} variant="side" hrefFor={hrefFor} onPick={onPick} />
            </aside>
          </div>
        ) : (
          <EmptyStage
            text={emptyText}
            action={
              q ? (
                <Link to={tab === "materias" ? "/otaku-tv" : `/otaku-tv?tab=${tab}`} className="inline-flex h-11 items-center rounded-[10px] bg-white/10 px-4 font-semibold hover:bg-white/[.18]">
                  Limpar busca
                </Link>
              ) : (
                <Link to={tab === "trailers" ? "/otaku-tv" : "/otaku-tv?tab=trailers"} className="inline-flex h-11 items-center rounded-[10px] bg-brand px-4 font-bold text-brand-ink hover:brightness-110">
                  {tab === "trailers" ? "Ver os vídeos das matérias" : "Ver os trailers da temporada"}
                </Link>
              )
            }
          />
        )}
      </Stage>

      {items.length > 0 && (
        <div className="mx-auto max-w-[1328px] px-4 py-8 sm:px-8 lg:px-14 lg:py-10">
          <div className="flex items-end justify-between gap-4">
            <h2 id="lista" className="scroll-mt-24 text-[1.35rem] font-extrabold tracking-[-0.025em] sm:text-[1.6rem]">
              {title}
            </h2>
            {list && <span className="text-[0.9rem] text-ink-soft">{list.total} vídeos</span>}
          </div>
          <div className="mt-6 flex flex-col gap-8">
            {blocks.map((b, bi) =>
              b.kind === "grid" ? (
                <div key={`g${bi}`} className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-4">
                  {b.items.map((it) => (
                    <VideoCard key={it.key} item={it} href={hrefFor(it)} onPick={onPick} active={current?.key === it.key} />
                  ))}
                </div>
              ) : (
                <ShelfBlock key={b.shelf.slug} shelf={b.shelf} hrefFor={hrefFor} onPick={onPick} activeKey={current?.key ?? null} />
              ),
            )}
          </div>
          <AdSlot slot="list" className="mt-8" />
          <div className="mt-10">{list && <Pagination page={list.page} pages={list.pages} basePath="/otaku-tv" query={{ ...(tab !== "materias" ? { tab } : {}), ...(q ? { q } : {}) }} />}</div>
        </div>
      )}
    </>
  );
}

function ShelfBlock({ shelf, hrefFor, onPick, activeKey }: { shelf: { slug: string; name: string; items: TvItem[] }; hrefFor: (i: TvItem) => string; onPick: (i: TvItem) => void; activeKey: string | null }) {
  const copy = shelfCopy(shelf.slug, shelf.name);
  return <Shelf id={`fileira-${shelf.slug}`} icon={copy.icon} title={copy.title} tagline={copy.tagline} moreHref={`/categoria/${shelf.slug}`} moreLabel={`Mais de ${shelf.name}`} items={shelf.items} hrefFor={hrefFor} onPick={onPick} activeKey={activeKey} />;
}

function MusicPage() {
  const t = useThemes();
  const all = t.items.map(fromTheme);
  const [pick, setPick] = useState<string | null>(null);
  const [playId, setPlayId] = useState<string | null>(null);
  const current = all.find((i) => i.key === pick) ?? all[0] ?? null;
  useScrollToPlayer(playId);
  const onPick = (i: TvItem) => {
    setPick(i.key);
    setPlayId(i.key);
  };
  const queue = current ? upNext(all, current.key, 12) : [];

  return (
    <>
      <Stage>
        <StageHead search={<SearchInput value={t.q} onChange={t.setQ} placeholder="Buscar músicas de um anime" />} />
        <Tabs tabs={TABS} current="musicas" extra={<TypeSwitch value={t.type} onChange={t.setType} />} />
        {t.state === "loading" ? (
          <PlayerSkeleton text={`Carregando as músicas de ${t.term.length >= 2 ? `“${t.term}”` : t.label}. Esse serviço é lento: pode levar uns segundos.`} />
        ) : t.state === "error" ? (
          <div className="mt-5 rounded-2xl border border-white/15 bg-white/[.04] p-5">
            <p className="font-semibold">Não consegui carregar as músicas agora.</p>
            <p className="mt-1 text-[0.9rem] text-white/70">O serviço que guarda os vídeos (AnimeThemes) está fora do ar ou lento. Isso não afeta o resto do site.</p>
            <button type="button" onClick={t.retry} className="mt-3 inline-flex h-11 items-center rounded-[10px] bg-brand px-4 font-bold text-brand-ink hover:brightness-110">
              Tentar de novo
            </button>
          </div>
        ) : current ? (
          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <Player item={current} playing={playId === current.key} onPlay={() => setPlayId(current.key)} />
              <Info item={current} shareUrl={null} />
              <div className="xl:hidden">
                <UpNext items={queue} variant="below" hrefFor={null} onPick={onPick} />
              </div>
            </div>
            <aside aria-label="A seguir" className="relative hidden xl:block">
              <UpNext items={queue} variant="side" hrefFor={null} onPick={onPick} />
            </aside>
          </div>
        ) : (
          <EmptyStage text={`Nenhuma música encontrada${t.term ? ` para “${t.term}”` : ""}.`} />
        )}
      </Stage>

      {all.length > 0 && (
        <div className="mx-auto max-w-[1328px] px-4 py-8 sm:px-8 lg:px-14 lg:py-10">
          <h2 id="lista" className="scroll-mt-24 text-[1.35rem] font-extrabold tracking-[-0.025em] sm:text-[1.6rem]">
            {t.term.length >= 2 ? `Músicas de “${t.term}”` : `Aberturas e encerramentos de ${t.label}`}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-5">
            {all.map((it) => (
              <VideoCard key={it.key} item={it} href={null} onPick={onPick} active={current?.key === it.key} cover />
            ))}
          </div>
          <AdSlot slot="list" className="mt-8" />
          {t.hasMore && (
            <div className="mt-10 text-center">
              <button type="button" onClick={t.loadMore} className="rounded-[9px] border border-line bg-surface px-6 py-3 font-semibold hover:bg-sunken">
                Carregar mais
              </button>
            </div>
          )}
          <p className="mt-8 text-center text-[0.85rem] text-ink-soft">
            Fonte:{" "}
            <a href="https://animethemes.moe" target="_blank" rel="noreferrer" className="font-semibold text-link underline">
              AnimeThemes.moe
            </a>
          </p>
        </div>
      )}
    </>
  );
}
