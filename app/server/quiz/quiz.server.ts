// Quiz no MySQL: listas, partida (conferir resposta e finalizar, sempre no servidor) e importação do site antigo.
// O gabarito nunca sai daqui: a página só recebe a versão pública (rules.server.ts > publicQuiz).
import type { PoolConnection } from "mysql2/promise";
import type { PublicQuiz, QuizCardData, QuizFinish, QuizKind } from "~/lib/quiz";
import { hasDatabase, iso, query, tx } from "../db.server";
import { toSqlDate, upsert } from "../content/import-old.server";
import { normalizeQuizData, publicQuiz, quizOutcome, quizProblems, resultShare, type QuizData } from "./rules.server";

type QuizRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
  kind: QuizKind;
  data: unknown;
  questions_count: number;
  plays_old: number;
  plays_new: number;
  published_at: string | null;
  updated_at: string | null;
};

const VISIBLE = "status = 'published' AND published_at IS NOT NULL AND published_at <= UTC_TIMESTAMP(3)";

const toCard = (r: Pick<QuizRow, "id" | "slug" | "title" | "description" | "cover_url" | "kind" | "questions_count" | "plays_old" | "plays_new" | "published_at">): QuizCardData => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  coverUrl: r.cover_url,
  kind: r.kind,
  plays: Number(r.plays_old) + Number(r.plays_new),
  questions: Number(r.questions_count),
  publishedAt: iso(r.published_at) ?? null,
});

const CARD_COLS = "id, slug, title, description, cover_url, kind, questions_count, plays_old, plays_new, published_at";

/** Quizzes publicados. Ordem: mais novos (padrão) ou mais jogados. */
export async function listQuizzes({ kind, order = "novos", limit = 100 }: { kind?: QuizKind; order?: "novos" | "jogados"; limit?: number } = {}) {
  if (!hasDatabase()) return [];
  const rows = await query<QuizRow>(
    `SELECT ${CARD_COLS} FROM quizzes WHERE ${VISIBLE} ${kind ? "AND kind = ?" : ""}
     ORDER BY ${order === "jogados" ? "(plays_old + plays_new) DESC, published_at DESC" : "published_at DESC"} LIMIT ?`,
    kind ? [kind, limit] : [limit],
  );
  return rows.map(toCard);
}

/** Contagens para as abas. */
export async function quizCounts() {
  const counts = { todos: 0, personalidade: 0, conhecimento: 0 };
  if (!hasDatabase()) return counts;
  const rows = await query<{ kind: QuizKind; n: number }>(`SELECT kind, COUNT(*) AS n FROM quizzes WHERE ${VISIBLE} GROUP BY kind`);
  for (const r of rows) {
    counts[r.kind] = Number(r.n);
    counts.todos += Number(r.n);
  }
  return counts;
}

async function getRow(slug: string): Promise<QuizRow | null> {
  if (!hasDatabase()) return null;
  const [row] = await query<QuizRow>(`SELECT ${CARD_COLS}, data, updated_at FROM quizzes WHERE ${VISIBLE} AND slug = ? LIMIT 1`, [slug]);
  return row ?? null;
}

/** Versão pública do quiz (sem gabarito), ou null se não existe. */
export async function getPublicQuiz(slug: string): Promise<PublicQuiz | null> {
  const row = await getRow(slug);
  return row ? publicQuiz(row, iso) : null;
}

/** Outros quizzes: primeiro os do mesmo tipo, depois os demais, os mais novos antes. */
export async function moreQuizzes(quiz: Pick<PublicQuiz, "id" | "kind">, limit = 12) {
  if (!hasDatabase()) return [];
  const rows = await query<QuizRow>(
    `SELECT ${CARD_COLS} FROM quizzes WHERE ${VISIBLE} AND id <> ? ORDER BY (kind = ?) DESC, published_at DESC LIMIT ?`,
    [quiz.id, quiz.kind, limit],
  );
  return rows.map(toCard);
}

/** O resultado de um link compartilhado (?r=): só id, título e imagem. */
export async function sharedResult(slug: string, resultId: string) {
  const row = await getRow(slug);
  if (!row) return null;
  const r = normalizeQuizData(row.data).results.find((x) => x.id === resultId);
  return r ? { id: r.id, title: r.title, image: r.image ?? null } : null;
}

export class QuizError extends Error {}

/** Quiz de conhecimento: qual era a opção certa da pergunta (e a explicação), logo depois de responder. */
export async function checkAnswer(slug: string, questionIndex: number, optionId: string) {
  const row = await getRow(slug);
  if (!row) throw new QuizError("Quiz não encontrado.");
  if (row.kind !== "conhecimento") throw new QuizError("Este quiz não tem resposta certa.");
  const q = normalizeQuizData(row.data).questions[questionIndex];
  if (!q || !q.options.some((o) => o.id === optionId)) throw new QuizError("Pergunta ou opção inválida.");
  return { correta: q.options.find((o) => o.correct)!.id, explicacao: q.explain };
}

const REPEAT_MINUTES = 10;

