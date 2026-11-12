-- 001: base do sistema. Configurações gerais e agenda das tarefas (cron).
-- Charset utf8mb4 e datas em UTC em todas as tabelas.

CREATE TABLE IF NOT EXISTS system_config (
  name VARCHAR(100) NOT NULL PRIMARY KEY,
  value JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uma linha por tarefa. O horário (schedule) vem do código (app/server/cron/jobs.server.ts);
-- aqui fica o estado: ligada ou não, próxima execução e a trava contra rodar duas vezes ao mesmo tempo.
CREATE TABLE IF NOT EXISTS cron_jobs (
  name VARCHAR(60) NOT NULL PRIMARY KEY,
  schedule VARCHAR(100) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  next_run_at DATETIME(3) NULL,
  locked_until DATETIME(3) NULL,
  last_run_at DATETIME(3) NULL,
  last_status VARCHAR(20) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico de execuções (aparece no painel admin). A limpeza diária apaga o que tem mais de 30 dias.
CREATE TABLE IF NOT EXISTS cron_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job VARCHAR(60) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  status VARCHAR(20) NOT NULL,
  message VARCHAR(1000) NULL,
  stats JSON NULL,
  KEY idx_cron_runs_job (job, started_at),
  KEY idx_cron_runs_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
