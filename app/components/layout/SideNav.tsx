// Menu lateral esquerdo (como no site antigo): 256 px com nomes, 72 px só com ícones. Docs: plano-sidebar-esquerda.md.
// A partir de 1280 px o visitante escolhe (botão no pé, salvo em localStorage "ap-sidebar"); de 1024 a 1279 px fica sempre
// recolhida; abaixo disso some e o menu abre na gaveta do topo. O servidor manda sempre o HTML expandido e um script no
// <head> aplica a escolha antes da primeira pintura (sem cookie, então o cache de 60 s da CDN não atrapalha).
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV, isActive } from "~/lib/nav";
import { ThemeToggle } from "./ThemeToggle";

const KEY = "ap-sidebar";

/** Roda no <head>: aplica "recolhida" salvo, antes de a página aparecer. */
export const sidebarBootstrap = `(function(){try{if(localStorage.getItem("${KEY}")==="mini")document.documentElement.dataset.sidebar="mini"}catch(e){}})();`;

type Variant = "rail" | "drawer";

/** Os grupos do menu. Na lateral, os nomes somem quando recolhida; na gaveta aparecem sempre. */
export function NavGroups({ variant, onNavigate }: { variant: Variant; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const rail = variant === "rail";
  return (
    <div className="flex flex-col gap-5">
      {NAV.map((group, gi) => (
        <div key={group.label}>
          <p className={`px-3 pb-1.5 text-[0.75rem] font-bold tracking-[0.14em] text-ink-soft uppercase ${rail ? "lg:sr-only xl:not-sr-only xl:mini:sr-only" : ""}`}>{group.label}</p>
          {rail && gi > 0 && <span aria-hidden className="mx-auto my-1 hidden h-px w-8 bg-line lg:block xl:hidden xl:mini:block" />}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ label, to, icon: Icon, soon }) => {
              const active = isActive(pathname, to);
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    title={soon ? `${label} (em breve)` : label}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold ${
                      rail ? "lg:justify-center lg:px-0 xl:justify-start xl:px-3 xl:mini:justify-center xl:mini:px-0" : ""
                    } ${
                      active
                        ? "bg-brand-soft text-brand before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand dark:text-glow"
                        : "text-ink hover:bg-sunken"
                    }`}
                  >
                    <Icon className={`size-5 shrink-0 ${active ? "" : "text-ink-soft"}`} aria-hidden />
                    <span className={`truncate ${rail ? "lg:sr-only xl:not-sr-only xl:mini:sr-only" : ""}`}>{label}</span>
                    {soon && (
                      <span className={`ml-auto shrink-0 rounded-full bg-sunken px-1.5 py-0.5 text-[0.65rem] font-bold whitespace-nowrap text-ink-soft ${rail ? "lg:hidden xl:inline xl:mini:hidden" : ""}`}>em breve</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Tema e links pequenos (pé da lateral e fim da gaveta). */
export function MenuFooter({ variant }: { variant: Variant }) {
  const rail = variant === "rail";
  const small = "text-[0.8rem] text-ink-soft hover:text-ink hover:underline";
  return (
    <>
      <div className={`flex h-11 items-center justify-between rounded-xl px-3 text-[0.9rem] text-ink-soft ${rail ? "lg:justify-center lg:px-0 xl:justify-between xl:px-3 xl:mini:justify-center xl:mini:px-0" : ""}`}>
        <span className={rail ? "lg:sr-only xl:not-sr-only xl:mini:sr-only" : ""}>Tema claro / escuro</span>
        <ThemeToggle className="text-ink-soft hover:bg-sunken hover:text-ink" />
      </div>
      <p className={`flex flex-wrap gap-x-3 px-3 ${rail ? "lg:hidden xl:flex xl:mini:hidden" : ""}`}>
        <Link to="/sobre" className={small}>
          Sobre
        </Link>
        <Link to="/contato" className={small}>
          Contato
        </Link>
        <Link to="/legal/privacidade" className={small}>
          Privacidade
        </Link>
      </p>
    </>
  );
}

export function SideNav() {
  const [mini, setMini] = useState(false);
  useEffect(() => setMini(document.documentElement.dataset.sidebar === "mini"), []);
  function toggle() {
    const next = document.documentElement.dataset.sidebar === "mini" ? "full" : "mini";
    if (next === "mini") document.documentElement.dataset.sidebar = "mini";
    else delete document.documentElement.dataset.sidebar;
    setMini(next === "mini");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // modo privado: vale só nesta visita
    }
  }
  return (
    <aside
      id="menu-lateral"
      className="hidden shrink-0 border-r border-line bg-surface lg:block lg:w-[72px] xl:w-64 xl:mini:w-[72px] motion-safe:transition-[width] motion-safe:duration-200"
    >
      <div className="sticky top-[72px] z-20 flex h-[calc(100dvh-72px)] flex-col">
        <nav aria-label="Menu principal" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <NavGroups variant="rail" />
        </nav>
        <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
          <MenuFooter variant="rail" />
          <button
            type="button"
            onClick={toggle}
            aria-controls="menu-lateral"
            aria-expanded={!mini}
            aria-label={mini ? "Expandir menu" : "Recolher menu"}
            title={mini ? "Expandir menu" : "Recolher menu"}
            className="hidden h-11 items-center gap-3 rounded-xl px-3 text-[0.9rem] font-semibold text-ink-soft hover:bg-sunken hover:text-ink xl:flex xl:mini:justify-center xl:mini:px-0"
          >
            {mini ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
            <span className="xl:mini:sr-only">{mini ? "Expandir menu" : "Recolher menu"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
