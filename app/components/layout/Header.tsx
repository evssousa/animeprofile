import { useEffect, useRef } from "react";
import { Form, Link, NavLink, useLocation } from "react-router";
import { Menu, Search, X } from "lucide-react";
import { NAV, TOP_NAV, isActive } from "~/lib/nav";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Topo do site: faixa escura (a "night"), que continua no cabeçalho de cada página (PageHeader),
 * como na capa cinematográfica do layout escolhido. No computador, menu na linha; no celular, um
 * <dialog> nativo com todos os grupos do menu (foco preso, Esc fecha, sem biblioteca).
 */
export function Header() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-30 bg-night/95 text-night-ink backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1328px] items-center gap-3 px-4 sm:gap-6 sm:px-8 lg:px-14">
        <MobileMenu />
        <Logo />
        <nav aria-label="Menu principal" className="hidden items-center gap-6 lg:flex">
          {TOP_NAV.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 py-2 text-[0.95rem] font-semibold ${active ? "border-brand text-white" : "border-transparent text-white/70 hover:text-white"}`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <Link to="/busca" aria-label="Buscar" className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <Search className="size-[19px]" aria-hidden />
          </Link>
          <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
          <Link to="/login" className="hidden px-2 py-2 font-semibold hover:text-glow sm:inline-block">
            Entrar
          </Link>
          <Link to="/cadastro" className="rounded-[9px] bg-brand px-3.5 py-2.5 text-[0.9rem] font-bold whitespace-nowrap sm:px-4 sm:text-[0.95rem] text-brand-ink shadow-[0_8px_24px_rgba(194,53,43,.35)] hover:brightness-110">
            Criar conta
          </Link>
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
        className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-white/10 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && close()}
        className="m-0 h-dvh max-h-none w-[min(21rem,88vw)] max-w-none bg-surface text-ink backdrop:bg-black/60"
        aria-label="Menu"
      >
        <div className="flex h-[72px] items-center justify-between bg-night px-4 text-night-ink">
          <Logo />
          <button type="button" onClick={close} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar menu">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-6 px-3 py-5">
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
          <nav aria-label="Menu completo" className="flex flex-col gap-5">
            {NAV.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[0.8rem] font-semibold text-ink-soft">{group.label}</p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map(({ label, to, icon: Icon }) => {
                    const active = isActive(pathname, to);
                    return (
                      <li key={to}>
                        <NavLink
                          to={to}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${active ? "bg-brand-soft text-brand" : "text-ink hover:bg-sunken"}`}
                        >
                          <Icon className="size-[1.15rem] shrink-0" aria-hidden />
                          {label}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <Link to="/login" onClick={close} className="mx-3 rounded-xl border border-line py-3 text-center font-semibold hover:bg-sunken">
            Entrar
          </Link>
        </div>
      </dialog>
    </>
  );
}
