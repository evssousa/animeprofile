// /animes: busca, no ar hoje, em alta nesta semana e a temporada atual (dados do AniList guardados no MySQL).
import { Form } from "react-router";
import { Search } from "lucide-react";
import type { Route } from "./+types/animes";
import { AiringPoster, AnimePoster, PosterGrid, TopTen } from "~/components/anime";
import { PageHeader } from "~/components/PageHeader";
import { Pagination, SectionHead } from "~/components/posts";
import { SEASON_PT, brDay } from "~/lib/anime";
import { seo } from "~/lib/seo";
import { airingBetween, searchAnimes, seasonAnimes, trendingAnimes, type AnimeCard } from "~/server/anime/anime.server";

const PER_PAGE = 48;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  if (q.length >= 2) {
    let results: AnimeCard[] = [];
    let error = false;
    try {
      results = await searchAnimes(q);
    } catch {
      error = true;
    }
    return { mode: "busca" as const, q, results, error };
  }
  const start = new Date(`${brDay(new Date())}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 86400_000);
  const [today, trending, season] = await Promise.all([airingBetween(start, end), trendingAnimes(10), seasonAnimes(PER_PAGE, (page - 1) * PER_PAGE)]);
  return { mode: "lista" as const, q, today, trending, season, page, pages: Math.max(1, Math.ceil(season.total / PER_PAGE)) };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (d?.mode === "busca") return seo({ title: `Animes: ${d.q}`, path: "/animes", noindex: true });
  const label = d ? `${SEASON_PT[d.season.season]} ${d.season.year}` : "";
  return seo({
    title: d && d.page > 1 ? `Animes: página ${d.page}` : "Animes",
    description: `Animes da temporada de ${label}, o que estreia hoje, os mais comentados da semana e onde assistir no Brasil.`,
    path: d && d.page > 1 ? `/animes?pagina=${d.page}` : "/animes",
  });
}

export default function Animes({ loaderData: d }: Route.ComponentProps) {
  return (
    <>
      <PageHeader label="Animes" title="O que assistir agora" intro="Temporada atual, episódios de hoje e os animes que todo mundo está comentando, com onde assistir no Brasil.">
        <Form method="get" role="search" className="mt-7 flex max-w-xl gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar anime</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/60" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={d.q}
              placeholder="Buscar anime pelo nome"
              className="h-12 w-full rounded-[10px] border border-white/15 bg-white/10 pr-4 pl-12 text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none"
            />
          </label>
          <button type="submit" className="rounded-[10px] bg-brand px-5 font-bold text-brand-ink hover:brightness-110">
            Buscar
          </button>
        </Form>
      </PageHeader>

      <div className="mx-auto flex max-w-[1328px] flex-col gap-16 px-4 py-12 sm:px-8 lg:px-14">
        {d.mode === "busca" ? (
          <section aria-labelledby="resultados" className="flex flex-col gap-6">
            <SectionHead id="resultados" label="Busca" title={`Resultados para “${d.q}”`} more={{ to: "/animes", text: "Voltar para animes" }} />
            {d.error ? (
              <p className="text-ink-soft">A busca de animes está fora do ar agora. Tente de novo em alguns minutos.</p>
            ) : d.results.length === 0 ? (
              <p className="text-ink-soft">Nenhum anime encontrado com esse nome. Tente o nome em japonês ou em inglês.</p>
            ) : (
              <PosterGrid>
                {d.results.map((a) => (
                  <AnimePoster key={a.id} anime={a} detail={[a.seasonYear, a.format].filter(Boolean).join(" · ")} />
                ))}
              </PosterGrid>
            )}
          </section>
        ) : (
          <>
            {d.page === 1 && (
              <section aria-labelledby="hoje" className="flex flex-col gap-6">
                <SectionHead id="hoje" label="Ao vivo" title="No ar hoje" more={{ to: "/animes/calendario", text: "Calendário da semana" }} />
                {d.today.length ? (
                  <PosterGrid>
                    {d.today.map((it) => (
                      <AiringPoster key={`${it.anime.id}-${it.episode}`} item={it} />
                    ))}
                  </PosterGrid>
                ) : (
                  <p className="text-ink-soft">Nenhum episódio novo hoje. Veja o que estreia nos próximos dias no calendário.</p>
                )}
              </section>
            )}

            {d.page === 1 && d.trending.length > 0 && (
              <section aria-labelledby="em-alta" className="flex flex-col gap-6">
                <SectionHead id="em-alta" label="Top 10 da semana" title="Os animes mais comentados agora" />
                <TopTen items={d.trending} />
              </section>
            )}

            <section aria-labelledby="temporada" className="flex flex-col gap-6">
              <SectionHead
                id="temporada"
                label="Temporada atual"
                title={`Animes de ${SEASON_PT[d.season.season]} ${d.season.year}`}
                more={{ to: "/animes/calendario", text: "Ver horários" }}
              />
              {d.season.items.length ? (
                <PosterGrid>
                  {d.season.items.map((a) => (
                    <AnimePoster key={a.id} anime={a} />
                  ))}
                </PosterGrid>
              ) : (
                <p className="text-ink-soft">A lista da temporada está sendo atualizada. Volte em alguns minutos.</p>
              )}
              <Pagination page={d.page} pages={d.pages} basePath="/animes" />
            </section>

            <p className="text-[0.85rem] text-ink-soft">
              Dados de animes:{" "}
              <a href="https://anilist.co" className="font-semibold text-link underline" target="_blank" rel="noreferrer">
                AniList
              </a>
              . Sinopses traduzidas pela redação do Anime Profile.
            </p>
          </>
        )}
      </div>
    </>
  );
}
