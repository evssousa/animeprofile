// Figurinhas: importação, ordem, álbuns, destaque da semana, mídia importada e sitemap (MySQL descartável).
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, query, setPool } from "~/server/db.server";
import { applySnapshot, type OldSnapshot } from "~/server/content/import-old.server";
import { MediaError, isMediaName, saveImportedMedia } from "~/server/content/media-import.server";
import { albumForAnime, collectionTeaser, getAlbum, isoWeekKey, listAlbums, weeklyFeaturedAlbum } from "~/server/stickers/stickers.server";
import { sitemapFigurinhas } from "~/server/seo/feeds.server";

let server: Awaited<ReturnType<typeof createDB>>;
let mediaDir: string;
const env = { ...process.env };

const A1 = "11111111-0000-4000-8000-000000000001";
const A2 = "11111111-0000-4000-8000-000000000002";
const A3 = "11111111-0000-4000-8000-000000000003";
const D = "2026-01-01T00:00:00Z";
const st = (id: string, album: string, rarity: string, extra: object = {}) => ({ id, album_id: album, name: `Fig ${id}`, rarity, xp: 10, image_url: `/media/figurinhas/${id}.png`, thumb_url: `/media/figurinhas/${id}-w400.webp`, active: true, sort_order: null, created_at: D, updated_at: D, ...extra });
const album = (id: string, slug: string, name: string, extra: object = {}) => ({ id, slug, name, description: null, cover_url: null, anilist_id: null, sort_order: 0, available_from: null, available_until: null, created_at: D, updated_at: D, ...extra });
const snap = (extra: object): OldSnapshot => ({ posts: [], categories: [], tags: [], ai_news_authors: [], profiles: [], post_categories: [], post_tags: [], tag_redirects: [], ...extra }) as unknown as OldSnapshot;

const full = {
  sticker_albums: [album(A1, "naruto", "Naruto", { anilist_id: 20 }), album(A2, "one-piece", "One Piece", { sort_order: 1, created_at: "2026-02-01T00:00:00Z" }), album(A3, "vazio", "Vazio", { sort_order: 2 })],
  sticker_catalog: [
    st("n1", A1, "comum", { sort_order: 2 }),
    st("n2", A1, "lendario", { sort_order: null }),
    st("n3", A1, "epico", { sort_order: 1, active: false }),
    st("o1", A2, "raro", { image_url: null, thumb_url: null }),
    st("x1", A2, "mitico"),
  ],
  weekly_featured_album: [],
};

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  mediaDir = await mkdtemp(join(tmpdir(), "ap-media-"));
  process.env.MEDIA_DIR = mediaDir;
});

afterAll(async () => {
  process.env = env;
  setPool(undefined);
  await server?.stop();
  await rm(mediaDir, { recursive: true, force: true });
});

describe("importação", () => {
  it("grava, pula raridade inválida e apaga o que saiu", async () => {
    const r = await applySnapshot(snap(full));
    expect(r).toMatchObject({ albuns: 3, figurinhas: 4, figurinhasSemImagem: 1 });
    expect(r.figurinhasPuladas).toHaveLength(1);
    await applySnapshot(snap({ ...full, sticker_catalog: full.sticker_catalog.filter((s) => s.id !== "n1") }));
    const [c] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM sticker_catalog");
    expect(Number(c.n)).toBe(3);
    await applySnapshot(snap(full));
  });
});

describe("leitura", () => {
  it("ordem com sort_order NULL por último e numeração a partir de 1", async () => {
    const found = await getAlbum("naruto");
    expect(found!.stickers.map((s) => [s.id, s.number])).toEqual([["n3", 1], ["n1", 2], ["n2", 3]]);
    expect(found!.stickers[0].active).toBe(false);
    expect(await getAlbum("nao-existe")).toBeNull();
  });
  it("álbuns: contagens, capa da 1ª figurinha e ordem", async () => {
    const list = await listAlbums();
    expect(list.map((a) => a.slug)).toEqual(["naruto", "one-piece", "vazio"]);
    expect(list[0]).toMatchObject({ total: 3, byRarity: { comum: 1, raro: 0, epico: 1, lendario: 1 }, inactive: 1, coverUrl: "/media/figurinhas/n3-w400.webp" });
    expect(list[2].total).toBe(0);
  });
  it("álbum do anime", async () => {
    expect(await albumForAnime(20)).toMatchObject({ slug: "naruto", total: 3 });
    expect(await albumForAnime(999)).toBeNull();
  });
  it("destaque da semana: casa o nome do álbum com o título em alta e fica gravado", async () => {
    expect(isoWeekKey(new Date("2026-11-15T12:00:00Z"))).toBe("2026-W46");
    expect(await weeklyFeaturedAlbum(new Date("2026-11-15T12:00:00Z"))).toBeNull(); // sem anime em alta
    await query("INSERT INTO anime_catalog (anilist_id, title, trending_rank) VALUES (20, 'Naruto Shippuden', 1)");
    await query("DELETE FROM weekly_featured_album");
    const w = await weeklyFeaturedAlbum(new Date("2026-11-15T12:00:00Z"));
    expect(w!.album.slug).toBe("naruto");
    expect(w!.discountPct).toBeGreaterThanOrEqual(10);
    expect((await weeklyFeaturedAlbum(new Date("2026-11-15T12:00:00Z")))!.discountPct).toBe(w!.discountPct);
    const teaser = await collectionTeaser(new Date("2026-11-15T12:00:00Z"));
    expect(teaser).toMatchObject({ albums: 3, stickers: 4, legendary: "/media/figurinhas/n2-w400.webp" });
  });
  it("sitemap sem o álbum vazio", async () => {
    const xml = await sitemapFigurinhas();
    expect(xml).toContain("/figurinhas/naruto</loc>");
    expect(xml).not.toContain("/figurinhas/vazio");
  });
});

describe("mídia importada", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  const name = `figurinhas/${"a".repeat(24)}.png`;
  it("recusa nome e conteúdo inválidos", async () => {
    await expect(saveImportedMedia("../x.png", png)).rejects.toBeInstanceOf(MediaError);
    await expect(saveImportedMedia(`outra/${"a".repeat(24)}.png`, png)).rejects.toBeInstanceOf(MediaError);
    await expect(saveImportedMedia(name, Buffer.from("isto não é imagem, é texto puro"))).rejects.toBeInstanceOf(MediaError);
  });
  it("aceita imagens do Storage antigo só nos buckets e caminhos simples", () => {
    expect(isMediaName("post-images/ai-news/2026/abc-123.webp")).toBe(true);
    expect(isMediaName("profile-media/avatars/u1/foto_1.jpg")).toBe(true);
    expect(isMediaName("post-images/ab/inline/1783646372098-1783646111313c.JPG")).toBe(true);
    for (const bad of ["post-images/../x.png", "post-images/.oculto.png", "bug-reports/x.png", "database_export_23_08_26/x.backup", "post-images/a.svg", "post-images/a b.png", "post-images/a.png/", "post-images/x.html", "/post-images/a.png", "post-images/a\b.png"]) expect(isMediaName(bad), bad).toBe(false);
  });
  it("grava uma vez e não sobrescreve", async () => {
    expect(await saveImportedMedia(name, png)).toEqual({ existia: false });
    expect(await saveImportedMedia(name, Buffer.concat([png, Buffer.from("x")]))).toEqual({ existia: true });
    expect((await readFile(join(mediaDir, name))).length).toBe(png.length);
  });
});
