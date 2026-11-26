// Caminhos compartilhados entre o servidor Express (server-app.js) e o app.
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Pasta dos arquivos enviados (fotos, capas, imagens das matérias). Fica FORA da pasta do app:
 * na VPS é o volume /srv/sites/animeprofile/media montado em /data/media (MEDIA_DIR no Dockerfile). Servida em /media
 * com cache de 1 ano (o nome de um arquivo nunca é reaproveitado).
 */
export function mediaDir() {
  return process.env.MEDIA_DIR || join(homedir(), "animeprofile-media");
}
