-- 005: animes. Os dados vêm do AniList (API pública e gratuita) pela tarefa "animes-anilist", que guarda aqui a
-- temporada atual, os animes em alta e os horários de episódio. As sinopses em português vêm do site antigo.
CREATE TABLE IF NOT EXISTS anime_catalog (
  anilist_id INT UNSIGNED NOT NULL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,                -- título principal (o "preferido" do AniList)
  title_english VARCHAR(300) NULL,
  title_native VARCHAR(300) NULL,
  cover_url VARCHAR(600) NULL,
  cover_color VARCHAR(10) NULL,
  banner_url VARCHAR(600) NULL,
  format VARCHAR(20) NULL,
  status VARCHAR(20) NULL,
  episodes SMALLINT UNSIGNED NULL,
  duration SMALLINT UNSIGNED NULL,
  season VARCHAR(10) NULL,
  season_year SMALLINT UNSIGNED NULL,
  start_date DATE NULL,
  genres JSON NULL,
  studios JSON NULL,
  popularity INT UNSIGNED NOT NULL DEFAULT 0,
  favourites INT UNSIGNED NOT NULL DEFAULT 0,
  average_score TINYINT UNSIGNED NULL,
  synopsis_en TEXT NULL,
  synopsis_pt TEXT NULL,                       -- tradução (site antigo / robô); quando falta, a página usa a em inglês
  trailer_youtube VARCHAR(40) NULL,
  streamers JSON NULL,                         -- chaves: netflix, crunchyroll, disney, prime, hbo
  characters JSON NULL,                        -- até 12 personagens com dublador japonês (só na página do anime)
  is_adult TINYINT(1) NOT NULL DEFAULT 0,
  trending_rank SMALLINT UNSIGNED NULL,        -- posição em "em alta nesta semana" (Top 10 da home)
  next_episode SMALLINT UNSIGNED NULL,
  next_airing_at DATETIME(3) NULL,
  details_at DATETIME(3) NULL,                 -- quando a ficha completa (personagens) foi buscada
  synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_anime_season (season_year, season, popularity),
  KEY idx_anime_trending (trending_rank),
  KEY idx_anime_next (next_airing_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Horários de episódio (calendário e "No ar hoje"). A tarefa guarda os próximos 8 dias e apaga os antigos.
CREATE TABLE IF NOT EXISTS anime_airing (
  anilist_id INT UNSIGNED NOT NULL,
  episode SMALLINT UNSIGNED NOT NULL,
  airing_at DATETIME(3) NOT NULL,
  PRIMARY KEY (anilist_id, episode),
  KEY idx_airing_at (airing_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
