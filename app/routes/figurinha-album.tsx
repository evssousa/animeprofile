// Um álbum de figurinhas (/figurinhas/:slug). Filtros por raridade e ordem no navegador.
import { useMemo, useState } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/figurinha-album";
import { PageHeader } from "~/components/PageHeader";
import { StickerCard, StickerDialog } from "~/components/stickers";
import { RARITIES, RARITY_LABEL, albumPath, rarityCount, type Rarity, type StickerData } from "~/lib/stickers";
import { seo } from "~/lib/seo";
import { absoluteUrl } from "~/lib/site";
import { getAlbum } from "~/server/stickers/stickers.server";

export async function loader({ params }: Route.LoaderArgs) {
  const found = await getAlbum(params.slug);
  if (!found) throw data(null, { status: 404 });
  return found;
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Álbum não encontrado | Anime Profile" }];
  const a = d.album;
  const path = albumPath(a.slug);
  return seo({
    title: `Álbum ${a.name} — Figurinhas`,
    description: a.description || `Colecione as ${a.total} figurinhas do álbum ${a.name} no Anime Profile e procure as lendárias.`,
    path,
    image: a.coverUrl,
    noindex: a.total === 0,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name: `Álbum ${a.name}`, url: absoluteUrl(path), about: a.name, inLanguage: "pt-BR" },
        { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Figurinhas", item: absoluteUrl("/figurinhas") }, { "@type": "ListItem", position: 2, name: a.name, item: absoluteUrl(path) }] },
      ],
    },
  });
}

type Sort = "numero" | "raridade" | "nome";

export default function Album({ loaderData }: Route.ComponentProps) {
  const { album, stickers } = loaderData;
  const [rarity, setRarity] = useState<Rarity | "todas">("todas");
  const [sort, setSort] = useState<Sort>("numero");
  const [open, setOpen] = useState<StickerData | null>(null);
  const shown = useMemo(() => {
    const list = stickers.filter((s) => rarity === "todas" || s.rarity === rarity);
    if (sort === "raridade") list.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.number - b.number);
    if (sort === "nome") list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"));
    return list;
  }, [stickers, rarity, sort]);
  const chip = (on: boolean) => `rounded-full px-3.5 py-1.5 text-[0.85rem] font-semibold ${on ? "bg-ink text-paper" : "border border-line bg-surface hover:bg-sunken"}`;
  const counts = RARITIES.filter((r) => album.byRarity[r] > 0)
    .reverse()
    .map((r) => rarityCount(r, album.byRarity[r]))
    .join(" · ");
  return (
    <>
      <PageHeader label="Álbum de figurinhas" title={album.name} intro={album.description ?? undefined}>
        <p className="mt-5 text-white/80">
          {album.total} {album.total === 1 ? "figurinha" : "figurinhas"}
          {counts && ` · ${counts}`}
          {album.inactive > 0 && ` · ${album.inactive} não ${album.inactive === 1 ? "sai" : "saem"} mais no sorteio`}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {album.anilistId && (
            <Link to={`/animes/${album.anilistId}`} className="rounded-[9px] bg-white px-5 py-2.5 font-bold text-night hover:brightness-95">
              Ver o anime
            </Link>
          )}
          <Link to="/figurinhas" className="rounded-[9px] bg-white/12 px-5 py-2.5 font-semibold text-white hover:bg-white/20">
            Todos os álbuns
          </Link>
        </div>
      </PageHeader>
      <div className="mx-auto flex max-w-[1328px] flex-col gap-6 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        <p className="rounded-xl bg-brand-soft px-4 py-3 text-[0.92rem] font-semibold">Comece a sua coleção: crie sua conta grátis (em breve). Por enquanto as figurinhas aparecem em silhueta.</p>
        {album.total === 0 ? (
          <p className="text-ink-soft">Este álbum ainda não tem figurinhas.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Raridade">
                <button type="button" className={chip(rarity === "todas")} onClick={() => setRarity("todas")}>
                  Todas
                </button>
                {RARITIES.map((r) => (
                  <button key={r} type="button" className={chip(rarity === r)} onClick={() => setRarity(r)}>
                    {RARITY_LABEL[r]}
                  </button>
                ))}
              </div>
              <label>
                <span className="sr-only">Ordem</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-[10px] border border-line bg-surface px-3">
                  <option value="numero">Número</option>
                  <option value="raridade">Raridade</option>
                  <option value="nome">Nome</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {shown.map((s) => (
                <StickerCard key={s.id} sticker={s} onOpen={setOpen} />
              ))}
            </div>
          </>
        )}
      </div>
      <StickerDialog sticker={open} onClose={() => setOpen(null)} />
    </>
  );
}
