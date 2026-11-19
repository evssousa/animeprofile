// Catálogo das tarefas agendadas. O horário mora aqui (versionado); o estado mora em cron_jobs.
// Cada tarefa devolve um resumo curto (vai para cron_runs.stats) ou lança erro.
import { publishWeeklyAgenda } from "../agenda/agenda.server";
import { syncAnimes } from "../anime/anime.server";
import { rebuildPostVideos } from "../tv/tv.server";
import { exec } from "../db.server";
import { limparVisitas } from "~/visitas/server/limpeza.server";
import { runRobot } from "../robot/run.server";

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
      const cands = await exec("DELETE FROM ai_news_candidates WHERE created_at < UTC_TIMESTAMP(3) - INTERVAL 30 DAY AND status NOT IN ('published', 'draft')");
      const usage = await exec("DELETE FROM ai_news_usage WHERE created_at < UTC_TIMESTAMP(3) - INTERVAL 60 DAY");
      const visitas = await limparVisitas();
      const runs = await exec("DELETE FROM ai_news_runs WHERE started_at < UTC_TIMESTAMP(3) - INTERVAL 60 DAY");
      return { execucoesApagadas: old.affected, execucoesTravadas: stuck.affected, candidatosApagados: cands.affected, usoApagado: usage.affected, rodadasApagadas: runs.affected, ...visitas };
    },
  },
  {
    // Robô de notícias. Minuto 20: não cruza com animes-anilist (:10) nem videos-materias (:40). Com modo "desligado" não faz nada.
    name: "robo-noticias",
    schedule: "20 * * * *",
    leaseMinutes: 15,
    run: () => runRobot({}),
  },
  {
    // Vídeos do YouTube dentro das matérias (Otaku TV). A importação também refaz a tabela.
    name: "videos-materias",
    schedule: "40 */6 * * *",
    leaseMinutes: 5,
    run: () => rebuildPostVideos(),
  },
  {
    // Agenda de animes da semana: toda segunda às 9h (Brasília). A capa gira a cada semana. Se a matéria já existe, atualiza.
    name: "agenda-semanal",
    schedule: "0 9 * * 1",
    leaseMinutes: 10,
    run: () => publishWeeklyAgenda(),
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
