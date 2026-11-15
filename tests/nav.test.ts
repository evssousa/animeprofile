// Menu: item ativo, itens únicos e os que dependem de conta apontam para páginas "em breve".
import { describe, expect, it } from "vitest";
import { HEADER_LINKS, NAV, isActive } from "~/lib/nav";

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
