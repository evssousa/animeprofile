// Rede do robô. O servidor busca endereços que vêm de feeds de terceiros, então nada de localhost/rede interna
// (SSRF): só http(s) nas portas 80/443, sem usuário e senha, e o nome precisa resolver para endereço público.
// Redirecionamentos são seguidos à mão, conferindo cada salto.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BOT_UA } from "./constants";

/** Endereço IP literal privado/reservado (IPv4 e IPv6). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (isIP(v) === 6) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return false;
}

/** Checagem sem rede: formato do endereço. */
export function isSafeUrlShape(u: string): boolean {
  let p: URL;
  try {
    p = new URL(u);
  } catch {
    return false;
  }
  if (p.protocol !== "http:" && p.protocol !== "https:") return false;
  if (p.username || p.password) return false;
  if (p.port && p.port !== "80" && p.port !== "443") return false;
  const h = p.hostname.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") && isIP(h.replace(/^\[|\]$/g, "")) === 0) return false;
  return !isPrivateIp(h);
}

export async function isPublicUrl(u: string): Promise<boolean> {
  if (!isSafeUrlShape(u)) return false;
  const host = new URL(u).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return true;
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

export type BotFetchInit = { headers?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal };

/** fetch GET seguro: confere cada salto de redirecionamento (máx. 5). Devolve null se o endereço não for público. */
export async function botFetch(url: string, init: BotFetchInit = {}): Promise<Response | null> {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    if (!(await isPublicUrl(current))) return null;
    const res = await fetch(current, {
      headers: { "User-Agent": BOT_UA, ...init.headers },
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel().catch(() => {});
      try {
        current = new URL(res.headers.get("location")!, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
}

/** Lê o corpo até `max` bytes (não deixa uma fonte mandar um arquivo gigante). */
export async function readLimited(res: Response, max: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
