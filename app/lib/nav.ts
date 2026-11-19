// Menu do site, nos mesmos grupos do site antigo (sem Comunidades, Eventos e Games, que saíram).
import {
  Award,
  Bell,
  BookOpen,
  CalendarCheck,
  Home,
  LayoutDashboard,
  MessageCircle,
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
import { EQUIPE, type Papel } from "./papeis";

/** `soon`: a página ainda é a "volta em breve" das contas (só serve de dado para os testes; o menu não mostra selo). */
/** `also`: outros prefixos que mantêm o item ativo (ex.: News fica ativo em /noticias e em /artigos). */
/** `auth`: só aparece para quem está logado. O HTML é igual para todos (cache da CDN): o CSS (`data-logado`) mostra, e o link só vira link no navegador de quem está logado. */
/** `papeis`: além de logado, exige algum destes papéis (o admin vê tudo). */
export type NavItem = { label: string; to: string; icon: LucideIcon; soon?: true; also?: string[]; auth?: true; papeis?: Papel[] };
export type NavGroup = { label: string; items: NavItem[] };

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
  {
    label: "Equipe",
    items: [{ label: "Administração", to: "/admin", icon: LayoutDashboard, auth: true, papeis: EQUIPE }],
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

/** Ações do topo de quem está logado, na ordem do site antigo (Check-in, Mensagens, Notificações). Saldos e nível voltam com a economia. */
export const HEADER_ACOES: { id: "checkin" | "mensagens" | "notificacoes"; label: string; icon: LucideIcon; to?: string }[] = [
  { id: "checkin", label: "Check-in do dia", icon: CalendarCheck, to: "/check-in" },
  { id: "mensagens", label: "Mensagens", icon: MessageCircle, to: "/mensagens" },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

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
