// Redirecionamentos permanentes (301) dos endereços do site antigo que saíram (docs/enderecos.md).
// Usado pelo server-app.js antes do React Router. Em JavaScript puro para rodar sem build.

const RULES = [
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
    if (m) return to(m) + search;
  }
  return null;
}
