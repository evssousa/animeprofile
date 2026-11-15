// Barra inferior do celular (abaixo de 1024 px), como a do site antigo: 5 itens, o último abre a gaveta do menu.
import { Link, useLocation } from "react-router";
import { Menu } from "lucide-react";
import { BOTTOM_NAV, isActive } from "~/lib/nav";

export function BottomNav() {
  const { pathname } = useLocation();
  const item = "relative flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold";
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="grid h-16 grid-cols-5">
        {BOTTOM_NAV.map(({ label, to, icon: Icon, also }) => {
          const active = isActive(pathname, to, also);
          return (
            <li key={to}>
              <Link to={to} aria-current={active ? "page" : undefined} className={`${item} ${active ? "text-brand dark:text-glow" : "text-ink-soft"}`}>
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand" />}
                <Icon className="size-[22px]" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => (document.getElementById("menu-gaveta") as HTMLDialogElement | null)?.showModal()}
            className={`${item} w-full text-ink-soft`}
          >
            <Menu className="size-[22px]" aria-hidden />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
