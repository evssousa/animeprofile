// Figurinhas: constantes e tipos que valem no servidor e no navegador (portado de animeprofile-old/src/data/stickers.ts).

export const RARITIES = ["comum", "raro", "epico", "lendario"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABEL: Record<Rarity, string> = { comum: "Comum", raro: "Raro", epico: "Épico", lendario: "Lendário" };
const PLURAL: Record<Rarity, [string, string]> = { comum: ["comum", "comuns"], raro: ["rara", "raras"], epico: ["épica", "épicas"], lendario: ["lendária", "lendárias"] };
export const rarityCount = (r: Rarity, n: number) => `${n} ${PLURAL[r][n === 1 ? 0 : 1]}`;

/** Chance de cada raridade num pacote (%), como no site antigo. */
export const RARITY_WEIGHTS: Record<Rarity, number> = { comum: 60, raro: 28, epico: 10, lendario: 2 };
export const GOLD_PULL_PCT = 0.5;

/** Cores por raridade (as da seção Coleção da home). */
export const RARITY_STYLE: Record<Rarity, { text: string; border: string; glow: string }> = {
  comum: { text: "text-white/80", border: "border-white/25", glow: "" },
  raro: { text: "text-[#63e6be]", border: "border-[#63e6be]", glow: "shadow-[0_0_22px_rgba(99,230,190,.3)]" },
  epico: { text: "text-[#c8b6ff]", border: "border-[#b197fc]", glow: "shadow-[0_0_26px_rgba(177,151,252,.4)]" },
  lendario: { text: "text-[#f2c14e]", border: "border-[#f2c14e]", glow: "shadow-[0_0_30px_rgba(242,193,78,.5)]" },
};

/**
 * Sem conta, ninguém tem figurinhas: no álbum elas aparecem em silhueta (como no site antigo para quem não
 * tem a figurinha). Mude para true para mostrar todas abertas. Decisão do dono em 2026-11-15: silhueta.
 */
export const MOSTRAR_ABERTAS = false;

export type StickerData = {
  id: string;
  number: number;
  name: string | null;
  rarity: Rarity;
  imageUrl: string | null;
  thumbUrl: string | null;
  active: boolean;
};

export type AlbumCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  anilistId: number | null;
  total: number;
  byRarity: Record<Rarity, number>;
  inactive: number;
  createdAt: string | null;
  sortOrder: number;
};

export const albumPath = (slug: string) => `/figurinhas/${slug}`;
