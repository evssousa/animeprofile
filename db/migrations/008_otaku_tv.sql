-- 008: vídeos do YouTube que aparecem dentro das matérias (Otaku TV, aba "Das matérias").
-- A tarefa "videos-materias" e a importação refazem esta tabela a partir do texto das matérias.
CREATE TABLE IF NOT EXISTS post_videos (
  video_id CHAR(11) CHARACTER SET ascii NOT NULL,
  post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (video_id, post_id),
  KEY idx_post_videos_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
