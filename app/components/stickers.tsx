// Figurinhas: cartão de álbum, barra de raridades e cartão de figurinha (silhueta ou aberta, com ampliação).
import { useState } from "react";
import { Link } from "react-router";
import { MOSTRAR_ABERTAS, RARITIES, RARITY_LABEL, RARITY_STYLE, albumPath, type AlbumCard, type Rarity, type StickerData } from "~/lib/stickers";

const RARITY_BAR: Record<Rarity, string> = { comum: "bg-white/40", raro: "bg-[#63e6be]", epico: "bg-[#b197fc]", lendario: "bg-[#f2c14e]" };

function Img({ src, name, className }: { src: string | null; name: string; className: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad)
    return (
      <span className={`${className} grid place-items-center bg-[linear-gradient(135deg,#2a1311,#0d0d10)] text-3xl font-extrabold text-white/60`} aria-hidden>
        {name.trim()[0]?.toUpperCase() ?? "?"}
      </span>
    );
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} className={`${className} object-cover`} />;
}

export function RarityBar({ byRarity, total }: { byRarity: Record<Rarity, number>; total: number }) {
  if (!total) return null;
  return (
    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
      {RARITIES.map((r) => (byRarity[r] ? <span key={r} className={RARITY_BAR[r]} style={{ width: `${(byRarity[r] / total) * 100}%` }} /> : null))}
    </span>
  );
}

export function AlbumTile({ album }: { album: AlbumCard }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-night text-night-ink">
      <Img src={album.coverUrl} name={album.name} className="aspect-[3/4] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
      <div className="flex flex-col gap-2 bg-[linear-gradient(0deg,#0d0d10,rgba(13,13,16,.85))] p-4">
        <h3 className="text-[1rem] leading-snug font-bold">
          <Link to={albumPath(album.slug)} className="line-clamp-2 after:absolute after:inset-0 hover:underline">
            {album.name}
          </Link>
        </h3>
        <p className="text-[0.8rem] text-white/65">{album.total} {album.total === 1 ? "figurinha" : "figurinhas"}</p>
        <RarityBar byRarity={album.byRarity} total={album.total} />
      </div>
    </article>
  );
}

/** Figurinha: em silhueta (blur + brilho baixo) enquanto não há contas; ao clicar abre o original só se MOSTRAR_ABERTAS. */
export function StickerCard({ sticker, onOpen }: { sticker: StickerData; onOpen: (s: StickerData) => void }) {
  const style = RARITY_STYLE[sticker.rarity];
  const hidden = !MOSTRAR_ABERTAS;
  const name = sticker.name ?? `Figurinha ${sticker.number}`;
  const inner = (
    <>
      <span className="absolute top-2 left-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[0.7rem] font-bold text-white">#{sticker.number}</span>
      <Img src={sticker.thumbUrl} name={name} className={`aspect-[3/4] w-full ${hidden ? "scale-110 blur-[6px] brightness-[.15] grayscale" : ""}`} />
      {hidden && <span className="absolute inset-0 grid place-items-center text-4xl font-extrabold text-white/50" aria-hidden>?</span>}
      {!sticker.active && !hidden && <span className="absolute inset-x-0 bottom-[3.4rem] bg-black/70 py-1 text-center text-[0.7rem] font-bold text-white">Não sai mais no sorteio</span>}
      <span className="flex flex-col gap-0.5 bg-[#0d0d10] p-2.5 text-left">
        <span className="line-clamp-1 text-[0.85rem] font-bold text-white">{hidden ? "Figurinha oculta" : name}</span>
        <span className={`text-[0.75rem] font-bold ${style.text}`}>{RARITY_LABEL[sticker.rarity]}</span>
      </span>
    </>
  );
  const cls = `relative flex flex-col overflow-hidden rounded-[14px] border-2 bg-[#0d0d10] ${style.border} ${style.glow}`;
  return hidden ? (
    <div className={cls} title="Entre para colecionar (em breve)">
      {inner}
    </div>
  ) : (
    <button type="button" onClick={() => onOpen(sticker)} className={`${cls} hover:brightness-110`} aria-label={`Ampliar ${name}`}>
      {inner}
    </button>
  );
}

export function StickerDialog({ sticker, onClose }: { sticker: StickerData | null; onClose: () => void }) {
  if (!sticker) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={sticker.name ?? "Figurinha"} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-full max-w-md overflow-auto rounded-2xl bg-night p-3 text-night-ink" onClick={(e) => e.stopPropagation()}>
        {sticker.imageUrl && <img src={sticker.imageUrl} alt={sticker.name ?? ""} className="max-h-[75vh] w-full rounded-xl object-contain" />}
        <div className="flex items-center justify-between gap-3 p-3">
          <span>
            <span className="block font-bold">{sticker.name}</span>
            <span className={`text-[0.85rem] font-bold ${RARITY_STYLE[sticker.rarity].text}`}>{RARITY_LABEL[sticker.rarity]}</span>
          </span>
          <button type="button" onClick={onClose} className="rounded-[9px] bg-white/12 px-4 py-2 font-semibold hover:bg-white/20" autoFocus>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