/** Calcula o resultado e conta a partida (uma por IP a cada 10 min por quiz; robôs não contam). */
export async function finishQuiz(slug: string, answers: unknown, opts: { ipHash: string | null; bot: boolean }): Promise<QuizFinish> {
  const row = await getRow(slug);
  if (!row) throw new QuizError("Quiz não encontrado.");
  const data = normalizeQuizData(row.data);
  if (!Array.isArray(answers) || answers.length !== data.questions.length || answers.some((a) => typeof a !== "string" || a.length > 40)) {
    throw new QuizError("Respostas inválidas.");
  }
  const outcome = quizOutcome(row.kind, data, answers as string[]);
  if (!outcome) throw new QuizError("Este quiz não tem resultados.");

  if (!opts.bot && hasDatabase()) {
    await tx(async (conn: PoolConnection) => {
      if (opts.ipHash) {
        const [rows] = await conn.query<import("mysql2/promise").RowDataPacket[]>(
          `SELECT 1 FROM quiz_plays WHERE quiz_id = ? AND ip_hash = ? AND created_at > UTC_TIMESTAMP(3) - INTERVAL ${REPEAT_MINUTES} MINUTE LIMIT 1`,
          [row.id, opts.ipHash],
        );
        if (rows.length) return false;
      }
      await conn.query("INSERT INTO quiz_plays (quiz_id, result_id, score, ip_hash) VALUES (?, ?, ?, ?)", [row.id, outcome.result.id, outcome.score, opts.ipHash]);
      await conn.query("INSERT INTO quiz_result_counts (quiz_id, result_id, plays_new) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE plays_new = plays_new + 1", [row.id, outcome.result.id]);
      await conn.query("UPDATE quizzes SET plays_new = plays_new + 1 WHERE id = ?", [row.id]);
      return true;
    });
  }

  const counts = await query<{ result_id: string; plays: number }>("SELECT result_id, plays_old + plays_new AS plays FROM quiz_result_counts WHERE quiz_id = ?", [row.id]);
  const finish: QuizFinish = {
    result: { id: outcome.result.id, title: outcome.result.title, description: outcome.result.description, ...(outcome.result.image ? { image: outcome.result.image } : {}) },
    score: outcome.score,
    total: outcome.total,
    sharePct: resultShare(counts, outcome.result.id),
  };
  if (row.kind === "conhecimento") {
    finish.review = data.questions.map((q, i) => ({
      questionId: q.id,
      escolhida: q.options.find((o) => o.id === answers[i])?.id ?? null,
      correta: q.options.find((o) => o.correct)?.id ?? "",
      ...(q.explain ? { explicacao: q.explain } : {}),
    }));
  }
  return finish;
}

// --------------------------------------------------------------------------------------------- importação

type OldQuiz = { id: string; slug: string; title: string; description: string | null; cover_url: string | null; kind: QuizKind; data: unknown; status: string; anilist_id: number | null; plays_count: number | null; published_at: string | null; created_at: string; updated_at: string };

/** Grava os quizzes do retrato. Nunca mexe em plays_new; apaga os que saíram do site antigo. */
export async function importQuizzes(s: { quizzes?: OldQuiz[]; quiz_result_counts?: { quiz_id: string; result_id: string; plays: number }[] }) {
  const puladas: string[] = [];
  const valid: { row: Record<string, unknown>; data: QuizData }[] = [];
  for (const q of s.quizzes ?? []) {
    if (q.status !== "published") continue;
    const data = normalizeQuizData(q.data);
    const problems = quizProblems({ title: q.title ?? "", slug: q.slug ?? "", kind: q.kind, data });
    if (problems.length) {
      puladas.push(`${q.slug}: ${problems[0]}`);
      continue;
    }
    valid.push({
      data,
      row: {
        id: q.id,
        slug: q.slug,
        title: q.title.slice(0, 140),
        description: (q.description ?? "").slice(0, 600),
        cover_url: q.cover_url,
        kind: q.kind,
        data: JSON.stringify(data),
        questions_count: data.questions.length,
        status: "published",
        anilist_id: q.anilist_id,
        plays_old: Number(q.plays_count ?? 0),
        published_at: toSqlDate(q.published_at),
        created_at: toSqlDate(q.created_at),
        updated_at: toSqlDate(q.updated_at),
      },
    });
  }
  const ids = valid.map((v) => v.row.id as string);
  await tx(async (conn) => {
    await upsert(conn, "quizzes", valid.map((v) => v.row), ["id"]);
    // O que saiu do site antigo sai daqui, com as contagens e as partidas.
    const [existing] = await conn.query<import("mysql2/promise").RowDataPacket[]>("SELECT id FROM quizzes");
    const gone = existing.map((r) => r.id as string).filter((id) => !ids.includes(id));
    for (let i = 0; i < gone.length; i += 200) {
      const part = gone.slice(i, i + 200);
      await conn.query("DELETE FROM quiz_result_counts WHERE quiz_id IN (?)", [part]);
      await conn.query("DELETE FROM quiz_plays WHERE quiz_id IN (?)", [part]);
      await conn.query("DELETE FROM quizzes WHERE id IN (?)", [part]);
    }
    const counts = (s.quiz_result_counts ?? []).filter((c) => ids.includes(c.quiz_id));
    await upsert(conn, "quiz_result_counts", counts.map((c) => ({ quiz_id: c.quiz_id, result_id: c.result_id, plays_old: Number(c.plays) })), ["quiz_id", "result_id"]);
  });
  return { quizzes: valid.length, partidas: valid.reduce((n, v) => n + Number(v.row.plays_old), 0), pulados: puladas.slice(0, 10) };
}

/** Para o sitemap: slug e datas dos publicados. */
export async function quizzesForSitemap() {
  if (!hasDatabase()) return [];
  return query<{ slug: string; updated_at: string | null; published_at: string | null }>(`SELECT slug, updated_at, published_at FROM quizzes WHERE ${VISIBLE} ORDER BY published_at DESC`);
}

/** Sugestões da busca do topo: quizzes publicados cujo título tem o termo. */
export async function sugerirQuizzes(q: string, limite = 2) {
  if (!hasDatabase()) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await query<QuizRow>(`SELECT ${CARD_COLS} FROM quizzes WHERE ${VISIBLE} AND title LIKE ? ORDER BY (plays_old + plays_new) DESC LIMIT ?`, [like, limite]);
  return rows.map(toCard);
}
