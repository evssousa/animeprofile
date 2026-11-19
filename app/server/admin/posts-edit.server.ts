// Edição de matérias no painel: carregar, salvar (rascunho, publicar, agendar, despublicar), versões, categorias e tags.
// Tudo é conferido aqui de novo (o navegador nunca é a regra). Docs: docs/plano-telas-painel.md, tela 3.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import sharp from "sharp";
import { z } from "zod";
import { autoExcerpt, checklistPublicar, htmlToPlain, resolveSave, slugify, type SaveAction } from "~/lib/post-editor";
import { clearCache } from "../cache.server";
import { sanitizePostHtml, readingMinutes } from "../content/sanitize.server";
import { mediaDir } from "../../../server-paths.mjs";
import { rebuildPostVideos } from "../tv/tv.server";
import { exec, hasDatabase, iso, query, tx } from "../db.server";

const MAX_VERSOES = 20;

export type PostEditavel = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string;
  capa: string;
  tipo: "news" | "article";
  html: string;
  status: "draft" | "scheduled" | "published";
  publicadoEm: string | null;
  atualizadoEm: string;
  categoriaIds: string[];
  tagIds: string[];
  palavraChave: string;
  autorId: string | null;
  autor: string | null;
  origem: string;
  /** Já teve data de publicação: o endereço fica travado (não há redirecionamento de matéria). */
  jaPublicado: boolean;
  url: string;
};

export type Versao = { id: number; titulo: string; status: string; salvaPor: string; criadaEm: string };

export type OpcoesEditor = {
  categorias: { id: string; nome: string; tipo: string; slug: string }[];
  tags: { id: string; nome: string; usos: number }[];
  autores: { id: string; nome: string }[];
};

/** Quem fez a versão anterior: o painel (se já tinha sido editada aqui) ou a origem da matéria. */
function quemSalvou(r: { origin: string; edited_at: string | null; source_url: string | null }): string {
  if (r.edited_at) return "painel";
  if (r.source_url?.startsWith("agenda de animes")) return "agenda";
  if (r.origin === "robo") return "robo";
  if (r.origin === "old") return "antigo";
  return "painel";
}

export async function carregarPost(id: string): Promise<{ post: PostEditavel; versoes: Versao[] } | null> {
  if (!hasDatabase() || !/^[a-zA-Z0-9-]{8,36}$/.test(id)) return null;
  const [p] = await query<{ id: string; title: string; slug: string; excerpt: string | null; featured_image: string | null; post_type: string; content_html: string; status: string; published_at: string | null; updated_at: string; focus_keyword: string | null; author_id: string | null; autor: string | null; origin: string }>(
    "SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.post_type, p.content_html, p.status, p.published_at, p.updated_at, p.focus_keyword, p.author_id, a.name AS autor, p.origin FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id WHERE p.id = ?",
    [id],
  );
  if (!p) return null;
  const [cats, tags, versoes] = await Promise.all([
    query<{ category_id: string }>("SELECT category_id FROM post_categories WHERE post_id = ?", [id]),
    query<{ tag_id: string }>("SELECT tag_id FROM post_tags WHERE post_id = ?", [id]),
    query<{ id: number; title: string; status: string; saved_by: string; created_at: string }>("SELECT id, title, status, saved_by, created_at FROM post_revisions WHERE post_id = ? ORDER BY id DESC LIMIT ?", [id, MAX_VERSOES]).catch(() => []),
  ]);
  const tipo = p.post_type === "article" ? "article" : "news";
  return {
    post: {
      id: p.id,
      titulo: p.title,
      slug: p.slug,
      resumo: p.excerpt ?? "",
      capa: p.featured_image ?? "",
      tipo,
      html: p.content_html,
      status: p.status === "published" || p.status === "scheduled" ? p.status : "draft",
      publicadoEm: iso(p.published_at) ?? null,
      atualizadoEm: iso(p.updated_at)!,
      categoriaIds: cats.map((c) => c.category_id),
      tagIds: tags.map((t) => t.tag_id),
      palavraChave: p.focus_keyword ?? "",
      autorId: p.author_id,
      autor: p.autor,
      origem: p.origin,
      jaPublicado: p.published_at !== null,
      url: `/${tipo === "article" ? "artigos" : "noticias"}/${p.slug}`,
    },
    versoes: versoes.map((v) => ({ id: Number(v.id), titulo: v.title, status: v.status, salvaPor: v.saved_by, criadaEm: iso(v.created_at)! })),
  };
}

