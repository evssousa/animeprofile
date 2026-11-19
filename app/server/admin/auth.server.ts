// Acesso ao painel /admin: um único administrador, definido por variáveis de ambiente (até as contas voltarem; depois,
// só esta função `requireAdmin` passa a ler o papel "admin" da sessão da conta).
//   ADMIN_EMAIL           e-mail de login
//   ADMIN_PASSWORD_HASH   hash scrypt da senha (gerado por `npm run admin:hash`, nunca a senha)
//   SESSION_SECRET        segredo que assina o cookie de sessão (32+ caracteres aleatórios)
import { createCookieSessionStorage, redirect } from "react-router";
import { clientIp, sameOrigin } from "../http.server";
import { parseHash, verifyPassword } from "./hash";

export { hashPassword, verifyPassword } from "./hash";

export const ADMIN_COOKIE = "__ap_admin";

// ───────────── Configuração ─────────────

export function adminConfig() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  // O que falta ou está inválido (só nomes, nunca valores): mostrado na tela de login.
  const problems: string[] = [];
  if (!email) problems.push("ADMIN_EMAIL não encontrada");
  else if (!email.includes("@")) problems.push("ADMIN_EMAIL não parece um e-mail");
  if (!hash) problems.push("ADMIN_PASSWORD_HASH não encontrada");
  else if (!parseHash(hash)) problems.push("ADMIN_PASSWORD_HASH incompleta ou alterada (cole a linha inteira gerada pelo npm run admin:hash)");
  if (!secret) problems.push("SESSION_SECRET não encontrada");
  else if (secret.length < 32) problems.push("SESSION_SECRET curta demais (mín. 32 caracteres)");
  return { ready: problems.length === 0, problems, email, hash, secret };
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

export async function login(request: Request, email: string, password: string): Promise<{ ok: true; cookie: string } | { ok: false; error: string }> {
  const cfg = adminConfig();
  if (!cfg.ready) return { ok: false, error: "Painel não configurado." };
  const ip = clientIp(request) || "local";
  if (loginBlocked(ip)) return { ok: false, error: "Muitas tentativas. Espere 15 minutos." };
  const emailOk = email.trim().toLowerCase() === cfg.email;
  // Sempre calcula o hash (mesmo com e-mail errado) para não revelar pelo tempo de resposta.
  const passOk = await verifyPassword(password, cfg.hash!);
  if (!emailOk || !passOk) {
    registerFail(ip);
    return { ok: false, error: "E-mail ou senha incorretos." };
  }
  fails.delete(ip);
  const session = await sessions().getSession();
  session.set("admin", cfg.email!);
  return { ok: true, cookie: await sessions().commitSession(session) };
}

export async function logout(request: Request) {
  const session = await sessions().getSession(request.headers.get("Cookie"));
  return sessions().destroySession(session);
}

/** Exige sessão de admin; sem ela, manda para o login. Em ações (POST), confere também a origem. */
export async function requireAdmin(request: Request) {
  const cfg = adminConfig();
  if (!cfg.ready) throw redirect("/admin/login");
  const session = await sessions().getSession(request.headers.get("Cookie"));
  if (session.get("admin") !== cfg.email) throw redirect("/admin/login");
  if (request.method !== "GET" && !sameOrigin(request)) throw new Response("Origem inválida", { status: 403 });
  return cfg.email!;
}

/** Há sessão de admin válida? (sem redirecionar) */
export async function isAdmin(request: Request) {
  const cfg = adminConfig();
  if (!cfg.ready) return false;
  const session = await sessions().getSession(request.headers.get("Cookie"));
  return session.get("admin") === cfg.email;
}
