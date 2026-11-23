import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AdSlot } from "~/components/ads/AdSlot";
import { CookieConsent, CookiePrefsButton } from "~/components/layout/CookieConsent";
import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS, CONSENT_KEY, consentBootstrap } from "~/lib/ads";
import { cortarEmParagrafos, textoComAnuncios } from "~/lib/anuncios-no-texto";

async function render(el: React.ReactElement) {
  const handler = createStaticHandler([{ path: "/", Component: () => el }]);
  const ctx = await handler.query(new Request("https://animeprofile.com.br/"));
  if (ctx instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, ctx)} context={ctx} />);
}
const p = (n: number) => `<p>Parágrafo ${n}.</p>`;

describe("AdSense: configuração", () => {
  it("ads.txt declara o mesmo editor da conta e o ID fixo do Google", () => {
    const txt = readFileSync("public/ads.txt", "utf8").trim();
    expect(txt).toBe(`google.com, ${ADSENSE_CLIENT.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`);
  });

  it("blocos de anúncio têm IDs numéricos e o consentimento nasce NEGADO por padrão (Modo de Consentimento v2)", () => {
    expect(ADS_ENABLED).toBe(true);
    for (const id of Object.values(AD_SLOTS)) expect(id).toMatch(/^\d{8,12}$/);
    const b = consentBootstrap();
    expect(b).toContain("gtag('consent','default'");
    for (const k of ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"]) expect(b).toMatch(new RegExp(`${k}:'denied'`));
    expect(b).toContain(CONSENT_KEY);
    expect(b).toContain("choice==='all'"); // só libera quem aceitou tudo
  });
});

describe("AdSense: no servidor (HTML público igual para todos)", () => {
  it("espaços e banner não saem no HTML do servidor (nascem só no navegador, e nunca para quem está logado)", async () => {
    const h = await render(
      <>
        <AdSlot slot="list" />
        <AdSlot slot="inArticle" />
        <CookieConsent />
      </>,
    );
    expect(h).not.toContain("adsbygoogle");
    expect(h).not.toContain("Cookies");
    expect(h).not.toContain("ca-pub");
  });

  it("o botão 'Preferências de cookies' do rodapé existe", async () => {
    expect(await render(<CookiePrefsButton />)).toContain("Preferências de cookies");
  });
});

describe("anúncio no meio do texto", () => {
  it("só corta depois de </p> de primeiro nível (nunca dentro de spoiler, lista ou citação)", () => {
    const html = `${p(1)}<details class="spoiler-box"><summary>s</summary><div class="spoiler-content"><p>segredo</p></div></details>${p(2)}<blockquote><p>cit</p></blockquote>${p(3)}`;
    const partes = cortarEmParagrafos(html);
    expect(partes.join("")).toBe(html); // nada se perde
    for (const parte of partes) expect((parte.match(/<details/g) ?? []).length).toBe((parte.match(/<\/details>/g) ?? []).length);
  });

  it("notícia: um anúncio depois do 1º parágrafo, só se houver pelo menos 2", () => {
    const r = textoComAnuncios(p(1) + p(2) + p(3), "news");
    expect(r.map((x) => ("anuncio" in x ? "AD" : "T"))).toEqual(["T", "AD", "T"]);
    expect(("html" in r[0] && r[0].html) || "").toBe(p(1));
    expect(textoComAnuncios(p(1), "news").some((x) => "anuncio" in x)).toBe(false);
    expect(textoComAnuncios("", "news")).toEqual([]);
  });

  it("artigo: um a cada 4 parágrafos; e pula o ponto que cairia entre um título e a imagem dele", () => {
    const longo = Array.from({ length: 10 }, (_, i) => p(i + 1)).join("");
    const r = textoComAnuncios(longo, "article");
    expect(r.filter((x) => "anuncio" in x)).toHaveLength(2); // antes do 5º e do 9º
    const juntou = r.map((x) => ("html" in x ? x.html : "")).join("");
    expect(juntou).toBe(longo);
    // título + imagem logo depois do 4º parágrafo: o anúncio vai para depois do parágrafo seguinte
    const html = p(1) + p(2) + p(3) + p(4) + '<h2>Mais</h2><figure><img src="/a.webp"></figure>' + p(5) + p(6);
    const partes = cortarEmParagrafos(html);
    expect(partes[4]).toMatch(/^<h2>/);
    const ad = textoComAnuncios(html, "article");
    const idx = ad.findIndex((x) => "anuncio" in x);
    const antes = ad.slice(0, idx).map((x) => ("html" in x ? x.html : "")).join("");
    expect(antes).toContain("Parágrafo 5."); // o anúncio entrou depois do parágrafo 5, não entre o título e a imagem
  });
});
