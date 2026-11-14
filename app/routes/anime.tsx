// Ficha do anime: /animes/<id do AniList>, o mesmo endereço do site antigo.
import { useState } from "react";
import { data, Link } from "react-router";
import { Play } from "lucide-react";
import type { Route } from "./+types/anime";
import { PostCard } from "~/components/posts";
import { FORMAT_PT, SEASON_PT, STATUS_PT, STREAMERS, airTime, brDayLabel, genrePt } from "~/lib/anime";
import { formatDateLong } from "~/lib/format";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { getAnime } from "~/server/anime/anime.server";
import { canFetchRemote } from "~/server/anime/remote-guard.server";
import { latestPosts } from "~/server/content/posts.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw data(null, { status: 404 });
  let anime;
  try {
    anime = await getAnime(id, { remote: canFetchRemote(request) });
  } catch {
    throw data(null, { status: 503 });
  }
  if (!anime) throw data(null, { status: 404 });
  const news = await latestPosts({ anilistId: id }, 4);
  return { anime, news };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Anime não encontrado | Anime Profile" }];
  const a = d.anime;
  const desc = a.synopsis ? a.synopsis.replace(/\s+/g, " ").slice(0, 155) : `${a.title}: episódios, onde assistir, personagens e notícias.`;
  return seo({
    title: `${a.title}: onde assistir, episódios e personagens`,
    description: desc,
    path: a.url,
    image: a.banner ?? a.cover,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": a.format === "MOVIE" ? "Movie" : "TVSeries",
      name: a.title,
      alternateName: [a.titleEnglish, a.titleNative].filter(Boolean),
      image: a.cover ?? undefined,
      description: a.synopsis ?? undefined,
      genre: a.genres.map(genrePt),
      startDate: a.startDate ?? undefined,
      numberOfEpisodes: a.episodes ?? undefined,
      url: absoluteUrl(a.url),
      ...(a.score != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: a.score, bestRating: 100, worstRating: 0, ratingCount: Math.max(1, a.popularity) } } : {}),
    },
  });
}

