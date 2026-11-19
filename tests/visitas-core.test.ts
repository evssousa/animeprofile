import { describe, expect, it } from "vitest";
import { VISITAS } from "~/visitas/config";
import { classificar, normalizar } from "~/visitas/core/caminho";
import { anterior, ddmm, diaBrasilia, diasEntre, intervalo, somarDias } from "~/visitas/core/dia";
import { origemDe } from "~/visitas/core/origem";
import { aparelhoDe, navegadorDe, sistemaDe } from "~/visitas/core/ua";

describe("dias de Brasília", () => {
  it("o dia vira à meia-noite de Brasília, não de Greenwich", () => {
    expect(diaBrasilia(new Date("2026-11-19T02:59:59Z"))).toBe("2026-11-18"); // 23:59 em Brasília
    expect(diaBrasilia(new Date("2026-11-19T03:00:00Z"))).toBe("2026-11-19");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("períodos: hoje, ontem, 7 e 30 dias terminando hoje, e o anterior do mesmo tamanho", () => {
    expect(intervalo("hoje", "2026-11-19")).toEqual({ de: "2026-11-19", ate: "2026-11-19", dias: 1 });
    expect(intervalo("ontem", "2026-11-19")).toEqual({ de: "2026-11-18", ate: "2026-11-18", dias: 1 });
    expect(intervalo("7d", "2026-11-19")).toEqual({ de: "2026-11-13", ate: "2026-11-19", dias: 7 });
    expect(intervalo("30d", "2026-11-19")).toEqual({ de: "2026-10-21", ate: "2026-11-19", dias: 30 });
    expect(anterior("7d", "2026-11-19")).toEqual({ de: "2026-11-06", ate: "2026-11-12", dias: 7 });
    expect(anterior("hoje", "2026-11-19")).toEqual({ de: "2026-11-18", ate: "2026-11-18", dias: 1 });
    expect(diasEntre("2026-11-28", "2026-12-02")).toEqual(["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(ddmm("2026-11-05")).toBe("05/11");
  });
});

describe("endereço da página", () => {
  it("aceita endereços normais e tira a barra do fim", () => {
    expect(normalizar("/")).toBe("/");
    expect(normalizar("/noticias/")).toBe("/noticias");
    expect(normalizar("/noticias/black-clover-noelle")).toBe("/noticias/black-clover-noelle");
    expect(normalizar("/animes/212888")).toBe("/animes/212888");
  });

  it("recusa admin, api, query, #, não ASCII, vazio e grande demais", () => {
    for (const ruim of ["/admin", "/admin/login", "/api/v", "/api", "/noticias?q=naruto", "/a#b", "/não-é-ascii", "sem-barra", "", "/x y", "/" + "a".repeat(260)]) expect(normalizar(ruim)).toBeNull();
    expect(normalizar(null)).toBeNull();
    expect(normalizar(42)).toBeNull();
    expect(normalizar("/administracao")).toBe("/administracao"); // só /admin e /api exatos são barrados
  });

  it("classifica cada tipo pela configuração do site", () => {
    const t = (p: string) => classificar(p, VISITAS.tipos);
    expect(t("/")).toBe("inicio");
    expect(t("/noticias/algo")).toBe("materia");
    expect(t("/artigos/algo")).toBe("materia");
    expect(t("/blog/tag/anime")).toBe("lista");
    expect(t("/blog/usuario/post-x")).toBe("blog");
    expect(t("/animes/personagem/123")).toBe("personagem");
    expect(t("/animes/212888")).toBe("anime");
    expect(t("/quiz/qual-personagem")).toBe("quiz");
    expect(t("/figurinhas/one-piece")).toBe("figurinhas");
    expect(t("/otaku-tv")).toBe("otaku-tv");
    expect(t("/login")).toBe("contas");
    expect(t("/convite/abc")).toBe("contas");
    expect(t("/noticias")).toBe("lista");
    expect(t("/categoria/games")).toBe("lista");
    expect(t("/tag/naruto")).toBe("lista");
    expect(t("/animes/calendario")).toBe("lista");
    expect(t("/sobre")).toBe("outra");
  });
});

describe("origem da visita", () => {
  const hosts = VISITAS.hosts;
  const o = (r: string | null, u?: string | null) => origemDe(r, u, hosts);

  it("sem referrer ou inválido é direto", () => {
    expect(o(null).origem).toBe("direto");
    expect(o("").origem).toBe("direto");
    expect(o("lixo que não é endereço").origem).toBe("direto");
    expect(o("ftp://exemplo.com/").origem).toBe("direto");
  });

  it("buscas, inclusive google.com.br e o app do Google no Android", () => {
    expect(o("https://www.google.com/")).toEqual({ origem: "busca", dim: "ref_busca", valor: "google.com" });
    expect(o("https://www.google.com.br/search?q=anime")).toMatchObject({ origem: "busca", valor: "google.com.br" });
    expect(o("https://duckduckgo.com/")).toMatchObject({ origem: "busca" });
    expect(o("https://www.bing.com/")).toMatchObject({ origem: "busca" });
    expect(o("android-app://com.google.android.googlequicksearchbox")).toMatchObject({ origem: "busca" });
  });

  it("redes sociais, inclusive subdomínios", () => {
    expect(o("https://l.instagram.com/?u=x")).toEqual({ origem: "social", dim: "ref_social", valor: "l.instagram.com" });
    expect(o("https://m.facebook.com/")).toMatchObject({ origem: "social" });
    expect(o("https://t.co/abc")).toMatchObject({ origem: "social", valor: "t.co" });
    expect(o("https://www.youtube.com/watch?v=x")).toMatchObject({ origem: "social", valor: "youtube.com" });
    expect(o("https://api.whatsapp.com/")).toMatchObject({ origem: "social" });
  });

  it("outros sites e navegação interna", () => {
    expect(o("https://myanimelist.net/anime/1")).toEqual({ origem: "site", dim: "ref_site", valor: "myanimelist.net" });
    expect(o("https://animeprofile.com.br/noticias").origem).toBe("interno");
    expect(o("https://www.animeprofile.com.br/").origem).toBe("interno");
    expect(o("https://google.com.exemplo-malicioso.net/").origem).toBe("site"); // não é o Google
  });

  it("UTM vence o referrer e vira campanha", () => {
    expect(o("https://l.instagram.com/", "Instagram|Social|Bio")).toEqual({ origem: "campanha", dim: "campanha", valor: "instagram / social / bio" });
    expect(o(null, "teste||painel").valor).toBe("teste / painel");
    expect(o("https://l.instagram.com/", "||").origem).toBe("social"); // UTM vazia não conta
  });
});

describe("aparelho, navegador e sistema", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const WIN_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const WIN_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
  const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
  const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
  const SAMSUNG = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
  const INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0";

  it("aparelho", () => {
    expect(aparelhoDe(IPHONE)).toBe("celular");
    expect(aparelhoDe(ANDROID)).toBe("celular");
    expect(aparelhoDe(IPAD)).toBe("tablet");
    expect(aparelhoDe(ANDROID_TABLET)).toBe("tablet");
    expect(aparelhoDe(WIN_CHROME)).toBe("computador");
    expect(aparelhoDe(MAC_SAFARI)).toBe("computador");
    expect(aparelhoDe(WIN_CHROME, "?1")).toBe("celular"); // a dica do navegador vale
  });

  it("navegador", () => {
    expect(navegadorDe(WIN_CHROME)).toBe("Chrome");
    expect(navegadorDe(WIN_EDGE)).toBe("Edge");
    expect(navegadorDe(MAC_SAFARI)).toBe("Safari");
    expect(navegadorDe(FIREFOX)).toBe("Firefox");
    expect(navegadorDe(SAMSUNG)).toBe("Samsung Internet");
    expect(navegadorDe(INSTAGRAM)).toBe("App do Instagram");
    expect(navegadorDe("curl/8.0")).toBe("Outro");
  });

  it("sistema", () => {
    expect(sistemaDe(ANDROID)).toBe("Android");
    expect(sistemaDe(IPHONE)).toBe("iOS");
    expect(sistemaDe(WIN_CHROME)).toBe("Windows");
    expect(sistemaDe(MAC_SAFARI)).toBe("macOS");
    expect(sistemaDe(FIREFOX)).toBe("Linux");
    expect(sistemaDe("CrOS x86_64")).toBe("ChromeOS");
    expect(sistemaDe("coisa")).toBe("Outro");
  });
});
