// Banner de consentimento de cookies (LGPD + Modo de Consentimento v2 do Google). Aparece na primeira visita e some depois da escolha;
// "Preferências de cookies" no rodapé reabre. "Aceitar todos" libera anúncios personalizados; "Só os essenciais" mantém tudo negado
// (o Google ainda pode mostrar anúncios não personalizados). A escolha fica no navegador (localStorage), sem cookie e sem servidor.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { ADS_ENABLED, CONSENT_KEY, CONSENT_VERSION, type ConsentChoice } from "~/lib/ads";

export const OPEN_CONSENT_EVENT = "ap:cookies";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function lerEscolha(): ConsentChoice | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null");
    return c?.v === CONSENT_VERSION ? c.choice : null;
  } catch {
    return null;
  }
}

function guardarEscolha(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, choice, at: new Date().toISOString() }));
  } catch {
    // navegador sem armazenamento: vale só nesta visita
  }
  const estado = choice === "all" ? "granted" : "denied";
  window.gtag?.("consent", "update", { ad_storage: estado, ad_user_data: estado, ad_personalization: estado, analytics_storage: estado });
}

export function CookieConsent() {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const semBanner = /^\/(admin|login|sair)(\/|$)/.test(pathname);

  useEffect(() => {
    if (!lerEscolha()) setAberto(true);
    const reabrir = () => setAberto(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reabrir);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reabrir);
  }, []);

  if (!ADS_ENABLED || !aberto || semBanner) return null;
  const escolher = (c: ConsentChoice) => {
    guardarEscolha(c);
    setAberto(false);
  };
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-titulo"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.45)] sm:inset-x-6 lg:bottom-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="cookies-titulo" className="text-[0.95rem] font-extrabold">
          Cookies
        </h2>
        <p className="text-[0.88rem] leading-relaxed text-ink-soft">
          Usamos cookies essenciais para o site funcionar. Com a sua permissão, o Google também usa cookies para mostrar anúncios personalizados e medir o resultado deles. Você muda de ideia quando quiser pelo link “Preferências de cookies” no rodapé. Saiba mais na{" "}
          <Link to="/legal/cookies" className="font-semibold text-link underline">
            política de cookies
          </Link>
          .
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => escolher("essential")} className="min-h-11 rounded-full border border-line px-5 text-[0.9rem] font-bold hover:bg-sunken">
          Só os essenciais
        </button>
        <button type="button" onClick={() => escolher("all")} className="min-h-11 rounded-full bg-brand px-5 text-[0.9rem] font-bold text-brand-ink hover:bg-[#a92c23]">
          Aceitar todos
        </button>
      </div>
    </section>
  );
}

/** Link do rodapé que reabre o banner. Só existe com os anúncios ligados. */
export function CookiePrefsButton({ className }: { className?: string }) {
  if (!ADS_ENABLED) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))} className={className}>
      Preferências de cookies
    </button>
  );
}
