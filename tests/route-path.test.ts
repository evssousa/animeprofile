// Na navegação por clique, o React Router pede "<endereço>.data". As páginas precisam ver o endereço limpo,
// senão dão "não encontrada" só ao clicar (bug de 2026-11-14 em /noticias).
import { describe, expect, it } from "vitest";
import { firstSegment, routePath } from "~/lib/route-path";

const req = (path: string) => new Request(`https://novo.animeprofile.com.br${path}`);

describe("routePath", () => {
  it("tira o sufixo .data da navegação por clique", () => {
    expect(routePath(req("/noticias.data"))).toBe("/noticias");
    expect(routePath(req("/noticias.data?tipo=noticias"))).toBe("/noticias");
    expect(routePath(req("/legal/termos.data"))).toBe("/legal/termos");
    expect(routePath(req("/noticias/um-slug.data"))).toBe("/noticias/um-slug");
    expect(routePath(req("/_.data"))).toBe("/");
  });
  it("não mexe no endereço normal", () => {
    expect(routePath(req("/noticias"))).toBe("/noticias");
    expect(routePath(req("/categoria/animes-e-mangas"))).toBe("/categoria/animes-e-mangas");
    expect(firstSegment(req("/tag/bleach.data"))).toBe("tag");
  });
});
