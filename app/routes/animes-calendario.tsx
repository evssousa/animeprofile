// /animes/calendario: episódios dos próximos 7 dias, por dia, no horário de Brasília.
import type { Route } from "./+types/animes-calendario";
import { AiringPoster, PosterGrid } from "~/components/anime";
import { PageHeader } from "~/components/PageHeader";
import { brDay, brDayLabel } from "~/lib/anime";
import { seo } from "~/lib/seo";
import { airingBetween, type AiringItem } from "~/server/anime/anime.server";

export async function loader() {
  const start = new Date(`${brDay(new Date())}T00:00:00-03:00`);
  const items = await airingBetween(start, new Date(start.getTime() + 7 * 86400_000));
  const days: { key: string; label: string; items: AiringItem[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400_000 + 12 * 3600_000);
    days.push({ key: brDay(d), label: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : brDayLabel(d), items: [] });
  }
  for (const it of items) days.find((d) => d.key === brDay(it.airingAt))?.items.push(it);
  return { days };
}

export function meta() {
  return seo({
    title: "Calendário de animes da semana",
    description: "Que horas sai o próximo episódio: os animes da semana, dia a dia, no horário de Brasília.",
    path: "/animes/calendario",
  });
}

export default function Calendario({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader label="Animes" title="Calendário da semana" intro="Os episódios dos próximos 7 dias, no horário de Brasília. O horário é o da exibição no Japão; no streaming pode chegar algumas horas depois." />
      <div className="mx-auto flex max-w-[1328px] flex-col gap-12 px-4 py-12 sm:px-8 lg:px-14">
        {loaderData.days.map((day) => (
          <section key={day.key} aria-labelledby={`dia-${day.key}`} className="flex flex-col gap-5">
            <h2 id={`dia-${day.key}`} className="text-[1.5rem] font-extrabold capitalize">
              {day.label}
              <span className="ml-2 text-[0.95rem] font-semibold text-ink-soft normal-case">
                {day.items.length === 1 ? "1 episódio" : `${day.items.length} episódios`}
              </span>
            </h2>
            {day.items.length ? (
              <PosterGrid>
                {day.items.map((it) => (
                  <AiringPoster key={`${it.anime.id}-${it.episode}`} item={it} />
                ))}
              </PosterGrid>
            ) : (
              <p className="text-ink-soft">Nenhum episódio neste dia.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
