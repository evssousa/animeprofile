-- 007: comentários das matérias. Por enquanto vêm do site antigo (só leitura); comentar no site novo chega com as
-- contas. Os autores ficam em post_authors (kind = 'user'), a mesma tabela dos autores das matérias.
CREATE TABLE IF NOT EXISTS post_comments (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  author_id CHAR(36) CHARACTER SET ascii NOT NULL,
  parent_id CHAR(36) CHARACTER SET ascii NULL,  -- resposta a outro comentário
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_comments_post (post_id, created_at),
  KEY idx_comments_recent (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
