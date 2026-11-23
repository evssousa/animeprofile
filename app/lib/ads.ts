// Anúncios (Google AdSense) e consentimento de cookies. O ID do editor é público (aparece em toda requisição de anúncio e em /ads.txt).
// Os blocos de anúncio abaixo já existem na conta do AdSense (criados para o animeprofile antigo, valem para o mesmo editor).
//
// Desligar tudo (se precisar): `ADS_ENABLED = false` e novo deploy. Os anúncios nunca aparecem no /admin e no /login, nem para quem está logado.

export const ADS_ENABLED = true;

export const ADSENSE_CLIENT = "ca-pub-4124845154866017";

export const AD_SLOTS = {
  inArticle: "5547770253", // AP - In-article - Meio do texto
  endOfArticle: "2921606913", // AP - Display - Fim da matéria
  sidebar: "8491740203", // AP - Display - Lateral (vertical)
  multiplex: "6209677860", // AP - Multiplex - Fim da matéria e listas
  list: "9193924697", // AP - Display - Home e listas
} as const;
export type AdSlotName = keyof typeof AD_SLOTS;

/** Mesma chave que a Política de Cookies cita. */
export const CONSENT_KEY = "ap-cookie-consent";
/** Mude a versão quando a política mudar de forma relevante: todo mundo vê o banner de novo. */
export const CONSENT_VERSION = 1;
export type ConsentChoice = "all" | "essential";

/**
 * Script que roda no <head> antes de qualquer anúncio: cria o gtag, nega tudo por padrão (Modo de Consentimento v2) e, se a pessoa
 * já escolheu "aceitar todos", libera na hora (sem esperar o React).
 */
export function consentBootstrap() {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
try{var c=JSON.parse(localStorage.getItem('${CONSENT_KEY}')||'null');if(c&&c.v===${CONSENT_VERSION}&&c.choice==='all')gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}catch(e){}`;
}
