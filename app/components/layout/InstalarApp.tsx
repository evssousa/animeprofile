// "Instalar app": botão no topo (a partir de 1024 px) e linha na gaveta do menu. Só aparece quando o navegador oferece a instalação
// (ou no Safari do iPhone, onde leva a /como-instalar); some depois de instalar ou de recusar.
import { Link } from "react-router";
import { Download } from "lucide-react";
import { instalarApp, useOfertaInstalar } from "~/lib/pwa";

export function InstalarTopo() {
  const oferta = useOfertaInstalar();
  if (oferta === "nenhuma") return null;
  const classes =
    "hidden h-9 items-center justify-center gap-2 rounded-full border border-white/15 px-0 text-[0.85rem] font-semibold text-white/85 hover:bg-white/10 hover:text-white size-9 lg:inline-flex xl:size-auto xl:px-3 motion-safe:animate-[ap-pop_120ms_ease-out]";
  const conteudo = (
    <>
      <Download className="size-4" aria-hidden />
      <span className="sr-only xl:not-sr-only">Instalar app</span>
    </>
  );
  return oferta === "ios" ? (
    <Link to="/como-instalar" aria-label="Instalar o app" className={classes}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={() => void instalarApp()} aria-label="Instalar o app" className={classes}>
      {conteudo}
    </button>
  );
}

/** Linha da gaveta do menu (abaixo de 1280 px). */
export function InstalarGaveta({ onNavigate }: { onNavigate: () => void }) {
  const oferta = useOfertaInstalar();
  if (oferta === "nenhuma") return null;
  const classes = "mx-3 flex h-11 items-center gap-3 rounded-xl px-3 font-semibold hover:bg-sunken";
  return oferta === "ios" ? (
    <Link to="/como-instalar" onClick={onNavigate} className={classes}>
      <Download className="size-5 text-ink-soft" aria-hidden /> Instalar o app
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => {
        onNavigate();
        void instalarApp();
      }}
      className={classes}
    >
      <Download className="size-5 text-ink-soft" aria-hidden /> Instalar o app
    </button>
  );
}
