-- 014: métricas do painel (docs/plano-telas-painel.md, tela 2). Retrato semanal e registro de decisões.
-- Datas em UTC; a semana é a segunda-feira de Brasília. JSON gravado como texto (MariaDB: nada de CAST(? AS JSON)).

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  week DATE NOT NULL PRIMARY KEY,                -- segunda-feira (Brasília) da semana retratada
  data JSON NOT NULL,                            -- números da semana (formato em app/server/admin/metricas.server.ts)
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metrics_decisions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  problem VARCHAR(300) NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NULL,
  owner VARCHAR(120) NULL,
  review_at DATE NULL,
  dissent TEXT NULL,
  snapshot JSON NULL,                            -- números do momento em que foi decidida
  status VARCHAR(12) NOT NULL DEFAULT 'aberta',  -- aberta | revista
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_metrics_decisions_review (status, review_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
