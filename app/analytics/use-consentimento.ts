// Lógica do banner de cookies (sem visual): quando abre, em qual camada ("resumo" ou "personalizar"), o rascunho das chaves e
// as ações. Cada site desenha o próprio banner em cima disto.
import { useCallback, useEffect, useState } from "react";
import { OPEN_CONSENT_EVENT, SEM_ANALYTICS } from "./config";
import { abrirMensagemGoogle, googleCmpApplies } from "./cmp-google";
import { guardarConsentimento, lerConsentimento, type Consentimento } from "./consent";

export type Categorias = { analytics: boolean; ads: boolean };
type Camada = "resumo" | "personalizar";

export function useConsentimento(categorias: Categorias, pathname: string) {
  const [aberto, setAberto] = useState(false);
  const [camada, setCamada] = useState<Camada>("resumo");
  const [veioDoResumo, setVeioDoResumo] = useState(false);
  const [reaberto, setReaberto] = useState(false);
  const [rascunho, setRascunho] = useState<Consentimento>({ analytics: false, ads: false });
  const existe = categorias.analytics || categorias.ads;

  useEffect(() => {
    if (!existe) return;
    let vivo = true;
    let googleAtende = false;
    void googleCmpApplies().then((g) => {
      if (!vivo) return;
      googleAtende = g;
      if (g) return;
      const l = lerConsentimento();
      if (!l.escolha) {
        if (l.parcial) setRascunho(l.parcial);
        setCamada("resumo");
        setReaberto(false);
        setAberto(true);
      }
    });
    const reabrir = () => {
      if (googleAtende && abrirMensagemGoogle()) return;
      setRascunho(lerConsentimento().escolha ?? { analytics: false, ads: false });
      setCamada("personalizar");
      setVeioDoResumo(false);
      setReaberto(true);
      setAberto(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reabrir);
    return () => {
      vivo = false;
      window.removeEventListener(OPEN_CONSENT_EVENT, reabrir);
    };
  }, [existe]);

  const gravar = useCallback((c: Consentimento) => {
    guardarConsentimento({ analytics: categorias.analytics && c.analytics, ads: categorias.ads && c.ads });
    setAberto(false);
  }, [categorias.analytics, categorias.ads]);

  return {
    aberto: aberto && existe && !SEM_ANALYTICS.test(pathname),
    camada,
    rascunho,
    setRascunho,
    /** Veio do rodapé: pode fechar sem escolher (Esc). */
    reaberto,
    podeVoltar: camada === "personalizar" && veioDoResumo,
    aceitarTodos: () => gravar({ analytics: true, ads: true }),
    soEssenciais: () => gravar({ analytics: false, ads: false }),
    salvar: () => gravar(rascunho),
    abrirPersonalizar: () => {
      setVeioDoResumo(true);
      setCamada("personalizar");
    },
    voltar: () => setCamada("resumo"),
    fechar: () => setAberto(false),
  };
}
