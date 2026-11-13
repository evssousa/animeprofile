import { Link } from "react-router";
import { FOOTER_LINKS, INSTITUTIONAL, LEGAL_LINKS, SOCIAL } from "~/lib/nav";
import { SITE } from "~/lib/site";
import { Logo } from "./Logo";

function Column({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h2 className="text-[0.9rem] font-extrabold">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-[0.92rem] text-ink-soft hover:text-ink hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1328px] gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.6fr_repeat(4,1fr)] lg:px-14">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-[0.92rem] leading-relaxed text-ink-soft">Notícias, coleção de figurinhas e comunidade para quem vive anime, mangá e cultura otaku.</p>
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
            {SOCIAL.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noreferrer" className="text-[0.92rem] font-semibold text-link hover:underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {FOOTER_LINKS.map((g) => (
          <Column key={g.label} title={g.label} links={g.items} />
        ))}
        <Column title="Anime Profile" links={INSTITUTIONAL} />
        <Column title="Políticas" links={LEGAL_LINKS} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1328px] flex-col gap-1 px-4 py-5 text-[0.85rem] text-ink-soft sm:flex-row sm:justify-between sm:px-8 lg:px-14">
          <p>© {new Date().getFullYear()} Anime Profile. Imagens de animes pertencem aos seus detentores.</p>
          <a href={`mailto:${SITE.email}`} className="hover:text-ink hover:underline">
            {SITE.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
