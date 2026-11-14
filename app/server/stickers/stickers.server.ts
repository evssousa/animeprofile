// Catálogo de figurinhas (só leitura): álbuns, figurinhas, destaque da semana, vitrine da home e importação.
import { RARITIES, type AlbumCard, type Rarity, type StickerData } from "~/lib/stickers";
import { hasDatabase, iso, query, tx } from "../db.server";
import { toSqlDate, upsert } from "../content/import-old.server";

type AlbumRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  anilist_id: number | null;
  sort_order: number;
  created_at: string | null;
  total: number;
  comum: number;
  raro: number;
  epico: number;
  lendario: number;
  inactive: number;
  first_thumb: string | null;
};

const ORDER_STICKERS = "s.sort_order IS NULL, s.sort_order, s.created_at, s.id";

function toAlbum(r: AlbumRow): AlbumCard {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    coverUrl: r.cover_url ?? r.first_thumb,
    anilistId: r.anilist_id == null ? null : Number(r.anilist_id),
    total: Number(r.total),
    byRarity: { comum: Number(r.comum), raro: Number(r.raro), epico: Number(r.epico), lendario: Number(r.lendario) },
    inactive: Number(r.inactive),
    createdAt: iso(r.created_at) ?? null,
    sortOrder: Number(r.sort_order),
  };
}

const ALBUM_SQL = `
  SELECT a.id, a.slug, a.name, a.description, a.cover_url, a.anilist_id, a.sort_order, a.created_at,
    COUNT(s.id) AS total,
    COALESCE(SUM(s.rarity = 'comum'), 0) AS comum, COALESCE(SUM(s.rarity = 'raro'), 0) AS raro,
    COALESCE(SUM(s.rarity = 'epico'), 0) AS epico, COALESCE(SUM(s.rarity = 'lendario'), 0) AS lendario,
    COALESCE(SUM(s.active = 0), 0) AS inactive,
    (SELECT COALESCE(s2.thumb_url, s2.image_url) FROM sticker_catalog s2 WHERE s2.album_id = a.id AND (s2.thumb_url IS NOT NULL OR s2.image_url IS NOT NULL)
       ORDER BY s2.sort_order IS NULL, s2.sort_order, s2.created_at, s2.id LIMIT 1) AS first_thumb
  FROM sticker_albums a LEFT JOIN sticker_catalog s ON s.album_id = a.id`;

/** Álbuns, na ordem do painel antigo (sort_order, depois os mais novos). */
export async function listAlbums(): Promise<AlbumCard[]> {
  if (!hasDatabase()) return [];
  const rows = await query<AlbumRow>(`${ALBUM_SQL} GROUP BY a.id ORDER BY a.sort_order, a.created_at DESC`);
  return rows.map(toAlbum);
}

export async function getAlbum(slug: string) {
  if (!hasDatabase()) return null;
  const [row] = await query<AlbumRow>(`${ALBUM_SQL} WHERE a.slug = ? GROUP BY a.id`, [slug]);
  if (!row) return null;
  const stickers = await query<{ id: string; name: string | null; rarity: Rarity; image_url: string | null; thumb_url: string | null; active: number }>(
    `SELECT s.id, s.name, s.rarity, s.image_url, s.thumb_url, s.active FROM sticker_catalog s WHERE s.album_id = ? ORDER BY ${ORDER_STICKERS}`,
    [row.id],
  );
  const items: StickerData[] = stickers.map((s, i) => ({
    id: s.id,
    number: i + 1,
    name: s.name,
    rarity: s.rarity,
    imageUrl: s.image_url,
    thumbUrl: s.thumb_url ?? s.image_url,
    active: Boolean(s.active),
  }));
  return { album: toAlbum(row), stickers: items };
}

// ------------------------------------------------------------------------------------- destaque da semana

