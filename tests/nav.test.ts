// Menu: item ativo, itens únicos e os que dependem de conta apontam para páginas "em breve".
import { describe, expect, it } from "vitest";
import { HEADER_LINKS, NAV, isActive, visibleNav } from "~/lib/nav";

const ACCOUNT_PENDING = ["/feed", "/missoes", "/ranking", "/quarto", "/login"];

describe("nav", () => {
  it("isActive", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/noticias/x", "/")).toBe(false);
    expect(isActive("/noticias/x", "/noticias")).toBe(true);
    expect(isActive("/artigos/x", "/noticias", ["/artigos"])).toBe(true);
    expect(isActive("/artigos/x", "/noticias")).toBe(false);
    expect(isActive("/quizz", "/quiz")).toBe(false);
  });
  it("todo endereço do menu é único e os 'em breve' são páginas de contas", () => {
    const all = NAV.flatMap((g) => g.items);
    expect(new Set(all.map((i) => i.to)).size).toBe(all.length);
    for (const i of all.filter((x) => x.soon)) expect(ACCOUNT_PENDING).toContain(i.to);
    expect(HEADER_LINKS.every((l) => l.to.startsWith("/"))).toBe(true);
  });
});

describe("menus só para quem está logado", () => {
  it("sem login, esconde Feed, Blog, Missões, Ranking, Figurinhas e Quarto Otaku, e os grupos que ficam vazios", () => {
    const labels = visibleNav(NAV).flatMap((g) => g.items.map((i) => i.label));
    for (const escondido of ["Feed", "Blog", "Missões", "Ranking", "Figurinhas", "Quarto Otaku"]) expect(labels).not.toContain(escondido);
    for (const aberto of ["Início", "News", "Animes", "Otaku TV", "Quiz"]) expect(labels).toContain(aberto);
    expect(visibleNav(NAV).map((g) => g.label)).toEqual(["Descobrir"]);
  });

  it("logado, mostra tudo", () => {
    expect(visibleNav(NAV, true).flatMap((g) => g.items).length).toBe(NAV.flatMap((g) => g.items).length);
  });
});
