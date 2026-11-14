// Quiz: cartão da lista e o player. O player nunca tem o gabarito: cada resposta do quiz de conhecimento é conferida
// no servidor (intent "responder") e o resultado também (intent "finalizar").
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Check, Link2, RotateCcw, Share2, X } from "lucide-react";
import { QUIZ_KIND_INFO, quizPath, quizShareText, type PublicQuiz, type QuizCardData, type QuizFinish } from "~/lib/quiz";
import { SITE, absoluteUrl } from "~/lib/site";

/** Imagem que, se quebrar, vira um quadrado com a inicial (o servidor de origem pode sumir). */
function SafeImg({ src, label, className }: { src?: string | null; label: string; className: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <span className={`${className} grid place-items-center bg-[linear-gradient(135deg,#2a1311,#0d0d10)] text-[1.6rem] font-extrabold text-white/70`} aria-hidden>
        {label.trim()[0]?.toUpperCase() ?? "?"}
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} className={`${className} object-cover`} />;
}

export function QuizCard({ quiz }: { quiz: QuizCardData }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface">
      <div className="relative">
        <SafeImg src={quiz.coverUrl} label={quiz.title} className="aspect-[16/10] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1.5 text-[0.7rem] font-bold text-white ${quiz.kind === "conhecimento" ? "bg-[#2b3fb0]" : "bg-brand"}`}>
          {QUIZ_KIND_INFO[quiz.kind].label}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-[1rem] leading-snug font-bold">
          <Link to={quizPath(quiz.slug)} className="line-clamp-3 after:absolute after:inset-0 hover:underline">
            {quiz.title}
          </Link>
        </h3>
        <p className="mt-auto text-[0.8rem] text-ink-soft">
          {quiz.questions} perguntas{quiz.plays > 0 ? ` · ${quiz.plays.toLocaleString("pt-BR")} ${quiz.plays === 1 ? "pessoa fez" : "pessoas fizeram"}` : ""}
        </p>
      </div>
    </article>
  );
}

type CheckData = { correta?: string; explicacao?: string; erro?: string };
type FinishData = { finish?: QuizFinish; erro?: string };
type Challenge = { score: number; total: number; from: string };
type Step = "capa" | "fim" | number;

