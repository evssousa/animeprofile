// Otaku TV: funções puras (sem banco, sem React), para a fila "A seguir", as fileiras e os links dos cartões.

/** A fila circular a partir do vídeo atual: os que vêm depois dele, depois os do começo. Sem o atual. */
export function upNext<T extends { key: string }>(items: T[], currentKey: string | null, n: number): T[] {
  const at = currentKey ? items.findIndex((i) => i.key === currentKey) : -1;
  const ordered = at < 0 ? items : [...items.slice(at + 1), ...items.slice(0, at)];
  return ordered.filter((i) => i.key !== currentKey).slice(0, n);
}

export type Block<I, S> = { kind: "grid"; items: I[] } | { kind: "shelf"; shelf: S };

/** Uma fileira a cada `every` itens; as que sobram vão no fim. Sem fileiras, é uma grade só. */
export function interleaveShelves<I, S>(items: I[], shelves: S[], every: number): Block<I, S>[] {
  const out: Block<I, S>[] = [];
  let grid: I[] = [];
  let next = 0;
  items.forEach((item, i) => {
    grid.push(item);
    if ((i + 1) % every === 0 && next < shelves.length) {
      out.push({ kind: "grid", items: grid }, { kind: "shelf", shelf: shelves[next++] });
      grid = [];
    }
  });
  if (grid.length) out.push({ kind: "grid", items: grid });
  while (next < shelves.length) out.push({ kind: "shelf", shelf: shelves[next++] });
  return out;
}

export type ShelfIcon = "games" | "filmes" | "eventos" | "apps" | "outros";

/** Título e frase de cada fileira "Veja também". */
export function shelfCopy(slug: string, name: string): { icon: ShelfIcon; title: string; tagline: string } {
  switch (slug) {
    case "games":
      return { icon: "games", title: "Pausa pro controle", tagline: "Trailers de games que passaram pelas nossas notícias" };
    case "filmes-e-series":
      return { icon: "filmes", title: "Pega a pipoca", tagline: "Filmes e séries que não são anime (ninguém é perfeito)" };
    case "eventos":
      return { icon: "eventos", title: "Direto do evento", tagline: "O que rolou nos palcos e painéis por aí" };
    case "apps":
      return { icon: "apps", title: "Arrasta pra cima", tagline: "Apps e novidades para o celular" };
    default:
      return { icon: "outros", title: `Veja também: ${name}`, tagline: `Vídeos de ${name} nas nossas matérias` };
  }
}

/** Link de um vídeo: mantém a aba, a busca e a página; troca só o `v`. */
export function cardHref({ tab, q, pagina }: { tab?: string; q?: string; pagina?: number }, id: string): string {
  const qs = new URLSearchParams();
  if (tab && tab !== "materias") qs.set("tab", tab);
  if (q) qs.set("q", q);
  if (pagina && pagina > 1) qs.set("pagina", String(pagina));
  qs.set("v", id);
  return `/otaku-tv?${qs.toString()}`;
}

/** Texto sem acento e em minúsculas, para comparar buscas. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Filtra pelo título, sem acento e sem diferença de maiúscula. Busca vazia devolve tudo. */
export function filterByTitle<T extends { title: string }>(items: T[], q: string): T[] {
  const term = fold(q.trim());
  return term ? items.filter((i) => fold(i.title).includes(term)) : items;
}