export default function Anime({ loaderData }: Route.ComponentProps) {
  const { anime: a, news } = loaderData;
  const facts = [
    a.format && ["Formato", FORMAT_PT[a.format] ?? a.format],
    a.episodes && ["Episódios", String(a.episodes)],
    a.duration && ["Duração", `${a.duration} min por episódio`],
    a.status && ["Situação", STATUS_PT[a.status] ?? a.status],
    a.season && a.seasonYear && ["Temporada", `${SEASON_PT[a.season]} ${a.seasonYear}`],
    a.startDate && ["Estreia", formatDateLong(`${a.startDate}T12:00:00Z`)],
    a.studios.length > 0 && ["Estúdio", a.studios.join(", ")],
    a.score != null && ["Nota no AniList", `${a.score}%`],
  ].filter(Boolean) as [string, string][];

  return (
    <article>
      <header className="relative overflow-hidden rounded-b-[28px] bg-night text-night-ink shadow-[0_24px_50px_rgba(60,20,20,.16)]">
        {(a.banner || a.cover) && (
          <img
            src={a.banner ?? a.cover!}
            alt=""
            className={`absolute inset-0 size-full object-cover ${a.banner ? "opacity-50" : "scale-110 opacity-40 blur-2xl"}`}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,16,.97)_0%,rgba(13,13,16,.8)_45%,rgba(13,13,16,.35)_100%),linear-gradient(0deg,rgba(13,13,16,.95)_0%,rgba(13,13,16,0)_55%)]" aria-hidden />
        <div className="relative mx-auto flex max-w-[1328px] flex-wrap items-end gap-8 px-4 pt-8 pb-12 sm:px-8 sm:pt-12 lg:px-14">
          {a.cover && <img src={a.cover} alt={`Pôster de ${a.title}`} className="w-[150px] shrink-0 rounded-[14px] shadow-[0_20px_40px_rgba(0,0,0,.5)] sm:w-[200px]" />}
          <div className="min-w-0 flex-[1_1_320px]">
            <nav aria-label="Você está em" className="flex gap-2 text-[0.85rem] text-white/70">
              <Link to="/animes" className="hover:text-white">
                Animes
              </Link>
              <span aria-hidden>/</span>
              <span className="truncate">{a.title}</span>
            </nav>
            <h1 className="mt-3 text-[2rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance sm:text-[3rem]">{a.title}</h1>
            {(a.titleEnglish || a.titleNative) && (
              <p className="mt-2 text-white/65">{[a.titleEnglish !== a.title ? a.titleEnglish : null, a.titleNative].filter(Boolean).join(" · ")}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2 text-[0.8rem] font-bold">
              {a.genres.slice(0, 5).map((g) => (
                <span key={g} className="rounded-[7px] bg-white/14 px-2.5 py-1.5 font-semibold">
                  {genrePt(g)}
                </span>
              ))}
            </div>
            {a.nextAiringAt && a.nextEpisode && (
              <p className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-[10px] bg-brand/90 px-3.5 py-2 text-[0.92rem] font-semibold">
                Episódio {a.nextEpisode}: {brDayLabel(a.nextAiringAt)}, às {airTime(a.nextAiringAt)}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1328px] gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-14">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="sinopse">
            <h2 id="sinopse" className="text-[1.5rem] font-extrabold">
              Sinopse
            </h2>
            {a.synopsis ? (
              <>
                {a.synopsisLang === "en" && <p className="mt-2 text-[0.85rem] text-ink-soft">Ainda sem tradução: sinopse original, em inglês.</p>}
                <div className="prose-ap mt-3 whitespace-pre-line">{a.synopsis}</div>
              </>
            ) : (
              <p className="mt-3 text-ink-soft">Este anime ainda não tem sinopse.</p>
            )}
          </section>

          {a.trailer && <Trailer id={a.trailer} title={a.title} />}

          {a.characters.length > 0 && (
            <section aria-labelledby="personagens">
              <h2 id="personagens" className="text-[1.5rem] font-extrabold">
                Personagens
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {a.characters.map((c) => (
                  <li key={c.id} className="relative flex items-center gap-3 overflow-hidden rounded-[14px] border border-line bg-surface p-2.5 hover:border-ink-soft">
                    {c.image && <img src={c.image} alt="" loading="lazy" className="size-14 shrink-0 rounded-[10px] object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">
                        <Link to={`/animes/personagem/${c.id}`} className="after:absolute after:inset-0 hover:underline">
                          {c.name}
                        </Link>
                      </p>
                      <p className="text-[0.8rem] text-ink-soft">{c.role}</p>
                    </div>
                    {c.voice && (
                      <div className="flex min-w-0 items-center gap-2 text-right">
                        <div className="min-w-0">
                          <p className="truncate text-[0.82rem] font-semibold">{c.voice.name}</p>
                          <p className="text-[0.72rem] text-ink-soft">Dublagem japonesa</p>
                        </div>
                        {c.voice.image && <img src={c.voice.image} alt="" loading="lazy" className="size-11 shrink-0 rounded-full object-cover" />}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {news.length > 0 && (
            <section aria-labelledby="noticias-anime">
              <h2 id="noticias-anime" className="text-[1.5rem] font-extrabold">
                Notícias sobre {a.title}
              </h2>
              <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2">
                {news.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="onde-assistir" className="rounded-[18px] border border-line bg-surface p-5">
            <h2 id="onde-assistir" className="text-[1.05rem] font-extrabold">
              Onde assistir
            </h2>
            {a.streamers.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {a.streamers.map((s) => (
                  <li key={s} className="rounded-[8px] px-3 py-1.5 text-[0.85rem] font-bold text-white" style={{ backgroundColor: STREAMERS[s].color }}>
                    {STREAMERS[s].label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.9rem] text-ink-soft">Ainda sem streaming oficial no Brasil.</p>
            )}
          </section>
          <section aria-labelledby="ficha" className="rounded-[18px] border border-line bg-surface p-5">
            <h2 id="ficha" className="text-[1.05rem] font-extrabold">
              Ficha
            </h2>
            <dl className="mt-3 flex flex-col gap-2.5 text-[0.9rem]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <a href={`https://anilist.co/anime/${a.id}`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[0.85rem] font-semibold text-link underline">
              Ver no AniList
            </a>
          </section>
        </aside>
      </div>
    </article>
  );
}

/** Trailer: mostra a capa do YouTube e só carrega o player ao clicar (página mais leve). */
function Trailer({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <section aria-labelledby="trailer">
      <h2 id="trailer" className="text-[1.5rem] font-extrabold">
        Trailer
      </h2>
      <div className="relative mt-4 aspect-video overflow-hidden rounded-[18px] bg-night shadow-[0_20px_40px_rgba(60,20,20,.16)]">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={`Trailer de ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label={`Assistir ao trailer de ${title}`}>
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="size-full object-cover opacity-80" />
            <span className="absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-night shadow-lg transition-transform group-hover:scale-105">
              <Play className="ml-1 size-7 fill-current" aria-hidden />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