export async function opcoesEditor(): Promise<OpcoesEditor> {
  if (!hasDatabase()) return { categorias: [], tags: [], autores: [] };
  const [categorias, tags, autores] = await Promise.all([
    query<{ id: string; name: string; kind: string; slug: string }>("SELECT id, name, kind, slug FROM categories ORDER BY name"),
    query<{ id: string; name: string; usos: number }>("SELECT t.id, t.name, COUNT(pt.post_id) AS usos FROM tags t LEFT JOIN post_tags pt ON pt.tag_id = t.id GROUP BY t.id, t.name ORDER BY t.name LIMIT 5000"),
    query<{ id: string; name: string }>("SELECT id, name FROM post_authors ORDER BY name LIMIT 200"),
  ]);
  return {
    categorias: categorias.map((c) => ({ id: c.id, nome: c.name, tipo: c.kind, slug: c.slug })),
    tags: tags.map((t) => ({ id: t.id, nome: t.name, usos: Number(t.usos) })),
    autores: autores.map((a) => ({ id: a.id, nome: a.name })),
  };
}

// ───────────── Salvar ─────────────

const Entrada = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{8,36}$/).nullable(),
  titulo: z.string().trim().min(1, "Adicione um título.").max(300, "O título passou de 300 caracteres."),
  slug: z.string().trim().max(200),
  resumo: z.string().trim().max(600, "O resumo passou de 600 caracteres."),
  capa: z.string().trim().max(600),
  tipo: z.enum(["news", "article"]),
  html: z.string().max(2_000_000, "O texto está grande demais."),
  categoriaIds: z.array(z.string().regex(/^[a-zA-Z0-9-]{8,36}$/)).max(20),
  tagIds: z.array(z.string().regex(/^[a-zA-Z0-9-]{8,36}$/)).max(40),
  publicadoEm: z.string().nullable(),
  palavraChave: z.string().trim().max(200),
  autorId: z.string().regex(/^[a-zA-Z0-9-]{8,36}$/).nullable(),
  /** `updated_at` que o navegador tinha ao abrir; se mudou no banco, é conflito. */
  atualizadoEm: z.string().nullable(),
});
export type EntradaPost = z.infer<typeof Entrada>;

export type ResultadoSalvar =
  | { ok: true; id: string; slug: string; status: "draft" | "scheduled" | "published"; publicadoEm: string | null; atualizadoEm: string; aviso?: string }
  | { ok: false; erro: string; faltando?: string[]; conflito?: boolean };

/** Largura e altura da capa quando ela é nossa (/media/...); senão null. */
async function medidasDaCapa(url: string): Promise<{ w: number; h: number } | null> {
  if (!url.startsWith("/media/") || url.includes("..")) return null;
  try {
    const m = await sharp(join(mediaDir(), url.slice("/media/".length))).metadata();
    return m.width && m.height ? { w: m.width, h: m.height } : null;
  } catch {
    return null;
  }
}

