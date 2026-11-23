// Lista de quizzes (/quiz). Abas por tipo (?tipo=), ordem (?ordem=jogados). O canonical é sempre /quiz.
import { AdSlot } from "~/components/ads/AdSlot";
import { Link } from "react-router";
import type { Route } from "./+types/quiz-list";
import { PageHeader } from "~/components/PageHeader";
import { QuizCard } from "~/components/quiz";
import { QUIZ_KIND_INFO, quizPath, type QuizKind } from "~/lib/quiz";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { listQuizzes, quizCounts } from "~/server/quiz/quiz.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const t = url.searchParams.get("tipo");
  const kind: QuizKind | undefined = t === "personalidade" || t === "conhecimento" ? t : undefined;
  const order = url.searchParams.get("ordem") === "jogados" ? "jogados" : "novos";
  const [quizzes, counts] = await Promise.all([listQuizzes({ kind, order }), quizCounts()]);
  return { quizzes, counts, kind: kind ?? null, order };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  return seo({
    title: "Quiz de anime: descubra qual personagem você seria",
    description: "Quizzes de anime: descubra qual personagem você seria e teste o seu conhecimento. Compartilhe o resultado com os amigos.",
    path: "/quiz",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Quiz de anime",
      url: absoluteUrl("/quiz"),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: (d?.quizzes ?? []).slice(0, 30).map((q, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(quizPath(q.slug)), name: q.title })),
      },
    },
  });
}

export default function QuizList({ loaderData }: Route.ComponentProps) {
  const { quizzes, counts, kind, order } = loaderData;
  const href = (k: QuizKind | null, o: string) => {
    const p = new URLSearchParams();
    if (k) p.set("tipo", k);
    if (o === "jogados") p.set("ordem", "jogados");
    const s = p.toString();
    return s ? `/quiz?${s}` : "/quiz";
  };
  const tabs: { k: QuizKind | null; label: string; n: number }[] = [
    { k: null, label: "Todos", n: counts.todos },
    { k: "personalidade", label: QUIZ_KIND_INFO.personalidade.label, n: counts.personalidade },
    { k: "conhecimento", label: QUIZ_KIND_INFO.conhecimento.label, n: counts.conhecimento },
  ];
  return (
    <>
      <PageHeader label="Quiz" title="Qual personagem você seria?" intro="Descubra com qual personagem você se parece ou teste o quanto você sabe de anime. Depois, compartilhe o resultado." />
      <div className="mx-auto flex max-w-[1328px] flex-col gap-8 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Tipo de quiz" className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Link
                key={t.label}
                to={href(t.k, order)}
                aria-current={t.k === kind ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-[0.88rem] font-semibold ${t.k === kind ? "bg-ink text-paper" : "border border-line bg-surface hover:bg-sunken"}`}
              >
                {t.label} <span className="opacity-60">{t.n}</span>
              </Link>
            ))}
          </nav>
          <nav aria-label="Ordem" className="flex gap-3 text-[0.88rem]">
            <Link to={href(kind, "novos")} className={order === "novos" ? "font-bold underline" : "text-ink-soft hover:underline"}>
              Mais novos
            </Link>
            <Link to={href(kind, "jogados")} className={order === "jogados" ? "font-bold underline" : "text-ink-soft hover:underline"}>
              Mais jogados
            </Link>
          </nav>
        </div>
        {quizzes.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quizzes.map((q) => (
              <QuizCard key={q.id} quiz={q} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-soft">Os primeiros quizzes estão chegando. Volte em breve!</p>
        )}
        {quizzes.length > 0 && <AdSlot slot="list" />}
      </div>
    </>
  );
}
