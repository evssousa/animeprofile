// Quem está logado (GET /api/eu). O navegador só pergunta quando existe o cookie marcador `ap_logado`.
// Sem cache. Nunca devolve e-mail. Se o marcador do pedido estiver desatualizado (ex.: sem os papéis), corrige.
import type { Route } from "./+types/api.eu";
import { SESSION_HINT } from "~/lib/session-hint";
import { hintCookie } from "~/server/admin/auth.server";
import { getViewer } from "~/server/auth/viewer.server";

export async function loader({ request }: Route.LoaderArgs) {
  const v = await getViewer(request);
  const headers = new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  if (v) {
    const atual = new RegExp(`(?:^|; )${SESSION_HINT}=([^;]*)`).exec(request.headers.get("Cookie") ?? "")?.[1];
    const esperado = v.papeis.length ? v.papeis.join(".") : "1";
    if (atual !== esperado) headers.append("Set-Cookie", hintCookie(v.papeis));
  }
  return Response.json(v ? { logado: true, nome: v.nome, inicial: v.inicial, papeis: v.papeis } : { logado: false }, { headers });
}
