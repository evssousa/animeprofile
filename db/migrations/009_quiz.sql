-- 009: quizzes gerados no painel admin do site antigo (vêm pela exportação) e as partidas jogadas aqui.
-- `data` guarda perguntas, opções e resultados com o gabarito; a página nunca recebe esse JSON inteiro.
CREATE TABLE IF NOT EXISTS quizzes (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  slug VARCHAR(90) NOT NULL,
  title VARCHAR(140) NOT NULL,
  description VARCHAR(600) NOT NULL DEFAULT '',
  cover_url VARCHAR(600) NULL,
  kind VARCHAR(20) NOT NULL,                       -- personalidade | conhecimento
  data JSON NOT NULL,
  questions_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'published', -- draft | published
  anilist_id INT UNSIGNED NULL,
  plays_old INT UNSIGNED NOT NULL DEFAULT 0,       -- partidas do site antigo (a importação só mexe aqui)
  plays_new INT UNSIGNED NOT NULL DEFAULT 0,       -- partidas jogadas no site novo
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),  -- sem ON UPDATE: contar partida não muda a data
  UNIQUE KEY uq_quiz_slug (slug),
  KEY idx_quiz_pub (status, published_at),
  CONSTRAINT chk_quiz_kind CHECK (kind IN ('personalidade', 'conhecimento')),
  CONSTRAINT chk_quiz_status CHECK (status IN ('draft', 'published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quantos tiveram cada resultado ("23% tiveram esse resultado").
CREATE TABLE IF NOT EXISTS quiz_result_counts (
  quiz_id CHAR(36) CHARACTER SET ascii NOT NULL,
  result_id VARCHAR(40) NOT NULL,
  plays_old INT UNSIGNED NOT NULL DEFAULT 0,
  plays_new INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada partida terminada no site novo. user_id fica NULL até as contas existirem (as missões vão contar por aqui).
CREATE TABLE IF NOT EXISTS quiz_plays (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quiz_id CHAR(36) CHARACTER SET ascii NOT NULL,
  result_id VARCHAR(40) NOT NULL,
  score SMALLINT UNSIGNED NULL,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  ip_hash CHAR(64) NULL,                           -- hash do IP com o dia (não guarda o IP); só para não contar repetido
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_plays_quiz (quiz_id, created_at),
  KEY idx_plays_ip (ip_hash, quiz_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
