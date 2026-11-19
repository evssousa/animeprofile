import { describe, expect, it } from "vitest";
import { ADMIN_NAV, adminAtivo, adminItem, adminNavVisivel } from "~/lib/admin-nav";

const todos = ADMIN_NAV.flatMap((g) => g.items);

describe("barra lateral do painel", () => {
  it("tem os grupos do antigo, endereços únicos em /admin e só o Painel pronto", () => {
    expect(ADMIN_NAV.map((g) => g.label)).toEqual(["Visão geral", "Conteúdo", "Moderação", "Usuários", "Economia e gamificação", "Financeiro", "Sistema"]);
    expect(new Set(todos.map((i) => i.href)).size).toBe(todos.length);
    expect(todos.every((i) => i.href === "/admin" || i.href.startsWith("/admin/"))).toBe(true);
    expect(todos.filter((i) => i.pronto).map((i) => i.label)).toEqual(["Painel"]);
    expect(todos).toHaveLength(27);
  });

  it("admin vê tudo; moderador, só Painel, WhatsApp e Denúncias; autor, só Posts e Mídias", () => {
    expect(adminNavVisivel(["admin"]).flatMap((g) => g.items)).toHaveLength(27);
    const nomes = (p: string[]) => adminNavVisivel(p).flatMap((g) => g.items.map((i) => i.label));
    expect(nomes(["moderator"])).toEqual(["Painel", "WhatsApp", "Denúncias"]);
    expect(nomes(["author"])).toEqual(["Posts", "Mídias"]);
    expect(nomes([])).toEqual([]);
  });

  it("item ativo: /admin só exato; os outros também em sub-rotas", () => {
    const painel = adminItem("/admin")!;
    expect(adminAtivo("/admin", painel)).toBe(true);
    expect(adminAtivo("/admin/posts", painel)).toBe(false);
    expect(adminAtivo("/admin/posts/novo", adminItem("/admin/posts")!)).toBe(true);
    expect(adminItem("/admin/inexistente")).toBeNull();
  });
});
