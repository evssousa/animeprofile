// Catálogo das tarefas agendadas. O horário mora aqui (versionado); o estado mora em cron_jobs.
// Cada tarefa devolve um resumo curto (vai para cron_runs.stats) ou lança erro.
import { syncAnimes } from "../anime/anime.server";
import { exec } from "../db.server";

export type JobStats = Record<string, unknown>;
export type Job = {
  name: string;
  /** Cron de 5 campos, no horário de Brasília. */
  schedule: string;
  /** Tempo máximo esperado; depois disso a trava vence e a tarefa pode rodar de novo. */
  leaseMinutes: number;
  run: () => Promise<JobStats>;
};

export const JOBS: Job[] = [
  {
    name: "limpeza",
    schedule: "30 4 * * *",
    leaseMinutes: 10,
    async run() {
      const old = await exec("DELETE FROM cron_runs WHERE started_at < UTC_TIMESTAMP(3) - INTERVAL 30 DAY");
      const stuck = await exec(
        "UPDATE cron_runs SET status = 'error', finished_at = UTC_TIMESTAMP(3), message = 'não terminou (processo reiniciado?)' WHERE status = 'running' AND started_at < UTC_TIMESTAMP(3) - INTERVAL 1 DAY",
      );
      return { execucoesApagadas: old.affected, execucoesTravadas: stuck.affected };
    },
  },
  {
    // Temporada atual, em alta nesta semana e episódios dos próximos 8 dias, do AniList (gratuito, sem chave).
    name: "animes-anilist",
    schedule: "10 */6 * * *",
    leaseMinutes: 10,
    run: () => syncAnimes(),
  },
];

export const findJob = (name: string) => JOBS.find((j) => j.name === name);
