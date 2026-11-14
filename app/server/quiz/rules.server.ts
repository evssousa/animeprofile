// Regras do quiz, só no servidor: lê o JSON sem confiar nele, valida, calcula o resultado e monta a versão pública
// (sem gabarito). Portado de animeprofile-old/src/lib/quiz.ts, sem zod.
import { json } from "../db.server";
import type { PublicQuiz, QuizKind } from "~/lib/quiz";

export type QuizOption = { id: string; text: string; image?: string; result?: string; correct?: boolean };
export type QuizQuestion = { id: string; text: string; image?: string; options: QuizOption[]; explain?: string };
export type QuizResult = { id: string; title: string; description: string; image?: string; minScore?: number };
export type QuizData = { questions: QuizQuestion[]; results: QuizResult[] };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const id = (v: unknown) => str(v, 40);
const https = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^https:\/\/[^\s"<>]+$/.test(s) && s.length <= 2048 ? s : undefined;
};

/** Lê o JSON do banco (texto no MariaDB, objeto no MySQL 8) e devolve dados limpos, nos limites do site antigo. */
export function normalizeQuizData(raw: unknown): QuizData {
  const r = json<Record<string, unknown>>(raw, {});
  const questions = (Array.isArray(r.questions) ? r.questions : []).slice(0, 40).map((q): QuizQuestion => {
    const o = (q ?? {}) as Record<string, unknown>;
    return {
      id: id(o.id),
      text: str(o.text, 300),
      image: https(o.image),
      explain: str(o.explain, 400) || undefined,
      options: (Array.isArray(o.options) ? o.options : []).slice(0, 12).map((p): QuizOption => {
        const x = (p ?? {}) as Record<string, unknown>;
        return { id: id(x.id), text: str(x.text, 160), image: https(x.image), result: id(x.result) || undefined, correct: x.correct === true ? true : undefined };
      }),
    };
  });
  const results = (Array.isArray(r.results) ? r.results : []).slice(0, 20).map((p): QuizResult => {
    const x = (p ?? {}) as Record<string, unknown>;
    const min = Number(x.minScore);
    return {
      id: id(x.id),
      title: str(x.title, 120),
      description: str(x.description, 1200),
      image: https(x.image),
      minScore: Number.isInteger(min) && min >= 0 && min <= 100 ? min : undefined,
    };
  });
  return { questions, results };
}

/** Problemas que impedem um quiz de funcionar. A importação pula o quiz que tiver algum. */
export function quizProblems(q: { title: string; slug: string; kind: QuizKind; data: QuizData }): string[] {
  const out: string[] = [];
  const { questions, results } = q.data;
  if (q.title.trim().length < 5) out.push("Título com pelo menos 5 letras.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.slug) || q.slug.length < 3) out.push("Endereço (slug) só com letras minúsculas, números e hífen.");
  if (questions.length < 3) out.push("Pelo menos 3 perguntas.");
  if (results.length < 2) out.push("Pelo menos 2 resultados.");
  results.forEach((r, i) => {
    if (!r.title.trim()) out.push(`Resultado ${i + 1} sem título.`);
  });
  const resultIds = new Set(results.map((r) => r.id));
  questions.forEach((qq, i) => {
    const n = i + 1;
    if (!qq.text.trim()) out.push(`Pergunta ${n} sem texto.`);
    if (qq.options.length < 2) out.push(`Pergunta ${n}: pelo menos 2 opções.`);
    if (qq.options.some((o) => !o.text.trim() && !o.image)) out.push(`Pergunta ${n}: opção sem texto nem imagem.`);
    if (q.kind === "personalidade" && qq.options.some((o) => !o.result || !resultIds.has(o.result))) out.push(`Pergunta ${n}: escolha o resultado de cada opção.`);
    if (q.kind === "conhecimento" && qq.options.filter((o) => o.correct).length !== 1) out.push(`Pergunta ${n}: marque exatamente uma opção certa.`);
  });
  if (q.kind === "personalidade" && results.length >= 2 && questions.length) {
    const reachable = new Set(questions.flatMap((qq) => qq.options.map((o) => o.result)));
    results.forEach((r, i) => {
      if (!reachable.has(r.id)) out.push(`Resultado ${i + 1} (“${r.title || "sem título"}”) não é levado por nenhuma opção.`);
    });
  }
  if (q.kind === "conhecimento" && results.length >= 2 && !results.some((r) => (r.minScore ?? 0) === 0)) out.push("Um resultado precisa começar em 0 acertos.");
  return out;
}

export type QuizOutcome = { result: QuizResult; score: number | null; total: number };

/**
 * Resultado das respostas (`answers[i]` = id da opção escolhida na pergunta i).
 * Conhecimento: faixa pelo número de acertos. Personalidade: o resultado que mais pontuou; no empate, vale o
 * escolhido por último.
 */
export function quizOutcome(kind: QuizKind, data: QuizData, answers: string[]): QuizOutcome | null {
  const { questions, results } = data;
  if (!results.length) return null;
  const picked = questions.map((q, i) => q.options.find((o) => o.id === answers[i]));
  if (kind === "conhecimento") {
    const score = picked.filter((o) => o?.correct).length;
    const tiers = [...results].sort((a, b) => (a.minScore ?? 0) - (b.minScore ?? 0));
    const result = tiers.filter((r) => (r.minScore ?? 0) <= score).at(-1) ?? tiers[0];
    return { result, score, total: questions.length };
  }
  const points = new Map<string, number>();
  const lastAt = new Map<string, number>();
  picked.forEach((o, i) => {
    if (!o?.result) return;
    points.set(o.result, (points.get(o.result) ?? 0) + 1);
    lastAt.set(o.result, i);
  });
  let best: QuizResult | null = null;
  for (const r of results) {
    if (!best) {
      best = r;
      continue;
    }
    const a = points.get(r.id) ?? 0;
    const b = points.get(best.id) ?? 0;
    if (a > b || (a === b && a > 0 && (lastAt.get(r.id) ?? -1) > (lastAt.get(best.id) ?? -1))) best = r;
  }
  return best ? { result: best, score: null, total: questions.length } : null;
}

/** "23% tiveram esse resultado": null enquanto ninguém jogou. */
export function resultShare(counts: { result_id: string; plays: number }[], resultId: string): number | null {
  const total = counts.reduce((s, c) => s + Number(c.plays), 0);
  if (!total) return null;
  const mine = Number(counts.find((c) => c.result_id === resultId)?.plays ?? 0);
  return Math.round((mine / total) * 100);
}

type PublicSource = { id: string; slug: string; title: string; description: string; cover_url: string | null; kind: QuizKind; data: unknown; plays_old: number; plays_new: number; published_at: string | null; updated_at: string | null };

/** A versão que a página recebe: perguntas e opções só com texto e imagem. Sem gabarito, sem resultados. */
export function publicQuiz(row: PublicSource, iso: (v: string | null | undefined) => string | undefined): PublicQuiz {
  const d = normalizeQuizData(row.data);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    kind: row.kind,
    plays: Number(row.plays_old) + Number(row.plays_new),
    publishedAt: iso(row.published_at) ?? null,
    updatedAt: iso(row.updated_at) ?? null,
    questions: d.questions.map((q) => ({
      id: q.id,
      text: q.text,
      ...(q.image ? { image: q.image } : {}),
      options: q.options.map((o) => ({ id: o.id, text: o.text, ...(o.image ? { image: o.image } : {}) })),
    })),
  };
}
