// Páginas de texto (institucionais e legais). O conteúdo vem de app/content/paginas/<slug>.md;
// o slug sai do endereço: /sobre → "sobre", /legal/termos → "legal-termos".
import { data } from "react-router";
import type { Route } from "./+types/pagina";
import { PageHeader } from "~/components/PageHeader";
import { seo } from "~/lib/seo";
import { getPage } from "~/server/pages.server";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function loader({ request }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  const page = getPage(path.slice(1).replace(/\//g, "-"));
  if (!page) throw data(null, { status: 404 });
  return { page, path, updatedLabel: page.updated ? dateFmt.format(new Date(`${page.updated}T12:00:00Z`)) : null };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) return [{ title: "Página não encontrada | Anime Profile" }];
  return seo({ title: data.page.title, description: data.page.description, path: data.path, type: "article" });
}

export default function Pagina({ loaderData }: Route.ComponentProps) {
  const { page, updatedLabel } = loaderData;
  const hasToc = page.toc.length > 0;
  return (
    <article>
      <PageHeader title={page.title} intro={page.intro}>
        {updatedLabel && <p className="mt-5 text-[0.9rem] text-ink-soft">Atualizado em {updatedLabel}</p>}
      </PageHeader>
      <div className={`mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 ${hasToc ? "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14" : ""}`}>
        {hasToc && (
          <>
            <details className="mb-8 rounded-xl border border-line bg-surface lg:hidden">
              <summary className="cursor-pointer px-4 py-3 font-semibold">Nesta página</summary>
              <Toc items={page.toc} />
            </details>
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="pl-3 text-[0.85rem] font-bold">Nesta página</p>
                <Toc items={page.toc} />
              </div>
            </aside>
          </>
        )}
        <div className="prose-ap" dangerouslySetInnerHTML={{ __html: page.html }} />
      </div>
    </article>
  );
}

function Toc({ items }: { items: { id: string; text: string }[] }) {
  return (
    <ol className="flex flex-col gap-0.5 px-1 pb-3 lg:mt-2 lg:border-l lg:border-line lg:px-0">
      {items.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} className="block rounded-lg px-3 py-1.5 text-[0.9rem] leading-snug text-ink-soft hover:bg-sunken hover:text-ink lg:-ml-px lg:rounded-none lg:border-l lg:border-transparent lg:hover:border-hanko lg:hover:bg-transparent">
            {t.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
