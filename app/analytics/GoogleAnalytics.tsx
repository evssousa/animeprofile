// Google Analytics 4, sem visual. Só mede quando TODAS valem: ID válido, página fora do painel/login, ninguém logado, navegador
// sem a marca "não medir" (?nao-medir=1) e consentimento de Estatística. Se alguma deixa de valer depois, pausa na hora.
// Um page_view por troca de endereço (pathname + search), com o título da página nova e sem duplicar.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useMarcador } from "~/lib/use-marcador";
import { COOKIE_DOMAIN, CONSENT_CHANGED_EVENT, NAO_MEDIR_KEY, SEM_ANALYTICS, gaIdValido } from "./config";
import { lerConsentimento } from "./consent";
import { apagarCookiesGa, carregarGa, enviarPageView, pausarGa } from "./gtag";

function lerNaoMedir(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("nao-medir");
    if (q === "1") localStorage.setItem(NAO_MEDIR_KEY, "1");
    if (q === "0") localStorage.removeItem(NAO_MEDIR_KEY);
    return localStorage.getItem(NAO_MEDIR_KEY) === "1";
  } catch {
    return false;
  }
}

export function GoogleAnalytics({ id }: { id: string }) {
  const { pathname, search } = useLocation();
  const { logado } = useMarcador();
  const [montado, setMontado] = useState(false);
  const [naoMedir, setNaoMedir] = useState(false);
  const [estatistica, setEstatistica] = useState(false);

  useEffect(() => {
    setNaoMedir(lerNaoMedir());
    const ler = () => setEstatistica(lerConsentimento().escolha?.analytics === true);
    ler();
    setMontado(true);
    window.addEventListener(CONSENT_CHANGED_EVENT, ler);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, ler);
  }, []);

  const valido = gaIdValido(id);
  const pode = Boolean(montado && valido && !SEM_ANALYTICS.test(pathname) && !logado && !naoMedir && estatistica);

  // liga/pausa; ao revogar a Estatística, apaga os cookies _ga
  const tinhaEstatistica = useRef(false);
  useEffect(() => {
    if (!valido || !montado) return;
    if (pode) {
      carregarGa(valido);
      pausarGa(valido, false);
    } else {
      pausarGa(valido, true);
    }
    if (tinhaEstatistica.current && !estatistica) apagarCookiesGa(COOKIE_DOMAIN);
    tinhaEstatistica.current = estatistica;
  }, [pode, valido, montado, estatistica]);

  // page_view manual
  const ultimo = useRef<string | null>(null);
  useEffect(() => {
    if (!pode) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mandar = () => {
      if (cancelado) return;
      // espera o React trocar o <title> da página nova
      timer = setTimeout(() => {
        const href = location.origin + location.pathname + location.search;
        if (href === ultimo.current) return;
        const anterior = ultimo.current ?? undefined;
        ultimo.current = href;
        enviarPageView(href, anterior);
      }, 0);
    };
    // espera a pré-renderização acabar e a aba ficar visível (como o VisitBeacon)
    const aoMudar = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", aoMudar);
      mandar();
    };
    const aposPrerender = () => (document.visibilityState === "visible" ? mandar() : document.addEventListener("visibilitychange", aoMudar));
    if ((document as Document & { prerendering?: boolean }).prerendering) {
      document.addEventListener("prerenderingchange", aposPrerender, { once: true });
    } else aposPrerender();
    return () => {
      cancelado = true;
      clearTimeout(timer);
      document.removeEventListener("prerenderingchange", aposPrerender);
      document.removeEventListener("visibilitychange", aoMudar);
    };
  }, [pode, pathname, search]);

  // voltar pelo histórico com a página restaurada da memória: conta de novo
  useEffect(() => {
    if (!pode) return;
    const aoMostrar = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      ultimo.current = null;
      enviarPageView(location.origin + location.pathname + location.search);
      ultimo.current = location.origin + location.pathname + location.search;
    };
    window.addEventListener("pageshow", aoMostrar);
    return () => window.removeEventListener("pageshow", aoMostrar);
  }, [pode]);

  return null;
}
