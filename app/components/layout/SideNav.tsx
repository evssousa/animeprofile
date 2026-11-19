// Menu lateral esquerdo (como no site antigo): 256 px com nomes, 72 px só com ícones. Docs: plano-sidebar-esquerda.md.
// A partir de 1280 px o visitante escolhe (botão no pé, salvo em localStorage "ap-sidebar"); de 1024 a 1279 px fica sempre
// recolhida; abaixo disso some e o menu abre na gaveta do topo. O servidor manda sempre o HTML expandido e um script no
// <head> aplica a escolha antes da primeira pintura (sem cookie, então o cache de 60 s da CDN não atrapalha).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV, isActive } from "~/lib/nav";
import { EQUIPE, podeVer, type Papel } from "~/lib/papeis";
import { useMarcador } from "~/lib/use-marcador";
import { ThemeToggle } from "./ThemeToggle";

const KEY = "ap-sidebar";

/** Roda no <head>: aplica "recolhida" salvo, antes de a página aparecer. */
export const sidebarBootstrap = `(function(){try{if(localStorage.getItem("${KEY}")==="mini")document.documentElement.dataset.sidebar="mini"}catch(e){}})();`;

type Variant = "rail" | "drawer";

// Quem vê o quê vem do CSS (`data-logado`/`data-papeis` no <html>, postos antes da primeira pintura). As classes ficam escritas
// por extenso para o Tailwind enxergá-las.
const VISIVEL_LOGADO = "hidden logado:block";
const VISIVEL_EQUIPE = "hidden equipe:block";
const VISIVEL_ADMIN = "hidden papel-admin:block";

function classeVisibilidade(item: { auth?: true; papeis?: Papel[] }) {
  if (item.papeis) return item.papeis.every((p) => EQUIPE.includes(p)) && item.papeis.length === EQUIPE.length ? VISIVEL_EQUIPE : VISIVEL_ADMIN;
  return item.auth ? VISIVEL_LOGADO : "";
}

/** Os grupos do menu. Na lateral, os nomes somem quando recolhida; na gaveta aparecem sempre. */
export function NavGroups({ variant, onNavigate }: { variant: Variant; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const marcador = useMarcador();
  const rail = variant === "rail";
  return (
    <div className="flex flex-col gap-4">
      {NAV.map((group, gi) => (
        <div key={group.label} className={group.items.every((i) => i.auth) ? classeVisibilidade(group.items[0]) : ""}>
          <p className={`px-3 pb-1.5 text-[0.75rem] font-bold tracking-[0.14em] text-ink-soft uppercase ${rail ? "lg:sr-only xl:not-sr-only xl:mini:sr-only" : ""}`}>{group.label}</p>
          {rail && gi > 0 && <span aria-hidden className="mx-auto my-1 hidden h-px w-8 bg-line lg:block xl:hidden xl:mini:block" />}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const { label, to, icon: Icon, also } = item;
              const active = isActive(pathname, to, also);
              const classes = `relative flex h-10 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold ${
                rail ? "lg:justify-center lg:px-0 xl:justify-start xl:px-3 xl:mini:justify-center xl:mini:px-0" : ""
              } ${
                active
                  ? "bg-brand-soft text-brand before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand dark:text-glow"
                  : "text-ink hover:bg-sunken"
              }`;
              const conteudo = (
                <>
                  <Icon className={`size-5 shrink-0 ${active ? "" : "text-ink-soft"}`} aria-hidden />
                  <span className={`min-w-0 truncate ${rail ? "lg:sr-only xl:not-sr-only xl:mini:sr-only" : ""}`}>{label}</span>
                </>
              );
              // Itens só de logado: no HTML público saem como texto (sem href), para o Google não indexar links de páginas
              // que só o logado usa; viram link no navegador de quem está logado (e tem o papel).
              const link = !item.auth || (marcador.logado && podeVer(item.papeis, marcador.papeis));
              return (
                <li key={to} className={classeVisibilidade(item)}>
                  {link ? (
                    <NavLink to={to} onClick={onNavigate} title={label} aria-current={active ? "page" : undefined} className={classes}>
                      {conteudo}
                    </NavLink>
                  ) : (
                    <span aria-hidden="true" className={classes}>
                      {conteudo}
                    </span>
                  )}
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

/**
 * Rolagem do menu sem barra: as bordas desvanecem quando há mais itens para cima ou para baixo (some no fim).
 * A roda e o toque continuam rolando; o teclado também (os links recebem foco e a lista acompanha).
 */
export function FadeScroll({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ top: el.scrollTop > 4, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  const a = edge.top ? "transparent 0, #000 28px" : "#000 0, #000 0";
  const b = edge.bottom ? "#000 calc(100% - 36px), transparent 100%" : "#000 100%, #000 100%";
  const mask = `linear-gradient(to bottom, ${a}, ${b})`;
  return (
    <nav ref={ref} aria-label={label} style={{ maskImage: mask, WebkitMaskImage: mask }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </nav>
  );
}

/** Preferência "menu recolhido" (compartilhada com o painel): lê o <html> depois de montar e salva em localStorage. */
export function useSidebarMini() {
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
  return { mini, toggle };
}

export function SideNav() {
  const { mini, toggle } = useSidebarMini();
  return (
    <aside
      id="menu-lateral"
      className="hidden shrink-0 border-r border-line bg-surface lg:block lg:w-[72px] xl:w-64 xl:mini:w-[72px] motion-safe:transition-[width] motion-safe:duration-200"
    >
      <div className="sticky top-[72px] z-20 flex h-[calc(100dvh-72px)] flex-col">
        <FadeScroll label="Menu principal">
          <NavGroups variant="rail" />
        </FadeScroll>
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
