-- 011: catálogo de figurinhas (só visualização até as contas). Vem do site antigo pela exportação.
-- As imagens ficam em /media/figurinhas/ (arquivo original, sem recompressão) e a miniatura WebP ao lado.
CREATE TABLE IF NOT EXISTS sticker_albums (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  cover_url VARCHAR(600) NULL,
  anilist_id INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  available_from DATETIME(3) NULL,
  available_until DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_album_slug (slug),
  KEY idx_album_order (sort_order, created_at),
  KEY idx_album_anime (anilist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- O id é texto no site antigo (ex.: "ds1"); a coleção dos usuários (fase das contas) aponta para ele.
CREATE TABLE IF NOT EXISTS sticker_catalog (
  id VARCHAR(64) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  album_id CHAR(36) CHARACTER SET ascii NULL,
  name VARCHAR(160) NULL,
  rarity VARCHAR(10) NOT NULL,
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  image_url VARCHAR(600) NULL,
  thumb_url VARCHAR(600) NULL,
  image_width SMALLINT UNSIGNED NULL,
  image_height SMALLINT UNSIGNED NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_sticker_album (album_id, sort_order, created_at),
  CONSTRAINT chk_sticker_rarity CHECK (rarity IN ('comum', 'raro', 'epico', 'lendario'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Álbum em destaque da semana (um por semana ISO, ex.: "2026-W46"). O desconto só vale quando houver pacotes.
CREATE TABLE IF NOT EXISTS weekly_featured_album (
  week_key VARCHAR(10) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  album_id CHAR(36) CHARACTER SET ascii NULL,
  discount_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
  computed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
