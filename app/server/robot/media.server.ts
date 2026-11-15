// Mídia da matéria com rede: mede as imagens, escolhe a capa e guarda cópias próprias em /media/robo (WebP 1280 + 640).
import { createHash } from "node:crypto";
import sharp from "sharp";
import { saveRobotMedia } from "../content/media-import.server";
import { COVER_MIN_W, MIN_IMG_H, MIN_IMG_W, extractMedia, imageSizeFromBytes, pickCover } from "./media";
import { botFetch, readLimited } from "./net.server";

const MAIN_WIDTH = 1280;
const THUMB_WIDTH = 640;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export type MediaResult = { ok: true; cover: string; coverW: number; coverH: number; bodyImages: string[]; trailer?: string; videos: string[] } | { ok: false; reason: string };

/** Mede a imagem lendo só o começo do arquivo. */
export async function probeImageSize(url: string): Promise<{ w: number; h: number } | null> {
  try {
    const res = await botFetch(url, { headers: { Range: "bytes=0-65535", Accept: "image/*" }, timeoutMs: 8000 });
    if (!res || (!res.ok && res.status !== 206)) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 65536) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    await reader.cancel().catch(() => {});
    return imageSizeFromBytes(Buffer.concat(chunks));
  } catch {
    return null;
  }
}

/**
 * Junta a imagem do RSS, o og:image e as do corpo, mede cada uma e escolhe a capa (de preferência ≥ 1200 px).
 * Sem nenhuma imagem utilizável o candidato é descartado ANTES de chamar o Gemini.
 */
export async function collectAndValidateMedia(opts: {
  candidateImageUrl: string | null;
  ogImage: string | null;
  candidateVideoUrl: string | null;
  scrapedHtml?: string;
  scrapedRawHtml?: string;
  scrapedLinks?: string[];
  bodyImageLimit: number;
}): Promise<MediaResult> {
  const media = extractMedia({ html: opts.scrapedHtml, rawHtml: opts.scrapedRawHtml, links: opts.scrapedLinks, candidateVideo: opts.candidateVideoUrl, excludeImage: opts.candidateImageUrl, imageLimit: opts.bodyImageLimit });
  const urls = new Set<string>();
  if (opts.candidateImageUrl) urls.add(opts.candidateImageUrl);
  if (opts.ogImage) urls.add(opts.ogImage);
  for (const img of media.images) urls.add(img);

  const probed: { url: string; w: number; h: number }[] = [];
  for (const url of urls) {
    const d = await probeImageSize(url);
    if (d && d.w >= MIN_IMG_W && d.h >= MIN_IMG_H) probed.push({ url, ...d });
  }
  const cover = pickCover(probed);
  if (!cover) return { ok: false, reason: "sem imagem utilizável na fonte" };
  const body = new Set(media.images);
  let bodyImages = probed.filter((p) => body.has(p.url)).slice(0, opts.bodyImageLimit).map((p) => p.url);
  if (!bodyImages.length) bodyImages = [cover.url];
  return { ok: true, cover: cover.url, coverW: cover.w, coverH: cover.h, bodyImages, trailer: media.trailer, videos: media.videos };
}

export const mediaKey = (sourceUrl: string) => createHash("sha1").update(sourceUrl).digest("hex").slice(0, 24);

/** Troca, no HTML, cada endereço (também na forma com &amp;) pelo nosso. */
export function replaceImageUrls(html: string, map: Map<string, string>): string {
  let out = html;
  for (const [from, to] of map) out = out.split(from.replace(/&/g, "&amp;")).join(to).split(from).join(to);
  return out;
}

export type LocalImage = { url: string; width: number; height: number };

/** Converte uma imagem em WebP 1280 + miniatura 640 e guarda em /media/robo. GIF e SVG ficam de fora. */
export async function localizeBuffer(sourceUrl: string, bytes: Buffer): Promise<LocalImage> {
  const meta = await sharp(bytes).metadata();
  if ((meta.pages ?? 1) > 1) throw new Error("imagem animada");
  const main = await sharp(bytes).rotate().resize({ width: MAIN_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const thumb = await sharp(bytes).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  const url = await saveRobotMedia(mediaKey(sourceUrl), main.data, thumb);
  return { url, width: main.info.width, height: main.info.height };
}

/** Baixa e guarda as imagens; devolve origem → cópia nossa (só das que deram certo; as outras ficam com o endereço da fonte). */
export async function localizeImages(urls: string[], log: (m: string) => void): Promise<Map<string, LocalImage>> {
  const map = new Map<string, LocalImage>();
  for (const url of new Set(urls.filter((u) => /^https?:\/\//.test(u)))) {
    try {
      const res = await botFetch(url, { headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: `${new URL(url).origin}/` }, timeoutMs: 20_000 });
      const type = res?.headers.get("content-type") ?? "";
      if (!res?.ok || !type.startsWith("image/") || /svg|gif/i.test(type)) continue;
      const bytes = await readLimited(res, MAX_SOURCE_BYTES);
      if (!bytes) continue;
      map.set(url, await localizeBuffer(url, bytes));
    } catch (e) {
      log(`Imagem mantida da fonte (${e instanceof Error ? e.message : String(e)}): ${url}`);
    }
  }
  return map;
}

export { COVER_MIN_W };
