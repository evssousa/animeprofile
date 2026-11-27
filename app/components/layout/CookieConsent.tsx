// Banner de consentimento de cookies (LGPD + Modo de Consentimento v2 do Google), em 2 camadas: "resumo" (Só os essenciais /
// Aceitar todos / Personalizar) e "personalizar" (chaves Estatística e Anúncios). A lógica fica em ~/analytics/use-consentimento.
// "Preferências de cookies" no rodapé reabre direto em "personalizar". Nada sai no HTML do servidor.
import { useEffect, useId, useRef } from "react";
import { Link, useLocation } from "react-router";
import { GA_MEASUREMENT_ID, OPEN_CONSENT_EVENT, gaIdValido } from "~/analytics/config";
import { useConsentimento } from "~/analytics/use-consentimento";
import { ADS_ENABLED } from "~/lib/ads";

export { OPEN_CONSENT_EVENT };

const TEM_GA = Boolean(gaIdValido(GA_MEASUREMENT_ID));

const BTN_CONTORNO = "min-h-11 rounded-full border border-line px-5 text-[0.9rem] font-bold hover:bg-sunken";
const BTN_ACEITAR = "min-h-11 rounded-full bg-brand px-5 text-[0.9rem] font-bold text-brand-ink hover:bg-[#a92c23]";
const BTN_TEXTO = "order-last min-h-11 px-2 text-[0.9rem] font-bold text-ink-soft underline underline-offset-4 hover:text-ink sm:order-first sm:mr-auto";

function textoResumo(analytics: boolean, ads: boolean) {
  if (analytics && ads)
    return "Usamos cookies essenciais para o site funcionar. Com a sua permissão, também usamos o Google Analytics para saber quais páginas são lidas e o Google AdSense para mostrar anúncios do seu interesse.";
  if (analytics) return "Usamos cookies essenciais para o site funcionar. Com a sua permissão, também usamos o Google Analytics para saber quais páginas são lidas.";
  return "Usamos cookies essenciais para o site funcionar. Com a sua permissão, o Google também usa cookies para mostrar anúncios personalizados e medir o resultado deles.";
}

function Chave({ ligado, aoMudar, rotulo, descricao }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; descricao: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-labelledby={rotulo}
      aria-describedby={descricao}
      onClick={() => aoMudar(!ligado)}
      className="-m-[9px] shrink-0 rounded-full p-[9px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className={`flex h-[26px] w-11 items-center rounded-full hover:brightness-95 ${ligado ? "bg-brand" : "bg-[#c9bcbc] dark:bg-[#4a4043]"}`}>
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-transform duration-150 ease-out motion-reduce:transition-none ${ligado ? "translate-x-[21px]" : "translate-x-[3px]"}`}
        />
      </span>
    </button>
  );
}

function Linha({ nome, sub, texto, children }: { nome: string; sub?: string; texto: string; children: (ids: { rotulo: string; descricao: string }) => React.ReactNode }) {
  const id = useId();
  const ids = { rotulo: `${id}-n`, descricao: `${id}-d` };
  return (
    <li className="grid grid-cols-[1fr_auto] items-start gap-4 py-3">
      <div>
        <p id={ids.rotulo} className="text-[0.9rem] font-bold text-ink">
          {nome}
          {sub && <span className="ml-2 text-[0.75rem] font-semibold text-ink-soft">{sub}</span>}
        </p>
        <p id={ids.descricao} className="mt-0.5 text-[0.82rem] leading-relaxed text-ink-soft">
          {texto}
        </p>
      </div>
      {children(ids)}
    </li>
  );
}

export function CookieConsent() {
  const { pathname } = useLocation();
  const c = useConsentimento({ analytics: TEM_GA, ads: ADS_ENABLED }, pathname);
  const titulo = useRef<HTMLHeadingElement | null>(null);

  // ao trocar de camada, o foco vai para o título
  useEffect(() => {
    if (c.aberto && c.camada === "personalizar") titulo.current?.focus();
  }, [c.aberto, c.camada]);

  // Esc fecha só quando reaberto pelo rodapé (na 1ª visita é preciso escolher)
  useEffect(() => {
    if (!c.aberto || !c.reaberto) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && c.fechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [c.aberto, c.reaberto, c]);

  if (!c.aberto) return null;
  const personalizar = c.camada === "personalizar";
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-titulo"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-h-[calc(100dvh-6rem)] max-w-3xl animate-[cookies-in_180ms_ease-out] flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.45)] motion-reduce:animate-none sm:inset-x-6 lg:bottom-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="cookies-titulo" ref={titulo} tabIndex={-1} className="text-[0.95rem] font-extrabold outline-none">
          {personalizar ? "Preferências de cookies" : "Cookies"}
        </h2>
        {personalizar ? (
          <ul className="divide-y divide-line">
            <Linha nome="Essenciais" texto="Login da equipe, tema claro ou escuro e esta escolha. Sem eles o site não funciona.">
              {() => <span className="pt-0.5 text-[0.78rem] font-bold text-ok">Sempre ativos</span>}
            </Linha>
            {TEM_GA && (
              <Linha nome="Estatística" sub="Google Analytics" texto="Mostra quais páginas são lidas e por quanto tempo, sem identificar você. O Google não guarda o seu IP.">
                {(ids) => <Chave {...ids} ligado={c.rascunho.analytics} aoMudar={(v) => c.setRascunho({ ...c.rascunho, analytics: v })} />}
              </Linha>
            )}
            {ADS_ENABLED && (
              <Linha nome="Anúncios personalizados" sub="Google AdSense" texto="Mostra anúncios de acordo com os seus interesses. Sem isso, os anúncios continuam, mas genéricos.">
                {(ids) => <Chave {...ids} ligado={c.rascunho.ads} aoMudar={(v) => c.setRascunho({ ...c.rascunho, ads: v })} />}
              </Linha>
            )}
          </ul>
        ) : (
          <p className="text-[0.88rem] leading-relaxed text-ink-soft">
            {textoResumo(TEM_GA, ADS_ENABLED)} Você muda de ideia quando quiser em “Preferências de cookies”, no rodapé. Saiba mais na{" "}
            <Link to="/legal/cookies" className="font-semibold text-link underline">
              política de cookies
            </Link>
            .
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {personalizar ? (
          <>
            {c.podeVoltar && (
              <button type="button" onClick={c.voltar} className={BTN_TEXTO}>
                Voltar
              </button>
            )}
            <button type="button" onClick={c.salvar} className={BTN_CONTORNO}>
              Salvar escolhas
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={c.abrirPersonalizar} className={BTN_TEXTO}>
              Personalizar
            </button>
            <button type="button" onClick={c.soEssenciais} className={BTN_CONTORNO}>
              Só os essenciais
            </button>
          </>
        )}
        <button type="button" onClick={c.aceitarTodos} className={BTN_ACEITAR}>
          Aceitar todos
        </button>
      </div>
    </section>
  );
}

/** Link do rodapé que reabre o banner. Só existe com anúncios ou Google Analytics ligados. */
export function CookiePrefsButton({ className }: { className?: string }) {
  if (!ADS_ENABLED && !TEM_GA) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))} className={className}>
      Preferências de cookies
    </button>
  );
}
