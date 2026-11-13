import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Os endereços seguem o site antigo (docs/enderecos.md). Os que saíram redirecionam em redirects.mjs.

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
const PENDING = ["animes", "otaku-tv", "quiz", "feed", "blog", "missoes", "ranking", "figurinhas", "quarto", "login", "cadastro", "u/:username"];

export default [
  index("routes/home.tsx"),
  route("noticias", "routes/posts-list.tsx", { id: "lista-noticias" }),
  route("artigos", "routes/posts-list.tsx", { id: "lista-artigos" }),
  route("noticias/:slug", "routes/post.tsx", { id: "materia-noticia" }),
  route("artigos/:slug", "routes/post.tsx", { id: "materia-artigo" }),
  route("categoria/:slug", "routes/taxonomia.tsx", { id: "categoria" }),
  route("tag/:slug", "routes/taxonomia.tsx", { id: "tag" }),
  route("autores/:slug", "routes/taxonomia.tsx", { id: "autor" }),
  route("busca", "routes/busca.tsx"),
  ...TEXT_PAGES.map((path) => route(path, "routes/pagina.tsx", { id: `pagina-${path}` })),
  route("contato", "routes/contato.tsx"),
  ...PENDING.map((path) => route(path, "routes/em-breve.tsx", { id: `em-breve-${path}` })),
  route("robots.txt", "routes/robots.ts"),
  route("api/health", "routes/api.health.ts"),
  route("api/cron/:job", "routes/api.cron.ts"),
  route("api/importar/:what", "routes/api.importar.ts"),
] satisfies RouteConfig;
