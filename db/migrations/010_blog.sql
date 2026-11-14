-- 010: blog da comunidade (só leitura até as contas). Vem do site antigo pela exportação.
-- O texto original é Markdown (content_md); content_html é gerado e limpo na importação.
-- Os autores ficam em post_authors (kind = 'user', slug = username), a mesma tabela dos comentários das matérias.
CREATE TABLE IF NOT EXISTS blog_posts (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  author_id CHAR(36) CHARACTER SET ascii NOT NULL,
  slug VARCHAR(200) NOT NULL,
  title VARCHAR(300) NOT NULL,
  excerpt TEXT NULL,
  content_md MEDIUMTEXT NOT NULL,
  content_html MEDIUMTEXT NOT NULL,
  cover_url VARCHAR(600) NULL,
  focus_keyword VARCHAR(200) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  promoted_post_id CHAR(36) CHARACTER SET ascii NULL,
  views_count INT UNSIGNED NOT NULL DEFAULT 0,
  likes_count INT UNSIGNED NOT NULL DEFAULT 0,
  claps_count INT UNSIGNED NOT NULL DEFAULT 0,
  bookmarks_count INT UNSIGNED NOT NULL DEFAULT 0,
  comments_count INT UNSIGNED NOT NULL DEFAULT 0,
  quality_score SMALLINT NOT NULL DEFAULT 0,
  reading_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_blog_slug (slug),
  KEY idx_blog_pub (status, published_at),
  KEY idx_blog_author (author_id, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorias e tags são de cada autor (como no site antigo); /blog/categoria/:slug junta as de mesmo slug.
CREATE TABLE IF NOT EXISTS blog_categories (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_blog_cat_user (user_id, slug),
  KEY idx_blog_cat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_tags (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_blog_tag_user (user_id, slug),
  KEY idx_blog_tag_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_post_categories (
  blog_post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  category_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (blog_post_id, category_id),
  KEY idx_bpc_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_post_tags (
  blog_post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  tag_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (blog_post_id, tag_id),
  KEY idx_bpt_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentários dos posts (só leitura por enquanto; os escondidos por denúncia não vêm).
CREATE TABLE IF NOT EXISTS blog_post_comments (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  blog_post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  author_id CHAR(36) CHARACTER SET ascii NOT NULL,
  parent_id CHAR(36) CHARACTER SET ascii NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_bcomments_post (blog_post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
