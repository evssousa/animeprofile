-- 015: edição de matérias no painel (docs/plano-telas-painel.md, tela 3).
-- origin ganha o valor 'painel' (escrita no painel). edited_at marca o que foi editado no painel: a importação do site antigo
-- não sobrescreve essas matérias.
ALTER TABLE posts
  ADD COLUMN edited_at DATETIME(3) NULL AFTER updated_at;

-- Versões anteriores de cada matéria (as 20 últimas por matéria; a limpeza apaga o resto).
CREATE TABLE IF NOT EXISTS post_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  title VARCHAR(300) NOT NULL,
  excerpt TEXT NULL,
  content_html MEDIUMTEXT NOT NULL,
  featured_image VARCHAR(600) NULL,
  status VARCHAR(20) NOT NULL,
  saved_by VARCHAR(20) NOT NULL,                 -- painel | robo | agenda
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_post_revisions_post (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
