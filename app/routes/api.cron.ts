// Tarefas agendadas, chamadas pelo Cron Job da Hostinger (uma entrada só, a cada 5 min):
//   GET /api/cron/tick?token=...               roda as tarefas que estão na hora (responde 202 e segue)
//   GET /api/cron/status?token=...             agenda e últimas execuções
//   GET /api/cron/run?token=...&nome=limpeza   roda uma tarefa agora (wait=1 espera o fim)
// Sem CRON_TOKEN configurado ou com token errado, responde 404 (a rota "não existe").
import { timingSafeEqual } from "node:crypto";
import type { Route } from "./+types/api.cron";
import { hasDatabase } from "~/server/db.server";
import { runNow, status, tick } from "~/server/cron/runner.server";

function authorized(request: Request) {
  const expected = process.env.CRON_TOKEN;
  if (!expected || expected.length < 24) return false;
  const url = new URL(request.url);
  const given = request.headers.get("x-cron-token") ?? url.searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const notFound = () => new Response("Not Found", { status: 404 });
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!authorized(request) || !hasDatabase()) return notFound();
  const url = new URL(request.url);
  const wait = url.searchParams.get("wait") === "1";

  if (params.job === "status") return Response.json(await status(Number(url.searchParams.get("n")) || 20), { headers });

  if (params.job === "tick") {
    const { started, done } = await tick();
    if (wait) await done;
    else done.catch((err) => console.error("[cron] tick falhou:", err));
    return Response.json({ started }, { status: 202, headers });
  }

  if (params.job === "run") {
    const name = url.searchParams.get("nome") ?? "";
    const running = runNow(name);
    if (!wait) {
      running.catch((err) => console.error(`[cron] ${name} falhou:`, err));
      return Response.json({ started: name }, { status: 202, headers });
    }
    const result = await running;
    if (result === null) return notFound();
    if (result === false) return Response.json({ error: "já está rodando" }, { status: 409, headers });
    return Response.json(result, { headers });
  }

  return notFound();
}
