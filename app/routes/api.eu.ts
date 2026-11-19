// Quem está logado (GET /api/eu). O navegador só pergunta quando existe o cookie marcador `ap_logado`.
// Sem cache. Nunca devolve e-mail. Se o marcador do pedido estiver desatualizado (ex.: sem os papéis), corrige.
// Só para admin ou moderador, devolve também `painel` (robô de hoje e visitas de hoje) para a faixa da equipe no topo.
import type { Route } from "./+types/api.eu";
import { SESSION_HINT } from "~/lib/session-hint";
import { hintCookie } from "~/server/admin/auth.server";
import { getViewer } from "~/server/auth/viewer.server";
import { cached } from "~/server/cache.server";
import { getConfig, roboPostsToday } from "~/server/robot/config.server";
import { diaBrasilia } from "~/visitas/core/dia";
import { visitantesHoje } from "~/visitas/server/consultas.server";

export type PainelEquipe = { robo: { hoje: number; teto: number; modo: string }; visitasHoje: number };

/** Números da faixa da equipe, guardados por 60 s; se algo falhar, a faixa some e o resto do /api/eu responde normal. */
async function painelEquipe(): Promise<PainelEquipe | undefined> {
  try {
    return await cached("eu-painel", 60_000, async () => {
      const [cfg, hoje, visitas] = await Promise.all([getConfig(), roboPostsToday(), visitantesHoje(diaBrasilia())]);
      return { robo: { hoje, teto: cfg.limiteDia, modo: cfg.modo }, visitasHoje: visitas };
    });
  } catch (e) {
    console.error(`[eu] painel da equipe indisponível: ${String((e as Error)?.message ?? e).slice(0, 100)}`);
    return undefined;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const v = await getViewer(request);
  const headers = new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  if (v) {
    const atual = new RegExp(`(?:^|; )${SESSION_HINT}=([^;]*)`).exec(request.headers.get("Cookie") ?? "")?.[1];
    const esperado = v.papeis.length ? v.papeis.join(".") : "1";
    if (atual !== esperado) headers.append("Set-Cookie", hintCookie(v.papeis));
  }
  const painel = v && (v.papeis.includes("admin") || v.papeis.includes("moderator")) ? await painelEquipe() : undefined;
  return Response.json(v ? { logado: true, nome: v.nome, inicial: v.inicial, papeis: v.papeis, ...(painel ? { painel } : {}) } : { logado: false }, { headers });
}
