// Dados do painel "Agora" (/api/agora), buscados uma vez e compartilhados pelo botão "Agora" e pelos assuntos em alta do topo.
// Busca logo depois de abrir o site (0,4 s) e de novo a cada 5 min, só com a aba visível. O servidor guarda a resposta por 60 s.
import { useEffect, useSyncExternalStore } from "react";
import type { Agora } from "~/server/topo.server";

export type EstadoAgora = { fase: "carregando" } | { fase: "ok"; dados: Agora } | { fase: "erro" };

const CARREGANDO: EstadoAgora = { fase: "carregando" };
let estado: EstadoAgora = CARREGANDO;
let iniciou = false;
const ouvintes = new Set<() => void>();
const publicar = (e: EstadoAgora) => {
  estado = e;
  ouvintes.forEach((f) => f());
};

export function recarregarAgora() {
  return fetch("/api/agora")
    .then((r) => (r.ok ? (r.json() as Promise<Agora>) : Promise.reject(new Error(String(r.status)))))
    .then((dados) => publicar({ fase: "ok", dados }))
    .catch(() => publicar({ fase: "erro" }));
}

function iniciar() {
  if (iniciou || typeof window === "undefined") return;
  iniciou = true;
  setTimeout(() => void recarregarAgora(), 400);
  setInterval(() => document.visibilityState === "visible" && void recarregarAgora(), 5 * 60_000);
}

export function useAgora(): EstadoAgora {
  useEffect(iniciar, []);
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado,
    () => CARREGANDO,
  );
}

/** Para o botão "Agora" voltar ao estado de carregando antes de tentar de novo. */
export function aguardarAgora() {
  publicar(CARREGANDO);
  return recarregarAgora();
}
