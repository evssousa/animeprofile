// Lê, no navegador, o estado posto no <html> pelo script do <head> (`data-logado`, `data-papeis`) e acompanha as mudanças
// (o UserMenu confirma em /api/eu e pode corrigir os papéis). No servidor e na hidratação devolve "ninguém logado",
// então o HTML do servidor e o da primeira pintura do navegador saem iguais.
import { useMemo, useSyncExternalStore } from "react";
import type { Papel } from "./papeis";

function subscribe(fn: () => void) {
  if (typeof document === "undefined") return () => {};
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-logado", "data-papeis"] });
  return () => mo.disconnect();
}

// Texto estável (comparável por valor): "0|" deslogado; "1|admin moderator" logado.
const snapshot = () => {
  const d = document.documentElement.dataset;
  return `${d.logado ? 1 : 0}|${d.papeis ?? ""}`;
};

export function useMarcador(): { logado: boolean; papeis: Papel[] } {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "0|");
  return useMemo(() => {
    const [l, p] = raw.split("|");
    return { logado: l === "1", papeis: (p ? p.split(" ") : []) as Papel[] };
  }, [raw]);
}
