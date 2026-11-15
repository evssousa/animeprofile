// Escolha de imagens e vídeos de uma matéria (partes puras, portadas de worker/media.ts).

export type ExtractedMedia = { trailer?: string; images: string[]; videos: string[] };

export const MIN_IMG_W = 360;
export const MIN_IMG_H = 300;
export const COVER_MIN_W = 1200; // tamanho que o Google Discover usa para prévia grande

export function isEmojiUrl(u: string): boolean {
  return (
    /(?:^|[\/._-])(?:emoji|emojis|emoticon|emoticons|smilie|smilies|smiley|wp-smiley|twemoji|openmoji|noto-emoji)(?:[\/._-]|$)/i.test(u) ||
    /s\.w\.org\/images\/core\/emoji/i.test(u) ||
    /twemoji\.maxcdn\.com|abs-\d+\.twimg\.com\/emoji|jsdelivr\.net\/gh\/twitter\/twemoji/i.test(u)
  );
}

const YT_ONE = [
  /(?:https?:)?\/\/(?:www\.|m\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/i,
  /(?:https?:)?\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^"'\s<>]*v=([A-Za-z0-9_-]{11})/i,
  /(?:https?:)?\/\/youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /(?:https?:)?\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,
  /(?:https?:)?\/\/(?:www\.|m\.)?youtube\.com\/v\/([A-Za-z0-9_-]{11})/i,
];

/** Trailer, vídeos extras e imagens do corpo de uma página já lida (sem rede). */
export function extractMedia(opts: { html?: string; rawHtml?: string; links?: string[]; candidateVideo?: string | null; excludeImage?: string | null; imageLimit?: number }): ExtractedMedia {
  const out: ExtractedMedia = { images: [], videos: [] };
  const hay = `${opts.html ?? ""}\n${opts.rawHtml ?? ""}\n${(opts.links ?? []).join("\n")}`;
  const limit = Math.max(1, opts.imageLimit ?? 3);

  if (opts.candidateVideo) out.trailer = opts.candidateVideo;
  else {
    const yt = YT_ONE.map((re) => hay.match(re)?.[1]).find(Boolean);
    if (yt) out.trailer = `https://www.youtube.com/embed/${yt}`;
    else {
      const vm = hay.match(/(?:https?:)?\/\/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
      if (vm) out.trailer = `https://player.vimeo.com/video/${vm[1]}`;
    }
  }

  const trailerId = out.trailer?.match(/embed\/([A-Za-z0-9_-]{11})/)?.[1];
  const ids = new Set<string>();
  for (const re of YT_ONE.slice(0, 4)) for (const m of hay.matchAll(new RegExp(re.source, "gi"))) ids.add(m[1]);
  for (const id of ids) {
    if (id === trailerId) continue;
    out.videos.push(`https://www.youtube.com/embed/${id}`);
    if (out.videos.length >= 3) break;
  }

  const seen = new Set<string>();
  if (opts.excludeImage) seen.add(opts.excludeImage);
  let skipFirst = hay.includes("ovicio.com.br"); // nessa fonte a 1ª imagem repete a capa
  for (const m of (opts.html ?? "").matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const u = m[1];
    if (!u || seen.has(u) || !/^https?:/i.test(u)) continue;
    if (/(sprite|icon|logo|avatar|placeholder|1x1|pixel)/i.test(u) || isEmojiUrl(u)) continue;
    if (skipFirst) {
      skipFirst = false;
      continue;
    }
    seen.add(u);
    out.images.push(u);
    if (out.images.length >= limit) break;
  }
  return out;
}

/** Largura e altura lidas dos primeiros bytes de uma imagem (PNG, JPEG, GIF, WebP). */
export function imageSizeFromBytes(buf: Uint8Array): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { w: buf[6] | (buf[7] << 8), h: buf[8] | (buf[9] << 8) };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45) {
    const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (fourcc === "VP8 ") return { w: (buf[26] | (buf[27] << 8)) & 0x3fff, h: (buf[28] | (buf[29] << 8)) & 0x3fff };
    if (fourcc === "VP8L") {
      const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]];
      return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (fourcc === "VP8X") return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      i += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      const len = (buf[i] << 8) | buf[i + 1];
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { h: (buf[i + 3] << 8) | buf[i + 4], w: (buf[i + 5] << 8) | buf[i + 6] };
      }
      i += len;
    }
  }
  return null;
}

/** Capa: a primeira com ≥ 1200 px de largura; senão a primeira que passou. */
export function pickCover<T extends { w: number }>(probed: T[]): T | undefined {
  return probed.find((p) => p.w >= COVER_MIN_W) ?? probed[0];
}
