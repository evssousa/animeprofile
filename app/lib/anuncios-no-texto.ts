// Onde entram os anúncios "no meio do texto" de uma matéria. Só corta o HTML logo depois de um </p> de primeiro nível (fora de
// blockquote, lista, figura, details, div e tabela): cortar dentro do spoiler deixaria o HTML desbalanceado. Puro (roda no servidor e no navegador).

const CONTAINERS = new Set(["blockquote", "li", "figure", "details", "div", "table"]);
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/** Pedaços do HTML, cada um terminando logo depois de um </p> de primeiro nível. */
export function cortarEmParagrafos(html: string): string[] {
  TAG_RE.lastIndex = 0;
  let nivel = 0;
  let corte = 0;
  const partes: string[] = [];
  for (let m = TAG_RE.exec(html); m; m = TAG_RE.exec(html)) {
    const nome = m[1].toLowerCase();
    const fecha = m[0][1] === "/";
    if (CONTAINERS.has(nome)) nivel = fecha ? Math.max(0, nivel - 1) : nivel + 1;
    else if (nome === "p" && fecha && nivel === 0) {
      partes.push(html.slice(corte, TAG_RE.lastIndex));
      corte = TAG_RE.lastIndex;
    }
  }
  if (corte < html.length) partes.push(html.slice(corte));
  return partes;
}

/** O pedaço começa com um título e logo uma imagem (antes de qualquer parágrafo)? Um anúncio ali ficaria entre o título e a imagem dele. */
function tituloLogoImagem(parte: string): boolean {
  const t = /^\s*<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/i.exec(parte);
  if (!t) return false;
  const resto = parte.slice(t[0].length);
  const p = resto.search(/<p[\s>]/i);
  return /<(img|figure)[\s>]/i.test(p === -1 ? resto : resto.slice(0, p));
}

export type PedacoDoTexto = { html: string } | { anuncio: true };

/**
 * Notícia (curta): um anúncio depois do 1º parágrafo, se houver pelo menos 2.
 * Artigo (longo): um a cada 4 parágrafos, pulando para o parágrafo seguinte quando o ponto cairia entre um título e a imagem dele.
 */
export function textoComAnuncios(html: string, tipo: "news" | "article"): PedacoDoTexto[] {
  const partes = cortarEmParagrafos(html);
  const paragrafos = partes.filter((p) => /<\/p>\s*$/i.test(p)).length;
  const pontos = new Set<number>(); // o anúncio entra ANTES da parte de índice i
  if (tipo === "news") {
    if (paragrafos >= 2) pontos.add(1);
  } else {
    for (let alvo = 4; alvo < paragrafos; alvo += 4) {
      let i = alvo;
      while (i < paragrafos && tituloLogoImagem(partes[i] ?? "")) i++;
      if (i < paragrafos) pontos.add(i);
    }
  }
  const out: PedacoDoTexto[] = [];
  let acumulado = "";
  partes.forEach((p, i) => {
    if (pontos.has(i)) {
      if (acumulado) out.push({ html: acumulado });
      out.push({ anuncio: true });
      acumulado = "";
    }
    acumulado += p;
  });
  if (acumulado) out.push({ html: acumulado });
  return out;
}
