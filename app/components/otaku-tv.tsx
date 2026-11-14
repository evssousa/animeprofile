// Peças da Otaku TV: player do YouTube, cartão de vídeo e a aba de aberturas e encerramentos (carregada no navegador).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Play } from "lucide-react";
import { currentSeason, SEASON_PT } from "~/lib/anime";
import { formatDate } from "~/lib/format";
import { fetchSeasonThemes, searchThemes, type ThemeItem } from "~/lib/themes";
import type { TvVideo } from "~/server/tv/tv.server";

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Player do YouTube sem cookies. Só carrega o vídeo quando a pessoa clica (a página abre leve). */
export function YoutubePlayer({ video, autoplay }: { video: Pick<TvVideo, "id" | "title">; autoplay: boolean }) {
  const [playing, setPlaying] = useState(autoplay);
  useEffect(() => setPlaying(autoplay), [video.id, autoplay]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-[18px] bg-night shadow-[0_20px_40px_rgba(60,20,20,.16)]">
      {playing ? (
        <iframe
          key={video.id}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1&autoplay=1`}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label={`Assistir: ${video.title}`}>
          <img src={ytThumb(video.id)} alt="" className="size-full object-cover opacity-85" />
          <PlayBadge />
        </button>
      )}
    </div>
  );
}

function PlayBadge() {
  return (
    <span className="absolute top-1/2 left-1/2 grid size-[68px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-night shadow-lg transition-transform group-hover:scale-105">
      <Play className="ml-1 size-7 fill-current" aria-hidden />
    </span>
  );
}

/** Cartão de vídeo: miniatura com o botão de play, selo, título e origem. O clique abre o vídeo no player da página. */
export function VideoCard({ video, href }: { video: TvVideo; href: string }) {
  return (
    <article className="group relative flex flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-xl bg-night shadow-[0_10px_22px_rgba(60,20,20,.16)]">
        <img src={ytThumb(video.id)} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/25">
          <span className="grid size-12 place-items-center rounded-full bg-white/95 text-night shadow-md">
            <Play className="ml-0.5 size-5 fill-current" aria-hidden />
          </span>
        </span>
        <span className="absolute top-2 left-2 rounded-md bg-night/80 px-2 py-1 text-[0.7rem] font-bold text-white">{video.badge}</span>
      </div>
      <h3 className="text-[0.95rem] leading-snug font-bold">
        <Link to={href} className="line-clamp-2 after:absolute after:inset-0 hover:underline" preventScrollReset={false}>
          {video.title}
        </Link>
      </h3>
      <p className="text-[0.8rem] text-ink-soft">{[video.subtitle, video.date ? formatDate(video.date) : null].filter(Boolean).join(" · ")}</p>
    </article>
  );
}

type Load = { state: "loading" } | { state: "error" } | { state: "ok"; items: ThemeItem[]; hasMore: boolean };

/** Aberturas e encerramentos da temporada atual, com busca por anime. Tudo no navegador. */
export function ThemesTab() {
  const season = currentSeason();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"ALL" | "OP" | "ED">("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Load>({ state: "loading" });
  const [current, setCurrent] = useState<ThemeItem | null>(null);
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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex-1 basis-64">
          <span className="sr-only">Buscar músicas de um anime</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar músicas de um anime"
            className="h-11 w-full rounded-[10px] border border-line bg-surface px-4 focus:border-ink-soft focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Tipo de música" className="inline-flex gap-1 rounded-[10px] border border-line bg-surface p-1">
          {(["ALL", "OP", "ED"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`rounded-lg px-3.5 py-1.5 text-[0.85rem] font-semibold ${type === t ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
            >
              {t === "ALL" ? "Tudo" : t === "OP" ? "Aberturas" : "Encerramentos"}
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="rounded-[18px] border border-line bg-surface p-4">
          <video key={current.src} src={current.src} controls autoPlay playsInline className="aspect-video w-full rounded-xl bg-night" />
          <p className="mt-3 font-bold">{current.title}</p>
          <p className="text-[0.85rem] text-ink-soft">
            {current.subtitle}
            {current.anilistId && (
              <>
                {" · "}
                <Link to={`/animes/${current.anilistId}`} className="font-semibold text-link underline">
                  Ver o anime
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {data.state === "loading" && <p className="text-ink-soft">Carregando as músicas de {term.length >= 2 ? `“${term}”` : `${SEASON_PT[season.season]} ${season.year}`}. Esse serviço é lento: pode levar uns segundos.</p>}
      {data.state === "error" && (
        <div className="rounded-[14px] border border-line bg-surface p-5">
          <p className="font-semibold">Não consegui carregar as músicas agora.</p>
          <p className="mt-1 text-[0.9rem] text-ink-soft">O serviço que guarda os vídeos (AnimeThemes) está fora do ar ou lento. Isso não afeta o resto do site.</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-3 rounded-[9px] bg-brand px-4 py-2.5 text-[0.9rem] font-bold text-brand-ink hover:brightness-110">
            Tentar de novo
          </button>
        </div>
      )}
      {data.state === "ok" && items.length === 0 && <p className="text-ink-soft">Nenhuma música encontrada{term ? ` para “${term}”` : ""}.</p>}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => (
            <article key={it.key} className="group relative flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-xl bg-night shadow-[0_10px_22px_rgba(60,20,20,.16)]">
                {it.thumb ? <img src={it.thumb} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" /> : <div className="aspect-[3/4]" />}
                <span className="absolute top-2 left-2 rounded-md bg-night/80 px-2 py-1 text-[0.7rem] font-bold text-white">{it.type === "OP" ? "Abertura" : "Encerramento"}</span>
              </div>
              <h3 className="text-[0.88rem] leading-snug font-bold">
                <button type="button" onClick={() => setCurrent(it)} className="line-clamp-2 text-left after:absolute after:inset-0 hover:underline">
                  {it.title}
                </button>
              </h3>
              <p className="text-[0.78rem] text-ink-soft">{it.subtitle}</p>
            </article>
          ))}
        </div>
      )}
      {data.state === "ok" && data.hasMore && (
        <button type="button" onClick={() => setPage((p) => p + 1)} className="self-center rounded-[9px] border border-line bg-surface px-6 py-3 font-semibold hover:bg-sunken">
          Carregar mais
        </button>
      )}
    </div>
  );
}
