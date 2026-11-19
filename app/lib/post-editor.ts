// Regras puras do editor de posts do painel (portadas do site antigo, lib/post-editor.ts e lib/editor-notes.ts).
// Roda no servidor e no navegador: o servidor confere tudo de novo (o navegador nunca é a regra).

export type PostType = "news" | "article";
export type PostStatus = "draft" | "scheduled" | "published";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** Texto puro do HTML (sem DOM, para rodar também no servidor). Espaço no fim de cada bloco. */
export function htmlToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|h[1-6]|li|div|blockquote|figcaption|td|th|summary)>/gi, "$& ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(plain: string): number {
  const t = plain.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Resumo automático: começo do texto, cortado na última palavra inteira. */
export function autoExcerpt(plain: string, max = 200): string {
  const t = plain.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

// ───────────── Marcações de revisão (rascunhos de "Artigos com IA") ─────────────
// ✍️ [ESCREVA AQUI: …] e ✍️ [CONFERIR: …]. O servidor não deixa publicar com marcação.

const MARCA = "✍️ [";
const INLINE = /✍️\s*\[[^\]]*\]/g;

export function contarMarcacoes(html: string | null | undefined): number {
  return (html ?? "").split(MARCA).length - 1;
}

/** Apaga as marcações: o parágrafo ou item inteiro quando ele é só a marcação; se sobrar texto, tira só o trecho entre colchetes. */
export function removerMarcacoes(html: string): string {
  return html
    .replace(/<(p|li|h[2-4]|blockquote)\b[^>]*>(?:(?!<\/\1>)[\s\S])*?✍️\s*\[[\s\S]*?<\/\1>/gi, (bloco) => {
      const texto = bloco.replace(/<[^>]+>/g, "").replace(INLINE, "").trim();
      return texto ? bloco.replace(INLINE, "").replace(/\s{2,}/g, " ") : "";
    })
    .replace(INLINE, "")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<ul>\s*<\/ul>|<ol>\s*<\/ol>/g, "");
}

// ───────────── Checklist e status ─────────────

export type ItemChecklist = { id: string; label: string; ok: boolean };

/** O mínimo para publicar. Rascunho pode ser salvo sem nada disso (só precisa de título). */
export function checklistPublicar(f: { title: string; html: string; featuredImage: string; categoryCount: number }): ItemChecklist[] {
  const plain = htmlToPlain(f.html);
  return [
    { id: "title", label: "Título", ok: f.title.trim().length >= 5 },
    { id: "content", label: "Conteúdo (pelo menos 50 palavras)", ok: wordCount(plain) >= 50 },
    { id: "cover", label: "Imagem de capa", ok: f.featuredImage.trim().length > 0 },
    { id: "category", label: "Pelo menos 1 categoria", ok: f.categoryCount > 0 },
    { id: "template", label: "Sem texto de modelo [entre colchetes]", ok: !/\[[^\]]{3,}\]/.test(plain.replace(MARCA, "")) },
    { id: "notes", label: "Sem marcações ✍️ de revisão", ok: contarMarcacoes(f.html) === 0 },
  ];
}

export type SaveAction = "draft" | "publish" | "schedule" | "keep" | "unpublish";

/**
 * Status e data de publicação para cada botão (a data vem em ISO/UTC).
 * - "keep" salva sem mudar o status (publicado continua no ar, agendado continua agendado).
 * - Publicar com data futura vira agendamento; "Publicar agora" usa agora; despublicar volta a rascunho e MANTÉM a data original.
 */
export function resolveSave(
  action: SaveAction,
  current: PostStatus,
  publishedAt: string | null,
  currentPublishedAt: string | null,
  now = Date.now(),
): { status: PostStatus; published_at: string | null } | { error: string } {
  const chosen = publishedAt ? new Date(publishedAt).getTime() : NaN;
  const status: PostStatus = action === "draft" || action === "unpublish" ? "draft" : action === "publish" ? "published" : action === "schedule" ? "scheduled" : current;
  if (status === "draft") return { status, published_at: action === "unpublish" ? currentPublishedAt : (currentPublishedAt ?? null) };
  if (status === "scheduled") {
    if (!Number.isFinite(chosen)) return { error: "Escolha a data e a hora do agendamento." };
    if (chosen <= now + 60_000) return { error: "O agendamento precisa ser pelo menos 1 minuto no futuro." };
    return { status, published_at: new Date(chosen).toISOString() };
  }
  // published: "Publicar agora" usa agora; manter publicado usa a data do campo (ou a que já tinha, ou agora).
  if (action === "publish") return { status, published_at: new Date(now).toISOString() };
  const fallback = currentPublishedAt ? new Date(currentPublishedAt).getTime() : now;
  return { status, published_at: new Date(Number.isFinite(chosen) ? chosen : fallback).toISOString() };
}

// ───────────── SEO simples (4 checagens) ─────────────

export type ChecagemSeo = { id: string; label: string; ok: boolean };

export function checagensSeo(f: { title: string; html: string; excerpt: string; focusKeyword: string }): ChecagemSeo[] {
  const kw = f.focusKeyword.trim().toLowerCase();
  const primeiro = (/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(f.html)?.[1] ?? "").replace(/<[^>]+>/g, "").toLowerCase();
  const t = f.title.trim().length;
  const r = f.excerpt.trim().length;
  return [
    ...(kw ? [{ id: "kw-title", label: "Palavra-chave no título", ok: f.title.toLowerCase().includes(kw) }, { id: "kw-p1", label: "Palavra-chave no 1º parágrafo", ok: primeiro.includes(kw) }] : []),
    { id: "title-len", label: "Título de 30 a 70 caracteres", ok: t >= 30 && t <= 70 },
    { id: "excerpt-len", label: "Resumo de 70 a 160 caracteres", ok: r >= 70 && r <= 160 },
  ];
}
