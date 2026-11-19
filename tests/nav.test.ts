// Menu: item ativo, itens únicos e os que dependem de conta apontam para páginas "em breve".
import { describe, expect, it } from "vitest";
import { HEADER_LINKS, NAV, isActive } from "~/lib/nav";
import { podeVer } from "~/lib/papeis";

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
  const publicos = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.auth) })).filter((g) => g.items.length > 0);

  it("para visitante sobram só os itens de Descobrir (Feed, Blog, Missões, Ranking, Figurinhas, Quarto e Administração são de logado)", () => {
    expect(publicos.map((g) => g.label)).toEqual(["Descobrir"]);
    const rotulos = NAV.filter((g) => g.label !== "Descobrir").flatMap((g) => g.items);
    for (const esperado of ["Feed", "Blog", "Missões", "Ranking", "Figurinhas", "Quarto Otaku", "Administração"]) expect(rotulos.map((i) => i.label)).toContain(esperado);
    expect(rotulos.every((i) => i.auth)).toBe(true);
  });

  it("o grupo Equipe é o último e só para admin ou moderador", () => {
    expect(NAV.at(-1)?.label).toBe("Equipe");
    const adm = NAV.at(-1)!.items[0];
    expect(adm.to).toBe("/admin");
    expect(podeVer(adm.papeis, ["admin"])).toBe(true);
    expect(podeVer(adm.papeis, ["moderator"])).toBe(true);
    expect(podeVer(adm.papeis, ["author"])).toBe(false);
    expect(podeVer(adm.papeis, [])).toBe(false);
  });

  it("podeVer: sem papéis no item vale para qualquer logado; admin vê tudo", () => {
    expect(podeVer(undefined, [])).toBe(true);
    expect(podeVer(["author"], ["admin"])).toBe(true);
    expect(podeVer(["author"], ["moderator"])).toBe(false);
  });
});

describe("menu do usuário", () => {
  it("na ordem do antigo, com Reportar um problema em /contato e Administração só para a equipe", async () => {
    const { USER_MENU } = await import("~/lib/nav");
    const todos = USER_MENU.flat();
    expect(todos.map((i) => i.label)).toEqual([
      "Meu perfil", "Editar perfil", "App e notificações", "Loja", "Premium",
      "Salvos", "Indicações", "Pagamentos", "Privacidade e dados", "Reportar um problema", "Administração",
    ]);
    expect(todos.find((i) => i.label === "Reportar um problema")?.to).toBe("/contato");
    expect(todos.every((i) => i.to.startsWith("/"))).toBe(true);
    const visiveis = (papeis: string[]) => USER_MENU.flat().filter((i) => podeVer(i.papeis, papeis)).map((i) => i.label);
    expect(visiveis(["admin"])).toContain("Administração");
    expect(visiveis([])).not.toContain("Administração");
  });
});
