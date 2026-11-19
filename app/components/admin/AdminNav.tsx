// Barra lateral do painel /admin (formato do site antigo: grupos com título, item ativo em destaque, cartão da conta no pé).
// Específica do animeprofile; o módulo copiável app/visitas/ não depende dela.
import { Link, NavLink, useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { FadeScroll, useSidebarMini } from "~/components/layout/SideNav";
import { adminAtivo, type AdminNavGroup } from "~/lib/admin-nav";

export type AdminConta = { nome: string; inicial: string };

/** Os grupos. Na lateral, os nomes somem quando recolhida; na gaveta aparecem sempre. */
function Grupos({ grupos, rail, onNavigate }: { grupos: AdminNavGroup[]; rail: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const oculto = rail ? "lg:sr-only xl:not-sr-only xl:mini:sr-only" : "";
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g, gi) => (
        <div key={g.label}>
          <p className={`px-3 pb-1.5 text-[0.75rem] font-bold tracking-[0.14em] text-ink-soft uppercase ${oculto}`}>{g.label}</p>
          {rail && gi > 0 && <span aria-hidden className="mx-auto my-1 hidden h-px w-8 bg-line lg:block xl:hidden xl:mini:block" />}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const ativo = adminAtivo(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.exact}
                    onClick={onNavigate}
                    title={`${item.label}: ${item.desc}`}
                    aria-current={ativo ? "page" : undefined}
                    className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold ${
                      rail ? "lg:justify-center lg:px-0 xl:justify-start xl:px-3 xl:mini:justify-center xl:mini:px-0" : ""
                    } ${
                      ativo
                        ? "bg-brand-soft text-brand before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand dark:text-glow"
                        : "text-ink hover:bg-sunken"
                    }`}
                  >
                    <Icon className={`size-5 shrink-0 ${ativo ? "" : "text-ink-soft"}`} aria-hidden />
                    <span className={`min-w-0 truncate ${oculto}`}>{item.label}</span>
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

function Marca({ rail }: { rail: boolean }) {
  return (
    <div className={`px-6 pt-4 ${rail ? "lg:hidden xl:block xl:mini:hidden" : ""}`}>
      <p className="text-[0.7rem] font-bold tracking-[0.22em] text-brand uppercase dark:text-glow">Anime Profile</p>
      <p className="text-[1.1rem] leading-tight font-extrabold">Administração</p>
    </div>
  );
}

function Conta({ conta, rail }: { conta: AdminConta; rail: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-sunken/60 p-2 ${rail ? "lg:justify-center xl:justify-start xl:mini:justify-center" : ""}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-extrabold text-brand-ink" aria-hidden>
        {conta.inicial}
      </span>
      <div className={`min-w-0 ${rail ? "lg:hidden xl:block xl:mini:hidden" : ""}`}>
        <p className="truncate text-[0.9rem] font-bold">{conta.nome}</p>
        <p className="text-[0.75rem] text-ink-soft">Equipe Anime Profile</p>
      </div>
    </div>
  );
}

/** Lateral fixa (a partir de 1024 px), recolhível como o menu do site. */
export function AdminNav({ grupos, conta }: { grupos: AdminNavGroup[]; conta: AdminConta }) {
  const { mini, toggle } = useSidebarMini();
  return (
    <aside id="menu-painel" className="hidden shrink-0 border-r border-line bg-surface lg:block lg:w-[72px] xl:w-64 xl:mini:w-[72px] motion-safe:transition-[width] motion-safe:duration-200">
      <div className="sticky top-14 z-20 flex h-[calc(100dvh-56px)] flex-col">
        <Marca rail />
        <FadeScroll label="Menu do painel">
          <Grupos grupos={grupos} rail />
        </FadeScroll>
        <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
          <Conta conta={conta} rail />
          <button
            type="button"
            onClick={toggle}
            aria-controls="menu-painel"
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

/** Conteúdo da gaveta (celular e telas médias): grupos, conta e atalho para o site. */
export function AdminNavGaveta({ grupos, conta, onNavigate }: { grupos: AdminNavGroup[]; conta: AdminConta; onNavigate: () => void }) {
  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <Marca rail={false} />
      <FadeScroll label="Menu do painel">
        <Grupos grupos={grupos} rail={false} onNavigate={onNavigate} />
      </FadeScroll>
      <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
        <Conta conta={conta} rail={false} />
        <Link to="/" onClick={onNavigate} className="flex h-10 items-center rounded-xl px-3 text-[0.9rem] font-semibold text-ink-soft hover:bg-sunken hover:text-ink">
          Ver o site
        </Link>
      </div>
    </div>
  );
}
