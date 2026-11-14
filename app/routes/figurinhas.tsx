// Catálogo de figurinhas (/figurinhas): álbuns e raridades. Só ver; abrir pacotes chega com as contas.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search } from "lucide-react";
import type { Route } from "./+types/figurinhas";
import { PageHeader } from "~/components/PageHeader";
import { AlbumTile } from "~/components/stickers";
import { GOLD_PULL_PCT, RARITIES, RARITY_LABEL, RARITY_STYLE, RARITY_WEIGHTS, albumPath } from "~/lib/stickers";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { listAlbums, weeklyFeaturedAlbum } from "~/server/stickers/stickers.server";

export async function loader() {
  const [albums, weekly] = await Promise.all([listAlbums(), weeklyFeaturedAlbum()]);
  return { albums, featured: weekly?.album ?? null };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  return seo({
    title: "Figurinhas de anime: álbuns e raridades",
    description: "Sorteie figurinhas dos seus animes favoritos, complete álbuns e procure as lendárias.",
    path: "/figurinhas",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: "Figurinhas de anime",
          url: absoluteUrl("/figurinhas"),
          mainEntity: { "@type": "ItemList", itemListElement: (d?.albums ?? []).slice(0, 50).map((a, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(albumPath(a.slug)), name: a.name })) },
        },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Figurinhas", item: absoluteUrl("/figurinhas") }] },
      ],
    },
  });
}

type Sort = "destaques" | "recentes" | "az" | "maior";

export default function Figurinhas({ loaderData }: Route.ComponentProps) {
  const { albums, featured } = loaderData;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("destaques");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = albums.filter((a) => !term || a.name.toLowerCase().includes(term));
    if (sort === "recentes") list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "maior") list.sort((a, b) => b.total - a.total);
    return list;
  }, [albums, q, sort]);
  return (
    <>
      <PageHeader label="Figurinhas" title="Sorteie. Colecione. Lendárias esperam." intro="Álbuns dos animes que você ama, com figurinhas de quatro raridades. Abrir pacotes e montar a sua coleção chega com as contas." />
      <div className="mx-auto flex max-w-[1328px] flex-col gap-10 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        <section aria-labelledby="pacotes" className="flex flex-wrap items-center justify-between gap-6 rounded-[26px] bg-[#17141a] p-6 text-night-ink sm:p-9">
          <div className="flex max-w-[560px] flex-col gap-3">
            <h2 id="pacotes" className="text-[1.6rem] font-extrabold tracking-[-0.02em]">
              Pacotes e chances
            </h2>
            <ul className="flex flex-wrap gap-2 text-[0.8rem] font-bold">
              {RARITIES.map((r) => (
                <li key={r} className={`rounded-full bg-white/10 px-3 py-1.5 ${RARITY_STYLE[r].text}`}>
                  {RARITY_LABEL[r]} · {RARITY_WEIGHTS[r]}%
                </li>
              ))}
              <li className="rounded-full bg-[rgba(242,193,78,.18)] px-3 py-1.5 text-[#f2c14e]">Gold Pull · {String(GOLD_PULL_PCT).replace(".", ",")}%</li>
            </ul>
            <button type="button" disabled className="mt-1 self-start rounded-[9px] bg-white/12 px-5 py-3 font-bold opacity-70">
              Abrir pacotes chega com as contas
            </button>
          </div>
          {featured && (
            <Link to={albumPath(featured.slug)} className="rounded-2xl border border-white/15 px-5 py-4 hover:bg-white/8">
              <span className="block text-[0.8rem] font-bold text-glow">Álbum da semana</span>
              <span className="block text-[1.15rem] font-extrabold">{featured.name}</span>
              <span className="text-[0.85rem] text-white/70">{featured.total} figurinhas</span>
            </Link>
          )}
        </section>

        <section aria-labelledby="albuns" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="albuns" className="text-[1.6rem] font-extrabold tracking-[-0.025em]">
              Álbuns
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative">
                <span className="sr-only">Buscar álbum</span>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar álbum" className="h-11 w-56 rounded-[10px] border border-line bg-surface pr-4 pl-10 focus:border-ink-soft focus:outline-none" />
              </label>
              <label>
                <span className="sr-only">Ordem</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 rounded-[10px] border border-line bg-surface px-3">
                  <option value="destaques">Destaques</option>
                  <option value="recentes">Recentes</option>
                  <option value="az">A–Z</option>
                  <option value="maior">Maior</option>
                </select>
              </label>
            </div>
          </div>
          {shown.length ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
              {shown.map((a) => (
                <AlbumTile key={a.id} album={a} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-soft">{albums.length ? "Nenhum álbum com esse nome." : "Os álbuns estão chegando. Volte em breve!"}</p>
          )}
        </section>
      </div>
    </>
  );
}
