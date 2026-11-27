// Carrega o gtag.js do Google Analytics 4 e envia os eventos. Só é chamado com consentimento de Estatística (modo básico do
// Modo de Consentimento: sem permissão, o script nem é baixado). O page_view é manual (um por troca de rota).

type Estado = "parado" | "carregando" | "ativo" | "falhou";
let estado: Estado = "parado";
let idAtual: string | null = null;
// O debug_mode no config não chega aos eventos (conferido em 2026-11-26): vai em cada evento.
let depurar = false;

function gtag(...args: unknown[]) {
  if (typeof window.gtag !== "function") {
    // o script do <head> normalmente já criou; aqui só por garantia (o gtag.js precisa receber o objeto `arguments`)
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  window.gtag(...args);
}

const DEBUG_KEY = "ap-ga-debug";
/** ?ga_debug=1 liga o modo de depuração (DebugView do GA) até fechar a aba; ?ga_debug=0 desliga. */
export function gaDebug(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("ga_debug");
    if (q === "1") sessionStorage.setItem(DEBUG_KEY, "1");
    if (q === "0") sessionStorage.removeItem(DEBUG_KEY);
    return sessionStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Prepara o GA (js + config, que entram no dataLayer antes de qualquer evento) e baixa o script com o navegador ocioso. Uma vez só. */
export function carregarGa(id: string) {
  if (estado !== "parado") return;
  estado = "carregando";
  idAtual = id;
  depurar = gaDebug();
  gtag("js", new Date());
  gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const inserir = () => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    s.onload = () => {
      estado = "ativo";
    };
    s.onerror = () => {
      estado = "falhou";
    };
    document.head.appendChild(s);
  };
  const quandoOcioso = () => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
    if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(inserir);
    else setTimeout(inserir, 1);
  };
  if (document.readyState === "complete") quandoOcioso();
  else window.addEventListener("load", quandoOcioso, { once: true });
}

const flags = () => window as unknown as Record<string, unknown>;

/** Para (ou volta a) enviar na hora, sem descarregar o script. */
export function pausarGa(id: string, pausa: boolean) {
  flags()[`ga-disable-${id}`] = pausa;
}

function pronto(): boolean {
  if (typeof window === "undefined" || !idAtual) return false;
  if (estado !== "carregando" && estado !== "ativo") return false;
  return flags()[`ga-disable-${idAtual}`] !== true;
}

export function enviarPageView(href: string, referrer?: string) {
  if (!pronto()) return;
  gtag("event", "page_view", { page_location: href, page_title: document.title, ...(referrer ? { page_referrer: referrer } : {}), ...(depurar ? { debug_mode: true } : {}) });
}

/** Evento personalizado. Sem GA ativo (sem consentimento, painel, logado), não faz nada e não enfileira. */
export function medir(nome: string, params: Record<string, unknown> = {}) {
  if (!pronto()) return;
  gtag("event", nome, depurar ? { ...params, debug_mode: true } : params);
}

/** Apaga os cookies _ga e _ga_* (no host e no domínio do site). */
export function apagarCookiesGa(dominio: string) {
  for (const parte of document.cookie.split(";")) {
    const nome = parte.split("=")[0]?.trim();
    if (!nome || !nome.startsWith("_ga")) continue;
    document.cookie = `${nome}=; Max-Age=0; Path=/`;
    document.cookie = `${nome}=; Max-Age=0; Path=/; Domain=${dominio}`;
  }
}
