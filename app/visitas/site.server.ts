// Títulos das páginas do painel (ESPECÍFICO DO SITE): o endereço vira o nome do conteúdo (matéria, anime, quiz...).
import { createHash } from "node:crypto";
import { cached } from "~/server/cache.server";
import { VISITAS } from "./config";
import { query } from "./db";

type Item = { path: string; kind: string };
const unicos = <T,>(l: T[]) => [...new Set(l)];

/** Títulos por endereço. O que não for achado (matéria apagada, anime sem ficha) fica de fora: o painel mostra o endereço. */
export async function titulos(itens: Item[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const i of itens) {
    const fixo = VISITAS.fixos[i.path];
    if (fixo) out.set(i.path, fixo);
  }
  const resto = itens.filter((i) => !out.has(i.path));
  if (!resto.length) return out;
  const chave = createHash("sha1").update(resto.map((i) => i.path).sort().join("\n")).digest("hex");
  const achados = await cached(`visitas:titulos:${chave}`, 10 * 60_000, async () => {
    const m = new Map<string, string>();
    const seg = (p: string, n: number) => p.split("/")[n] ?? "";
    const porSlug = async (sql: string, paths: string[], n: number) => {
      const slugs = unicos(paths.map((p) => seg(p, n))).filter(Boolean);
      if (!slugs.length) return;
      const rows = await query<{ k: string; t: string }>(sql.replace("(?)", `(${slugs.map(() => "?").join(",")})`), slugs);
      const mapa = new Map(rows.map((r) => [r.k, r.t]));
      for (const p of paths) if (mapa.has(seg(p, n))) m.set(p, mapa.get(seg(p, n))!);
    };
    const de = (kind: string) => resto.filter((i) => i.kind === kind).map((i) => i.path);
    await porSlug("SELECT slug AS k, title AS t FROM posts WHERE slug IN (?)", de("materia"), 2);
    await porSlug("SELECT slug AS k, title AS t FROM quizzes WHERE slug IN (?)", de("quiz"), 2);
    await porSlug("SELECT slug AS k, name AS t FROM sticker_albums WHERE slug IN (?)", de("figurinhas"), 2);
    // anime e personagem: o id é o último trecho do endereço
    const ids = (paths: string[]) => unicos(paths.map((p) => Number(seg(p, paths[0]?.startsWith("/animes/personagem") ? 3 : 2)))).filter((n) => n > 0);
    const animes = de("anime");
    if (animes.length) {
      const rows = await query<{ id: number; t: string }>(`SELECT anilist_id AS id, title AS t FROM anime_catalog WHERE anilist_id IN (${ids(animes).map(() => "?").join(",")})`, ids(animes));
      const mapa = new Map(rows.map((r) => [Number(r.id), r.t]));
      for (const p of animes) if (mapa.has(Number(seg(p, 2)))) m.set(p, mapa.get(Number(seg(p, 2)))!);
    }
    const chars = de("personagem");
    if (chars.length) {
      const lista = unicos(chars.map((p) => Number(seg(p, 3)))).filter((n) => n > 0);
      const rows = await query<{ id: number; t: string }>(`SELECT id, name AS t FROM anime_characters WHERE id IN (${lista.map(() => "?").join(",")})`, lista);
      const mapa = new Map(rows.map((r) => [Number(r.id), r.t]));
      for (const p of chars) if (mapa.has(Number(seg(p, 3)))) m.set(p, mapa.get(Number(seg(p, 3)))!);
    }
    // blog: /blog/<usuario>/<slug>
    const blogs = de("blog");
    if (blogs.length) {
      const slugs = unicos(blogs.map((p) => seg(p, 3))).filter(Boolean);
      const rows = await query<{ u: string; s: string; t: string }>(
        `SELECT a.slug AS u, b.slug AS s, b.title AS t FROM blog_posts b JOIN post_authors a ON a.id = b.author_id WHERE b.slug IN (${slugs.map(() => "?").join(",")})`,
        slugs,
      );
      const mapa = new Map(rows.map((r) => [`/blog/${r.u}/${r.s}`, r.t]));
      for (const p of blogs) if (mapa.has(p)) m.set(p, mapa.get(p)!);
    }
    // listas: categoria, tag e autor
    for (const [prefixo, tabela, coluna] of [["/categoria/", "categories", "name"], ["/tag/", "tags", "name"], ["/autores/", "post_authors", "name"]] as const) {
      const paths = resto.filter((i) => i.path.startsWith(prefixo)).map((i) => i.path);
      if (!paths.length) continue;
      const slugs = unicos(paths.map((p) => seg(p, 2))).filter(Boolean);
      const rows = await query<{ k: string; t: string }>(`SELECT slug AS k, ${coluna} AS t FROM ${tabela} WHERE slug IN (${slugs.map(() => "?").join(",")})`, slugs);
      const mapa = new Map(rows.map((r) => [r.k, r.t]));
      for (const p of paths) if (mapa.has(seg(p, 2))) m.set(p, `${prefixo === "/tag/" ? "#" : ""}${mapa.get(seg(p, 2))!}`);
    }
    return m;
  });
  for (const [k, v] of achados) out.set(k, v);
  return out;
}
