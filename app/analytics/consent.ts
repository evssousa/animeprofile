// Consentimento de cookies por categoria (Estatística = Google Analytics; Anúncios = AdSense personalizado), no formato v2:
// { v: 2, analytics: boolean, ads: boolean, at: string } no localStorage. Converte a escolha antiga (v1, "all" | "essential").
// Também gera o script do <head> que liga o Modo de Consentimento v2 do Google (tudo negado por padrão) antes de qualquer tag.
import { CONSENT_CHANGED_EVENT, CONSENT_KEY, CONSENT_VERSION } from "./config";

export type Consentimento = { analytics: boolean; ads: boolean };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type Leitura = {
  /** Escolha válida (não precisa mostrar o banner). */
  escolha: Consentimento | null;
  /** Escolha antiga que deve ser regravada no formato novo. */
  migrar?: Consentimento;
  /** Pré-preenchimento do "Personalizar" quando a escolha antiga não cobre tudo (v1 "aceitar todos" não falava de estatística). */
  parcial?: Consentimento;
};

/** Interpreta o que está guardado (função pura, testável sem navegador). */
export function interpretar(raw: string | null): Leitura {
  let c: unknown;
  try {
    c = JSON.parse(raw ?? "null");
  } catch {
    return { escolha: null };
  }
  if (!c || typeof c !== "object") return { escolha: null };
  const o = c as Record<string, unknown>;
  if (o.v === CONSENT_VERSION && typeof o.analytics === "boolean" && typeof o.ads === "boolean") {
    return { escolha: { analytics: o.analytics, ads: o.ads } };
  }
  if (o.v === 1 && o.choice === "essential") {
    const e = { analytics: false, ads: false };
    return { escolha: e, migrar: e };
  }
  if (o.v === 1 && o.choice === "all") return { escolha: null, parcial: { analytics: false, ads: true } };
  return { escolha: null };
}

// Vale para a visita atual mesmo sem localStorage (modo privado restrito).
let naMemoria: Consentimento | null = null;

/** Lê a escolha do navegador (e regrava a antiga no formato novo). */
export function lerConsentimento(): Leitura {
  if (typeof window === "undefined") return { escolha: null };
  if (naMemoria) return { escolha: naMemoria };
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CONSENT_KEY);
  } catch {
    return { escolha: null };
  }
  const l = interpretar(raw);
  if (l.migrar) gravar(l.migrar);
  return l;
}

function gravar(c: Consentimento) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, analytics: c.analytics, ads: c.ads, at: new Date().toISOString() }));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}

/** Passa a escolha ao Google (Modo de Consentimento v2). */
export function aplicarNoGtag(c: Consentimento) {
  const ad = c.ads ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    analytics_storage: c.analytics ? "granted" : "denied",
    ad_storage: ad,
    ad_user_data: ad,
    ad_personalization: ad,
  });
}

/** Grava a escolha, avisa o Google e o resto do site. */
export function guardarConsentimento(c: Consentimento) {
  naMemoria = c;
  gravar(c);
  aplicarNoGtag(c);
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

/**
 * Script do <head>, antes de qualquer anúncio ou medição: cria o gtag, nega tudo por padrão e, se a pessoa já escolheu, libera
 * na hora o que ela aceitou (sem esperar o React). A escolha antiga "aceitar todos" (v1) libera só os anúncios.
 */
export function consentBootstrap() {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
try{var c=JSON.parse(localStorage.getItem('${CONSENT_KEY}')||'null'),a=0,d=0;
if(c&&c.v===${CONSENT_VERSION}){a=c.analytics===true;d=c.ads===true}else if(c&&c.v===1&&c.choice==='all'){d=1}
if(a||d){var g=d?'granted':'denied';gtag('consent','update',{analytics_storage:a?'granted':'denied',ad_storage:g,ad_user_data:g,ad_personalization:g})}}catch(e){}`;
}
