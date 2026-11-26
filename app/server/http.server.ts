// Utilidades de pedido HTTP compartilhadas (contato, quiz e as próximas áreas com formulário ou ação).
import { createHash } from "node:crypto";
import { SITE } from "~/lib/site";

/** IP de quem fez o pedido (atrás do proxy (Traefik na VPS), vem em x-forwarded-for). */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

/** Hash do IP com o dia: dá para contar repetições sem guardar o IP de ninguém. */
export function ipHash(ip: string) {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${day}|${process.env.CRON_TOKEN ?? ""}`).digest("hex");
}

/**
 * Proteção simples contra pedidos vindos de outro site: num POST, o cabeçalho Origin vazio ou do mesmo endereço
 * (do site ou do próprio pedido) passa; outro endereço não.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === new URL(SITE.url).host || host === request.headers.get("host") || host === new URL(request.url).host;
  } catch {
    return false;
  }
}
