// Redirecionamentos permanentes (301) dos endereços do site antigo que saíram (docs/enderecos.md).
// Usado pelo server-app.js antes do React Router. Em JavaScript puro para rodar sem build.

const RULES = [
  // A lista de notícias é a /news (a mesma página); as matérias continuam em /noticias/<slug>.
  [/^\/noticias\/?$/, () => "/news?tipo=noticias"],
  [/^\/faca-parte\/?$/, () => "/contato"],
  [/^\/clas(\/.*)?$/, () => "/ranking"],
  [/^\/comunidades(\/.*)?$/, () => "/feed"],
  [/^\/eventos\/?$/, () => "/"],
  [/^\/(fig-battle(\/.*)?|jogo-da-memoria\/?|games\/?)$/, () => "/figurinhas"],
  [/^\/qg\/?$/, () => "/sobre"],
  [/^\/membros\/?$/, () => "/explorar"],
  [/^\/sitemap-en\.xml$/, () => "/sitemap.xml"],
  [/^\/en\/news\/(.+)$/, (m) => `/noticias/${m[1]}`],
  [/^\/en(\/.*)?$/, (m) => m[1] || "/"],
];

/** Destino do redirecionamento (com a query original) ou null. */
export function redirectFor(pathname, search = "") {
  for (const [re, to] of RULES) {
    const m = re.exec(pathname);
    if (m) {
      const target = to(m);
      // Junta a query original (ex.: ?pagina=2) com a do destino, se ele já tiver uma.
      return search && target.includes("?") ? `${target}&${search.replace(/^\?/, "")}` : target + search;
    }
  }
  return null;
}
