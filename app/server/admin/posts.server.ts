// Posts no painel (/admin/posts): lista paginada no servidor, contagens das abas e exclusão de rascunhos.
// A edição (salvar, publicar, agendar) entra nos próximos passos do plano (docs/plano-telas-painel.md, tela 3).
import { hasDatabase, iso, query, tx } from "../db.server";
import { clearCache } from "../cache.server";

export const POR_PAGINA = 25;

export type StatusLista = "todos" | "published" | "scheduled" | "draft";
export type OrigemPost = "old" | "robo" | "agenda" | "painel";
export type Ordem = "recentes" | "antigos" | "vistas";

export type FiltrosPosts = { status: StatusLista; tipo: "" | "news" | "article"; origem: "" | OrigemPost; autor: string; q: string; ordem: Ordem; pagina: number };

const STATUS: StatusLista[] = ["todos", "published", "scheduled", "draft"];
const ORIGENS: OrigemPost[] = ["old", "robo", "agenda", "painel"];
const ORDENS: Ordem[] = ["recentes", "antigos", "vistas"];

/** Lê os filtros do endereço, ignorando valores inválidos. */
export function lerFiltros(sp: URLSearchParams): FiltrosPosts {
  const pick = <T extends string>(v: string | null, ok: readonly T[], padrao: T): T => (ok.includes(v as T) ? (v as T) : padrao);
  const tipo = sp.get("tipo");
  const origem = sp.get("origem");
  return {
    status: pick(sp.get("status"), STATUS, "todos"),
    tipo: tipo === "news" || tipo === "article" ? tipo : "",
    origem: ORIGENS.includes(origem as OrigemPost) ? (origem as OrigemPost) : "",
    autor: (sp.get("autor") ?? "").slice(0, 36).replace(/[^a-zA-Z0-9-]/g, ""),
    q: (sp.get("q") ?? "").trim().slice(0, 100),
    ordem: pick(sp.get("ordem"), ORDENS, "recentes"),
    pagina: Math.max(1, Number(sp.get("pagina")) || 1),
  };
}

/** A origem "de verdade" de cada matéria: a agenda do robô é separada, e o que veio do painel tem origin = 'painel'. */
const CLASSE = `CASE WHEN p.source_url LIKE 'agenda de animes%' THEN 'agenda' WHEN p.origin = 'robo' THEN 'robo' WHEN p.origin = 'old' THEN 'old' ELSE 'painel' END`;

function onde(f: FiltrosPosts, comStatus = true): { sql: string; params: unknown[] } {
  const partes = ["1 = 1"];
  const params: unknown[] = [];
  if (comStatus && f.status !== "todos") {
    partes.push("p.status = ?");
    params.push(f.status);
  }
  if (f.tipo) {
    partes.push("p.post_type = ?");
    params.push(f.tipo);
  }
  if (f.origem) {
    partes.push(`${CLASSE} = ?`);
    params.push(f.origem);
  }
  if (f.autor) {
    partes.push("p.author_id = ?");
    params.push(f.autor);
  }
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    partes.push("(p.title LIKE ? OR p.slug LIKE ?)");
    params.push(like, like);
  }
  return { sql: partes.join(" AND "), params };
}

export type LinhaPost = {
  id: string;
  slug: string;
  titulo: string;
  status: "draft" | "published" | "scheduled";
  tipo: "news" | "article";
  url: string;
  capa: string | null;
  publicadoEm: string | null;
  vistas: number;
  origem: OrigemPost;
  autor: string | null;
  categoria: string | null;
};

export type ListaPosts = {
  itens: LinhaPost[];
  total: number;
  pagina: number;
  paginas: number;
  contagens: Record<StatusLista, number>;
  autores: { id: string; nome: string }[];
};

const ORDEM_SQL: Record<Ordem, string> = {
  recentes: "COALESCE(p.published_at, p.created_at) DESC, p.id",
  antigos: "COALESCE(p.published_at, p.created_at) ASC, p.id",
  vistas: "p.views_count DESC, p.id",
};

