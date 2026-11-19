// Casca do painel /admin: topo escuro (☰ no celular, logo, selo "Painel", tema, ver o site, sair) e a barra lateral com os
// menus do painel. Específico do animeprofile.
import { useEffect, useRef } from "react";
import { Form, useLocation } from "react-router";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { Logo } from "~/components/layout/Logo";
import { ThemeToggle } from "~/components/layout/ThemeToggle";
import type { AdminNavGroup } from "~/lib/admin-nav";
import { AdminNav, AdminNavGaveta, type AdminConta } from "./AdminNav";

export function AdminShell({ children, aqui, grupos, conta }: { children: React.ReactNode; aqui?: React.ReactNode; grupos: AdminNavGroup[]; conta: AdminConta }) {
  const gaveta = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const fechar = () => gaveta.current?.close();
  useEffect(fechar, [pathname]);
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-30 bg-night text-night-ink">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 text-night-ink">
            <button type="button" onClick={() => gaveta.current?.showModal()} aria-label="Abrir menu do painel" aria-haspopup="dialog" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-white/10 lg:hidden">
              <Menu className="size-6" aria-hidden />
            </button>
            <Logo />
            <span className="rounded-full border border-glow/40 px-2 py-0.5 text-[0.7rem] font-bold tracking-[0.08em] text-glow uppercase">Painel</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {aqui}
            <ThemeToggle />
            <a href="/" target="_blank" rel="noreferrer" className="hidden h-11 items-center gap-1.5 rounded-full px-3 text-[0.85rem] font-semibold text-night-ink/80 hover:text-night-ink sm:inline-flex">
              Ver o site <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <Form method="post" action="/admin/sair">
              <button type="submit" className="inline-flex size-11 items-center justify-center gap-1.5 rounded-full text-night-ink/80 hover:text-night-ink sm:w-auto sm:px-3" aria-label="Sair do painel">
                <LogOut className="size-4" aria-hidden />
                <span className="hidden text-[0.85rem] font-semibold sm:inline">Sair</span>
              </button>
            </Form>
          </div>
        </div>
      </header>
      <dialog
        ref={gaveta}
        onClick={(e) => e.target === gaveta.current && fechar()}
        aria-label="Menu do painel"
        className="m-0 h-dvh max-h-none w-[min(18rem,88vw)] max-w-none bg-surface text-ink backdrop:bg-black/60"
      >
        <div className="flex h-14 items-center justify-between bg-night px-4 text-night-ink">
          <Logo />
          <button type="button" onClick={fechar} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar menu">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <AdminNavGaveta grupos={grupos} conta={conta} onNavigate={fechar} />
      </dialog>
      <div className="flex">
        <AdminNav grupos={grupos} conta={conta} />
        <main id="conteudo" className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
