// Fase 1 das contas: só o admin entra, por /login. Quem está logado, o papel admin, os cookies e o destino seguro.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { safeRedirect } from "~/lib/safe-redirect";
import { hashPassword, login, logout, resetLoginLimits } from "~/server/admin/auth.server";
import { getViewer, hasRole, requireAdmin } from "~/server/auth/viewer.server";
import { loader as eu } from "~/routes/api.eu";

const SENHA = "uma senha bem comprida 123";

beforeAll(async () => {
  Object.assign(process.env, { ADMIN_EMAIL: "dono@exemplo.com", ADMIN_PASSWORD_HASH: await hashPassword(SENHA), SESSION_SECRET: "y".repeat(40) });
});
afterEach(() => resetLoginLimits());

const req = (ip: string, cookie?: string, extra: Record<string, string> = {}, method = "GET") =>
  new Request("https://animeprofile.com.br/admin", { method, headers: { "x-forwarded-for": ip, ...(cookie ? { cookie } : {}), ...extra } });
async function entrar(ip: string) {
  const r = await login(req(ip, undefined, {}, "POST"), "dono@exemplo.com", SENHA);
  if (!r.ok) throw new Error("login falhou");
  return r.cookies;
}
const cookieHeader = (cookies: string[]) => cookies.map((c) => c.split(";")[0]).join("; ");

describe("quem está logado", () => {
  it("sem cookie, ninguém; com o cookie do login, o administrador com o papel admin", async () => {
    expect(await getViewer(req("1.1.1.1"))).toBeNull();
    const viewer = await getViewer(req("1.1.1.1", cookieHeader(await entrar("1.1.1.1"))));
    expect(viewer).toMatchObject({ nome: "Administrador", inicial: "A", papeis: ["admin"] });
    expect(hasRole(viewer, "admin")).toBe(true);
    expect(hasRole(null, "admin")).toBe(false);
  });

  it("requireAdmin manda para /login?redirect=/admin sem sessão", async () => {
    await expect(requireAdmin(req("2.2.2.2"))).rejects.toMatchObject({ status: 302 });
    try {
      await requireAdmin(req("2.2.2.2"));
    } catch (e) {
      expect((e as Response).headers.get("location")).toBe("/login?redirect=/admin");
    }
    const cookie = cookieHeader(await entrar("2.2.2.2"));
    await expect(requireAdmin(req("2.2.2.2", cookie))).resolves.toMatchObject({ papeis: ["admin"] });
  });

  it("recusa ação (POST) vinda de outro site", async () => {
    const cookie = cookieHeader(await entrar("3.3.3.3"));
    await expect(requireAdmin(req("3.3.3.3", cookie, { origin: "https://site-malicioso.example" }, "POST"))).rejects.toMatchObject({ status: 403 });
    await expect(requireAdmin(req("3.3.3.3", cookie, { origin: "https://animeprofile.com.br" }, "POST"))).resolves.toBeTruthy();
  });
});

describe("cookies", () => {
  it("o login dá o cookie de sessão (HttpOnly, Strict) e o marcador ap_logado (legível, Lax, sem segredo)", async () => {
    const [sessao, marcador] = await entrar("4.4.4.4");
    expect(sessao).toContain("__ap_admin=");
    expect(sessao).toContain("HttpOnly");
    expect(sessao).toContain("SameSite=Strict");
    expect(sessao).toContain("Path=/");
    expect(marcador).toContain("ap_logado=admin;");
    expect(marcador).not.toContain("HttpOnly");
    expect(marcador).toContain("SameSite=Lax");
    expect(marcador).not.toContain("dono@exemplo.com");
  });

  it("sair apaga os dois", async () => {
    const cookies = await logout(req("5.5.5.5", cookieHeader(await entrar("5.5.5.5"))));
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("__ap_admin=");
    expect(cookies.every((c) => /Max-Age=0|Expires=/.test(c))).toBe(true);
    expect(cookies[1]).toContain("ap_logado=;");
  });
});

describe("destino depois do login", () => {
  it("só aceita endereços do próprio site", () => {
    expect(safeRedirect("/admin")).toBe("/admin");
    expect(safeRedirect("/noticias?x=1")).toBe("/noticias?x=1");
    for (const ruim of ["//mal.com", "/\\mal.com", "https://mal.com", "javascript:alert(1)", "", null, undefined, "/ok\nquebra", "/" + "a".repeat(400)]) expect(safeRedirect(ruim as string)).toBe("/admin");
    expect(safeRedirect("//mal.com", "/")).toBe("/");
  });
});

describe("GET /api/eu", () => {
  it("sem sessão: logado false, sem cache; com sessão: logado true e nenhum e-mail", async () => {
    const sem = await eu({ request: req("7.7.7.7") } as never);
    expect(sem.headers.get("Cache-Control")).toBe("no-store");
    expect(await sem.json()).toEqual({ logado: false });
    const com = await eu({ request: req("7.7.7.7", cookieHeader(await entrar("7.7.7.7"))) } as never);
    const corpo = await com.json();
    expect(corpo).toEqual({ logado: true, nome: "Administrador", inicial: "A", papeis: ["admin"] });
    expect(JSON.stringify(corpo)).not.toContain("@");
  });
});

describe("/api/eu corrige o marcador", () => {
  const chamar = (cookie: string) => eu({ request: req("7.7.7.7", cookie) } as never) as Promise<Response>;

  it("marcador antigo (ap_logado=1) é trocado por ap_logado=admin; o certo não é reenviado", async () => {
    const sessao = cookieHeader(await entrar("7.7.7.7")).split("; ").filter((c) => c.startsWith("__ap_admin")).join("");
    const antigo = await chamar(`${sessao}; ap_logado=1`);
    expect(antigo.headers.get("set-cookie")).toContain("ap_logado=admin;");
    const certo = await chamar(`${sessao}; ap_logado=admin`);
    expect(certo.headers.get("set-cookie")).toBeNull();
    expect((await certo.json()).papeis).toEqual(["admin"]);
  });
});
