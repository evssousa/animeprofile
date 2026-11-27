// Tudo o que muda de um site para outro no módulo de Google Analytics + consentimento. O resto da pasta se copia igual.
// Plano: docs/plano-google-analytics.md. Instalação em outro site: app/analytics/README.md.

/** ID de medição do GA4 (público: sai em toda página). Vazio ou inválido = GA desligado. */
export const GA_MEASUREMENT_ID = "G-GFBZ97L4WX";

/** Onde a escolha de cookies fica no navegador (a Política de Cookies cita este nome). */
export const CONSENT_KEY = "ap-cookie-consent";
/** Mude quando a política mudar de forma relevante: quem escolheu numa versão anterior vê o banner de novo. */
export const CONSENT_VERSION = 2;
/** "Preferências de cookies" no rodapé dispara este evento para reabrir o banner. */
export const OPEN_CONSENT_EVENT = "ap:cookies";
/** Disparado quando a escolha muda (o GA escuta). */
export const CONSENT_CHANGED_EVENT = "ap:consent-changed";
/** Marca "não medir este navegador" (ligada com ?nao-medir=1, desligada com ?nao-medir=0). */
export const NAO_MEDIR_KEY = "ap-nao-medir";
/** Caminhos sem GA e sem banner. */
export const SEM_ANALYTICS = /^\/(admin|login|sair|api)(\/|$)/;
/** Domínio dos cookies _ga (para apagar ao revogar). */
export const COOKIE_DOMAIN = ".animeprofile.com.br";

/** Devolve o ID se tiver o formato do GA4 (G-XXXXXXX); senão, null (GA desligado). */
export function gaIdValido(id: string | null | undefined): string | null {
  return id && /^G-[A-Z0-9]{6,12}$/.test(id) ? id : null;
}
