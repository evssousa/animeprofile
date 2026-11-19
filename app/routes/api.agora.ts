// Painel "Agora" do topo (GET /api/agora): última hora, no ar hoje e tags em alta. Público e igual para todos (cache de 60 s).
import type { Route } from "./+types/api.agora";
import { agora } from "~/server/topo.server";

export async function loader(_: Route.LoaderArgs) {
  try {
    return Response.json(await agora(), { headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300", "X-Robots-Tag": "noindex" } });
  } catch (e) {
    console.error(`[agora] ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return Response.json({ erro: true }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
