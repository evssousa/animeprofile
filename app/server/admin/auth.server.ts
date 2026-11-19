// Acesso do administrador: um único admin, definido por variáveis de ambiente (até as contas voltarem; na fase 2,
// `getViewer` passa a ler a sessão do banco e `user_roles`, e este arquivo some).
//   ADMIN_EMAIL           e-mail de login
//   ADMIN_USERNAME        usuário de login (opcional; padrão "animeprofile"). Entra-se com o e-mail OU com o usuário.
//   ADMIN_PASSWORD_HASH   hash scrypt da senha (gerado por `npm run admin:hash`, nunca a senha)
//   SESSION_SECRET        segredo que assina o cookie de sessão (32+ caracteres aleatórios)
import { createCookieSessionStorage } from "react-router";
import { SESSION_HINT } from "~/lib/session-hint";
import { clientIp } from "../http.server";
import { parseHash, verifyPassword } from "./hash";

export { hashPassword, verifyPassword } from "./hash";

export const ADMIN_COOKIE = "__ap_admin";

// ───────────── Configuração ─────────────

export function adminConfig() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const username = (process.env.ADMIN_USERNAME?.trim() || "animeprofile").replace(/^@/, "").toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  // O que falta ou está inválido (só nomes, nunca valores): vai para o log do servidor, nunca para a página.
  const problems: string[] = [];
  if (!email) problems.push("ADMIN_EMAIL não encontrada");
  else if (!email.includes("@")) problems.push("ADMIN_EMAIL não parece um e-mail");
  if (!hash) problems.push("ADMIN_PASSWORD_HASH não encontrada");
  else if (!parseHash(hash)) problems.push("ADMIN_PASSWORD_HASH incompleta ou alterada (cole a linha inteira gerada pelo npm run admin:hash)");
  if (!secret) problems.push("SESSION_SECRET não encontrada");
  else if (secret.length < 32) problems.push("SESSION_SECRET curta demais (mín. 32 caracteres)");
  return { ready: problems.length === 0, problems, email, username, hash, secret };
}

type SessionData = { admin: string };
let storage: ReturnType<typeof createCookieSessionStorage<SessionData>> | undefined;
let storageSecret = "";
function sessions() {
  const { secret } = adminConfig();
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  if (!storage || storageSecret !== secret) {
    storageSecret = secret;
    storage = createCookieSessionStorage<SessionData>({
      cookie: {
        name: ADMIN_COOKIE,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/", // "/admin" não serve: a navegação por clique busca "/admin.data", fora desse caminho
        maxAge: 7 * 24 * 3600,
        secrets: [secret],
      },
    });
  }
  return storage;
}

/** Cookie marcador (sem segredo, legível pelo navegador): só avisa que vale perguntar a /api/eu quem está logado. */
export function hintCookie(ligado: boolean): string {
  const base = `${SESSION_HINT}=${ligado ? "1" : ""}; Path=/; SameSite=Lax; Max-Age=${ligado ? 7 * 24 * 3600 : 0}`;
  return process.env.NODE_ENV === "production" ? `${base}; Secure` : base;
}

// ───────────── Limite de tentativas (em memória) ─────────────

const WINDOW_MS = 15 * 60_000;
export const MAX_FAILS_PER_IP = 5;
export const MAX_FAILS_TOTAL = 30;
const fails = new Map<string, number[]>();
let allFails: number[] = [];

/** Só para os testes. */
export function resetLoginLimits() {
  fails.clear();
  allFails = [];
}

/** Bloqueado por muitas tentativas do mesmo IP ou, no total, de qualquer IP (tentativa espalhada). */
export function loginBlocked(ip: string, now = Date.now()) {
  const list = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  fails.set(ip, list);
  allFails = allFails.filter((t) => now - t < WINDOW_MS);
  return list.length >= MAX_FAILS_PER_IP || allFails.length >= MAX_FAILS_TOTAL;
}

export function registerFail(ip: string, now = Date.now()) {
  fails.set(ip, [...(fails.get(ip) ?? []), now]);
  allFails.push(now);
}

// ───────────── Sessão ─────────────

export type LoginResult = { ok: true; cookies: string[] } | { ok: false; error: "config" | "bloqueado" | "credenciais" };

/** Confere e-mail OU usuário e a senha. Devolve os dois cookies (sessão HttpOnly + marcador) ou o motivo da recusa. */
export async function login(request: Request, identificador: string, password: string): Promise<LoginResult> {
  const cfg = adminConfig();
  if (!cfg.ready) {
    console.error(`[login] configuração incompleta: ${cfg.problems.join("; ")}`);
    return { ok: false, error: "config" };
  }
  const ip = clientIp(request) || "local";
  if (loginBlocked(ip)) return { ok: false, error: "bloqueado" };
  const quem = identificador.trim().replace(/^@/, "").toLowerCase();
  const emailOk = quem !== "" && (quem === cfg.email || quem === cfg.username);
  // Sempre calcula o hash (mesmo com e-mail errado) para não revelar pelo tempo de resposta.
  const passOk = await verifyPassword(password, cfg.hash!);
  if (!emailOk || !passOk) {
    registerFail(ip);
    return { ok: false, error: "credenciais" };
  }
  fails.delete(ip);
  const session = await sessions().getSession();
  session.set("admin", cfg.email!);
  return { ok: true, cookies: [await sessions().commitSession(session), hintCookie(true)] };
}

/** Os dois cookies, apagados. */
export async function logout(request: Request): Promise<string[]> {
  const cfg = adminConfig();
  if (!cfg.ready) return [hintCookie(false)];
  const session = await sessions().getSession(request.headers.get("Cookie"));
  return [await sessions().destroySession(session), hintCookie(false)];
}

/** Há sessão de admin válida? (sem redirecionar) */
export async function isAdmin(request: Request) {
  const cfg = adminConfig();
  if (!cfg.ready) return false;
  const session = await sessions().getSession(request.headers.get("Cookie"));
  return session.get("admin") === cfg.email;
}
