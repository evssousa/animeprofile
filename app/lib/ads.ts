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

// O consentimento (chave, versão e script do <head>) mora no módulo ~/analytics; reexportado aqui para quem já importava daqui.
export { CONSENT_KEY, CONSENT_VERSION } from "~/analytics/config";
export { consentBootstrap } from "~/analytics/consent";
