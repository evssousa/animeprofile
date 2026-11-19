// Envio de imagem do editor de posts (POST /admin/posts/imagem). Só admin. Até 8 MB; vira WebP (1600 px) + miniatura (640 px)
// em /media/painel/<sha1>.webp. O nome vem do conteúdo, então enviar a mesma imagem de novo não duplica.
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Route } from "./+types/posts-imagem";
import { isImageBytes, MediaError, saveOwnMedia } from "~/server/content/media-import.server";
import { requireAdmin } from "~/server/auth/viewer.server";

const MAX_BYTES = 8 * 1024 * 1024;

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const falha = (erro: string, status = 400) => Response.json({ erro }, { status, headers: { "Cache-Control": "no-store" } });
  let arquivo: FormDataEntryValue | null;
  try {
    arquivo = (await request.formData()).get("arquivo");
  } catch {
    return falha("Envio inválido.");
  }
  if (!(arquivo instanceof File)) return falha("Escolha uma imagem.");
  if (arquivo.size > MAX_BYTES) return falha("Imagem muito grande: até 8 MB.", 413);
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (!isImageBytes(bytes)) return falha("Esse arquivo não é uma imagem (use JPG, PNG, WebP ou GIF).");
  try {
    const meta = await sharp(bytes).metadata();
    if ((meta.pages ?? 1) > 1) return falha("Imagem animada não é aceita aqui. Use JPG, PNG ou WebP.");
    const principal = await sharp(bytes).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const miniatura = await sharp(bytes).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    const chave = createHash("sha1").update(bytes).digest("hex").slice(0, 24);
    const url = await saveOwnMedia("painel", chave, principal.data, miniatura);
    return Response.json({ url, width: principal.info.width, height: principal.info.height }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof MediaError) return falha(e.message);
    console.error(`[posts] imagem não processada: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return falha("Não consegui processar essa imagem. Tente outra.", 422);
  }
}
