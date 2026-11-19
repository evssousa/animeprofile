// Marcador de sessão: um cookie SEM segredo (`ap_logado=admin`, ou `=1` sem papel) que diz ao navegador "vale perguntar quem
// está logado" e quais papéis a pessoa tem (separados por ponto). Serve só para desenhar o menu certo antes de pintar.
// O HTML público continua igual para todos (cache da CDN); o estado "logado" é lido no navegador, em /api/eu, só com o marcador.
// O marcador NÃO dá acesso a nada: /admin e as ações continuam exigindo a sessão assinada no servidor.
export const SESSION_HINT = "ap_logado";

/** Roda no <head>, antes de pintar: põe `data-logado` (e `data-papeis`) no <html> quando há o marcador (sem "Entrar" piscando). */
export const sessionHintBootstrap = `(function(){try{var m=/(?:^|; )${SESSION_HINT}=([a-z0-9.]+)/.exec(document.cookie);if(m){var d=document.documentElement.dataset;d.logado="1";if(m[1]!=="1")d.papeis=m[1].split(".").join(" ")}}catch(e){}})();`;

/** No navegador: guarda os papéis confirmados por /api/eu no <html> (ou apaga, se não houver nenhum). */
export function setPapeisAttr(papeis: string[]) {
  try {
    const d = document.documentElement.dataset;
    if (papeis.length) d.papeis = papeis.join(" ");
    else delete d.papeis;
  } catch {
    /* sem document */
  }
}

/** No navegador: apaga o marcador e tira `data-logado`/`data-papeis` (ao sair, ou quando a sessão venceu). */
export function clearSessionHint() {
  try {
    document.cookie = `${SESSION_HINT}=; Max-Age=0; Path=/; SameSite=Lax`;
    delete document.documentElement.dataset.logado;
    delete document.documentElement.dataset.papeis;
  } catch {
    /* sem document */
  }
}
