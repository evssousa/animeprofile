// Um espaço de anúncio do AdSense. Nasce fechado (sem bloco vazio reservado) e só abre, com o rótulo "Publicidade", quando o Google
// entrega o anúncio; se todas as tentativas vierem "sem anúncio" (ou o script for bloqueado), some de vez. O script do AdSense só é
// carregado quando o primeiro espaço aparece, e só com o navegador ocioso (não disputa banda com o conteúdo). Nunca roda para quem está
// logado (o dono não pode ver nem clicar nos próprios anúncios) nem no painel.
import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS, type AdSlotName } from "~/lib/ads";
import { useMarcador } from "~/lib/use-marcador";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Pede o anúncio bem antes de o espaço entrar na tela, para o Google responder ainda fora da vista.
const MARGEM = "1000px";
// Se o script nem carregou depois disso (rede muito ruim), some com o espaço.
const DESISTE_MS = 30_000;

type Tentativa = { unit: string; format: "fluid" | "auto" | "vertical" | "autorelaxed"; layout?: "in-article" };

/** Formatos com poucos anúncios disponíveis (in-article, vertical) tentam de novo com o banner comum responsivo antes de sumir. */
const TENTATIVAS: Record<AdSlotName, Tentativa[]> = {
  inArticle: [
    { unit: AD_SLOTS.inArticle, format: "fluid", layout: "in-article" },
    { unit: AD_SLOTS.list, format: "auto" },
  ],
  endOfArticle: [{ unit: AD_SLOTS.endOfArticle, format: "auto" }],
  sidebar: [
    { unit: AD_SLOTS.sidebar, format: "vertical" },
    { unit: AD_SLOTS.sidebar, format: "auto" },
  ],
  multiplex: [
    { unit: AD_SLOTS.multiplex, format: "autorelaxed" },
    { unit: AD_SLOTS.list, format: "auto" },
  ],
  list: [{ unit: AD_SLOTS.list, format: "auto" }],
};

type EstadoScript = "parado" | "carregando" | "carregado" | "falhou";
const EVENTO = "ap-ads-script";
let estadoScript: EstadoScript = "parado";
const mudar = (e: EstadoScript) => {
  estadoScript = e;
  window.dispatchEvent(new Event(EVENTO));
};

function acrescentarScript() {
  window.adsbygoogle = window.adsbygoogle || [];
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.onload = () => mudar("carregado");
  s.onerror = () => mudar("falhou");
  document.head.appendChild(s);
}

/** Carrega a biblioteca do AdSense uma vez, depois que a página terminou de carregar e o navegador está ocioso. */
function carregarAdsense() {
  if (typeof window === "undefined" || estadoScript !== "parado") return;
  mudar("carregando");
  const quandoOcioso = () => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(acrescentarScript);
    else setTimeout(acrescentarScript, 1);
  };
  if (document.readyState === "complete") quandoOcioso();
  else window.addEventListener("load", quandoOcioso, { once: true });
}

export function AdSlot({ slot, className = "" }: { slot: AdSlotName; className?: string }) {
  const { logado } = useMarcador();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const ativo = ADS_ENABLED && montado && !logado;
  const caixa = useRef<HTMLDivElement | null>(null);
  const [perto, setPerto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [escondido, setEscondido] = useState(false);
  const [preenchido, setPreenchido] = useState(false);

  useEffect(() => {
    if (!ativo) return;
    carregarAdsense();
    const el = caixa.current;
    if (!el) return;
    const aoMudar = () => estadoScript === "falhou" && setEscondido(true);
    window.addEventListener(EVENTO, aoMudar);
    aoMudar();
    const desiste = setTimeout(() => estadoScript !== "carregado" && setEscondido(true), DESISTE_MS);
    const io = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) {
          setPerto(true);
          io.disconnect();
        }
      },
      { rootMargin: MARGEM },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener(EVENTO, aoMudar);
      clearTimeout(desiste);
    };
  }, [ativo]);

  if (!ativo || escondido) return null;
  const tentativas = TENTATIVAS[slot];
  const atual = tentativas[tentativa];
  return (
    <div ref={caixa} className={`ap-ad-slot w-full overflow-hidden text-center ${preenchido ? "my-6" : "my-0"} ${className}`} data-ad-slot-name={slot} data-ad-filled={preenchido ? "true" : undefined}>
      {preenchido && <p className="mb-1.5 text-center text-[0.62rem] font-semibold tracking-[0.16em] text-ink-soft/70 uppercase">Publicidade</p>}
      {perto && atual && (
        <Unidade
          key={tentativa}
          t={atual}
          aoPreencher={() => setPreenchido(true)}
          aoFicarVazio={() => (tentativa + 1 < tentativas.length ? setTentativa(tentativa + 1) : setEscondido(true))}
        />
      )}
    </div>
  );
}

/** Um <ins> do AdSense: dá o push uma vez e avisa quando o Google responde (preenchido ou "sem anúncio"). */
function Unidade({ t, aoPreencher, aoFicarVazio }: { t: Tentativa; aoPreencher: () => void; aoFicarVazio: () => void }) {
  const ins = useRef<HTMLModElement | null>(null);
  const vazio = useRef(aoFicarVazio);
  vazio.current = aoFicarVazio;
  const cheio = useRef(aoPreencher);
  cheio.current = aoPreencher;
  useEffect(() => {
    const el = ins.current;
    if (!el) return;
    const obs = new MutationObserver(() => {
      const s = el.getAttribute("data-ad-status");
      if (s === "unfilled") vazio.current();
      else if (s === "filled") cheio.current();
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    // Guarda contra montagem dupla (React em dev) e <ins> já reivindicado pelo script: cada <ins> recebe um único push.
    if (!el.getAttribute("data-adsbygoogle-status") && !el.dataset.apPush) {
      el.dataset.apPush = "1";
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        vazio.current();
      }
    }
    return () => obs.disconnect();
  }, []);
  return (
    <ins
      ref={ins}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={t.unit}
      data-ad-format={t.format}
      {...(t.layout ? { "data-ad-layout": t.layout } : {})}
      {...(t.format === "auto" || t.format === "autorelaxed" || t.format === "vertical" ? { "data-full-width-responsive": "true" } : {})}
    />
  );
}
