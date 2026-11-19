// Prévia do texto gerado pelo robô (ensaio ou rascunho): GET /admin/ai-news/previa/:id. Só admin. Devolve uma página HTML simples
// (a mesma de /api/robo/previa, que usa o token), para abrir em nova aba a partir da lista de candidatos.
import { data } from "react-router";
import type { Route } from "./+types/ai-news-previa";
import { requireAdmin } from "~/server/auth/viewer.server";
import { previewHtml } from "~/server/robot/painel.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const html = await previewHtml(Number(params.id));
  if (!html) throw data("Prévia não encontrada", { status: 404 });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
