// Recebe imagens copiadas do site antigo (script do PC) e grava em MEDIA_DIR, servidas em /media/<nome>.
// Nomes aceitos: figurinhas/<24 hex do sha256>[-w400].<ext> e <bucket>/<caminho> das imagens do Storage do site antigo
// (post-images, profile-media, images, feed-images). O nome nunca é reaproveitado (cache de 1 ano em /media).
import { randomUUID } from "node:crypto";
import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mediaDir } from "../../../server-paths.mjs";

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const EXT = "(png|jpe?g|webp|gif|avif)";
const NAME_FIGURINHA = new RegExp(`^figurinhas/[a-f0-9]{24}(-w400)?\\.${EXT}$`);
// Segmentos sem ponto no começo (nada de ".." nem arquivo oculto) e só caracteres simples.
const NAME_STORAGE = new RegExp(`^(post-images|profile-media|images|feed-images)(/[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}){1,6}\\.${EXT}$`, "i");
export const isMediaName = (name: string) => name.length <= 400 && !name.includes("..") && (NAME_FIGURINHA.test(name) || NAME_STORAGE.test(name));

/** Assinatura dos bytes: PNG, JPEG, WebP, GIF ou AVIF. */
export function isImageBytes(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") return true;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return true;
  if (b.toString("latin1", 0, 3) === "GIF") return true;
  return b.toString("latin1", 4, 8) === "ftyp" && /avif|avis/.test(b.toString("latin1", 8, 16));
}

export class MediaError extends Error {}

export async function saveImportedMedia(name: string, bytes: Buffer): Promise<{ existia: boolean }> {
  if (!isMediaName(name)) throw new MediaError("nome inválido");
  if (bytes.length > MAX_MEDIA_BYTES) throw new MediaError("arquivo grande demais");
  if (!isImageBytes(bytes)) throw new MediaError("não é uma imagem");
  const target = join(mediaDir(), name);
  const exists = await access(target).then(() => true, () => false);
  if (exists) return { existia: true };
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, target);
  return { existia: false };
}
