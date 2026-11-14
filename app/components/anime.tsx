// Peças de anime: pôster, cartão de episódio (calendário / no ar hoje) e o Top 10 com números vazados.
import { Link } from "react-router";
import { FORMAT_PT, airTime, genrePt } from "~/lib/anime";
import type { AiringItem, AnimeCard } from "~/server/anime/anime.server";

function Cover({ src, color, className }: { src: string | null; color: string | null; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" decoding="async" className={`${className} object-cover`} style={{ backgroundColor: color ?? undefined }} />
  ) : (
    <div className={`${className} bg-[linear-gradient(160deg,#2a1311,#0d0d10)]`} aria-hidden />
  );
}

/** Pôster com título e detalhes curtos (grades de temporada, busca). */
export function AnimePoster({ anime, detail }: { anime: AnimeCard; detail?: string }) {
  const meta = detail ?? [anime.format ? FORMAT_PT[anime.format] ?? anime.format : null, anime.genres[0] ? genrePt(anime.genres[0]) : null].filter(Boolean).join(" · ");
  return (
    <article className="group relative flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl shadow-[0_10px_22px_rgba(60,20,20,.16)]">
        <Cover src={anime.cover} color={anime.color} className="aspect-[2/3] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {anime.score != null && (
          <span className="absolute top-2 right-2 rounded-md bg-night/80 px-1.5 py-1 text-[0.7rem] font-bold text-white">{anime.score}%</span>
        )}
      </div>
      <h3 className="text-[0.88rem] leading-snug font-semibold">
        <Link to={anime.url} className="line-clamp-2 after:absolute after:inset-0 hover:underline">
          {anime.title}
        </Link>
      </h3>
      {meta && <p className="text-[0.75rem] text-ink-soft">{meta}</p>}
    </article>
  );
}

/** Episódio com horário (No ar hoje, calendário). */
export function AiringPoster({ item }: { item: AiringItem }) {
  return (
    <article className="group relative flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl shadow-[0_10px_22px_rgba(60,20,20,.16)]">
        <Cover src={item.anime.cover} color={item.anime.color} className="aspect-[2/3] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.85),rgba(0,0,0,0))] px-2.5 pt-7 pb-2 text-[0.72rem] font-bold text-white">
          {airTime(item.airingAt)} · Ep. {item.episode}
        </span>
      </div>
      <h3 className="text-[0.85rem] leading-snug font-semibold">
        <Link to={item.anime.url} className="line-clamp-2 after:absolute after:inset-0 hover:underline">
          {item.anime.title}
        </Link>
      </h3>
    </article>
  );
}

/** Top 10: números gigantes vazados atrás dos pôsteres (rola na horizontal no celular). */
export function TopTen({ items }: { items: AnimeCard[] }) {
  return (
    <ol className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14">
      {items.map((a, i) => (
        <li key={a.id} className="group relative flex shrink-0 snap-start items-end">
          <span
            aria-hidden
            className="mr-[-14px] text-[150px] leading-[.78] font-extrabold tracking-[-0.07em] text-paper [-webkit-text-stroke:2px_color-mix(in_oklab,var(--ink)_32%,transparent)] select-none sm:text-[168px]"
          >
            {i + 1}
          </span>
          <Link to={a.url} className="relative block w-[124px] sm:w-[140px]" aria-label={`${i + 1}º lugar: ${a.title}`}>
            <Cover src={a.cover} color={a.color} className="aspect-[2/3] w-full rounded-[10px] shadow-[0_14px_28px_rgba(60,20,20,.25)] transition-transform group-hover:-translate-y-1" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function PosterGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">{children}</div>;
}
