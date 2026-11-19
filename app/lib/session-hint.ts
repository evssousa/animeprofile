// Marcador de sessão: um cookie SEM segredo (`ap_logado=1`) que só diz ao navegador "vale perguntar quem está logado".
// O HTML público continua igual para todos (cache da CDN); o estado "logado" é lido no navegador, em /api/eu, só com o marcador.
export const SESSION_HINT = "ap_logado";

/** Roda no <head>, antes de pintar: põe `data-logado` no <html> quando há o marcador (sem "Entrar" piscando). */
export const sessionHintBootstrap = `(function(){try{if(/(?:^|; )${SESSION_HINT}=1/.test(document.cookie))document.documentElement.dataset.logado="1"}catch(e){}})();`;

/** No navegador: apaga o marcador e tira `data-logado` (ao sair, ou quando a sessão venceu). */
export function clearSessionHint() {
  try {
    document.cookie = `${SESSION_HINT}=; Max-Age=0; Path=/; SameSite=Lax`;
    delete document.documentElement.dataset.logado;
  } catch {
    /* sem document */
  }
}
