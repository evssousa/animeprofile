// App instalável (PWA): registra o service worker e guarda o convite de instalação do navegador (`beforeinstallprompt`).
// O botão "Instalar app" só aparece quando há o que oferecer: o evento do Chrome/Edge/Android, ou o Safari do iPhone/iPad
// (que não tem o evento: leva a /como-instalar). Recusou? Não oferece de novo por 30 dias.
import { useSyncExternalStore } from "react";

type Convite = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY_RECUSADO = "ap-instalar-recusado";
const TRINTA_DIAS = 30 * 86400_000;

let convite: Convite | null = null;
let instalado = false;
let iniciou = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

const recusadoRecente = () => {
  try {
    const t = Number(localStorage.getItem(KEY_RECUSADO) ?? 0);
    return t > 0 && Date.now() - t < TRINTA_DIAS;
  } catch {
    return false;
  }
};

const noModoApp = () => typeof matchMedia !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const ehIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

/** Chamar uma vez, no navegador (o Header faz isso ao montar). */
export function registrarApp() {
  if (iniciou || typeof window === "undefined") return;
  iniciou = true;
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && (import.meta.env.PROD || local)) navigator.serviceWorker.register("/sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    convite = e as Convite;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    convite = null;
    instalado = true;
    avisar();
  });
  avisar();
}

export type OfertaInstalar = "nenhuma" | "navegador" | "ios";

function oferta(): OfertaInstalar {
  if (typeof window === "undefined" || instalado || noModoApp() || recusadoRecente()) return "nenhuma";
  if (convite) return "navegador";
  return ehIos() ? "ios" : "nenhuma";
}

/** O que oferecer agora (no servidor e na hidratação: nada). */
export function useOfertaInstalar(): OfertaInstalar {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    oferta,
    () => "nenhuma",
  );
}

/** Abre o convite do navegador; se a pessoa recusar, guarda para não insistir por 30 dias. */
export async function instalarApp() {
  if (!convite) return;
  const c = convite;
  await c.prompt();
  const { outcome } = await c.userChoice;
  convite = null;
  if (outcome === "dismissed") {
    try {
      localStorage.setItem(KEY_RECUSADO, String(Date.now()));
    } catch {
      // modo privado
    }
  }
  avisar();
}