export async function salvarPost(bruto: unknown, acao: SaveAction, agora = Date.now()): Promise<ResultadoSalvar> {
  const parsed = Entrada.safeParse(bruto);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const e = parsed.data;
  const html = sanitizePostHtml(e.html);
  const plain = htmlToPlain(html);
  const resumo = e.resumo || autoExcerpt(plain);
  const medidas = await medidasDaCapa(e.capa);

  const resultado = await tx<ResultadoSalvar>(async (conn) => {
    let atual: (RowDataPacket & { id: string; status: string; published_at: string | null; updated_at: string; origin: string; edited_at: string | null; source_url: string | null; slug: string; title: string; excerpt: string | null; content_html: string; featured_image: string | null }) | undefined;
    if (e.id) {
      const [rows] = await conn.query<NonNullable<typeof atual>[]>("SELECT id, status, published_at, updated_at, origin, edited_at, source_url, slug, title, excerpt, content_html, featured_image FROM posts WHERE id = ? FOR UPDATE", [e.id]);
      atual = rows[0];
      if (!atual) return { ok: false, erro: "Este post não existe mais." };
      if (e.atualizadoEm && iso(atual.updated_at) !== e.atualizadoEm) {
        const quando = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso(atual.updated_at)!));
        return { ok: false, conflito: true, erro: `Este post foi alterado às ${quando} (robô, agenda ou outra aba). Copie o que escreveu e recarregue.` };
      }
    }
    const statusAtual = (atual?.status === "published" || atual?.status === "scheduled" ? atual.status : "draft") as "draft" | "scheduled" | "published";
    const publicadoAtual = atual ? (iso(atual.published_at) ?? null) : null;

    // Publicar, agendar ou salvar um post no ar exige o checklist completo.
    const vaiAoAr = acao === "publish" || acao === "schedule" || (acao === "keep" && statusAtual !== "draft");
    const check = checklistPublicar({ title: e.titulo, html, featuredImage: e.capa, categoryCount: e.categoriaIds.length });
    if (vaiAoAr && check.some((c) => !c.ok)) {
      const faltando = check.filter((c) => !c.ok).map((c) => c.label);
      return { ok: false, erro: `Falta para publicar: ${faltando.map((f) => f.toLowerCase()).join(", ")}.`, faltando };
    }
    const r = resolveSave(acao, statusAtual, e.publicadoEm, publicadoAtual, agora);
    if ("error" in r) return { ok: false, erro: r.error };

    // Endereço: editável só enquanto a matéria nunca foi publicada; depois, o que está no banco manda.
    const travado = !!atual && publicadoAtual !== null;
    const slug = travado ? atual!.slug : slugify(e.slug || e.titulo);
    if (!slug) return { ok: false, erro: "O endereço ficou vazio." };
    const [choque] = await conn.query<(RowDataPacket & { id: string })[]>("SELECT id FROM posts WHERE slug = ? AND id <> ? LIMIT 1", [slug, e.id ?? "-"]);
    if (choque.length) return { ok: false, erro: "Já existe um post com esse endereço. Mude o endereço." };

    // Só categorias e tags que existem (id inventado não vira vínculo).
    const catIds = e.categoriaIds.length ? (await conn.query<(RowDataPacket & { id: string })[]>(`SELECT id FROM categories WHERE id IN (${e.categoriaIds.map(() => "?").join(",")})`, e.categoriaIds))[0].map((c) => c.id) : [];
    const tagIds = e.tagIds.length ? (await conn.query<(RowDataPacket & { id: string })[]>(`SELECT id FROM tags WHERE id IN (${e.tagIds.map(() => "?").join(",")})`, e.tagIds))[0].map((t) => t.id) : [];

    const id = e.id ?? randomUUID();
    const dados = [e.titulo, slug, r.status, resumo, html, e.capa || null, medidas?.w ?? null, medidas?.h ?? null, e.tipo, e.autorId, e.palavraChave || null, readingMinutes(html), r.published_at ? r.published_at.replace("T", " ").replace("Z", "") : null];
    if (atual) {
      await conn.query("INSERT INTO post_revisions (post_id, title, excerpt, content_html, featured_image, status, saved_by) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, atual.title, atual.excerpt, atual.content_html, atual.featured_image, atual.status, quemSalvou(atual)]);
      await conn.query(
        "UPDATE posts SET title = ?, slug = ?, status = ?, excerpt = ?, content_html = ?, featured_image = ?, image_width = ?, image_height = ?, post_type = ?, author_id = ?, focus_keyword = ?, reading_minutes = ?, published_at = ?, edited_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [...dados, id],
      );
      await conn.query("DELETE FROM post_revisions WHERE post_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM post_revisions WHERE post_id = ? ORDER BY id DESC LIMIT ?) x)", [id, id, MAX_VERSOES]);
    } else {
      await conn.query(
        "INSERT INTO posts (title, slug, status, excerpt, content_html, featured_image, image_width, image_height, post_type, author_id, focus_keyword, reading_minutes, published_at, id, origin, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'painel', UTC_TIMESTAMP(3))",
        [...dados, id],
      );
    }
    await conn.query("DELETE FROM post_categories WHERE post_id = ?", [id]);
    for (const c of catIds) await conn.query("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [id, c]);
    await conn.query("DELETE FROM post_tags WHERE post_id = ?", [id]);
    for (const t of tagIds) await conn.query("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, t]);
    const [novo] = await conn.query<(RowDataPacket & { updated_at: string })[]>("SELECT updated_at FROM posts WHERE id = ?", [id]);
    return { ok: true, id, slug, status: r.status, publicadoEm: r.published_at, atualizadoEm: iso(novo[0].updated_at)! };
  });

  if (resultado.ok) {
    clearCache();
    void rebuildPostVideos().catch((err) => console.error(`[posts] vídeos das matérias não atualizaram: ${String((err as Error)?.message ?? err).slice(0, 100)}`));
  }
  return resultado;
}

/** Uma versão antiga (para "Restaurar": o navegador carrega no editor sem salvar). */
export async function lerVersao(postId: string, versaoId: number) {
  const [v] = await query<{ title: string; excerpt: string | null; content_html: string; featured_image: string | null }>("SELECT title, excerpt, content_html, featured_image FROM post_revisions WHERE id = ? AND post_id = ?", [versaoId, postId]);
  return v ? { titulo: v.title, resumo: v.excerpt ?? "", html: v.content_html, capa: v.featured_image ?? "" } : null;
}

// ───────────── Categorias e tags ─────────────

/** Cria a categoria (ou devolve a que já existe com o mesmo endereço). */
export async function criarCategoria(nome: string, tipo: "news" | "article") {
  const n = nome.trim().slice(0, 120);
  const slug = slugify(n);
  if (n.length < 2 || !slug) throw new Error("Nome inválido.");
  const [ex] = await query<{ id: string; name: string }>("SELECT id, name FROM categories WHERE slug = ?", [slug]);
  if (ex) return { id: ex.id, nome: ex.name, tipo, slug, nova: false };
  const id = randomUUID();
  await exec("INSERT INTO categories (id, name, slug, kind) VALUES (?, ?, ?, ?)", [id, n, slug, tipo]);
  clearCache();
  return { id, nome: n, tipo, slug, nova: true };
}

/** Cria a tag, reaproveitando a que já existe com o mesmo endereço ou o mesmo nome (evita "DAN DA DAN" × "Dandadan"). */
export async function criarTag(nome: string) {
  const n = nome.trim().replace(/^#/, "").slice(0, 80);
  const slug = slugify(n);
  if (n.length < 2 || !slug) throw new Error("Nome inválido.");
  const [ex] = await query<{ id: string; name: string }>("SELECT id, name FROM tags WHERE slug = ? OR name = ? LIMIT 1", [slug, n]);
  if (ex) return { id: ex.id, nome: ex.name, nova: false };
  const id = randomUUID();
  await exec("INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", [id, n, slug]);
  clearCache();
  return { id, nome: n, nova: true };
}

/** Passa matérias agendadas cuja hora chegou para publicadas (tarefa a cada 5 minutos). Devolve quantas. */
export async function publicarAgendados(): Promise<number> {
  const { affected } = await exec("UPDATE posts SET status = 'published' WHERE status = 'scheduled' AND published_at <= UTC_TIMESTAMP(3)");
  if (affected > 0) clearCache();
  return affected;
}
