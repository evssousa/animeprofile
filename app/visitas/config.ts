// Configuração do contador de visitas ESPECÍFICA DO SITE (animeprofile). Ao copiar o módulo para outro site, este arquivo,
// `db.ts`, `site.server.ts` e `ui/visitas.css` são os que mudam. Dados puros: nada de banco aqui.
import type { TipoPagina } from "./core/caminho";

/** Primeiros trechos dos endereços que dependem de conta (login, perfil, feed...) e hoje mostram "volta em breve". */
const CONTAS = "login|cadastro|esqueci-senha|redefinir-senha|configuracoes|perfil|notificacoes|salvos|u|check-in|missoes|conquistas|ranking|loja|premium|rubi|pagamentos|convidar|indicacoes|convite|w|feed|mensagens|explorar|quarto";

export const VISITAS = {
  site: "Anime Profile",
  /** Referrer destes endereços conta como navegação interna. */
  hosts: ["animeprofile.com.br", "www.animeprofile.com.br", "localhost"],
  /** Cookie da sessão do admin: quando presente, a visita não é contada. */
  cookieAdmin: "__ap_admin",
  /** Quantos dias guardar páginas e origens (os totais por dia ficam sem prazo). */
  retencaoDias: 400,
  /** A ordem importa: o primeiro tipo que bate vence. */
  tipos: [
    { tipo: "inicio", rotulo: "Página inicial", re: /^\/$/ },
    { tipo: "materia", rotulo: "Matéria", re: /^\/(noticias|artigos)\/[^/]+$/ },
    { tipo: "lista", rotulo: "Lista", re: /^\/blog\/(categoria|tag|u)\// },
    { tipo: "blog", rotulo: "Blog", re: /^\/blog\/[^/]+\/[^/]+$/ },
    { tipo: "personagem", rotulo: "Personagem", re: /^\/animes\/personagem\/\d+$/ },
    { tipo: "anime", rotulo: "Anime", re: /^\/animes\/\d+$/ },
    { tipo: "quiz", rotulo: "Quiz", re: /^\/quiz\/[^/]+$/ },
    { tipo: "figurinhas", rotulo: "Figurinhas", re: /^\/figurinhas\/[^/]+$/ },
    { tipo: "otaku-tv", rotulo: "Otaku TV", re: /^\/otaku-tv$/ },
    { tipo: "contas", rotulo: "Volta em breve", re: new RegExp(`^/(${CONTAS})(/|$)`) },
    { tipo: "lista", rotulo: "Lista", re: /^\/(noticias|artigos|categoria\/[^/]+|tag\/[^/]+|autores\/[^/]+|animes|animes\/calendario|quiz|blog|figurinhas|busca)$/ },
  ] as TipoPagina[],
  /** Abas do "Páginas mais vistas". `tipos: null` = todos. */
  filtros: [
    { id: "tudo", rotulo: "Tudo", tipos: null },
    { id: "materias", rotulo: "Matérias", tipos: ["materia"] },
    { id: "animes", rotulo: "Animes", tipos: ["anime", "personagem"] },
    { id: "quiz", rotulo: "Quiz", tipos: ["quiz"] },
    { id: "blog", rotulo: "Blog", tipos: ["blog"] },
    { id: "outras", rotulo: "Outras", tipos: ["inicio", "lista", "otaku-tv", "figurinhas", "contas", "outra"] },
  ] as { id: string; rotulo: string; tipos: string[] | null }[],
  /** Contadores por matéria: o endereço bate com `re` e o `sql` soma as visitas (primeiro parâmetro = quantidade). */
  contadores: [
    { re: /^\/(?:noticias|artigos)\/([^/]+)$/, sql: "UPDATE posts SET views_count = views_count + ? WHERE slug = ? AND status = 'published'", args: (m: RegExpMatchArray) => [m[1]] },
    {
      re: /^\/blog\/([^/]+)\/([^/]+)$/,
      sql: "UPDATE blog_posts b JOIN post_authors a ON a.id = b.author_id SET b.views_count = b.views_count + ? WHERE a.slug = ? AND b.slug = ? AND b.status = 'published'",
      args: (m: RegExpMatchArray) => [m[1], m[2]],
    },
  ],
  /** Títulos fixos das páginas que não são de um conteúdo. */
  fixos: {
    "/": "Página inicial",
    "/noticias": "Notícias",
    "/artigos": "Artigos",
    "/animes": "Animes",
    "/animes/calendario": "Calendário da semana",
    "/quiz": "Quiz",
    "/blog": "Blog",
    "/figurinhas": "Figurinhas",
    "/otaku-tv": "Otaku TV",
    "/busca": "Busca",
    "/sobre": "Sobre",
    "/contato": "Contato",
    "/site-novo": "Site novo",
    "/legal/termos": "Termos de uso",
    "/legal/privacidade": "Privacidade",
    "/legal/cookies": "Cookies",
  } as Record<string, string>,
};

export type ConfigVisitas = typeof VISITAS;
