// Tipos e textos do quiz que valem no servidor e no navegador. NUNCA inclui o gabarito (correct, result, explain,
// minScore): a página só recebe a versão pública do quiz.

export type QuizKind = "personalidade" | "conhecimento";

export const QUIZ_KIND_INFO: Record<QuizKind, { label: string; hint: string }> = {
  personalidade: { label: "Quem você seria?", hint: "Cada resposta soma ponto para um resultado; ganha o que somar mais." },
  conhecimento: { label: "Teste seu conhecimento", hint: "Cada pergunta tem uma resposta certa; o resultado é a faixa de acertos." },
};

export type PublicQuiz = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  kind: QuizKind;
  plays: number;
  publishedAt: string | null;
  updatedAt: string | null;
  questions: { id: string; text: string; image?: string; options: { id: string; text: string; image?: string }[] }[];
};

export type QuizCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  kind: QuizKind;
  plays: number;
  questions: number;
  publishedAt: string | null;
};

/** O que o servidor devolve ao terminar. `review` só no quiz de conhecimento. */
export type QuizFinish = {
  result: { id: string; title: string; description: string; image?: string };
  score: number | null;
  total: number;
  sharePct: number | null;
  review?: { questionId: string; escolhida: string | null; correta: string; explicacao?: string }[];
};

export const quizPath = (slug: string) => `/quiz/${slug}`;

/** Texto para compartilhar o resultado. */
export function quizShareText(quiz: { title: string; kind: QuizKind }, result: { title: string }, score: number | null, total: number): string {
  return quiz.kind === "conhecimento" && score != null
    ? `Acertei ${score} de ${total} no quiz "${quiz.title}"! Consegue bater?`
    : `Fiz o quiz "${quiz.title}" e deu: ${result.title}! Qual é o seu?`;
}

/** `?desafio=7-10&de=Nome`: "Fulano acertou 7 de 10, consegue bater?". null se o valor for inválido. */
export function parseChallenge(desafio: string | null, de: string | null): { score: number; total: number; from: string } | null {
  const m = /^(\d{1,3})-(\d{1,3})$/.exec(desafio ?? "");
  if (!m) return null;
  const score = Number(m[1]);
  const total = Number(m[2]);
  if (total < 1 || score > total) return null;
  return { score, total, from: (de ?? "").replace(/[<>]/g, "").trim().slice(0, 30) || "Um amigo" };
}