export async function listarPosts(f: FiltrosPosts): Promise<ListaPosts> {
  const vazio: ListaPosts = { itens: [], total: 0, pagina: 1, paginas: 1, contagens: { todos: 0, published: 0, scheduled: 0, draft: 0 }, autores: [] };
  if (!hasDatabase()) return vazio;
  const w = onde(f);
  const wSemStatus = onde(f, false); // as abas contam com os mesmos filtros, menos o status
  const [[cont], porStatus, autores] = await Promise.all([
    query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts p WHERE ${w.sql}`, w.params),
    query<{ status: string; n: number }>(`SELECT p.status, COUNT(*) AS n FROM posts p WHERE ${wSemStatus.sql} GROUP BY p.status`, wSemStatus.params),
    query<{ id: string; name: string }>("SELECT a.id, a.name FROM post_authors a WHERE EXISTS (SELECT 1 FROM posts p WHERE p.author_id = a.id) ORDER BY a.name LIMIT 200"),
  ]);
  const total = Number(cont?.n ?? 0);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(f.pagina, paginas);
  const rows = await query<{ id: string; slug: string; title: string; status: string; post_type: string; featured_image: string | null; published_at: string | null; created_at: string; views_count: number; classe: string; autor: string | null; categoria: string | null }>(
    `SELECT p.id, p.slug, p.title, p.status, p.post_type, p.featured_image, p.published_at, p.created_at, p.views_count, ${CLASSE} AS classe, a.name AS autor,
            (SELECT c.name FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id ORDER BY c.name LIMIT 1) AS categoria
     FROM posts p LEFT JOIN post_authors a ON a.id = p.author_id WHERE ${w.sql} ORDER BY ${ORDEM_SQL[f.ordem]} LIMIT ? OFFSET ?`,
    [...w.params, POR_PAGINA, (pagina - 1) * POR_PAGINA],
  );
  const contagens = { todos: 0, published: 0, scheduled: 0, draft: 0 };
  for (const r of porStatus) {
    if (r.status in contagens) contagens[r.status as keyof typeof contagens] = Number(r.n);
    contagens.todos += Number(r.n);
  }
  return {
    total,
    pagina,
    paginas,
    contagens,
    autores: autores.map((a) => ({ id: a.id, nome: a.name })),
    itens: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      titulo: r.title,
      status: r.status === "published" || r.status === "scheduled" ? r.status : "draft",
      tipo: r.post_type === "article" ? "article" : "news",
      url: `/${r.post_type === "article" ? "artigos" : "noticias"}/${r.slug}`,
      capa: r.featured_image,
      publicadoEm: iso(r.published_at ?? r.created_at) ?? null,
      vistas: Number(r.views_count),
      origem: (ORIGENS as string[]).includes(r.classe) ? (r.classe as OrigemPost) : "painel",
      autor: r.autor,
      categoria: r.categoria,
    })),
  };
}

/** Exclui só RASCUNHOS (publicado precisa ser despublicado antes: evita 404 de matéria indexada). Devolve quantos saíram. */
export async function excluirRascunhos(ids: string[]): Promise<number> {
  const limpos = [...new Set(ids)].filter((id) => /^[a-zA-Z0-9-]{8,36}$/.test(id)).slice(0, 100);
  if (!limpos.length) return 0;
  const apagados = await tx(async (conn) => {
    const [alvo] = await conn.query<(import("mysql2/promise").RowDataPacket & { id: string })[]>(`SELECT id FROM posts WHERE status = 'draft' AND id IN (${limpos.map(() => "?").join(",")})`, limpos);
    const validos = alvo.map((r) => r.id);
    if (!validos.length) return 0;
    const marcas = validos.map(() => "?").join(",");
    await conn.query(`DELETE FROM post_categories WHERE post_id IN (${marcas})`, validos);
    await conn.query(`DELETE FROM post_tags WHERE post_id IN (${marcas})`, validos);
    await conn.query(`DELETE FROM post_revisions WHERE post_id IN (${marcas})`, validos).catch(() => undefined); // tabela da migration 015
    const [res] = await conn.query<import("mysql2/promise").ResultSetHeader>(`DELETE FROM posts WHERE status = 'draft' AND id IN (${marcas})`, validos);
    return res.affectedRows;
  });
  if (apagados) clearCache();
  return apagados;
}
