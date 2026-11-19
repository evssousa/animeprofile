import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { adminConfig, hashPassword, login, loginBlocked, MAX_FAILS_PER_IP, MAX_FAILS_TOTAL, registerFail, resetLoginLimits, verifyPassword } from "~/server/admin/auth.server";

const SENHA = "uma senha bem comprida 123";
let hash = "";

beforeAll(async () => {
  hash = await hashPassword(SENHA);
  Object.assign(process.env, { ADMIN_EMAIL: "Dono@Exemplo.com", ADMIN_PASSWORD_HASH: hash, SESSION_SECRET: "x".repeat(40) });
});
afterEach(() => resetLoginLimits());

const req = (ip: string) => new Request("https://animeprofile.com.br/login", { method: "POST", headers: { "x-forwarded-for": ip } });

describe("login do admin (senha e limites)", () => {
  it("o hash não tem '$' e confere só com a senha certa", async () => {
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(await verifyPassword(SENHA, hash)).toBe(true);
    expect(await verifyPassword("outra senha qualquer", hash)).toBe(false);
    expect(await verifyPassword(SENHA, "lixo")).toBe(false);
  });

  it("diz o que falta na configuração (só nomes)", () => {
    const antes = { ...process.env };
    delete process.env.ADMIN_EMAIL;
    process.env.SESSION_SECRET = "curta";
    const cfg = adminConfig();
    expect(cfg.ready).toBe(false);
    expect(cfg.problems.join(" ")).toContain("ADMIN_EMAIL");
    expect(cfg.problems.join(" ")).toContain("SESSION_SECRET curta");
    expect(cfg.problems.join(" ")).not.toContain(SENHA);
    Object.assign(process.env, antes);
  });

  it("entra com e-mail (sem diferença de maiúscula) e senha certos e devolve os dois cookies", async () => {
    const r = await login(req("1.1.1.1"), "dono@exemplo.com", SENHA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cookies).toHaveLength(2);
  });

  it("senha ou e-mail errados dão o mesmo erro", async () => {
    const a = await login(req("2.2.2.2"), "dono@exemplo.com", "errada errada errada");
    const b = await login(req("2.2.2.2"), "outro@exemplo.com", SENHA);
    expect(a).toEqual({ ok: false, error: "credenciais" });
    expect(b).toEqual(a);
  });

  it("bloqueia o IP depois de 5 erros em 15 minutos, mesmo com a senha certa", async () => {
    for (let i = 0; i < MAX_FAILS_PER_IP; i++) await login(req("3.3.3.3"), "dono@exemplo.com", "errada errada errada");
    expect(loginBlocked("3.3.3.3")).toBe(true);
    expect(await login(req("3.3.3.3"), "dono@exemplo.com", SENHA)).toEqual({ ok: false, error: "bloqueado" });
    expect(loginBlocked("4.4.4.4")).toBe(false); // outro IP segue livre
    expect(loginBlocked("3.3.3.3", Date.now() + 16 * 60_000)).toBe(false); // passados 15 min, libera
  });

  it("bloqueia todos depois de 30 erros no total (tentativa espalhada por muitos IPs)", () => {
    for (let i = 0; i < MAX_FAILS_TOTAL; i++) registerFail(`10.0.0.${i}`);
    expect(loginBlocked("9.9.9.9")).toBe(true);
  });

  it("sem configuração, devolve 'config' (o motivo vai só para o log do servidor)", async () => {
    const antes = { ...process.env };
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(await login(req("6.6.6.6"), "dono@exemplo.com", SENHA)).toEqual({ ok: false, error: "config" });
    Object.assign(process.env, antes);
  });
});
