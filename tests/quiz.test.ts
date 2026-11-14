// Quiz: regras de resultado, gabarito fora da versão pública, partidas e importação (MySQL descartável).
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { parseChallenge } from "~/lib/quiz";
import { createPool, query, setPool } from "~/server/db.server";
import { normalizeQuizData, quizOutcome, quizProblems, resultShare } from "~/server/quiz/rules.server";
import { QuizError, checkAnswer, finishQuiz, getPublicQuiz, importQuizzes, listQuizzes, quizCounts } from "~/server/quiz/quiz.server";

let server: Awaited<ReturnType<typeof createDB>>;
const env = { ...process.env };

const opt = (id: string, text: string, extra: object = {}) => ({ id, text, ...extra });
const personalidade = {
  questions: [1, 2, 3].map((n) => ({ id: `q${n}`, text: `Pergunta ${n}`, options: [opt(`a${n}`, "A", { result: "r1" }), opt(`b${n}`, "B", { result: "r2" })] })),
  results: [
    { id: "r1", title: "Resultado 1", description: "d1" },
    { id: "r2", title: "Resultado 2", description: "d2" },
  ],
};
const conhecimento = {
  questions: [1, 2, 3].map((n) => ({ id: `q${n}`, text: `Pergunta ${n}`, explain: n === 1 ? "Porque sim." : undefined, options: [opt(`a${n}`, "A", { correct: true }), opt(`b${n}`, "B")] })),
  results: [
    { id: "ruim", title: "Iniciante", description: "", minScore: 0 },
    { id: "bom", title: "Mestre", description: "", minScore: 3 },
  ],
};
const old = (id: string, slug: string, kind: string, data: unknown, plays = 5) => ({
  id, slug, title: `Quiz ${slug}`, description: "desc", cover_url: null, kind, data, status: "published", anilist_id: null, plays_count: plays,
  published_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});
const P = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
});

afterAll(async () => {
  process.env = env;
  setPool(undefined);
  await server?.stop();
});

describe("regras", () => {
  it("personalidade: ganha quem somou mais; empate vale o último", () => {
    const d = normalizeQuizData(personalidade);
    expect(quizOutcome("personalidade", d, ["a1", "a2", "b3"])?.result.id).toBe("r1");
    expect(quizOutcome("personalidade", normalizeQuizData({ ...personalidade, questions: personalidade.questions.slice(0, 2) }), ["a1", "b2"])?.result.id).toBe("r2");
  });
  it("conhecimento: faixa pelo número de acertos", () => {
    const d = normalizeQuizData(conhecimento);
    expect(quizOutcome("conhecimento", d, ["a1", "a2", "a3"])).toMatchObject({ score: 3, result: { id: "bom" } });
    expect(quizOutcome("conhecimento", d, ["a1", "b2", "a3"])).toMatchObject({ score: 2, result: { id: "ruim" } });
  });
  it("problemas e porcentagem", () => {
    const d = normalizeQuizData({ ...conhecimento, questions: [] });
    expect(quizProblems({ title: "Quiz ok", slug: "quiz-ok", kind: "conhecimento", data: d })).toContain("Pelo menos 3 perguntas.");
    expect(resultShare([], "x")).toBeNull();
    expect(resultShare([{ result_id: "a", plays: 1 }, { result_id: "b", plays: 3 }], "b")).toBe(75);
  });
  it("desafio", () => {
    expect(parseChallenge("7-10", "Ana<b>")).toEqual({ score: 7, total: 10, from: "Anab" });
    expect(parseChallenge("11-10", null)).toBeNull();
  });
});

describe("banco", () => {
  it("importa, esconde o gabarito e confere respostas", async () => {
    const r = await importQuizzes({ quizzes: [old(P, "qual-voce-seria", "personalidade", personalidade, 5), old(C, "teste-geral", "conhecimento", conhecimento, 2), old("x", "ruim", "personalidade", { questions: [], results: [] })] as never, quiz_result_counts: [{ quiz_id: P, result_id: "r1", plays: 4 }, { quiz_id: P, result_id: "r2", plays: 1 }] });
    expect(r).toMatchObject({ quizzes: 2, partidas: 7 });
    expect(r.pulados).toHaveLength(1);
    expect(await quizCounts()).toEqual({ todos: 2, personalidade: 1, conhecimento: 1 });
    expect((await listQuizzes({ order: "jogados" }))[0].slug).toBe("qual-voce-seria");

    const pub = await getPublicQuiz("teste-geral");
    expect(JSON.stringify(pub)).not.toMatch(/correct|explain|minScore|Mestre/);
    expect(await checkAnswer("teste-geral", 0, "b1")).toEqual({ correta: "a1", explicacao: "Porque sim." });
    await expect(checkAnswer("teste-geral", 9, "a1")).rejects.toBeInstanceOf(QuizError);
    await expect(checkAnswer("qual-voce-seria", 0, "a1")).rejects.toBeInstanceOf(QuizError);
  });

  it("finaliza, conta uma partida por IP e ignora robôs", async () => {
    const f = await finishQuiz("teste-geral", ["a1", "a2", "a3"], { ipHash: "ip1", bot: false });
    expect(f).toMatchObject({ score: 3, total: 3, result: { id: "bom" } });
    expect(f.review).toHaveLength(3);
    await finishQuiz("teste-geral", ["a1", "a2", "a3"], { ipHash: "ip1", bot: false });
    await finishQuiz("teste-geral", ["a1", "a2", "a3"], { ipHash: "ip2", bot: true });
    const [row] = await query<{ plays_new: number }>("SELECT plays_new FROM quizzes WHERE slug = 'teste-geral'");
    expect(Number(row.plays_new)).toBe(1);
    await expect(finishQuiz("teste-geral", ["a1"], { ipHash: null, bot: false })).rejects.toBeInstanceOf(QuizError);
  });

  it("reimportar preserva as partidas novas e remove quizzes que saíram", async () => {
    const r = await importQuizzes({ quizzes: [old(C, "teste-geral", "conhecimento", conhecimento, 9)] as never, quiz_result_counts: [] });
    expect(r.quizzes).toBe(1);
    const rows = await query<{ slug: string; plays_old: number; plays_new: number }>("SELECT slug, plays_old, plays_new FROM quizzes");
    expect(rows).toHaveLength(1);
    expect([Number(rows[0].plays_old), Number(rows[0].plays_new)]).toEqual([9, 1]);
  });
});
