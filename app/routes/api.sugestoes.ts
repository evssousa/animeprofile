// Sugestões da busca do topo (GET /api/sugestoes?q=). Público e igual para todos: a CDN pode guardar por 5 minutos.
import type { Route } from "./+types/api.sugestoes";
import { sugestoes } from "~/server/topo.server";

export async function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return Response.json(await sugestoes(q), { headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=300", "X-Robots-Tag": "noindex" } });
  } catch (e) {
    console.error(`[sugestoes] ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return Response.json({ erro: true }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
