import { makeSlug } from "./text";

// Ajustes de SEO no HTML gerado (portado do site antigo; sem o cartão do anime no meio do texto: a lateral da matéria já mostra).

/**
 * Post-processes AI-generated HTML to guarantee SEO requirements: trailer at
 * top, internal link, external link, H2 "Mais sobre <kw>", body images.
 */
export function enforceSeoHtml(opts: {
  html: string;
  focusKeyword: string;
  sourceUrl: string;
  sourceName: string;
  trailer?: string;
  bodyImages: string[];
  extraVideos?: string[];
}): string {
  let html = opts.html.trim();
  const kw = opts.focusKeyword.trim();
  const kwSlug = makeSlug(kw, 60);

  // 1) Trailer at top
  if (opts.trailer && !/youtube\.com\/embed|player\.vimeo\.com/i.test(html)) {
    html = `<div class="aspect-video my-4"><iframe src="${opts.trailer}" allowfullscreen frameborder="0" class="w-full h-full rounded-xl"></iframe></div>\n${html}`;
  } else if (opts.trailer) {
    const m = html.match(/<div[^>]*aspect-video[\s\S]*?<\/div>|<iframe[^>]*(?:youtube|vimeo)[^>]*><\/iframe>/i);
    if (m && html.indexOf(m[0]) > 50) {
      html = m[0] + "\n" + html.replace(m[0], "");
    }
  }

  // 2) Link interno: a primeira vez que a palavra-chave aparece num parágrafo vira link para a tag.
  //    Antes, sem a palavra no 1º parágrafo, colava "<palavra-chave> — " no começo do texto (abertura
  //    estranha tipo "Séries Sci-Fi Anos 90 — A era..."). Agora, se não aparecer, fica sem o link.
  const hasInternal = /<a[^>]+href=["']\/(tag|categoria|artigos|noticias)\//i.test(html);
  if (!hasInternal && kwSlug && kw) {
    let done = false;
    html = html.replace(/<p>([\s\S]*?)<\/p>/gi, (full, inner: string) => {
      if (done || /<a\b/i.test(inner)) return full;
      const idx = inner.toLowerCase().indexOf(kw.toLowerCase());
      if (idx < 0) return full;
      done = true;
      return `<p>${inner.slice(0, idx)}<a href="/tag/${kwSlug}">${inner.slice(idx, idx + kw.length)}</a>${inner.slice(idx + kw.length)}</p>`;
    });
  }

  // 3) Remove any "Fonte:" / "Leia na fonte" paragraphs the AI may have added
  html = html.replace(/<p[^>]*>\s*(?:<strong>\s*)?(?:Fonte|Leia\s+(?:na|mais\s+na)\s+fonte|Source)\b[\s\S]*?<\/p>/gi, "").trim();

  // 4) "Mais sobre <kw>" é seção (H2), não sub-seção: H3 solto sem H2 antes quebrava a ordem dos
  //    títulos. Se faltar, NÃO inventamos parágrafo genérico ("fique de olho...") — a checagem de
  //    qualidade reprova e o Gemini tenta de novo.
  html = html.replace(/<h3([^>]*)>(\s*Mais sobre\b[\s\S]*?)<\/h3>/i, "<h2$1>$2</h2>");

  // 5) Ensure ALL source images from the original post are included.
  if (opts.bodyImages.length) {
    const missing = opts.bodyImages.filter((u) => !html.includes(u));
    if (missing.length) {
      const figures = missing.map(
        (img) => `<figure class="my-6 w-full"><img src="${img}" alt="${kw}" class="rounded-xl w-full h-auto" loading="lazy" /></figure>`,
      );
      const parts = html.split(/(<\/p>)/i);
      let injected = 0;
      const rebuilt: string[] = [];
      let pCount = 0;
      for (let i = 0; i < parts.length; i++) {
        rebuilt.push(parts[i]);
        if (/<\/p>/i.test(parts[i])) {
          pCount++;
          if (pCount % 2 === 0 && injected < figures.length) {
            rebuilt.push("\n" + figures[injected++] + "\n");
          }
        }
      }
      while (injected < figures.length) rebuilt.push("\n" + figures[injected++] + "\n");
      html = rebuilt.join("");
    }
  }

  // 5a) Ensure extra source videos (beyond the main trailer) are embedded.
  if (opts.extraVideos && opts.extraVideos.length) {
    const missingVids = opts.extraVideos.filter((u) => !html.includes(u));
    for (const v of missingVids) {
      const embed = `\n<div class="aspect-video my-4"><iframe src="${v}" allowfullscreen frameborder="0" class="w-full h-full rounded-xl"></iframe></div>\n`;
      if (/<h[23][^>]*>\s*Mais sobre\b/i.test(html)) {
        html = html.replace(/<h[23][^>]*>\s*Mais sobre\b/i, (m) => embed + m);
      } else {
        html += embed;
      }
    }
  }

  // 5b) Force every existing <img> to render large, full-width
  html = html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    let a = attrs;
    if (/class=["'][^"']*["']/i.test(a)) {
      a = a.replace(/class=["']([^"']*)["']/i, (_m, c: string) => {
        const cls = new Set(c.split(/\s+/).filter(Boolean));
        ["w-full", "h-auto", "rounded-xl"].forEach((x) => cls.add(x));
        return `class="${[...cls].join(" ")}"`;
      });
    } else {
      a = ` class="w-full h-auto rounded-xl"` + a;
    }
    if (!/loading=/i.test(a)) a = a + ` loading="lazy"`;
    return `<img${a}>`;
  });
  html = html.replace(/(^|>)\s*(<img\b[^>]*>)(?!\s*<\/figure>)/gi, (_m, pre: string, img: string) => {
    return `${pre}<figure class="my-6 w-full">${img}</figure>`;
  });

  // 6) Final "Fonte: <name>" block (always last)
  const safeName = opts.sourceName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.trimEnd() + `\n<p>Fonte: <a href="${opts.sourceUrl}" target="_blank" rel="noopener">${safeName}</a></p>`;

  return html;
}

/**
 * Last-resort guarantee (plano §2.5): if the HTML still has zero `<img>` after
 * `enforceSeoHtml` (it shouldn't, but never publish a "sem imagem" post), inject
 * the fallback image as a figure right before the final "Fonte:" paragraph.
 */
export function ensureAtLeastOneImage(html: string, fallbackImageUrl: string, altText: string): string {
  if (/<img\b/i.test(html)) return html;
  const figure = `<figure class="my-6 w-full"><img src="${fallbackImageUrl}" alt="${altText.replace(/"/g, "&quot;")}" class="rounded-xl w-full h-auto" loading="lazy" /></figure>`;
  const sourceParaRe = /<p>\s*Fonte:[\s\S]*?<\/p>\s*$/i;
  if (sourceParaRe.test(html)) {
    return html.replace(sourceParaRe, (m) => `${figure}\n${m}`);
  }
  return html.trimEnd() + `\n${figure}`;
}
