-- 003: notícias e artigos. Mesmos IDs (UUID) e slugs do site antigo, para os endereços não mudarem.
-- Enquanto o site antigo estiver no ar, a tarefa "copiar-conteudo-antigo" mantém estas tabelas em dia.

-- Quem assina as matérias: autores de IA (página /autores/<slug>) e pessoas (perfil /u/<usuário>).
CREATE TABLE IF NOT EXISTS post_authors (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  kind VARCHAR(10) NOT NULL,              -- ai | user
  slug VARCHAR(80) NOT NULL,              -- slug do autor de IA ou @ da pessoa
  name VARCHAR(120) NOT NULL,
  avatar_url VARCHAR(600) NULL,
  bio TEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_post_authors_kind_slug (kind, slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  kind VARCHAR(20) NOT NULL,              -- news | article
  description TEXT NULL,
  color VARCHAR(20) NULL,
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  UNIQUE KEY uq_tags_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Slugs antigos de tags que foram renomeadas: /tag/<antigo> redireciona para a atual.
CREATE TABLE IF NOT EXISTS tag_redirects (
  old_slug VARCHAR(160) NOT NULL PRIMARY KEY,
  tag_id CHAR(36) CHARACTER SET ascii NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  post_type VARCHAR(10) NOT NULL,         -- news (/noticias) | article (/artigos)
  slug VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL,            -- draft | published | scheduled
  title VARCHAR(300) NOT NULL,
  excerpt TEXT NULL,
  content_html MEDIUMTEXT NOT NULL,       -- HTML já limpo (sanitize) na gravação
  featured_image VARCHAR(600) NULL,
  author_id CHAR(36) CHARACTER SET ascii NULL,
  is_ai_generated TINYINT(1) NOT NULL DEFAULT 0,
  anilist_id INT NULL,
  focus_keyword VARCHAR(200) NULL,
  views_count INT NOT NULL DEFAULT 0,
  reading_minutes SMALLINT NOT NULL DEFAULT 1,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_posts_slug (slug),
  KEY idx_posts_list (status, post_type, published_at),
  KEY idx_posts_published (status, published_at),
  KEY idx_posts_author (author_id, published_at),
  KEY idx_posts_views (status, views_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_categories (
  post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  category_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (post_id, category_id),
  KEY idx_post_categories_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  tag_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  KEY idx_post_tags_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
