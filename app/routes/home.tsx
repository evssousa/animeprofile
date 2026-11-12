// Página inicial provisória. Vira a home de verdade quando as notícias chegarem (fase 3 do conteúdo).
import { Link } from "react-router";
import { PageHeader } from "~/components/PageHeader";
import { NAV } from "~/lib/nav";
import { seo } from "~/lib/seo";

export function meta() {
  return seo({
    title: "Anime Profile",
    description: "Notícias de anime, coleção de figurinhas, quizzes e comunidade otaku em português.",
    path: "/",
  });
}

export default function Home() {
  const sections = NAV.flatMap((g) => g.items).filter((i) => i.to !== "/");
  return (
    <>
      <PageHeader
        title="Anime Profile"
        intro="Notícias de anime, coleção de figurinhas, quizzes e comunidade otaku em português. Esta é a versão nova do site, em construção."
      />
      <section aria-labelledby="secoes" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <h2 id="secoes" className="font-display text-2xl">
          O que tem no site
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 font-semibold hover:border-ink-soft">
                <Icon className="size-5 text-hanko" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
