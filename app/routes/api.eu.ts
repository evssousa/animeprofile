// Quem está logado (GET /api/eu). O navegador só pergunta quando existe o cookie marcador `ap_logado`.
// Sem cache. Nunca devolve e-mail.
import type { Route } from "./+types/api.eu";
import { getViewer } from "~/server/auth/viewer.server";

export async function loader({ request }: Route.LoaderArgs) {
  const v = await getViewer(request);
  return Response.json(v ? { logado: true, nome: v.nome, inicial: v.inicial, papeis: v.papeis } : { logado: false }, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
