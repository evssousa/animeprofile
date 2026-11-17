// Peças da Otaku TV (docs/plano-otaku-tv.md): palco escuro com player e fila "A seguir", cartões, fileiras e o hook das
// aberturas e encerramentos (AnimeThemes, carregado no navegador). Nada daqui usa cookie nem conta.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Form, Link } from "react-router";
import { AudioLines, Check, ChevronLeft, ChevronRight, ExternalLink, Eye, Gamepad2, Link2, MessageCircle, MonitorPlay, Play, Popcorn, Search, Smartphone, Ticket, Tv, X, type LucideIcon } from "lucide-react";
import { currentSeason, SEASON_PT } from "~/lib/anime";
import { formatDate } from "~/lib/format";
import { fetchSeasonThemes, searchThemes, type ThemeItem } from "~/lib/themes";
import type { ShelfIcon } from "~/lib/tv";
import type { TvVideo } from "~/server/tv/tv.server";

export const ytThumb = (id: string, size: "mq" | "hq" = "hq") => `https://i.ytimg.com/vi/${id}/${size}default.jpg`;

/** Um item tocável: vídeo do YouTube (`src` = id) ou .webm das aberturas e encerramentos (`src` = endereço). */
export type TvItem = {
  key: string;
  kind: "youtube" | "file";
  src: string;
  title: string;
  subtitle: string;
  badge: string;
  thumb: string;
  date: string | null;
  excerpt: string | null;
  postUrl: string | null;
  animeUrl: string | null;
};

export const fromVideo = (v: TvVideo): TvItem => ({
  key: `yt:${v.id}`,
  kind: "youtube",
  src: v.id,
  title: v.title,
  subtitle: v.subtitle,
  badge: v.badge,
  thumb: ytThumb(v.id),
  date: v.date,
  excerpt: v.excerpt,
  postUrl: v.postUrl,
  animeUrl: v.animeUrl,
});

export const fromTheme = (t: ThemeItem): TvItem => ({
  key: t.key,
  kind: "file",
  src: t.src,
  title: t.title,
  subtitle: t.subtitle,
  badge: t.type === "OP" ? "Abertura" : "Encerramento",
  thumb: t.thumb,
  date: null,
  excerpt: null,
  postUrl: null,
  animeUrl: t.anilistId ? `/animes/${t.anilistId}` : null,
});

const thumbOf = (item: TvItem, size: "mq" | "hq") => (item.kind === "youtube" ? ytThumb(item.src, size) : item.thumb);
const metaOf = (item: TvItem) => (item.date ? `${item.badge} · ${formatDate(item.date)}` : item.subtitle);

/* ---------- palco ---------- */

/** O palco escuro do topo (modo cinema): cabeçalho, abas, player e fila. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="otaku-tv-titulo" className="relative overflow-hidden rounded-b-3xl bg-night text-night-ink shadow-[0_24px_50px_rgba(60,20,20,.16)] sm:rounded-b-[28px]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(620px_320px_at_85%_0%,rgba(194,53,43,.38),rgba(13,13,16,0)_70%)]" />
      <div className="relative mx-auto max-w-[1600px] px-4 pt-5 pb-7 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10">{children}</div>
    </section>
  );
}

/** Rótulo, título e o campo de busca (à direita em telas largas). */
export function StageHead({ search }: { search: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="inline-flex items-center gap-1.5 text-[0.82rem] font-bold text-glow">
          <MonitorPlay className="size-3.5" aria-hidden /> Otaku TV
        </p>
        <h1 id="otaku-tv-titulo" className="mt-1 text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2rem]">
          Vídeos de anime
        </h1>
      </div>
      {search}
    </div>
  );
}

const searchBox = "h-11 w-full rounded-full border border-white/10 bg-white/10 pr-10 pl-10 text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none";

