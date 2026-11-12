import { useEffect, useRef } from "react";
import { Form, Link, useLocation } from "react-router";
import { Menu, Search, X } from "lucide-react";
import { Logo } from "./Logo";
import { NavGroups } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

function SearchField({ className = "" }: { className?: string }) {
  return (
    <Form method="get" action="/busca" role="search" className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
      <input
        type="search"
        name="q"
        placeholder="Buscar notícias, animes, quizzes..."
        aria-label="Buscar no site"
        className="h-10 w-full rounded-full border border-line bg-sunken pr-4 pl-10 text-[0.95rem] placeholder:text-ink-soft focus:border-ai focus:bg-surface focus:outline-none"
      />
    </Form>
  );
}

function AccountLinks() {
  return (
    <div className="flex items-center gap-1.5">
      <Link to="/login" className="rounded-full px-3.5 py-2 text-[0.95rem] font-semibold text-ink hover:bg-sunken">
        Entrar
      </Link>
      <Link
        to="/cadastro"
        className="hidden rounded-full bg-hanko px-4 py-2 text-[0.95rem] font-semibold text-hanko-ink hover:brightness-110 sm:inline-block"
      >
        Criar conta
      </Link>
    </div>
  );
}

/** Menu do celular: um <dialog> nativo (foco preso, Esc fecha, sem biblioteca). */
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
        className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sunken lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && close()}
        className="m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none bg-surface text-ink backdrop:bg-black/50"
        aria-label="Menu"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo />
          <button type="button" onClick={close} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sunken" aria-label="Fechar menu">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="px-3 py-5">
          <SearchField className="mb-6" />
          <NavGroups onNavigate={close} />
        </div>
      </dialog>
    </>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <MobileMenu />
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <SearchField className="hidden max-w-md flex-1 sm:block" />
        <div className="ml-auto flex items-center gap-1">
          <Link to="/busca" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sunken sm:hidden" aria-label="Buscar">
            <Search className="size-5" aria-hidden />
          </Link>
          <ThemeToggle />
          <AccountLinks />
        </div>
      </div>
    </header>
  );
}
