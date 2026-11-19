// Buscas recentes da pessoa, só neste aparelho (localStorage "ap-buscas"). Até 5, a mais nova primeiro, sem repetir.
const KEY = "ap-buscas";
const MAX = 5;

export function lerBuscas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function gravar(lista: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista.slice(0, MAX)));
  } catch {
    // modo privado: vale só nesta visita
  }
}

export function guardarBusca(termo: string): string[] {
  const t = termo.trim().slice(0, 60);
  if (t.length < 2) return lerBuscas();
  const lista = [t, ...lerBuscas().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
  gravar(lista);
  return lista;
}

export function removerBusca(termo: string): string[] {
  const lista = lerBuscas().filter((x) => x !== termo);
  gravar(lista);
  return lista;
}

export function limparBuscas(): string[] {
  gravar([]);
  return [];
}
