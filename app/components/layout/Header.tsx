import { useEffect, useRef } from "react";
import { Form, Link, NavLink, useLocation } from "react-router";
import { Menu, Search, X } from "lucide-react";
import { HEADER_LINKS, isActive } from "~/lib/nav";
import { AcoesLogado } from "./AcoesLogado";
import { AgoraTopo } from "./AgoraTopo";
import { InstalarGaveta, InstalarTopo } from "./InstalarApp";
import { PainelEquipeTopo } from "./PainelEquipeTopo";
import { registrarApp } from "~/lib/pwa";
import { BuscaCelular, BuscaTopo } from "./BuscaTopo";
import { Logo } from "./Logo";
import { MenuFooter, NavGroups } from "./SideNav";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu, UserMenuDrawer } from "./UserMenu";

/**
 * Topo do site: faixa escura (a "night"), que continua no cabeçalho de cada página (PageHeader), como na capa
 * cinematográfica do layout escolhido. O menu principal fica na lateral esquerda (SideNav, como no site antigo); aqui
 * ficam o logo, um espaço para menus extras (HEADER_LINKS), a busca e a entrada. Abaixo de 1280 px o menu abre numa
 * gaveta (<dialog> nativo, foco preso, Esc fecha, sem biblioteca).
 */
export function Header() {
  const { pathname } = useLocation();
  useEffect(registrarApp, []);
  return (
    <header className="sticky top-0 z-30 bg-night/95 text-night-ink backdrop-blur-md">
      <div className="flex h-[60px] items-center gap-3 lg:h-[72px] px-4 sm:gap-5 sm:px-6 lg:px-5">
        <MobileMenu />
        <Logo />
        {HEADER_LINKS.length > 0 && (
          <nav aria-label="Atalhos" className="hidden items-center gap-6 lg:flex">
            {HEADER_LINKS.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 py-2 text-[0.95rem] font-semibold ${active ? "border-brand text-white" : "border-transparent text-white/70 hover:text-white"}`}
                >
                  {item.label}
                  {item.badge && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[0.65rem] font-bold text-brand-ink">{item.badge}</span>}
                </NavLink>
              );
            })}
          </nav>
        )}
        <AgoraTopo />
        <BuscaTopo />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3 lg:ml-0">
          <PainelEquipeTopo />
          <InstalarTopo />
          <BuscaCelular />
          <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white lg:hidden logado:max-sm:hidden!" />
          <Link to="/login" className="hidden px-2 py-2 font-semibold hover:text-glow sm:inline-block logado:hidden!">
            Entrar
          </Link>
          <Link to="/login" className="logado:hidden! rounded-[9px] bg-brand px-3.5 py-2.5 text-[0.9rem] font-bold whitespace-nowrap sm:px-4 sm:text-[0.95rem] text-brand-ink shadow-[0_8px_24px_rgba(194,53,43,.35)] hover:brightness-110">
            <span className="min-[400px]:hidden">Em breve</span>
            <span className="hidden min-[400px]:inline">Contas em breve</span>
          </Link>
          <AcoesLogado />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function MobileMenu() {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const close = () => ref.current?.close();
  useEffect(close, [pathname]);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        id="abrir-menu" className="-ml-2 hidden size-11 place-items-center rounded-full hover:bg-white/10 lg:grid xl:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <dialog
        ref={ref}
        id="menu-gaveta"
        onClick={(e) => e.target === ref.current && close()}
        className="m-0 h-dvh max-h-none w-[min(21rem,88vw)] max-w-none bg-surface text-ink backdrop:bg-black/60"
        aria-label="Menu"
      >
        <div className="flex h-[60px] items-center justify-between bg-night px-4 text-night-ink lg:h-[72px]">
          <Logo />
          <button type="button" onClick={close} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar menu">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="flex h-[calc(100dvh-60px)] flex-col gap-6 overflow-y-auto px-3 py-5 lg:h-[calc(100dvh-72px)]">
          <Form method="get" action="/busca" role="search" className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Buscar notícias, animes, quizzes..."
              aria-label="Buscar no site"
              className="h-11 w-full rounded-xl border border-line bg-sunken pr-4 pl-10 placeholder:text-ink-soft focus:bg-surface focus:outline-none"
            />
          </Form>
          <nav aria-label="Menu completo">
            <NavGroups variant="drawer" onNavigate={close} />
          </nav>
          <Link to="/login" onClick={close} className="mx-3 rounded-xl border border-line py-3 text-center font-semibold hover:bg-sunken logado:hidden!">
            Entrar
          </Link>
          <UserMenuDrawer onNavigate={close} />
          <InstalarGaveta onNavigate={close} />
          <div className="flex flex-col gap-1">
            <MenuFooter variant="drawer" />
          </div>
        </div>
      </dialog>
    </>
  );
}
