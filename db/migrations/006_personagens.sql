-- 006: fichas de personagens (/animes/personagem/<id>), buscadas no AniList na primeira visita e guardadas por 7 dias.
CREATE TABLE IF NOT EXISTS anime_characters (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  data JSON NOT NULL,                 -- ficha pronta para a página (nomes, foto, descrição, animes, dubladores)
  fetched_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