/** Semana ISO no formato do site antigo ("2026-W46", sem zero à esquerda). */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNo}`;
}

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Álbum em destaque da semana: entre os álbuns cujo nome (3+ letras) está contido no título de algum anime em alta,
 * um por semana (hash da semana). Fica gravado; sem candidato grava album_id NULL.
 */
export async function weeklyFeaturedAlbum(now = new Date()) {
  if (!hasDatabase()) return null;
  const weekKey = isoWeekKey(now);
  let [row] = await query<{ album_id: string | null; discount_pct: number }>("SELECT album_id, discount_pct FROM weekly_featured_album WHERE week_key = ?", [weekKey]);
  if (!row) {
    const [albums, trending] = await Promise.all([
      query<{ id: string; name: string }>("SELECT a.id, a.name FROM sticker_albums a WHERE EXISTS (SELECT 1 FROM sticker_catalog s WHERE s.album_id = a.id) ORDER BY a.id"),
      query<{ title: string; title_english: string | null; title_native: string | null }>("SELECT title, title_english, title_native FROM anime_catalog WHERE trending_rank IS NOT NULL"),
    ]);
    const titles = trending.flatMap((t) => [norm(t.title), norm(t.title_english), norm(t.title_native)]).filter(Boolean);
    const candidates = albums.filter((a) => {
      const n = norm(a.name);
      return n.length >= 3 && titles.some((t) => t.includes(n));
    });
    const pick = candidates.length ? candidates[hashString(weekKey) % candidates.length] : null;
    const discount = pick ? 10 + (hashString(`${weekKey}:promo`) % 41) : 0;
    await query("INSERT IGNORE INTO weekly_featured_album (week_key, album_id, discount_pct) VALUES (?, ?, ?)", [weekKey, pick?.id ?? null, discount]);
    [row] = await query("SELECT album_id, discount_pct FROM weekly_featured_album WHERE week_key = ?", [weekKey]);
  }
  if (!row?.album_id) return null;
  const [album] = await query<AlbumRow>(`${ALBUM_SQL} WHERE a.id = ? GROUP BY a.id`, [row.album_id]);
  return album ? { album: toAlbum(album), discountPct: Number(row.discount_pct) } : null;
}

/** Para a ficha do anime: o álbum desse anime, se houver. */
export async function albumForAnime(anilistId: number) {
  if (!hasDatabase()) return null;
  const [row] = await query<AlbumRow>(`${ALBUM_SQL} WHERE a.anilist_id = ? GROUP BY a.id HAVING COUNT(s.id) > 0 LIMIT 1`, [anilistId]);
  if (!row) return null;
  const a = toAlbum(row);
  return { slug: a.slug, name: a.name, image: a.coverUrl, total: a.total };
}

/** Vitrine da home: contagens, álbum da semana e uma lendária e uma épica com imagem (escolhidas pelo dia). */
export async function collectionTeaser(now = new Date()) {
  const empty = { albums: 0, stickers: 0, featured: null as { slug: string; name: string; image: string | null } | null, legendary: null as string | null, epic: null as string | null };
  if (!hasDatabase()) return empty;
  const [[counts], weekly] = await Promise.all([
    query<{ albums: number; stickers: number }>("SELECT (SELECT COUNT(*) FROM sticker_albums) AS albums, (SELECT COUNT(*) FROM sticker_catalog) AS stickers"),
    weeklyFeaturedAlbum(now),
  ]);
  if (!Number(counts?.stickers)) return empty;
  const day = now.toISOString().slice(0, 10);
  const showcase = async (rarity: Rarity) => {
    const rows = await query<{ image: string }>(
      "SELECT COALESCE(thumb_url, image_url) AS image FROM sticker_catalog WHERE rarity = ? AND (thumb_url IS NOT NULL OR image_url IS NOT NULL) ORDER BY id",
      [rarity],
    );
    return rows.length ? rows[hashString(`${day}:${rarity}`) % rows.length].image : null;
  };
  let featured = weekly ? { slug: weekly.album.slug, name: weekly.album.name, image: weekly.album.coverUrl } : null;
  if (!featured) {
    const [first] = await listAlbums();
    featured = first ? { slug: first.slug, name: first.name, image: first.coverUrl } : null;
  }
  return { albums: Number(counts.albums), stickers: Number(counts.stickers), featured, legendary: await showcase("lendario"), epic: await showcase("epico") };
}

export async function albumsForSitemap() {
  if (!hasDatabase()) return [];
  return query<{ slug: string; updated_at: string | null }>(
    "SELECT a.slug, a.updated_at FROM sticker_albums a WHERE EXISTS (SELECT 1 FROM sticker_catalog s WHERE s.album_id = a.id) ORDER BY a.slug",
  );
}

// --------------------------------------------------------------------------------------------- importação

export type OldStickerSnapshot = {
  sticker_albums?: { id: string; slug: string; name: string; description: string | null; cover_url: string | null; anilist_id: number | null; sort_order: number | null; available_from: string | null; available_until: string | null; created_at: string; updated_at: string }[];
  sticker_catalog?: { id: string; album_id: string | null; name: string | null; rarity: string; xp: number | null; image_url: string | null; thumb_url?: string | null; image_width?: number | null; image_height?: number | null; active?: boolean | null; sort_order: number | null; created_at: string; updated_at: string }[];
  weekly_featured_album?: { week_key: string; album_id: string | null; discount_pct: number | null; computed_at: string | null }[];
};

export async function importStickers(s: OldStickerSnapshot) {
  const skipped: string[] = [];
  const albums = (s.sticker_albums ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name.slice(0, 120),
    description: a.description,
    cover_url: a.cover_url,
    anilist_id: a.anilist_id,
    sort_order: a.sort_order ?? 0,
    available_from: toSqlDate(a.available_from),
    available_until: toSqlDate(a.available_until),
    created_at: toSqlDate(a.created_at),
    updated_at: toSqlDate(a.updated_at),
  }));
  const albumIds = new Set(albums.map((a) => a.id));
  const stickers: Record<string, unknown>[] = [];
  for (const c of s.sticker_catalog ?? []) {
    if (!(RARITIES as readonly string[]).includes(c.rarity)) {
      skipped.push(`${c.id}: raridade ${c.rarity}`);
      continue;
    }
    stickers.push({
      id: c.id,
      album_id: c.album_id && albumIds.has(c.album_id) ? c.album_id : null,
      name: c.name?.slice(0, 160) ?? null,
      rarity: c.rarity,
      xp: c.xp ?? 0,
      image_url: c.image_url,
      thumb_url: c.thumb_url ?? null,
      image_width: c.image_width ?? null,
      image_height: c.image_height ?? null,
      active: c.active === false ? 0 : 1,
      sort_order: c.sort_order,
      created_at: toSqlDate(c.created_at),
      updated_at: toSqlDate(c.updated_at),
    });
  }
  const stickerIds = new Set(stickers.map((x) => x.id as string));
  const weeks = (s.weekly_featured_album ?? []).map((w) => ({ week_key: w.week_key, album_id: w.album_id && albumIds.has(w.album_id) ? w.album_id : null, discount_pct: w.discount_pct ?? 0, computed_at: toSqlDate(w.computed_at) ?? toSqlDate(new Date().toISOString()) }));

  await tx(async (conn) => {
    await upsert(conn, "sticker_albums", albums, ["id"]);
    await upsert(conn, "sticker_catalog", stickers, ["id"]);
    await upsert(conn, "weekly_featured_album", weeks, ["week_key"]);
    // O que saiu do site antigo sai daqui (ninguém tem coleção neste site ainda).
    for (const [table, keep] of [["sticker_catalog", stickerIds], ["sticker_albums", albumIds]] as const) {
      const [existing] = await conn.query<import("mysql2/promise").RowDataPacket[]>(`SELECT id FROM ${table}`);
      const gone = existing.map((r) => r.id as string).filter((id) => !keep.has(id));
      for (let i = 0; i < gone.length; i += 500) await conn.query(`DELETE FROM ${table} WHERE id IN (?)`, [gone.slice(i, i + 500)]);
    }
  });
  return { albuns: albums.length, figurinhas: stickers.length, semImagem: stickers.filter((x) => !x.image_url).length, pulados: skipped.slice(0, 10) };
}
