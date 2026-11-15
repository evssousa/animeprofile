// Abas do hub de Animes (como no site antigo): Temporada, Calendário, Favoritos e Seguindo.
// Favoritos e Seguindo dependem de conta e levam à página "volta em breve".
import { NavLink } from "react-router";
import { Bell, Calendar, Heart, Sparkles, type LucideIcon } from "lucide-react";

const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean; soon?: true }[] = [
  { to: "/animes", label: "Temporada", icon: Sparkles, end: true },
  { to: "/animes/calendario", label: "Calendário", icon: Calendar },
  { to: "/animes/favoritos", label: "Favoritos", icon: Heart, soon: true },
  { to: "/animes/seguindo", label: "Seguindo", icon: Bell, soon: true },
];

export function AnimeTabs() {
  return (
    <nav aria-label="Seções de animes" className="border-b border-line">
      <ul className="mx-auto flex max-w-[1328px] gap-2 overflow-x-auto px-4 py-3 sm:px-8 lg:px-14 [scrollbar-width:none]">
        {TABS.map(({ to, label, icon: Icon, end, soon }) => (
          <li key={to} className="shrink-0">
            <NavLink
              to={to}
              end={end}
              title={soon ? `${label} (em breve)` : label}
              className={({ isActive }) =>
                `inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.9rem] font-semibold whitespace-nowrap ${
                  isActive ? "bg-brand text-brand-ink" : "border border-line bg-surface text-ink-soft hover:bg-sunken hover:text-ink"
                }`
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {soon && <span className="rounded-full bg-sunken px-1.5 py-0.5 text-[0.65rem] font-bold text-ink-soft">em breve</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
