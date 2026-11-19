// Busca de anime para o "card de anime" do editor (GET /admin/posts/anime?q=). Só admin. Procura primeiro no banco (rápido); se achar
// pouco, pergunta ao AniList (que também guarda o anime no banco, então a página do card já abre com a ficha).
import type { Route } from "./+types/posts-anime";
import { requireAdmin } from "~/server/auth/viewer.server";
import { searchAnimes, sugerirAnimes } from "~/server/anime/anime.server";
import { FORMAT_PT } from "~/lib/anime";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const cab = { headers: { "Cache-Control": "no-store" } };
  if (q.length < 2) return Response.json({ itens: [] }, cab);
  let lista = await sugerirAnimes(q, 10).catch(() => []);
  if (lista.length < 3) {
    const remotos = await searchAnimes(q).catch(() => []);
    const ids = new Set(lista.map((a) => a.id));
    lista = [...lista, ...remotos.filter((a) => !ids.has(a.id))].slice(0, 10);
  }
  return Response.json(
    {
      itens: lista.map((a) => ({
        id: a.id,
        titulo: a.title,
        capa: a.cover,
        info: [a.seasonYear, a.format ? (FORMAT_PT[a.format] ?? a.format) : null, a.episodes ? `${a.episodes} ep.` : null].filter(Boolean).join(" · "),
      })),
    },
    cab,
  );
}
