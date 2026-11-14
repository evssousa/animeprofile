// Um quiz (/quiz/:slug). O gabarito nunca vai à página: a action confere cada resposta e calcula o resultado.
import { data } from "react-router";
import { isbot } from "isbot";
import type { Route } from "./+types/quiz";
import { QuizCard, QuizPlayer } from "~/components/quiz";
import { QUIZ_KIND_INFO, parseChallenge, quizPath } from "~/lib/quiz";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { clientIp, ipHash, sameOrigin } from "~/server/http.server";
import { QuizError, checkAnswer, finishQuiz, getPublicQuiz, moreQuizzes, sharedResult } from "~/server/quiz/quiz.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const quiz = await getPublicQuiz(params.slug);
  if (!quiz) throw data(null, { status: 404 });
  const url = new URL(request.url);
  const r = url.searchParams.get("r");
  const [more, shared] = await Promise.all([moreQuizzes(quiz, 12), r ? sharedResult(quiz.slug, r) : null]);
  return { quiz, more, shared, challenge: parseChallenge(url.searchParams.get("desafio"), url.searchParams.get("de")) };
}

export async function action({ params, request }: Route.ActionArgs) {
  if (!sameOrigin(request)) throw data({ erro: "Pedido não permitido." }, { status: 403 });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    if (intent === "responder") {
      const q = Number(form.get("q"));
      if (!Number.isInteger(q) || q < 0) return data({ erro: "Pergunta inválida." }, { status: 400 });
      return await checkAnswer(params.slug, q, String(form.get("o") ?? ""));
    }
    if (intent === "finalizar") {
      let answers: unknown;
      try {
        answers = JSON.parse(String(form.get("answers") ?? ""));
      } catch {
        return data({ erro: "Respostas inválidas." }, { status: 400 });
      }
      const bot = isbot(request.headers.get("user-agent") ?? "");
      return { finish: await finishQuiz(params.slug, answers, { ipHash: ipHash(clientIp(request)), bot }) };
    }
  } catch (e) {
    if (e instanceof QuizError) return data({ erro: e.message }, { status: 400 });
    throw e;
  }
  return data({ erro: "Ação desconhecida." }, { status: 400 });
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Quiz não encontrado" }];
  const { quiz, shared } = d;
  const title = shared ? `Meu resultado: ${shared.title} (${quiz.title})` : quiz.title;
  return seo({
    title,
    description: quiz.description || QUIZ_KIND_INFO[quiz.kind].hint,
    path: quizPath(quiz.slug),
    image: shared?.image ?? quiz.coverUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Quiz",
          name: quiz.title,
          description: quiz.description,
          url: absoluteUrl(quizPath(quiz.slug)),
          ...(quiz.coverUrl ? { image: quiz.coverUrl } : {}),
          ...(quiz.publishedAt ? { datePublished: quiz.publishedAt } : {}),
          inLanguage: "pt-BR",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Quiz", item: absoluteUrl("/quiz") },
            { "@type": "ListItem", position: 2, name: quiz.title, item: absoluteUrl(quizPath(quiz.slug)) },
          ],
        },
      ],
    },
  });
}

export default function QuizPage({ loaderData }: Route.ComponentProps) {
  const { quiz, more, challenge, shared } = loaderData;
  return (
    <div className="mx-auto grid max-w-[1328px] gap-8 px-4 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-14">
      <main className="flex flex-col gap-5">
        <h1 className="text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.4rem]">{quiz.title}</h1>
        {shared && <p className="rounded-xl bg-brand-soft px-4 py-3 font-semibold">Alguém tirou “{shared.title}” neste quiz. E você?</p>}
        <QuizPlayer key={quiz.id} quiz={quiz} challenge={challenge} next={more[0] ?? null} />
      </main>
      <aside aria-label="Mais quizzes" className="flex flex-col gap-4">
        <h2 className="text-[1.15rem] font-extrabold">Continue jogando</h2>
        <div className="grid gap-4">
          {more.slice(0, 4).map((q) => (
            <QuizCard key={q.id} quiz={q} />
          ))}
        </div>
      </aside>
    </div>
  );
}
