// Métricas do painel com banco: números do período, os 5 cartões, matérias com mais entradas, origens por semana e retrato semanal.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, query, setPool } from "~/server/db.server";
import { calcularPeriodo, gravarRetrato, historico, maisEntradas, montarCartoes, origensSemanais, resumoMetricas, segundaDe, ultimaSemanaCompleta } from "~/server/admin/metricas.server";

let server: Awaited<ReturnType<typeof createDB>>;
const HOJE = "2026-11-19"; // quinta-feira

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));

  const dias = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => `2026-11-${String(de + i).padStart(2, "0")}`);
  for (const d of dias(12, 18)) await exec("INSERT INTO visit_daily (day, pageviews, entries, visitors) VALUES (?, 250, 100, 100)", [d]);
  for (const d of dias(5, 11)) await exec("INSERT INTO visit_daily (day, pageviews, entries, visitors) VALUES (?, 100, 50, 50)", [d]);
  await exec("INSERT INTO visit_dims (day, dim, value, n) VALUES ('2026-11-15', 'origem', 'busca', 70), ('2026-11-15', 'origem', 'direto', 30), ('2026-11-15', 'origem', 'interno', 999), ('2026-11-08', 'origem', 'busca', 10), ('2026-11-08', 'origem', 'direto', 40)");
  await exec("INSERT INTO visit_pages (day, path, kind, views, entries) VALUES ('2026-11-15', '/quiz/teste', 'quiz', 10, 0), ('2026-11-15', '/login', 'contas', 12, 0)");
  for (let i = 0; i < 4; i++) await exec("INSERT INTO quiz_plays (quiz_id, result_id, created_at) VALUES ('qqqqqqqq-0000-4000-8000-000000000001', 'r', '2026-11-15 15:00:00')");

  // matéria do robô publicada em 05/11 (meio-dia em Brasília = 15h UTC); agenda de 04/11; uma recente (15/11) que ainda não conta
  const post = (id: string, slug: string, origin: string, src: string | null, pub: string) =>
    exec("INSERT INTO posts (id, post_type, slug, status, title, content_html, origin, source_url, published_at, created_at, updated_at) VALUES (?, 'news', ?, 'published', ?, '<p>x</p>', ?, ?, ?, ?, ?)", [id, slug, `Título ${slug}`, origin, src, pub, pub, pub]);
  await post("pppppppp-0000-4000-8000-000000000001", "a", "robo", null, "2026-11-05 15:00:00");
  await post("pppppppp-0000-4000-8000-000000000002", "agenda-semana", "robo", "agenda de animes", "2026-11-04 12:00:00");
  await post("pppppppp-0000-4000-8000-000000000003", "recente", "robo", null, "2026-11-15 15:00:00");
  await exec("INSERT INTO visit_pages (day, path, kind, views, entries) VALUES ('2026-11-05', '/noticias/a', 'materia', 10, 6), ('2026-11-08', '/noticias/a', 'materia', 20, 9), ('2026-11-12', '/noticias/a', 'materia', 100, 0)");
});
afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("datas", () => {
  it("a semana começa na segunda; a tarefa de segunda grava a semana anterior", () => {
    expect(segundaDe("2026-11-19")).toBe("2026-11-16");
    expect(segundaDe("2026-11-16")).toBe("2026-11-16");
    expect(segundaDe("2026-11-22")).toBe("2026-11-16"); // domingo
    expect(ultimaSemanaCompleta("2026-11-19")).toBe("2026-11-09");
    expect(ultimaSemanaCompleta("2026-11-16")).toBe("2026-11-09");
  });
});

describe("números do período e os 5 cartões", () => {
  it("calcula visitantes por dia, páginas por visita, busca (sem a navegação interna), quiz e procura por contas", async () => {
    const a = await calcularPeriodo("2026-11-12", "2026-11-18");
    expect(a).toMatchObject({ visitantesDia: 100, paginasPorVisita: 2.5, buscaPct: 70, quizConclusaoPct: 40, procuraContas: 12 });
    expect(a.entradasPorOrigem).toEqual({ busca: 70, direto: 30 });
    expect(a.publicadas).toEqual({ robo: 1, agenda: 0, painel: 0, old: 0 });
  });

  it("compara com os 7 dias anteriores (% nas contagens, pontos nas porcentagens) e diz 'sem base' quando falta", async () => {
    const a = await calcularPeriodo("2026-11-12", "2026-11-18");
    const b = await calcularPeriodo("2026-11-05", "2026-11-11");
    const c = Object.fromEntries(montarCartoes(a, b).map((x) => [x.id, x]));
    expect(c.visitantes).toMatchObject({ valor: 100, delta: 100, unidadeDelta: "%" });
    expect(c.busca).toMatchObject({ valor: 70, delta: 50, unidadeDelta: "pts" }); // 70% contra 20%
    expect(c.quiz.delta).toBeNull(); // semana anterior sem quiz
    expect(c.contas.piorar).toContain("fase 2");
  });

  it("período sem visitas devolve vazios, nunca zero falso nas razões", async () => {
    const v = await calcularPeriodo("2026-01-01", "2026-01-07");
    expect(v).toMatchObject({ visitantesDia: 0, paginasPorVisita: null, buscaPct: null, quizConclusaoPct: null, procuraContas: 0 });
  });
});

describe("entradas e origens", () => {
  it("lista as matérias que mais trouxeram entradas em 30 dias, com o título", async () => {
    const r = await maisEntradas(HOJE);
    expect(r[0]).toEqual({ path: "/noticias/a", titulo: "Título a", entradas: 15 });
  });

  it("origens por semana: 8 semanas, a última é a atual, sem a navegação interna", async () => {
    const s = await origensSemanais(HOJE);
    expect(s).toHaveLength(8);
    expect(s.at(-1)?.semana).toBe("2026-11-16");
    const dia15 = s.find((x) => x.semana === "2026-11-09")!;
    expect(dia15.valores).toEqual({ busca: 70, direto: 30 });
    expect(s.find((x) => x.semana === "2026-11-02")!.valores).toEqual({ busca: 10, direto: 40 });
  });
});

describe("retrato semanal", () => {
  it("gravar o retrato duas vezes mantém uma linha só (a semana é a chave)", async () => {
    await gravarRetrato("2026-11-09");
    await gravarRetrato("2026-11-09");
    const h = await historico();
    expect(h).toHaveLength(1);
    expect(h![0]).toMatchObject({ semana: "2026-11-09", dados: { v: 1, visitantesDia: 79 } });
  });

  it("resumo da tela junta tudo e avisa quando falta a migration (tabela ausente vira null)", async () => {
    const r = await resumoMetricas(HOJE);
    expect(r.cartoes).toHaveLength(5);
    expect(r.semBase).toBe(false);
    expect(r.historico).not.toBeNull();
    await exec("DROP TABLE metrics_snapshots");
    const sem = await resumoMetricas(HOJE);
    expect(sem.historico).toBeNull();
  });
});
