// Ações do topo de quem está logado, como no site antigo: Check-in do dia, Mensagens e Notificações (sino com painel).
// O HTML público não leva nada disto (só depois de o navegador saber que há sessão), então não vira link indexável.
// Saldos (AP Coins, Rubis) e nível voltam com a economia; hoje não há dado e nunca mostramos "0" falso.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Bell } from "lucide-react";
import { HEADER_ACOES } from "~/lib/nav";
import { useMarcador } from "~/lib/use-marcador";

const botao = "grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 sm:size-11";

function Sino() {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    titulo.current?.focus();
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        gatilho.current?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button ref={gatilho} type="button" aria-label="Notificações" aria-haspopup="dialog" aria-expanded={aberto} aria-controls="painel-notificacoes" onClick={() => setAberto((a) => !a)} className={botao}>
        <Bell className="size-5" aria-hidden />
      </button>
      {aberto && (
        <div
          id="painel-notificacoes"
          role="dialog"
          aria-labelledby="titulo-notificacoes"
          className="absolute top-[calc(100%+8px)] right-0 z-40 w-[min(22.5rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="titulo-notificacoes" ref={titulo} tabIndex={-1} className="text-[0.95rem] font-bold outline-none">
              Notificações
            </h2>
          </div>
          <div className="px-6 py-10 text-center">
            <Bell className="mx-auto size-10 text-ink-soft/40" aria-hidden />
            <p className="mt-3 font-semibold">Nenhuma notificação ainda</p>
            <p className="mt-1 text-[0.85rem] text-ink-soft">Curtidas, respostas e avisos aparecem aqui.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AcoesLogado() {
  const { logado } = useMarcador();
  if (!logado) return null;
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {HEADER_ACOES.map((a) =>
        a.to ? (
          <Link key={a.id} to={a.to} aria-label={a.label} title={a.label} className={botao}>
            <a.icon className="size-5" aria-hidden />
          </Link>
        ) : (
          <Sino key={a.id} />
        ),
      )}
    </div>
  );
}
