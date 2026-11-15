// Redirecionamentos permanentes (301) dos endereços do site antigo que saíram (docs/enderecos.md).
// Usado pelo server-app.js antes do React Router. Em JavaScript puro para rodar sem build.

const RULES = [
  // O blog saiu da central de notícias: /news?tipo=blog e /noticias?tipo=blog vão para /blog (sem a query).
  [/^\/(news|noticias)\/?$/, (_m, search) => (new URLSearchParams(search).get("tipo") === "blog" ? { to: "/blog" } : null)],
  // A central de notícias do site antigo (/news) agora é a /noticias; a query (?tipo, ?pagina) vai junto.
  [/^\/news\/?$/, () => "/noticias"],
  [/^\/faca-parte\/?$/, () => "/contato"],
  // Endereços do site antigo que não existem no novo (docs/plano-virada-parcial.md 2.3). Os 302 voltam com as contas.
  [/^\/privacidade\/?$/, () => "/legal/privacidade"],
  [/^\/(ajuda(\/.*)?|reportar-bug)\/?$/, () => ({ to: "/contato", status: 302 })],
  [/^\/links\/?$/, () => ({ to: "/", status: 302 })],
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

/** Destino e código (301, ou o que a regra pedir) do redirecionamento, ou null. */
export function redirectInfo(pathname, search = "") {
  for (const [re, to] of RULES) {
    const m = re.exec(pathname);
    if (m) {
      const target = to(m, search);
      if (target == null) continue;
      if (typeof target === "object") return { to: target.to, status: target.status ?? 301 };
      // Junta a query original (ex.: ?pagina=2) com a do destino, se ele já tiver uma.
      return { to: search && target.includes("?") ? `${target}&${search.replace(/^\?/, "")}` : target + search, status: 301 };
    }
  }
  return null;
}

/** Só o destino (301 ou 302), para os testes e quem não precisa do código. */
export const redirectFor = (pathname, search = "") => redirectInfo(pathname, search)?.to ?? null;