/** Busca por formulário (aba das matérias e dos trailers): recarrega a lista com `?q=`. */
export function SearchForm({ tab, q, placeholder }: { tab: string; q: string; placeholder: string }) {
  const clear = tab === "materias" ? "/otaku-tv" : `/otaku-tv?tab=${tab}`;
  return (
    <Form method="get" role="search" className="relative w-full sm:w-80">
      {tab !== "materias" && <input type="hidden" name="tab" value={tab} />}
      <label>
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/60" aria-hidden />
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} className={searchBox} />
      </label>
      {q && (
        <Link to={clear} aria-label="Limpar busca" className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-white/70 hover:bg-white/10">
          <X className="size-4" aria-hidden />
        </Link>
      )}
    </Form>
  );
}

/** Busca sem formulário (aba das músicas): o texto vai direto para o hook `useThemes`. */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative w-full sm:w-80">
      <label>
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/60" aria-hidden />
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={searchBox} />
      </label>
    </form>
  );
}

/** As 3 abas em pílula; rolam para o lado no celular. `extra` entra ao lado (o seletor das músicas). */
export function Tabs({ tabs, current, extra }: { tabs: { value: string; label: string; href: string; icon: LucideIcon }[]; current: string; extra?: ReactNode }) {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Seções da Otaku TV" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ value, label, href, icon: Icon }) => (
          <Link
            key={value}
            to={href}
            aria-current={value === current ? "page" : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[0.88rem] font-semibold ${value === current ? "bg-white text-night" : "bg-white/12 text-white hover:bg-white/20"}`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      {extra}
    </div>
  );
}

/* ---------- player ---------- */

/** Player 16:9. O iframe do YouTube (sem cookies) e o <video> só existem depois do clique: a página abre leve. */
export function Player({ item, playing, onPlay }: { item: TvItem; playing: boolean; onPlay: () => void }) {
  return (
    <div id="player" className="relative -mx-4 aspect-video scroll-mt-[84px] overflow-hidden bg-black sm:mx-0 sm:rounded-2xl sm:shadow-[0_30px_60px_rgba(0,0,0,.45)] sm:ring-1 sm:ring-white/10">
      {playing && item.kind === "youtube" ? (
        <iframe
          key={item.key}
          src={`https://www.youtube-nocookie.com/embed/${item.src}?rel=0&modestbranding=1&playsinline=1&autoplay=1`}
          title={item.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : playing ? (
        <video key={item.key} src={item.src} controls autoPlay playsInline preload="none" poster={item.thumb || undefined} className="absolute inset-0 size-full bg-black object-contain" />
      ) : (
        <button type="button" onClick={onPlay} aria-label={`Assistir: ${item.title}`} className="group absolute inset-0">
          {item.kind === "file" && item.thumb && <img src={item.thumb} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-md" />}
          <img
            src={thumbOf(item, "hq")}
            alt=""
            fetchPriority="high"
            width={480}
            height={360}
            className={`absolute inset-0 size-full ${item.kind === "file" ? "object-contain" : "object-cover"}`}
          />
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.55),transparent_55%)]" />
          <span className="absolute top-3 left-3 rounded-md bg-black/70 px-2 py-1 text-[0.72rem] font-bold text-white">{item.badge}</span>
          <span className="absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-brand-ink shadow-[0_10px_30px_rgba(194,53,43,.5)] motion-safe:transition-transform group-hover:scale-[1.06] group-focus-visible:scale-[1.06]">
            <Play className="ml-1 size-8 fill-current" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}

/** Página do player sem vídeo (lista vazia, busca sem resultado): o lugar do player com uma frase e uma ação. */
export function EmptyStage({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="mt-5 grid aspect-video place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[.03] p-6 text-center">
      <div>
        <MonitorPlay className="mx-auto size-10 text-white/40" aria-hidden />
        <p className="mt-3 font-semibold">{text}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/** Esqueleto da aba das músicas, enquanto o AnimeThemes responde. */
export function PlayerSkeleton({ text }: { text: string }) {
  return (
    <div className="mt-5">
      <div className="aspect-video rounded-2xl bg-white/5 motion-safe:animate-pulse" />
      <div className="mt-4 space-y-2">
        {[48, 70, 30].map((w) => (
          <div key={w} className="h-3 rounded bg-white/10 motion-safe:animate-pulse" style={{ width: `${w}%` }} />
        ))}
      </div>
      <p className="mt-4 text-[0.9rem] text-white/60">{text}</p>
    </div>
  );
}

const btnSecondary = "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] bg-white/10 px-3 font-semibold text-white hover:bg-white/[.18]";

/** Título, resumo e botões do vídeo. `shareUrl`: o endereço para copiar/compartilhar (sem ele, esses dois botões somem). */
export function Info({ item, shareUrl }: { item: TvItem; shareUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [item.key]);
  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão da área de transferência: o botão do WhatsApp continua */
    }
  };
  const primary = item.postUrl ? { to: item.postUrl, label: "Ler a matéria", icon: Tv } : item.animeUrl ? { to: item.animeUrl, label: "Ver o anime", icon: Tv } : null;
  return (
    <div className="mt-4">
      <p className="text-[0.8rem] font-bold tracking-[0.08em] text-glow uppercase">{metaOf(item)}</p>
      <h2 className="mt-1.5 line-clamp-3 text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-[1.5rem]">{item.title}</h2>
      {item.excerpt && <p className="mt-2 line-clamp-2 max-w-[70ch] text-white/70">{item.excerpt}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {primary && (
          <Link to={primary.to} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-brand px-4 font-bold text-brand-ink hover:brightness-110 sm:w-auto">
            <primary.icon className="size-4" aria-hidden />
            {primary.label}
          </Link>
        )}
        {item.postUrl && item.animeUrl && (
          <Link to={item.animeUrl} className={btnSecondary} aria-label="Ver o anime" title="Ver o anime">
            <Tv className="size-4" aria-hidden />
            <span className="hidden sm:inline">Ver o anime</span>
          </Link>
        )}
        {item.kind === "youtube" && (
          <a href={`https://www.youtube.com/watch?v=${item.src}`} target="_blank" rel="noreferrer" className={btnSecondary} aria-label="Ver no YouTube" title="Ver no YouTube">
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">YouTube</span>
          </a>
        )}
        {shareUrl && (
          <>
            <button type="button" onClick={copy} className={btnSecondary} aria-label="Copiar link" title="Copiar link">
              {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              <span className="hidden sm:inline">{copied ? "Link copiado" : "Copiar link"}</span>
              <span className="sr-only" aria-live="polite">
                {copied ? "Link copiado" : ""}
              </span>
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${item.title} ${shareUrl}`)}`} target="_blank" rel="noreferrer" className={btnSecondary} aria-label="Compartilhar no WhatsApp" title="WhatsApp">
              <MessageCircle className="size-4" aria-hidden />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- fila "A seguir" ---------- */

function QueueItem({ item, href, onPick }: { item: TvItem; href: string | null; onPick: (i: TvItem) => void }) {
  const inner = (
    <>
      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-white/5 sm:w-[148px]">
        {thumbOf(item, "mq") && <img src={thumbOf(item, "mq")} alt="" loading="lazy" width={320} height={180} className={`size-full ${item.kind === "file" ? "object-contain" : "object-cover"}`} />}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block text-[0.88rem] leading-snug font-semibold group-hover:text-glow">{item.title}</span>
        <span className="mt-0.5 block text-[0.75rem] text-white/55">{metaOf(item)}</span>
      </span>
    </>
  );
  const cls = "group flex w-full gap-3 rounded-xl p-2 text-left hover:bg-white/8";
  return href ? (
    <Link to={href} preventScrollReset onClick={() => onPick(item)} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={() => onPick(item)} className={cls}>
      {inner}
    </button>
  );
}

/** "A seguir". `side`: ao lado do player (≥ 1280 px), com a altura do player e rolagem por dentro. `below`: 3 itens embaixo. */
export function UpNext({ items, variant, hrefFor, onPick }: { items: TvItem[]; variant: "side" | "below"; hrefFor: ((i: TvItem) => string) | null; onPick: (i: TvItem) => void }) {
  if (items.length === 0) return null;
  const head = (
    <div className="flex items-baseline justify-between">
      <h2 className="text-[0.78rem] font-bold tracking-[0.14em] text-white/60 uppercase">A seguir</h2>
      {variant === "below" && (
        <a href="#lista" className="text-[0.85rem] font-bold text-glow hover:underline">
          Ver todos
        </a>
      )}
    </div>
  );
  if (variant === "side")
    return (
      <div className="absolute inset-0 flex flex-col">
        {head}
        <ol className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {items.map((i) => (
            <li key={i.key}>
              <QueueItem item={i} href={hrefFor ? hrefFor(i) : null} onPick={onPick} />
            </li>
          ))}
        </ol>
        <div aria-hidden className="pointer-events-none -mt-8 h-8 bg-gradient-to-t from-night" />
      </div>
    );
  return (
    <div className="mt-6">
      {head}
      <ol className="mt-2 space-y-1 md:grid md:grid-cols-3 md:gap-3 md:space-y-0">
        {items.slice(0, 3).map((i) => (
          <li key={i.key}>
            <QueueItem item={i} href={hrefFor ? hrefFor(i) : null} onPick={onPick} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- grade e fileiras (área clara) ---------- */

/** Cartão de vídeo. `cover`: capa em pé (aberturas e encerramentos). `active`: é o que está no player. */
export function VideoCard({ item, href, onPick, active, cover, compact }: { item: TvItem; href: string | null; onPick: (i: TvItem) => void; active: boolean; cover?: boolean; compact?: boolean }) {
  const body = (
    <>
      <span className={`relative block overflow-hidden rounded-xl bg-sunken ${cover ? "aspect-[3/4]" : "aspect-video"} ${active ? "ring-2 ring-brand ring-offset-2 ring-offset-paper" : ""}`}>
        {thumbOf(item, "mq") && (
          <img
            src={thumbOf(item, "mq")}
            srcSet={item.kind === "youtube" ? `${ytThumb(item.src, "mq")} 320w, ${ytThumb(item.src, "hq")} 480w` : undefined}
            sizes="(min-width:1280px) 280px, (min-width:768px) 33vw, 50vw"
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={cover ? 427 : 180}
            className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]"
          />
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-bold ${active ? "bg-brand text-brand-ink" : "bg-night/80 text-white"}`}>
          {active && <AudioLines className="size-3" aria-hidden />}
          {active ? "Tocando" : item.badge}
        </span>
        <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/25">
          <span className="grid size-11 place-items-center rounded-full bg-white/95 text-night opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            <Play className="ml-0.5 size-5 fill-current" aria-hidden />
          </span>
        </span>
      </span>
      <span className="mt-2.5 line-clamp-2 block text-[0.92rem] leading-snug font-bold group-hover:text-brand sm:text-[0.95rem] dark:group-hover:text-glow">{item.title}</span>
      <span className="mt-0.5 block text-[0.78rem] text-ink-soft">{metaOf(item)}</span>
    </>
  );
  const cls = `group block rounded-xl text-left focus-visible:outline-offset-4 ${compact ? "w-[72%] shrink-0 snap-start sm:w-[260px]" : ""}`;
  return href ? (
    <Link to={href} preventScrollReset onClick={() => onPick(item)} aria-current={active ? "true" : undefined} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={() => onPick(item)} aria-current={active ? "true" : undefined} className={cls}>
      {body}
    </button>
  );
}

const SHELF_ICONS: Record<ShelfIcon, LucideIcon> = { games: Gamepad2, filmes: Popcorn, eventos: Ticket, apps: Smartphone, outros: Eye };

/** Fileira "Veja também": vídeos de outras categorias, numa faixa que rola para o lado. */
export function Shelf({
  id,
  icon,
  title,
  tagline,
  moreHref,
  moreLabel,
  items,
  hrefFor,
  onPick,
  activeKey,
}: {
  id: string;
  icon: ShelfIcon;
  title: string;
  tagline: string;
  moreHref: string;
  moreLabel: string;
  items: TvItem[];
  hrefFor: (i: TvItem) => string;
  onPick: (i: TvItem) => void;
  activeKey: string | null;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const Icon = SHELF_ICONS[icon];
  const scroll = (dir: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: calm ? "auto" : "smooth" });
  };
  const arrow = "hidden size-9 place-items-center rounded-full border border-line bg-surface hover:bg-sunken md:grid";
  return (
    <section aria-labelledby={id} className="rounded-[22px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand dark:text-glow">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id={id} className="text-[1.15rem] font-extrabold">
              {title}
            </h3>
            <p className="text-[0.85rem] text-ink-soft">{tagline}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to={moreHref} className="text-[0.85rem] font-bold text-link hover:underline">
            {moreLabel} →
          </Link>
          <button type="button" onClick={() => scroll(-1)} className={arrow} aria-label="Anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => scroll(1)} className={arrow} aria-label="Próximo">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div ref={strip} className="mt-4 -mx-5 flex snap-x snap-mandatory scroll-pl-5 gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 sm:scroll-pl-6 [&::-webkit-scrollbar]:hidden">
        {items.map((i) => (
          <VideoCard key={i.key} item={i} href={hrefFor(i)} onPick={onPick} active={i.key === activeKey} compact />
        ))}
      </div>
    </section>
  );
}

/* ---------- aberturas e encerramentos (AnimeThemes, no navegador) ---------- */

type Load = { state: "loading" } | { state: "error" } | { state: "ok"; items: ThemeItem[]; hasMore: boolean };

/** Estado da aba das músicas: busca (450 ms de espera), "Carregar mais", "Tentar de novo" e o filtro Abertura/Encerramento. */
export function useThemes() {
  const season = currentSeason();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"ALL" | "OP" | "ED">("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Load>({ state: "loading" });
  const [retry, setRetry] = useState(0);
  const term = q.trim();
  const seen = useRef(new Map<string, ThemeItem>());

  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(
      () => {
        setData((d) => (d.state === "ok" && page > 1 ? d : { state: "loading" }));
        const job = term.length >= 2 ? searchThemes(term, ctl.signal).then((items) => ({ items, hasMore: false })) : fetchSeasonThemes(season.season, season.year, page, ctl.signal);
        job
          .then(({ items, hasMore }) => {
            if (term.length < 2 && page === 1) seen.current.clear();
            const merged = term.length < 2 ? [...seen.current.values()] : [];
            for (const it of items) seen.current.set(it.key, it);
            setData({ state: "ok", items: term.length >= 2 ? items : [...merged.filter((m) => !items.some((i) => i.key === m.key)), ...items], hasMore });
          })
          .catch((e) => e?.name !== "AbortError" && setData({ state: "error" }));
      },
      term.length >= 2 ? 450 : 0,
    );
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [term, page, retry, season.season, season.year]);

  const items = data.state === "ok" ? data.items.filter((i) => type === "ALL" || i.type === type) : [];
  return {
    state: data.state,
    items,
    hasMore: data.state === "ok" && data.hasMore,
    loadMore: () => setPage((p) => p + 1),
    retry: () => setRetry((n) => n + 1),
    q,
    term,
    setQ: (v: string) => {
      setQ(v);
      setPage(1);
    },
    type,
    setType,
    label: `${SEASON_PT[season.season]} ${season.year}`,
  };
}

/** Seletor Tudo / Aberturas / Encerramentos, no palco escuro. */
export function TypeSwitch({ value, onChange }: { value: "ALL" | "OP" | "ED"; onChange: (v: "ALL" | "OP" | "ED") => void }) {
  return (
    <div role="group" aria-label="Tipo de música" className="inline-flex self-start rounded-full bg-white/10 p-1">
      {(["ALL", "OP", "ED"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={value === t}
          onClick={() => onChange(t)}
          className={`h-9 rounded-full px-3.5 text-[0.85rem] font-semibold ${value === t ? "bg-brand text-brand-ink" : "text-white/70 hover:text-white"}`}
        >
          {t === "ALL" ? "Tudo" : t === "OP" ? "Aberturas" : "Encerramentos"}
        </button>
      ))}
    </div>
  );
}
