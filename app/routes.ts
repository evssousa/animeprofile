import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Os endereços seguem o site antigo (docs/enderecos.md).

// Páginas de texto em Markdown (app/content/paginas/<slug>.md, com "/" virando "-").
const TEXT_PAGES = [
  "sobre",
  "como-instalar",
  "legal/termos",
  "legal/privacidade",
  "legal/cookies",
  "legal/dmca",
  "legal/menores",
  "legal/padroes-editoriais",
];

// Endereços do menu que ainda não existem no site novo: mostram "em construção" com link para o
// site atual. Cada um sai desta lista quando a página for construída.
const PENDING = [
  "noticias",
  "artigos",
  "animes",
  "otaku-tv",
  "quiz",
  "feed",
  "blog",
  "missoes",
  "ranking",
  "figurinhas",
  "quarto",
  "busca",
  "login",
  "cadastro",
];

export default [
  index("routes/home.tsx"),
  ...TEXT_PAGES.map((path) => route(path, "routes/pagina.tsx", { id: `pagina-${path}` })),
  route("contato", "routes/contato.tsx"),
  route("faca-parte", "routes/faca-parte.tsx"),
  ...PENDING.map((path) => route(path, "routes/em-breve.tsx", { id: `em-breve-${path}` })),
  route("robots.txt", "routes/robots.ts"),
  route("api/health", "routes/api.health.ts"),
  route("api/cron/:job", "routes/api.cron.ts"),
] satisfies RouteConfig;
