-- 004: largura e altura da capa de cada matéria (medidas na exportação). A página inicial só usa na capa
-- grande as imagens com pelo menos 1280 px de largura; as menores aparecem desfocadas como fundo.
ALTER TABLE posts
  ADD COLUMN image_width SMALLINT UNSIGNED NULL AFTER featured_image,
  ADD COLUMN image_height SMALLINT UNSIGNED NULL AFTER image_width;
