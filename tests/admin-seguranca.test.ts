// Toda tela do painel confere a sessão no próprio loader e na própria action (o layout não roda quando o navegador pede
// só o loader filho). Percorre os arquivos de app/routes/admin para nenhuma tela futura escapar.
import { describe, expect, it } from "vitest";

type Modulo = { loader?: (a: unknown) => unknown; action?: (a: unknown) => unknown };
const LIVRES = ["/login.tsx", "/sair.ts"];
const telas = Object.entries(import.meta.glob<Modulo>("../app/routes/admin/*.{ts,tsx}")).filter(([f]) => !LIVRES.some((l) => f.endsWith(l)));

describe("telas do painel exigem sessão", () => {
  it("há telas para conferir", () => expect(telas.length).toBeGreaterThanOrEqual(4));
  for (const [arquivo, carregar] of telas) {
    it(`${arquivo.split("/").pop()}: loader e action recusam quem não está logado`, async () => {
      const mod = await carregar();
      expect(mod.loader ?? mod.action).toBeTruthy();
      if (mod.loader) await expect(Promise.resolve().then(() => mod.loader!({ request: new Request("https://animeprofile.com.br/admin.data") }))).rejects.toMatchObject({ status: 302 });
      if (mod.action) await expect(Promise.resolve().then(() => mod.action!({ request: new Request("https://animeprofile.com.br/admin", { method: "POST", body: new FormData() }) }))).rejects.toMatchObject({ status: 302 });
    });
  }
});
