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
  "site-novo",
];

// Endereços que dependem de conta (login, perfil, economia, feed...): mostram "volta em breve" (200, noindex) até as
// contas voltarem. Cada um sai desta lista quando a página for construída.
const ACCOUNT_PENDING = [
  "cadastro", "esqueci-senha", "redefinir-senha", "configuracoes", "perfil", "notificacoes", "salvos", "u/:username",
  "check-in", "missoes", "conquistas", "ranking", "loja", "premium", "rubi", "pagamentos", "convidar", "indicacoes",
  "convite/:code", "w/:code", "feed", "feed/post/:id", "mensagens", "explorar", "quarto", "animes/favoritos", "animes/seguindo",
  "blog/editor", "blog/dashboard",
];

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
  route("otaku-tv", "routes/otaku-tv.tsx"),
  route("quiz", "routes/quiz-list.tsx"),
  route("quiz/:slug", "routes/quiz.tsx"),
  route("figurinhas", "routes/figurinhas.tsx"),
  route("figurinhas/:slug", "routes/figurinha-album.tsx"),
  route("blog", "routes/blog-list.tsx"),
  route("blog/rss.xml", "routes/blog-feeds.ts", { id: "blog-rss" }),
  route("blog/criadores", "routes/redirect-temp.ts", { id: "blog-criadores" }),
  route("blog/categoria/:slug", "routes/blog-taxonomia.tsx", { id: "blog-categoria" }),
  route("blog/tag/:slug", "routes/blog-taxonomia.tsx", { id: "blog-tag" }),
  route("blog/u/:username/rss.xml", "routes/blog-feeds.ts", { id: "blog-rss-autor" }),
  route("blog/u/:username", "routes/blog-author.tsx"),
  route("blog/:username/:slug", "routes/blog-post.tsx"),
  route("animes", "routes/animes.tsx"),
  route("animes/calendario", "routes/animes-calendario.tsx"),
  route("animes/personagem/:id", "routes/personagem.tsx"),
  route("animes/:id", "routes/anime.tsx"),
  ...TEXT_PAGES.map((path) => route(path, "routes/pagina.tsx", { id: `pagina-${path}` })),
  route("contato", "routes/contato.tsx"),
  route("login", "routes/login.tsx"),
  route("sair", "routes/sair.ts"),
  route("admin/login", "routes/admin/login.tsx"),
  route("admin/sair", "routes/admin/sair.ts"),
  route("admin", "routes/admin/layout.tsx", [index("routes/admin/visitas.tsx")]),
  ...ACCOUNT_PENDING.map((path) => route(path, "routes/contas-em-breve.tsx", { id: `contas-${path}` })),
  route("robots.txt", "routes/robots.ts"),
  ...["sitemap.xml", "sitemap-static.xml", "sitemap-news.xml", "sitemap-articles.xml", "sitemap-taxonomy.xml", "sitemap-animes.xml", "sitemap-quiz.xml", "sitemap-blog.xml", "sitemap-figurinhas.xml", "rss.xml"].map((f) =>
    route(f, "routes/feeds.ts", { id: `feed-${f}` }),
  ),
  route("unsubscribe", "routes/unsubscribe.tsx"),
  route("api/public/payments/webhook", "routes/api.mp-webhook.ts", { id: "mp-webhook" }),
  route("api/public/payments/mercado-pago", "routes/api.mp-webhook.ts", { id: "mp-webhook-2" }),
  route("api/health", "routes/api.health.ts"),
  route("api/eu", "routes/api.eu.ts"),
  route("api/v", "routes/api.v.ts"),
  route("api/cron/:job", "routes/api.cron.ts"),
  route("api/importar/:what", "routes/api.importar.ts"),
  route("api/robo/:acao", "routes/api.robo.ts"),
] satisfies RouteConfig;
