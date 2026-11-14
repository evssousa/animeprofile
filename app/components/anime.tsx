// Peças de anime: pôster, cartão de episódio (calendário / no ar hoje) e o Top 10 com números vazados.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

/**
 * Top 10: números gigantes vazados atrás dos pôsteres. Rola na horizontal sem barra de rolagem: no celular
 * com o dedo, no computador com as setas dos lados (como no site antigo), que somem no começo e no fim.
 */
export function TopTen({ items }: { items: AnimeCard[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: true });
  const update = () => {
    const el = ref.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(update, [items.length]);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-night/85 text-white shadow-lg backdrop-blur hover:bg-night md:grid";
  return (
    <div className="relative">
      <ol
        ref={ref}
        onScroll={update}
        className="-mx-4 flex scroll-pl-4 snap-x gap-5 overflow-x-auto overflow-y-hidden px-4 pt-2 pb-3 [scrollbar-width:none] sm:-mx-8 sm:scroll-pl-8 sm:px-8 lg:-mx-14 lg:scroll-pl-14 lg:px-14 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((a, i) => (
          <li key={a.id} className="group relative flex shrink-0 snap-start items-end">
            {/* O número fica alinhado ao pé da capa: a margem de baixo é a altura das 2 linhas do nome. */}
            <span
              aria-hidden
              className="mr-[-14px] mb-[2.9rem] text-[150px] leading-[.78] font-extrabold tracking-[-0.07em] text-paper [-webkit-text-stroke:2px_color-mix(in_oklab,var(--ink)_32%,transparent)] select-none sm:text-[168px]"
            >
              {i + 1}
            </span>
            <div className="relative flex w-[124px] flex-col gap-2 sm:w-[140px]">
              <Cover src={a.cover} color={a.color} className="aspect-[2/3] w-full rounded-[10px] shadow-[0_14px_28px_rgba(60,20,20,.25)] transition-transform group-hover:-translate-y-1" />
              <Link to={a.url} className="line-clamp-2 h-[2.5rem] text-[0.85rem] leading-[1.25rem] font-semibold after:absolute after:inset-0 hover:underline">
                <span className="sr-only">{i + 1}º lugar: </span>
                {a.title}
              </Link>
            </div>
          </li>
        ))}
        {/* O navegador ignora o espaço da direita numa lista que rola: este item garante que a última capa apareça inteira. */}
        <li aria-hidden className="w-px shrink-0 sm:w-4 lg:w-10" />
      </ol>
      {edges.left && (
        <button type="button" onClick={() => scroll(-1)} className={`${arrow} -left-5`} aria-label="Ver os anteriores do Top 10">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
      )}
      {edges.right && (
        <button type="button" onClick={() => scroll(1)} className={`${arrow} -right-5`} aria-label="Ver os próximos do Top 10">
          <ChevronRight className="size-6" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function PosterGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">{children}</div>;
}
