import { describe, expect, it } from "vitest";
import { autoExcerpt, checagensSeo, checklistPublicar, contarMarcacoes, htmlToPlain, removerMarcacoes, resolveSave, slugify, wordCount } from "~/lib/post-editor";

const AGORA = Date.parse("2026-11-19T15:00:00Z");
const palavras = (n: number) => `<p>${"palavra ".repeat(n)}</p>`;

describe("texto", () => {
  it("slugify tira acento e símbolos", () => expect(slugify("  Ação & Aventura: One Piece! ")).toBe("acao-aventura-one-piece"));
  it("texto puro separa os blocos (sem colar palavras) e entende as entidades", () => {
    expect(htmlToPlain("<p>fim do parágrafo.</p><h2>Título</h2><p>a &amp; b&nbsp;c</p>")).toBe("fim do parágrafo. Título a & b c");
    expect(wordCount("  um dois   três ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("resumo automático corta na última palavra inteira", () => {
    expect(autoExcerpt("curto")).toBe("curto");
    const r = autoExcerpt("palavra ".repeat(60));
    expect(r.endsWith("…")).toBe(true);
    expect(r.length).toBeLessThanOrEqual(201);
  });
});

describe("marcações ✍️", () => {
  const html = "<p>Texto bom.</p><p>✍️ [ESCREVA AQUI: sua opinião]</p><ul><li>✍️ [CONFERIR: data]</li></ul><p>Fim ✍️ [CONFERIR: nome] do texto.</p>";
  it("conta e limpa: apaga o bloco que é só marcação e mantém o texto do resto", () => {
    expect(contarMarcacoes(html)).toBe(3);
    const limpo = removerMarcacoes(html);
    expect(contarMarcacoes(limpo)).toBe(0);
    expect(limpo).toContain("Texto bom.");
    expect(limpo).toContain("Fim");
    expect(limpo).not.toContain("<ul></ul>");
    expect(limpo).not.toContain("ESCREVA");
  });
});

describe("checklist para publicar", () => {
  const ok = { title: "Um título bom", html: palavras(60), featuredImage: "/media/x.webp", categoryCount: 1 };
  it("tudo certo não deixa nada faltando", () => expect(checklistPublicar(ok).every((c) => c.ok)).toBe(true));
  it("aponta o que falta: título curto, pouco texto, sem capa, sem categoria, texto de modelo e marcação", () => {
    const falta = (o: Partial<typeof ok>) => checklistPublicar({ ...ok, ...o }).filter((c) => !c.ok).map((c) => c.id);
    expect(falta({ title: "Oi" })).toEqual(["title"]);
    expect(falta({ html: palavras(10) })).toEqual(["content"]);
    expect(falta({ featuredImage: " " })).toEqual(["cover"]);
    expect(falta({ categoryCount: 0 })).toEqual(["category"]);
    expect(falta({ html: `<p>[nome do anime] ${"palavra ".repeat(60)}</p>` })).toEqual(["template"]);
    expect(falta({ html: `<p>✍️ [ESCREVA AQUI: x] ${"palavra ".repeat(60)}</p>` })).toEqual(["notes"]);
  });
});

describe("status ao salvar (resolveSave)", () => {
  const FUTURO = new Date(AGORA + 3_600_000).toISOString();
  const PASSADO = new Date(AGORA - 3_600_000).toISOString();
  it("rascunho não tem data nova; despublicar mantém a data original", () => {
    expect(resolveSave("draft", "draft", FUTURO, null, AGORA)).toEqual({ status: "draft", published_at: null });
    expect(resolveSave("unpublish", "published", FUTURO, PASSADO, AGORA)).toEqual({ status: "draft", published_at: PASSADO });
  });
  it("publicar agora usa a hora de agora; manter publicado mantém a data do campo (ou a que já tinha)", () => {
    expect(resolveSave("publish", "draft", FUTURO, null, AGORA)).toEqual({ status: "published", published_at: new Date(AGORA).toISOString() });
    expect(resolveSave("keep", "published", PASSADO, PASSADO, AGORA)).toEqual({ status: "published", published_at: PASSADO });
    expect(resolveSave("keep", "published", null, PASSADO, AGORA)).toEqual({ status: "published", published_at: PASSADO });
  });
  it("agendar exige data, pelo menos 1 minuto no futuro", () => {
    expect(resolveSave("schedule", "draft", FUTURO, null, AGORA)).toEqual({ status: "scheduled", published_at: FUTURO });
    expect(resolveSave("schedule", "draft", null, null, AGORA)).toMatchObject({ error: expect.stringContaining("data") });
    expect(resolveSave("schedule", "draft", PASSADO, null, AGORA)).toMatchObject({ error: expect.stringContaining("futuro") });
  });
  it("salvar um agendado (keep) continua agendado", () => expect(resolveSave("keep", "scheduled", FUTURO, FUTURO, AGORA)).toEqual({ status: "scheduled", published_at: FUTURO }));
});

describe("SEO simples", () => {
  it("palavra-chave no título e no 1º parágrafo, tamanho do título e do resumo", () => {
    const r = checagensSeo({ title: "One Piece: capítulo 1100 chega com revelação enorme", html: "<p>One Piece volta.</p>", excerpt: "x".repeat(100), focusKeyword: "one piece" });
    expect(r.every((c) => c.ok)).toBe(true);
    const ruim = checagensSeo({ title: "Oi", html: "<p>nada</p>", excerpt: "curto", focusKeyword: "one piece" });
    expect(ruim.filter((c) => !c.ok).map((c) => c.id)).toEqual(["kw-title", "kw-p1", "title-len", "excerpt-len"]);
    expect(checagensSeo({ title: "x".repeat(40), html: "", excerpt: "y".repeat(80), focusKeyword: "" })).toHaveLength(2); // sem palavra-chave, só os dois de tamanho
  });
});
