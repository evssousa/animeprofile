// Operação do robô de notícias. Tudo protegido pelo CRON_TOKEN (cabeçalho x-cron-token ou ?token=); sem token, 404.
//   GET  /api/robo/status                        modo, chave, fontes, autores, horários, uso do Gemini, últimas rodadas
//   GET  /api/robo/modo?valor=desligado|ensaio|rascunho|publicar[&limiteDia=N]
//   GET  /api/robo/ensaio?limite=1..3            roda agora em modo ensaio (202); não cria matéria
//   GET  /api/robo/url?u=<endereço>              ensaio de um endereço só (202)
//   GET  /api/robo/previa?id=<candidato>         página para conferir o texto gerado (ensaio ou rascunho)
//   POST /api/robo/config                        recebe a configuração do site antigo (JSON, gzip opcional)
import { timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { Route } from "./+types/api.robo";
import { hasDatabase } from "~/server/db.server";
import { trackRun } from "~/server/cron/runner.server";
import { setConfig, ROBO_MODES, type RoboMode } from "~/server/robot/config.server";
import { applyRoboConfig, type RoboConfigInput } from "~/server/robot/config-import.server";
import { runRobot } from "~/server/robot/run.server";
import { previewHtml, statusRobo } from "~/server/robot/painel.server";

function authorized(request: Request) {
  const expected = process.env.CRON_TOKEN;
  if (!expected || expected.length < 24) return false;
  const given = request.headers.get("x-cron-token") ?? new URL(request.url).searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const notFound = () => new Response("Not Found", { status: 404 });
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
export async function loader({ request, params }: Route.LoaderArgs) {
  if (!authorized(request) || !hasDatabase()) return notFound();
  const url = new URL(request.url);

  if (params.acao === "status") return Response.json(await statusRobo(), { headers });

  if (params.acao === "modo") {
    const valor = url.searchParams.get("valor") as RoboMode | null;
    if (!valor || !ROBO_MODES.includes(valor)) return Response.json({ error: `valor deve ser um de: ${ROBO_MODES.join(", ")}` }, { status: 400, headers });
    const patch: { modo: RoboMode; limiteDia?: number } = { modo: valor };
    const limite = url.searchParams.get("limiteDia");
    if (limite !== null) {
      const n = Number(limite);
      if (!Number.isInteger(n) || n < 1 || n > 15) return Response.json({ error: "limiteDia deve ser um inteiro de 1 a 15" }, { status: 400, headers });
      patch.limiteDia = n;
    }
    return Response.json(await setConfig(patch), { headers });
  }

  if (params.acao === "ensaio" || params.acao === "url") {
    const endereco = url.searchParams.get("u") ?? "";
    if (params.acao === "url" && !/^https?:\/\//i.test(endereco)) return Response.json({ error: "informe ?u=<endereço completo>" }, { status: 400, headers });
    const limit = Math.min(3, Math.max(1, Number(url.searchParams.get("limite")) || 1));
    const opts = params.acao === "url" ? { rehearsal: true, force: true, url: endereco } : { rehearsal: true, force: true, limit };
    const wait = url.searchParams.get("wait") === "1";
    const running = trackRun("robo-ensaio", () => runRobot(opts));
    if (!wait) {
      running.catch((err) => console.error("[robo] ensaio falhou:", err));
      return Response.json({ iniciado: params.acao }, { status: 202, headers });
    }
    return Response.json(await running, { headers });
  }

  if (params.acao === "previa") {
    const page = await previewHtml(Number(url.searchParams.get("id")));
    return page ? new Response(page, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } }) : notFound();
  }
  return notFound();
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST" || params.acao !== "config" || !authorized(request) || !hasDatabase()) return notFound();
  let body: RoboConfigInput;
  try {
    const raw = Buffer.from(await request.arrayBuffer());
    const text = request.headers.get("content-encoding") === "gzip" || raw[0] === 0x1f ? gunzipSync(raw, { maxOutputLength: 20 * 1024 * 1024 }) : raw;
    body = JSON.parse(text.toString("utf8"));
  } catch {
    return Response.json({ error: "corpo inválido (esperado JSON, de preferência com gzip)" }, { status: 400, headers });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "formato inesperado" }, { status: 400, headers });
  return Response.json(await applyRoboConfig(body), { headers });
}
