// Menu do site, nos mesmos grupos do site antigo (sem Comunidades, Eventos e Games, que saíram).
import {
  Award,
  BookOpen,
  Home,
  MessagesSquare,
  MonitorPlay,
  Newspaper,
  PenSquare,
  Puzzle,
  Sofa,
  Sparkles,
  Trophy,
  Tv,
  type LucideIcon,
} from "lucide-react";

/** `soon`: depende de conta; o item continua no menu e leva à página "volta em breve". */
/** `also`: outros prefixos que mantêm o item ativo (ex.: News fica ativo em /noticias e em /artigos). */
/** `auth`: só aparece para quem está logado. Sem contas no ar (LOGGED_IN = false), some do menu; a página continua existindo. */
export type NavItem = { label: string; to: string; icon: LucideIcon; soon?: true; also?: string[]; auth?: true };
export type NavGroup = { label: string; items: NavItem[] };

/** Enquanto as contas não voltam, ninguém está logado. Quando o login existir, isto passa a vir da sessão. */
export const LOGGED_IN = false;

/** Menus visíveis: tira os itens `auth` de quem não está logado e some com grupos que ficarem vazios. */
export function visibleNav<T extends { items: { auth?: true }[] }>(groups: T[], loggedIn = LOGGED_IN): T[] {
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => loggedIn || !i.auth) })).filter((g) => g.items.length > 0);
}

export const NAV: NavGroup[] = [
  {
    label: "Descobrir",
    items: [
      { label: "Início", to: "/", icon: Home },
      { label: "News", to: "/noticias", icon: Newspaper, also: ["/artigos"] },
      { label: "Animes", to: "/animes", icon: Tv },
      { label: "Otaku TV", to: "/otaku-tv", icon: MonitorPlay },
      { label: "Quiz", to: "/quiz", icon: Puzzle },
    ],
  },
  {
    label: "Comunidade",
    items: [
      { label: "Feed", to: "/feed", icon: MessagesSquare, soon: true, auth: true },
      { label: "Blog", to: "/blog", icon: PenSquare, auth: true },
    ],
  },
  {
    label: "Recompensas",
    items: [
      { label: "Missões", to: "/missoes", icon: Award, soon: true, auth: true },
      { label: "Ranking", to: "/ranking", icon: Trophy, soon: true, auth: true },
    ],
  },
  {
    label: "Coleção",
    items: [
      { label: "Figurinhas", to: "/figurinhas", icon: Sparkles, auth: true },
      { label: "Quarto Otaku", to: "/quarto", icon: Sofa, soon: true, auth: true },
    ],
  },
];

/** Barra inferior do celular (abaixo de 1024 px). "Menu" abre a gaveta; quando as contas voltarem, Quiz dá lugar a Perfil. */
export const BOTTOM_NAV: { label: string; to: string; icon: LucideIcon; also?: string[] }[] = [
  { label: "Início", to: "/", icon: Home },
  { label: "News", to: "/noticias", icon: Newspaper, also: ["/artigos"] },
  { label: "Animes", to: "/animes", icon: Tv },
  { label: "Quiz", to: "/quiz", icon: Puzzle },
];

/** Menus extras do topo (ao lado do logo, a partir de `lg`). O menu principal fica na lateral esquerda. */
export const HEADER_LINKS: { label: string; to: string; badge?: string; external?: boolean }[] = [];

export const FOOTER_LINKS: NavGroup[] = [
  {
    label: "Conteúdo",
    items: [
      { label: "Notícias", to: "/noticias", icon: Newspaper },
      { label: "Artigos", to: "/artigos", icon: BookOpen },
      { label: "Animes", to: "/animes", icon: Tv },
      { label: "Quiz", to: "/quiz", icon: Puzzle },
    ],
  },
  {
    label: "Comunidade",
    items: [
      { label: "Feed", to: "/feed", icon: MessagesSquare, auth: true },
      { label: "Blog", to: "/blog", icon: PenSquare, auth: true },
      { label: "Ranking", to: "/ranking", icon: Trophy, auth: true },
      { label: "Figurinhas", to: "/figurinhas", icon: Sparkles, auth: true },
    ],
  },
];

export const INSTITUTIONAL: { label: string; to: string }[] = [
  { label: "Sobre", to: "/sobre" },
  { label: "Contato", to: "/contato" },
  { label: "Como instalar", to: "/como-instalar" },
];

export const LEGAL_LINKS: { label: string; to: string }[] = [
  { label: "Termos de uso", to: "/legal/termos" },
  { label: "Privacidade", to: "/legal/privacidade" },
  { label: "Cookies", to: "/legal/cookies" },
  { label: "Direitos autorais", to: "/legal/dmca" },
  { label: "Proteção a menores", to: "/legal/menores" },
  { label: "Padrões editoriais", to: "/legal/padroes-editoriais" },
];

export const SOCIAL = [
  { label: "Instagram", href: "https://www.instagram.com/animeprofilebr/" },
  { label: "X (Twitter)", href: "https://x.com/animeprofilebr" },
  { label: "TikTok", href: "https://www.tiktok.com/@animeprofilebr" },
];

/** Ativo quando a rota é a do item ou uma sub-rota dele. "/" só vale exato. */
export function isActive(pathname: string, to: string, also: string[] = []) {
  if (to === "/") return pathname === "/";
  return [to, ...also].some((t) => pathname === t || pathname.startsWith(`${t}/`));
}
