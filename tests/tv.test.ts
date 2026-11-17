import { describe, expect, it } from "vitest";
import { cardHref, filterByTitle, interleaveShelves, shelfCopy, upNext } from "~/lib/tv";

const k = (...keys: string[]) => keys.map((key) => ({ key }));

describe("Otaku TV: funções puras", () => {
  it("a fila 'A seguir' é circular a partir do vídeo atual e não repete o atual", () => {
    const items = k("a", "b", "c", "d", "e");
    expect(upNext(items, "c", 3).map((i) => i.key)).toEqual(["d", "e", "a"]);
    expect(upNext(items, "e", 4).map((i) => i.key)).toEqual(["a", "b", "c", "d"]);
    expect(upNext(items, "a", 2).map((i) => i.key)).toEqual(["b", "c"]);
  });

  it("sem vídeo atual, ou fora da lista, a fila começa pelo primeiro", () => {
    const items = k("a", "b", "c");
    expect(upNext(items, null, 2).map((i) => i.key)).toEqual(["a", "b"]);
    expect(upNext(items, "zzz", 5).map((i) => i.key)).toEqual(["a", "b", "c"]);
    expect(upNext(k("a"), "a", 3)).toEqual([]);
  });

  it("intercala uma fileira a cada N itens e põe as que sobram no fim", () => {
    const items = Array.from({ length: 5 }, (_, i) => i + 1);
    const blocks = interleaveShelves(items, ["A", "B", "C"], 2);
    expect(blocks.map((b) => (b.kind === "grid" ? b.items.join("") : `[${b.shelf}]`))).toEqual(["12", "[A]", "34", "[B]", "5", "[C]"]);
  });

  it("sem fileiras é uma grade só; sem itens só aparecem as fileiras", () => {
    expect(interleaveShelves([1, 2, 3], [], 2)).toEqual([{ kind: "grid", items: [1, 2, 3] }]);
    expect(interleaveShelves([], ["A"], 12)).toEqual([{ kind: "shelf", shelf: "A" }]);
  });

  it("títulos das fileiras: os conhecidos e o genérico", () => {
    expect(shelfCopy("games", "Games")).toMatchObject({ icon: "games", title: "Pausa pro controle" });
    expect(shelfCopy("filmes-e-series", "Filmes e Séries").title).toBe("Pega a pipoca");
    expect(shelfCopy("outro", "Música")).toMatchObject({ icon: "outros", title: "Veja também: Música", tagline: "Vídeos de Música nas nossas matérias" });
  });

  it("o link do cartão mantém aba, busca e página, e troca só o vídeo", () => {
    expect(cardHref({}, "AAAAAAAAAAA")).toBe("/otaku-tv?v=AAAAAAAAAAA");
    expect(cardHref({ tab: "materias" }, "AAAAAAAAAAA")).toBe("/otaku-tv?v=AAAAAAAAAAA");
    expect(cardHref({ tab: "trailers", q: "naruto", pagina: 2 }, "BBBBBBBBBBB")).toBe("/otaku-tv?tab=trailers&q=naruto&pagina=2&v=BBBBBBBBBBB");
    expect(cardHref({ pagina: 1 }, "C")).toBe("/otaku-tv?v=C");
  });

  it("a busca pelo título ignora acento e maiúscula", () => {
    const list = [{ title: "Pokémon: novo trailer" }, { title: "Naruto volta" }];
    expect(filterByTitle(list, "pokemon")).toEqual([list[0]]);
    expect(filterByTitle(list, "NARUTO")).toEqual([list[1]]);
    expect(filterByTitle(list, "  ")).toEqual(list);
    expect(filterByTitle(list, "xyz")).toEqual([]);
  });
});
