// Executor do cron contra um MySQL de verdade (descartável): migrations, reserva sem duplicar e histórico.
import { createDB } from "mysql-memory-server";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, query, setPool } from "~/server/db.server";
import { runNow, status, tick } from "~/server/cron/runner.server";

let server: Awaited<ReturnType<typeof createDB>>;
let pool: mysql.Pool;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  pool = createPool({ ...config, connectionLimit: 5 });
  setPool(pool);
});

afterAll(async () => {
  setPool(undefined);
  await pool?.end();
  await server?.stop();
});

describe("cron", () => {
  it("migrations são idempotentes", async () => {
    const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName };
    expect(await migrate(config, () => {})).toEqual([]);
  });

  it("primeiro tick só agenda; a tarefa roda quando chega a hora, uma vez só", async () => {
    const t0 = new Date("2026-11-12T06:00:00Z"); // 03:00 em Brasília
    expect((await tick(t0)).started).toEqual([]);
    const [job] = await query<{ next_run_at: string }>("SELECT next_run_at FROM cron_jobs WHERE name = 'limpeza'");
    expect(job.next_run_at).toBe("2026-11-12 07:30:00.000");

    // Dois ticks ao mesmo tempo (dois processos do LiteSpeed): só um reserva.
    const t1 = new Date("2026-11-12T07:31:00Z");
    const [a, b] = await Promise.all([tick(t1), tick(t1)]);
    expect([...a.started, ...b.started]).toEqual(["limpeza"]);
    await Promise.all([a.done, b.done]);

    const runs = await query<{ job: string; status: string }>("SELECT job, status FROM cron_runs ORDER BY job");
    expect(runs).toEqual([{ job: "limpeza", status: "ok" }]);
    const [after] = await query<{ next_run_at: string; locked_until: string | null; last_status: string }>(
      "SELECT next_run_at, locked_until, last_status FROM cron_jobs WHERE name = 'limpeza'",
    );
    expect(after).toEqual({ next_run_at: "2026-11-13 07:30:00.000", locked_until: null, last_status: "ok" });

    // Antes da próxima hora, nada roda.
    // 08:00 UTC: a limpeza já rodou e a dos animes (06:10 em Brasília = 09:10 UTC) ainda não chegou.
    const late = await tick(new Date("2026-11-12T08:00:00Z"));
    expect(late.started).toEqual([]);
    await late.done;
  });

  it("rodar agora: tarefa desconhecida, sucesso e histórico no status", async () => {
    expect(await runNow("nao-existe")).toBeNull();
    const result = await runNow("limpeza");
    expect(result && result.status).toBe("ok");
    const s = await status(5);
    expect(s.runs.filter((r) => (r as { job: string }).job === "limpeza").length).toBe(2);
    expect(s.jobs.map((j) => (j as { name: string }).name)).toEqual(["animes-anilist", "limpeza"]);
  });
});
