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

export type NavItem = { label: string; to: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Descobrir",
    items: [
      { label: "Início", to: "/", icon: Home },
      { label: "Notícias", to: "/noticias", icon: Newspaper },
      { label: "Artigos", to: "/artigos", icon: BookOpen },
      { label: "Animes", to: "/animes", icon: Tv },
      { label: "Otaku TV", to: "/otaku-tv", icon: MonitorPlay },
      { label: "Quiz", to: "/quiz", icon: Puzzle },
    ],
  },
  {
    label: "Comunidade",
    items: [
      { label: "Feed", to: "/feed", icon: MessagesSquare },
      { label: "Blog", to: "/blog", icon: PenSquare },
    ],
  },
  {
    label: "Recompensas",
    items: [
      { label: "Missões", to: "/missoes", icon: Award },
      { label: "Ranking", to: "/ranking", icon: Trophy },
    ],
  },
  {
    label: "Coleção",
    items: [
      { label: "Figurinhas", to: "/figurinhas", icon: Sparkles },
      { label: "Quarto Otaku", to: "/quarto", icon: Sofa },
    ],
  },
];

/** Menu do topo (computador). O celular usa os grupos completos de NAV. */
export const TOP_NAV: { label: string; to: string }[] = [
  { label: "Início", to: "/" },
  { label: "Notícias", to: "/noticias" },
  { label: "Animes", to: "/animes" },
  { label: "Otaku TV", to: "/otaku-tv" },
  { label: "Quiz", to: "/quiz" },
  { label: "Figurinhas", to: "/figurinhas" },
  { label: "Comunidade", to: "/feed" },
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
      { label: "Feed", to: "/feed", icon: MessagesSquare },
      { label: "Blog", to: "/blog", icon: PenSquare },
      { label: "Ranking", to: "/ranking", icon: Trophy },
      { label: "Figurinhas", to: "/figurinhas", icon: Sparkles },
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
export function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}
