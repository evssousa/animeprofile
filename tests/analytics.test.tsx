import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { GoogleAnalytics } from "~/analytics/GoogleAnalytics";
import { CONSENT_KEY, GA_MEASUREMENT_ID, gaIdValido } from "~/analytics/config";
import { consentBootstrap, interpretar } from "~/analytics/consent";
import { medir } from "~/analytics/gtag";
import { CookieConsent } from "~/components/layout/CookieConsent";

async function render(el: React.ReactElement) {
  const handler = createStaticHandler([{ path: "/", Component: () => el }]);
  const ctx = await handler.query(new Request("https://animeprofile.com.br/"));
  if (ctx instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, ctx)} context={ctx} />);
}

/** Roda o script do <head> com um localStorage falso e devolve o que entrou no dataLayer. */
function rodarBootstrap(guardado: unknown): unknown[][] {
  const dataLayer: unknown[] = [];
  const win = { dataLayer };
  const ls = { getItem: (k: string) => (k === CONSENT_KEY && guardado != null ? JSON.stringify(guardado) : null) };
  new Function("window", "localStorage", "dataLayer", consentBootstrap())(win, ls, dataLayer);
  return dataLayer.map((a) => Array.from(a as ArrayLike<unknown>));
}

describe("Google Analytics: configuração", () => {
  it("ID de medição válido e validação do formato", () => {
    expect(gaIdValido(GA_MEASUREMENT_ID)).toBe(GA_MEASUREMENT_ID);
    expect(gaIdValido("G-ABC1234")).toBe("G-ABC1234");
    for (const ruim of ["", null, undefined, "UA-1234-1", "GTM-T4V9938Z", "G-<script>"]) expect(gaIdValido(ruim)).toBeNull();
  });
});

describe("consentimento v2", () => {
  it("lê o formato novo", () => {
    expect(interpretar(JSON.stringify({ v: 2, analytics: true, ads: false }))).toEqual({ escolha: { analytics: true, ads: false } });
  });
  it("v1 'só os essenciais' vira v2 negado, sem mostrar o banner de novo", () => {
    const l = interpretar(JSON.stringify({ v: 1, choice: "essential" }));
    expect(l.escolha).toEqual({ analytics: false, ads: false });
    expect(l.migrar).toEqual({ analytics: false, ads: false });
  });
  it("v1 'aceitar todos' mostra o banner de novo, com só os anúncios pré-ligados", () => {
    expect(interpretar(JSON.stringify({ v: 1, choice: "all" }))).toEqual({ escolha: null, parcial: { analytics: false, ads: true } });
  });
  it("lixo ou nada: sem escolha", () => {
    for (const raw of [null, "", "{", "123", JSON.stringify({ v: 9 }), JSON.stringify({ v: 2, analytics: "sim" })]) expect(interpretar(raw).escolha).toBeNull();
  });
});

describe("script do <head> (Modo de Consentimento v2)", () => {
  const ultimo = (dl: unknown[][]) => dl.at(-1)?.[2] as Record<string, string>;
  it("sem escolha: tudo negado e nada liberado", () => {
    const dl = rodarBootstrap(null);
    expect(dl).toHaveLength(1);
    expect(dl[0][0]).toBe("consent");
    expect(dl[0][1]).toBe("default");
    for (const v of Object.values(dl[0][2] as Record<string, unknown>).filter((x) => typeof x === "string")) expect(v).toBe("denied");
  });
  it("v2 só Estatística: analytics liberado, anúncios negados", () => {
    const u = ultimo(rodarBootstrap({ v: 2, analytics: true, ads: false }));
    expect(u.analytics_storage).toBe("granted");
    expect(u.ad_storage).toBe("denied");
    expect(u.ad_personalization).toBe("denied");
  });
  it("v1 'aceitar todos': só os anúncios liberados", () => {
    const u = ultimo(rodarBootstrap({ v: 1, choice: "all" }));
    expect(u.ad_storage).toBe("granted");
    expect(u.ad_user_data).toBe("granted");
    expect(u.analytics_storage).toBe("denied");
  });
  it("v2 negado: nada liberado", () => {
    expect(rodarBootstrap({ v: 2, analytics: false, ads: false })).toHaveLength(1);
  });
});

describe("Google Analytics: no servidor", () => {
  it("nada do GA nem do banner no HTML do servidor", async () => {
    const h = await render(
      <>
        <GoogleAnalytics id="G-TEST123" />
        <CookieConsent />
      </>,
    );
    expect(h).not.toContain("googletagmanager");
    expect(h).not.toContain("Cookies");
  });
  it("medir() antes de carregar não faz nada", () => {
    expect(() => medir("quiz_complete", { quiz_slug: "x" })).not.toThrow();
  });
});