export function QuizPlayer({ quiz, challenge, next }: { quiz: PublicQuiz; challenge: Challenge | null; next: QuizCardData | null }) {
  const check = useFetcher<CheckData>();
  const done = useFetcher<FinishData>();
  const [step, setStep] = useState<Step>("capa");
  const [answers, setAnswers] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [fb, setFb] = useState<{ correta: string; explicacao?: string } | null>(null);
  const [problem, setProblem] = useState<"responder" | "finalizar" | null>(null);
  const [review, setReview] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const total = quiz.questions.length;
  const knowledge = quiz.kind === "conhecimento";
  const finish = done.data?.finish ?? null;

  const advance = (answer: string, soFar: string[]) => {
    const all = [...soFar, answer];
    setAnswers(all);
    setPicked(null);
    setFb(null);
    setProblem(null);
    if (all.length < total) {
      setStep(all.length);
    } else {
      setStep("fim");
      done.submit({ intent: "finalizar", answers: JSON.stringify(all) }, { method: "post" });
    }
    topRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // A resposta do servidor ao "responder" chega aqui.
  useEffect(() => {
    if (picked == null || check.state !== "idle" || !check.data) return;
    if (check.data.correta) {
      setFb({ correta: check.data.correta, explicacao: check.data.explicacao });
      if (!check.data.explicacao) {
        const t = setTimeout(() => advance(picked, answers), 1100);
        return () => clearTimeout(t);
      }
    } else {
      setProblem("responder");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check.data, check.state]);

  const pick = (optionId: string) => {
    if (picked) return;
    setPicked(optionId);
    if (knowledge) {
      check.submit({ intent: "responder", q: String(step), o: optionId }, { method: "post" });
    } else {
      setTimeout(() => advance(optionId, answers), 350);
    }
  };

  const restart = () => {
    setStep("capa");
    setAnswers([]);
    setPicked(null);
    setFb(null);
    setProblem(null);
    setReview(false);
  };

  const url = absoluteUrl(quizPath(quiz.slug));

  return (
    <div ref={topRef} className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_20px_40px_rgba(60,20,20,.08)]">
      {step === "capa" && (
        <div>
          <SafeImg src={quiz.coverUrl} label={quiz.title} className="aspect-[16/8] w-full" />
          <div className="flex flex-col items-start gap-4 p-6 sm:p-8">
            <span className="rounded-full bg-brand-soft px-3 py-1.5 text-[0.78rem] font-bold text-brand">{QUIZ_KIND_INFO[quiz.kind].label}</span>
            <p className="max-w-[60ch] text-ink-soft">{quiz.description || QUIZ_KIND_INFO[quiz.kind].hint}</p>
            {challenge && (
              <p className="rounded-xl bg-brand-soft px-4 py-3 text-[0.92rem] font-semibold">
                {challenge.from} acertou {challenge.score} de {challenge.total}. Consegue bater?
              </p>
            )}
            <p className="text-[0.85rem] text-ink-soft">{total} perguntas{quiz.plays > 0 ? ` · ${quiz.plays.toLocaleString("pt-BR")} pessoas já fizeram` : ""}</p>
            <button type="button" onClick={() => setStep(0)} className="rounded-[10px] bg-brand px-7 py-3.5 font-extrabold text-brand-ink shadow-[0_10px_30px_rgba(194,53,43,.35)] hover:brightness-110">
              Começar o quiz
            </button>
          </div>
        </div>
      )}

      {typeof step === "number" && (
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
            <span className="text-[0.85rem] font-semibold text-ink-soft">
              {step + 1} de {total}
            </span>
          </div>
          <h2 className="mt-6 text-[1.35rem] leading-snug font-extrabold sm:text-[1.6rem]">{quiz.questions[step].text}</h2>
          {quiz.questions[step].image && <SafeImg src={quiz.questions[step].image} label={quiz.questions[step].text} className="mt-5 aspect-video w-full rounded-2xl" />}
          <ul className={`mt-6 grid gap-3 ${quiz.questions[step].options.some((o) => o.image) ? "grid-cols-2 sm:grid-cols-3" : ""}`}>
            {quiz.questions[step].options.map((o) => {
              const state = fb ? (o.id === fb.correta ? "certa" : o.id === picked ? "errada" : "neutra") : o.id === picked ? "marcada" : "livre";
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={Boolean(picked)}
                    onClick={() => pick(o.id)}
                    aria-pressed={o.id === picked}
                    className={`flex w-full items-center gap-3 rounded-[14px] border-2 p-4 text-left font-semibold transition-colors ${
                      state === "certa"
                        ? "border-[#2e9e5b] bg-[#2e9e5b]/12"
                        : state === "errada"
                          ? "border-brand bg-brand/10"
                          : state === "marcada"
                            ? "border-ink bg-sunken"
                            : "border-line bg-surface hover:border-ink-soft"
                    } ${o.image ? "flex-col text-center" : ""}`}
                  >
                    {o.image && <SafeImg src={o.image} label={o.text} className="aspect-square w-full rounded-xl" />}
                    <span className="flex-1">{o.text}</span>
                    {state === "certa" && <Check className="size-5 text-[#2e9e5b]" aria-label="Resposta certa" />}
                    {state === "errada" && <X className="size-5 text-brand" aria-label="Resposta errada" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {problem === "responder" && picked && (
            <p role="alert" className="mt-5 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3">
              Não deu para conferir agora.{" "}
              <button type="button" className="font-bold underline" onClick={() => check.submit({ intent: "responder", q: String(step), o: picked }, { method: "post" })}>
                Tentar de novo
              </button>
            </p>
          )}
          {fb?.explicacao && (
            <div className="mt-5 rounded-xl bg-sunken p-4">
              <p className="text-[0.95rem]">{fb.explicacao}</p>
              <button type="button" onClick={() => advance(picked!, answers)} className="mt-3 rounded-[9px] bg-ink px-5 py-2.5 font-bold text-paper">
                {answers.length + 1 < total ? "Próxima pergunta" : "Ver o resultado"}
              </button>
            </div>
          )}
        </div>
      )}

      {step === "fim" && (
        <div className="p-6 sm:p-8">
          {!finish && done.data?.erro == null && done.state !== "idle" && <p className="text-ink-soft">Calculando o seu resultado...</p>}
          {!finish && (done.data?.erro != null || (done.state === "idle" && !done.data)) && (
            <p role="alert" className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3">
              Não deu para conferir agora. Suas respostas estão guardadas.{" "}
              <button type="button" className="font-bold underline" onClick={() => done.submit({ intent: "finalizar", answers: JSON.stringify(answers) }, { method: "post" })}>
                Tentar de novo
              </button>
            </p>
          )}
          {finish && (
            <div className="flex flex-col gap-5">
              <p className="text-[0.85rem] font-bold text-brand">{knowledge && finish.score != null ? `Você acertou ${finish.score} de ${finish.total}` : "Seu resultado"}</p>
              {finish.result.image && <SafeImg src={finish.result.image} label={finish.result.title} className="aspect-video w-full max-w-[520px] rounded-2xl" />}
              <h2 className="text-[1.8rem] leading-tight font-extrabold tracking-[-0.025em]">{finish.result.title}</h2>
              {finish.result.description && <p className="max-w-[62ch] text-[1.02rem] leading-relaxed text-ink-soft">{finish.result.description}</p>}
              {finish.sharePct != null && <p className="text-[0.9rem] font-semibold">{finish.sharePct}% das pessoas tiveram esse resultado.</p>}
              {challenge && knowledge && finish.score != null && (
                <p className="rounded-xl bg-brand-soft px-4 py-3 font-semibold">
                  {finish.score > challenge.score
                    ? `Você bateu ${challenge.from}: ${finish.score} contra ${challenge.score}.`
                    : finish.score === challenge.score
                      ? `Empate com ${challenge.from}: ${finish.score} acertos.`
                      : `${challenge.from} fez ${challenge.score}. Tente de novo!`}
                </p>
              )}
              <ShareRow quiz={quiz} finish={finish} url={`${url}?r=${encodeURIComponent(finish.result.id)}`} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={restart} className="inline-flex items-center gap-2 rounded-[10px] border border-line px-4 py-2.5 font-semibold hover:bg-sunken">
                  <RotateCcw className="size-4" aria-hidden /> Refazer
                </button>
                {knowledge && finish.score != null && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Acertei ${finish.score} de ${finish.total} no quiz "${quiz.title}". Consegue bater? ${url}?desafio=${finish.score}-${finish.total}&de=Um%20amigo`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[10px] bg-[#1f9d55] px-4 py-2.5 font-semibold text-white hover:brightness-110"
                  >
                    Desafiar um amigo
                  </a>
                )}
                {next && (
                  <Link to={quizPath(next.slug)} className="rounded-[10px] bg-brand px-4 py-2.5 font-bold text-brand-ink hover:brightness-110">
                    Próximo quiz
                  </Link>
                )}
              </div>
              {knowledge && finish.review && (
                <div>
                  <button type="button" onClick={() => setReview((v) => !v)} aria-expanded={review} className="font-bold text-link underline">
                    {review ? "Esconder as respostas" : "Revise suas respostas"}
                  </button>
                  {review && (
                    <ol className="mt-4 flex flex-col gap-4">
                      {finish.review.map((r, i) => {
                        const q = quiz.questions[i];
                        const label = (id: string | null) => q.options.find((o) => o.id === id)?.text ?? "(sem resposta)";
                        const ok = r.escolhida === r.correta;
                        return (
                          <li key={r.questionId} className="rounded-xl border border-line p-4">
                            <p className="font-bold">
                              {i + 1}. {q.text}
                            </p>
                            <p className={`mt-2 text-[0.9rem] ${ok ? "text-[#2e7d4f]" : "text-brand"}`}>Sua resposta: {label(r.escolhida)}</p>
                            {!ok && <p className="text-[0.9rem] text-[#2e7d4f]">Certa: {label(r.correta)}</p>}
                            {r.explicacao && <p className="mt-1 text-[0.85rem] text-ink-soft">{r.explicacao}</p>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShareRow({ quiz, finish, url }: { quiz: PublicQuiz; finish: QuizFinish; url: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && "share" in navigator), []);
  const text = quizShareText(quiz, finish.result, finish.score, finish.total);
  const enc = encodeURIComponent;
  const btn = "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[0.85rem] font-semibold hover:bg-sunken";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Compartilhar o resultado">
      <span className="mr-1 text-[0.85rem] font-bold text-ink-soft">Compartilhar</span>
      <a className={btn} href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a className={btn} href={`https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noreferrer">
        X
      </a>
      <button
        type="button"
        className={btn}
        onClick={() =>
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
      >
        {copied ? <Check className="size-4 text-brand" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      {canShare && (
        <button type="button" className={btn} onClick={() => navigator.share({ title: `${quiz.title} | ${SITE.name}`, text, url }).catch(() => {})}>
          <Share2 className="size-4" aria-hidden /> Mais opções
        </button>
      )}
    </div>
  );
}
