// Executa a agenda. A Hostinger chama /api/cron/tick a cada 5 minutos; o tick roda só as tarefas na hora.
//
// O LiteSpeed pode ter mais de um processo do app, e dois ticks podem chegar juntos: cada tarefa é
// "reservada" com um UPDATE condicional (só um processo consegue), e a reserva vence em leaseMinutes.
import { exec, query } from "../db.server";
import { JOBS, findJob, type Job } from "./jobs.server";
import { nextRun } from "./schedule";

type JobRow = { name: string; schedule: string; enabled: number; next_run_at: string | null; locked_until: string | null };

/** Garante uma linha por tarefa do catálogo; recalcula a próxima execução se o horário mudou. */
export async function syncJobs(now = new Date()) {
  for (const job of JOBS) {
    await exec(
      `INSERT INTO cron_jobs (name, schedule, next_run_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         next_run_at = IF(schedule <> VALUES(schedule) OR next_run_at IS NULL, VALUES(next_run_at), next_run_at),
         schedule = VALUES(schedule)`,
      [job.name, job.schedule, nextRun(job.schedule, now)],
    );
  }
}

/** Tenta reservar a tarefa. `force` ignora o horário (rodar agora pelo painel). */
async function claim(job: Job, now: Date, force: boolean): Promise<boolean> {
  const lease = new Date(now.getTime() + job.leaseMinutes * 60_000);
  const { affected } = await exec(
    `UPDATE cron_jobs SET locked_until = ?, next_run_at = ?
     WHERE name = ? AND (locked_until IS NULL OR locked_until < ?)
       ${force ? "" : "AND enabled = 1 AND next_run_at <= ?"}`,
    force ? [lease, nextRun(job.schedule, now), job.name, now] : [lease, nextRun(job.schedule, now), job.name, now, now],
  );
  return affected === 1;
}

async function execute(job: Job): Promise<{ status: "ok" | "error"; stats?: unknown; message?: string }> {
  const { insertId } = await exec("INSERT INTO cron_runs (job, started_at, status) VALUES (?, UTC_TIMESTAMP(3), 'running')", [job.name]);
  let result: { status: "ok" | "error"; stats?: unknown; message?: string };
  try {
    result = { status: "ok", stats: await job.run() };
  } catch (err) {
    result = { status: "error", message: String((err as Error)?.message ?? err).slice(0, 1000) };
    console.error(`[cron] ${job.name} falhou:`, err);
  }
  await exec("UPDATE cron_runs SET finished_at = UTC_TIMESTAMP(3), status = ?, message = ?, stats = ? WHERE id = ?", [
    result.status,
    result.message ?? null,
    result.stats === undefined ? null : JSON.stringify(result.stats),
    insertId,
  ]);
  await exec("UPDATE cron_jobs SET locked_until = NULL, last_run_at = UTC_TIMESTAMP(3), last_status = ? WHERE name = ?", [result.status, job.name]);
  return result;
}

/**
 * Reserva as tarefas na hora e as executa. Devolve os nomes reservados e uma promessa do fim:
 * a rota responde 202 sem esperar (a CDN da Hostinger corta respostas acima de ~55 s).
 */
export async function tick(now = new Date()) {
  await syncJobs(now);
  const due = await query<JobRow>(
    "SELECT name FROM cron_jobs WHERE enabled = 1 AND next_run_at <= ? AND (locked_until IS NULL OR locked_until < ?)",
    [now, now],
  );
  const claimed: Job[] = [];
  for (const row of due) {
    const job = findJob(row.name);
    if (job && (await claim(job, now, false))) claimed.push(job);
  }
  const done = (async () => {
    for (const job of claimed) await execute(job);
  })();
  return { started: claimed.map((j) => j.name), done };
}

/** Roda uma tarefa agora, fora do horário. `null` = não existe; `false` = já está rodando. */
export async function runNow(name: string, now = new Date()) {
  const job = findJob(name);
  if (!job) return null;
  await syncJobs(now);
  if (!(await claim(job, now, true))) return false;
  return execute(job);
}

/**
 * Registra em cron_runs uma execução que não é da agenda (ex.: importação enviada pelo script), para ela
 * aparecer no mesmo histórico (/api/cron/status e, depois, no painel admin).
 */
export async function trackRun(name: string, fn: () => Promise<unknown>) {
  const { insertId } = await exec("INSERT INTO cron_runs (job, started_at, status) VALUES (?, UTC_TIMESTAMP(3), 'running')", [name]);
  try {
    const stats = await fn();
    await exec("UPDATE cron_runs SET finished_at = UTC_TIMESTAMP(3), status = 'ok', stats = ? WHERE id = ?", [JSON.stringify(stats ?? null), insertId]);
    return { status: "ok" as const, stats };
  } catch (err) {
    const message = String((err as Error)?.message ?? err).slice(0, 1000);
    await exec("UPDATE cron_runs SET finished_at = UTC_TIMESTAMP(3), status = 'error', message = ? WHERE id = ?", [message, insertId]);
    console.error(`[import] ${name} falhou:`, err);
    return { status: "error" as const, message };
  }
}

export async function status(limit = 20) {
  const jobs = await query("SELECT name, schedule, enabled, next_run_at, locked_until, last_run_at, last_status FROM cron_jobs ORDER BY name");
  const runs = await query("SELECT id, job, started_at, finished_at, status, message, stats FROM cron_runs ORDER BY id DESC LIMIT ?", [limit]);
  return { jobs, runs };
}
