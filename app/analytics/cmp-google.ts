// O aviso europeu do Google (CMP certificada, ligada no AdSense em "Privacidade e mensagens → Regulamentos europeus") atende
// este visitante? Se sim, o banner próprio não aparece (evita dois avisos) e o "Preferências de cookies" abre a mensagem do Google.

declare global {
  interface Window {
    __tcfapi?: (command: string, version: number, callback: (data: { gdprApplies?: boolean }, ok: boolean) => void) => void;
    googlefc?: { showRevocationMessage?: () => void };
  }
}

/** Espera até 1,5 s o __tcfapi existir; sem ele, responde false e o banner próprio segue (Brasil, LGPD). */
export function googleCmpApplies(): Promise<boolean> {
  return new Promise((resolve) => {
    let waited = 0;
    const tick = () => {
      if (typeof window.__tcfapi === "function") {
        try {
          window.__tcfapi("addEventListener", 2, (tc, ok) => resolve(Boolean(ok && tc?.gdprApplies === true)));
        } catch {
          resolve(false);
        }
        return;
      }
      waited += 100;
      if (waited >= 1500) resolve(false);
      else setTimeout(tick, 100);
    };
    tick();
  });
}

/** Abre a mensagem de revogação do Google, se ela existir. */
export function abrirMensagemGoogle(): boolean {
  const f = window.googlefc?.showRevocationMessage;
  if (typeof f !== "function") return false;
  f();
  return true;
}
