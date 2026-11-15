-- 012: robô de notícias (fase A). Configuração vinda do site antigo, candidatos, rodadas e uso do Gemini.
-- Datas em UTC (o código grava com UTC_TIMESTAMP(3)).

-- De onde veio cada matéria: 'old' (importada do site antigo) ou 'robo' (publicada aqui).
-- A importação do site antigo só apaga e religa as matérias 'old'.
ALTER TABLE posts
  ADD COLUMN origin VARCHAR(10) NOT NULL DEFAULT 'old' AFTER is_ai_generated,
  ADD COLUMN source_url VARCHAR(600) NULL AFTER origin,
  ADD KEY idx_posts_origin (origin, created_at),
  ADD KEY idx_posts_source (source_url(255));

CREATE TABLE IF NOT EXISTS ai_news_sources (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,   -- mesmo UUID do site antigo
  name VARCHAR(120) NOT NULL,
  base_url VARCHAR(600) NOT NULL,
  rss_url VARCHAR(600) NULL,
  priority SMALLINT NOT NULL DEFAULT 5,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_fetched_at DATETIME(3) NULL,
  last_status VARCHAR(20) NULL,                            -- ok | discovered | no_rss | failed
  fail_streak SMALLINT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuração dos autores de IA. O nome, o slug e o avatar ficam em post_authors (kind = 'ai'), mesmo id.
CREATE TABLE IF NOT EXISTS ai_news_authors (
  author_id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL,                     -- ex.: 'Animes e Mangás' (igual a categories.name)
  specialty TEXT NULL,                                     -- system_prompt antigo: só para escolher o autor
  auto_publish TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lista negra (kind = 'block') e tópicos prioritários (kind = 'topic', com peso).
CREATE TABLE IF NOT EXISTS ai_news_terms (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(10) NOT NULL,
  term VARCHAR(160) NOT NULL,
  weight SMALLINT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ai_news_terms (kind, term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quantas notícias em cada hora (horário de Brasília). Vazia = horários padrão do código.
CREATE TABLE IF NOT EXISTS ai_news_schedule_slots (
  hour TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  posts SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_news_candidates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_id CHAR(36) CHARACTER SET ascii NULL,
  dedup_hash CHAR(40) CHARACTER SET ascii NOT NULL,        -- sha1(título normalizado | host)
  title VARCHAR(400) NOT NULL,
  summary TEXT NULL,
  content MEDIUMTEXT NULL,
  source_url VARCHAR(600) NOT NULL,
  image_url VARCHAR(600) NULL,
  video_url VARCHAR(600) NULL,
  published_at DATETIME(3) NULL,
  score SMALLINT NOT NULL DEFAULT 0,
  score_breakdown JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',           -- pending | selected | published | draft | discarded | failed | rehearsal
  discard_reason VARCHAR(500) NULL,
  result_json MEDIUMTEXT NULL,                             -- texto gerado no ensaio (para a prévia)
  post_id CHAR(36) CHARACTER SET ascii NULL,
  run_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ai_news_candidates_hash (dedup_hash),
  KEY idx_ai_news_candidates_status (status, score),
  KEY idx_ai_news_candidates_created (created_at),
  KEY idx_ai_news_candidates_url (source_url(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_news_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  status VARCHAR(20) NOT NULL,                             -- running | finished | expired | error
  mode VARCHAR(12) NOT NULL,                               -- ensaio | rascunho | publicar
  slot CHAR(2) NULL,
  limit_n SMALLINT NOT NULL DEFAULT 0,
  generated_count SMALLINT NOT NULL DEFAULT 0,
  discarded SMALLINT NOT NULL DEFAULT 0,
  failed SMALLINT NOT NULL DEFAULT 0,
  report JSON NULL,
  KEY idx_ai_news_runs_started (started_at),
  KEY idx_ai_news_runs_status (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada chamada ao Gemini (também as que deram 429): conta o uso do dia por modelo.
CREATE TABLE IF NOT EXISTS ai_news_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT UNSIGNED NULL,
  candidate_id BIGINT UNSIGNED NULL,
  model VARCHAR(60) NOT NULL,
  status_code SMALLINT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_ai_news_usage_created (created_at, model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuração do robô. Nasce desligado: só liga de propósito (passo 13).
INSERT IGNORE INTO system_config (name, value) VALUES
  ('robo', JSON_OBJECT(
    'modo', 'desligado',
    'limiteDia', 10,
    'foraDeAnimePct', 33,
    'imagensCorpo', 3,
    'modelo', 'gemini-3-flash-preview',
    'chamadasDiaPorModelo', 40
  ));
