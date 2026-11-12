import { NavLink, useLocation } from "react-router";
import { NAV, isActive } from "~/lib/nav";
import { Logo } from "./Logo";

/** Lista de grupos do menu, usada na lateral (computador) e no menu do celular. */
export function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-6">
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
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium ${
                      active ? "bg-sunken text-ink" : "text-ink-soft hover:bg-sunken hover:text-ink"
                    }`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-hanko" aria-hidden />}
                    <Icon className={`size-[1.15rem] shrink-0 ${active ? "text-hanko" : ""}`} aria-hidden />
                    {label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6">
        <NavGroups />
      </div>
    </aside>
  );
}
