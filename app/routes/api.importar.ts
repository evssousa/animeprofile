// POST /api/importar/conteudo: recebe o retrato do site antigo enviado por scripts/exportar-conteudo-antigo.mjs.
// Corpo: JSON compactado com gzip (Content-Type: application/gzip). Protegido pelo CRON_TOKEN (cabeçalho x-cron-token).
// Responde 202 assim que recebe e grava em segundo plano (a CDN corta respostas acima de ~55 s); o resultado
// aparece em /api/cron/status como "importar-conteudo".
import { timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { Route } from "./+types/api.importar";
import { hasDatabase } from "~/server/db.server";
import { trackRun } from "~/server/cron/runner.server";
import { applySnapshot, validateSnapshot } from "~/server/content/import-old.server";
import { MAX_MEDIA_BYTES, MediaError, saveImportedMedia } from "~/server/content/media-import.server";

const MAX_BYTES = 80 * 1024 * 1024; // depois de descompactado

function authorized(request: Request) {
  const expected = process.env.CRON_TOKEN;
  if (!expected || expected.length < 24) return false;
  const given = request.headers.get("x-cron-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const notFound = () => new Response("Not Found", { status: 404 });
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function loader() {
  return notFound();
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method === "POST" && params.what === "midia" && authorized(request)) {
    // Uma imagem por pedido: corpo em bytes, nome em x-media-name (ver media-import.server.ts).
    try {
      const bytes = Buffer.from(await request.arrayBuffer());
      if (bytes.length > MAX_MEDIA_BYTES) return Response.json({ error: "arquivo grande demais" }, { status: 400, headers });
      return Response.json({ ok: true, ...(await saveImportedMedia(request.headers.get("x-media-name") ?? "", bytes)) }, { headers });
    } catch (err) {
      if (err instanceof MediaError) return Response.json({ error: err.message }, { status: 400, headers });
      throw err;
    }
  }
  if (request.method !== "POST" || params.what !== "conteudo" || !authorized(request) || !hasDatabase()) return notFound();
  let snapshot: unknown;
  try {
    const raw = Buffer.from(await request.arrayBuffer());
    const body = request.headers.get("content-encoding") === "gzip" || raw[0] === 0x1f ? gunzipSync(raw, { maxOutputLength: MAX_BYTES }) : raw;
    snapshot = JSON.parse(body.toString("utf8"));
  } catch {
    return Response.json({ error: "corpo inválido (esperado JSON, de preferência com gzip)" }, { status: 400, headers });
  }
  if (!validateSnapshot(snapshot)) return Response.json({ error: "formato inesperado" }, { status: 400, headers });
  const recebido = { materias: snapshot.posts.length, categorias: snapshot.categories.length, tags: snapshot.tags.length };
  trackRun("importar-conteudo", () => applySnapshot(snapshot)).catch((err) => console.error("[import] falhou:", err));
  return Response.json({ recebido }, { status: 202, headers });
}
