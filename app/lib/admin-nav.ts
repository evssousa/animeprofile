// Barra lateral do painel /admin, nos grupos e na ordem do site antigo (components/admin/AdminLayout.tsx).
// `pronto`: a tela existe. As demais abrem uma página "em construção" (rota coringa do painel) até serem feitas, na ordem
// combinada com o dono (docs/plano-menus-logado.md): primeiro o que o recebimento de usuários exige, depois o resto.
// Itens a reavaliar com o dono: Títulos no Google, Sistemas, Agendamentos (talvez não façam mais sentido) e
// Quarto otaku (será refeito com three.js).
import {
  Activity,
  Album,
  Award,
  Bot,
  BookOpen,
  Bug,
  CalendarClock,
  CalendarDays,
  DollarSign,
  Flag,
  FolderTree,
  Frame,
  Image as ImageIcon,
  LayoutDashboard,
  Mail,
  Newspaper,
  PenLine,
  Power,
  Puzzle,
  SearchCheck,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Papel } from "./papeis";

export type AdminNavItem = { label: string; href: string; icon: LucideIcon; desc: string; papeis: Papel[]; pronto?: true; exact?: true };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

const ADMIN: Papel[] = ["admin"];

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { label: "Painel", href: "/admin", icon: LayoutDashboard, desc: "Visitas por dia, páginas e de onde vêm, sem cookie.", papeis: ["admin", "moderator"], pronto: true, exact: true },
      { label: "Métricas", href: "/admin/retention", icon: Activity, desc: "Funil, retenção, churn, NPS, receita e decisões.", papeis: ADMIN, pronto: true },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { label: "Posts", href: "/admin/posts", icon: Newspaper, desc: "Notícias e artigos: escrever, agendar e publicar.", papeis: ["admin", "author"] },
      { label: "Notícias IA", href: "/admin/ai-news", icon: Bot, desc: "Motor de notícias por IA, autores e desempenho.", papeis: ADMIN },
      { label: "Artigos com IA", href: "/admin/artigos-ia", icon: PenLine, desc: "Rascunhos de artigos evergreen para revisar e publicar.", papeis: ADMIN },
      { label: "Quizzes", href: "/admin/quizzes", icon: Puzzle, desc: "Quiz de personalidade e de conhecimento, com página própria em /quiz.", papeis: ADMIN },
      { label: "Títulos no Google", href: "/admin/titulos-google", icon: SearchCheck, desc: "Páginas com poucos cliques no Google: títulos novos e o antes e depois.", papeis: ADMIN },
      { label: "Quarto otaku", href: "/admin/quarto", icon: Sofa, desc: "Móveis da loja do quarto: imagem, tamanho, preço e teste no quarto.", papeis: ADMIN },
      { label: "Redes sociais", href: "/admin/redes-sociais", icon: Share2, desc: "Carrossel, imagem vertical e legenda de cada notícia para Instagram e TikTok.", papeis: ADMIN },
      { label: "Blog dos usuários", href: "/admin/blog", icon: BookOpen, desc: "Posts de blog que podem virar artigos oficiais.", papeis: ADMIN },
      { label: "Categorias e tags", href: "/admin/categories", icon: FolderTree, desc: "Organização das notícias e artigos.", papeis: ADMIN },
      { label: "Mídias", href: "/admin/media", icon: ImageIcon, desc: "Biblioteca de imagens enviadas.", papeis: ["admin", "author"] },
    ],
  },
  {
    label: "Moderação",
    items: [
      { label: "Denúncias", href: "/admin/denuncias", icon: Flag, desc: "Conteúdos denunciados pela comunidade.", papeis: ["admin", "moderator"] },
      { label: "Bug reports", href: "/admin/bug-reports", icon: Bug, desc: "Problemas relatados e recompensas.", papeis: ADMIN },
      { label: "Eventos", href: "/admin/eventos", icon: CalendarDays, desc: "Eventos da comunidade e emblemas das datas comemorativas.", papeis: ADMIN },
    ],
  },
  {
    label: "Usuários",
    items: [
      { label: "Usuários", href: "/admin/users", icon: Users, desc: "Contas, papéis, saldo, planos e bonificações.", papeis: ADMIN },
      { label: "Segurança", href: "/admin/seguranca", icon: ShieldAlert, desc: "Cadastros suspeitos, e-mails bloqueados, captcha, limites de contas novas e registro do painel.", papeis: ADMIN },
    ],
  },
  {
    label: "Economia e gamificação",
    items: [
      { label: "Molduras", href: "/admin/molduras", icon: Frame, desc: "Catálogo de molduras, encaixe e preços.", papeis: ADMIN },
      { label: "Emblemas", href: "/admin/emblemas", icon: Award, desc: "Emblemas personalizados e de nick.", papeis: ADMIN },
      { label: "Figurinhas", href: "/admin/figurinhas", icon: Album, desc: "Álbuns, figurinhas, sorteio e atributos do Fig Battle.", papeis: ADMIN },
      { label: "Níveis", href: "/admin/gamificacao", icon: Sparkles, desc: "Trilha de níveis e o que cada um dá.", papeis: ADMIN },
      { label: "Custos", href: "/admin/configuracoes", icon: SlidersHorizontal, desc: "Valores do sistema: preços, prêmios e limites.", papeis: ADMIN },
    ],
  },
  {
    label: "Financeiro",
    items: [{ label: "Receita", href: "/admin/finances", icon: DollarSign, desc: "Vendas, Rubis e reembolsos.", papeis: ADMIN }],
  },
  {
    label: "Sistema",
    items: [
      { label: "Sistemas", href: "/admin/sistemas", icon: Power, desc: "Ligar e desligar partes do site para manutenção.", papeis: ADMIN },
      { label: "Agendamentos", href: "/admin/agendamentos", icon: CalendarClock, desc: "Tarefas automáticas: ligadas, última execução e erros.", papeis: ADMIN },
      { label: "E-mails", href: "/admin/emails", icon: Mail, desc: "Registro de e-mails enviados e falhas.", papeis: ADMIN },
    ],
  },
];

/** O que cada papel enxerga na barra (admin vê tudo); some com grupos que ficarem vazios. */
export function adminNavVisivel(papeis: readonly string[]): AdminNavGroup[] {
  const pode = (i: AdminNavItem) => papeis.includes("admin") || i.papeis.some((p) => papeis.includes(p));
  return ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter(pode) })).filter((g) => g.items.length > 0);
}

export const adminItem = (pathname: string) => ADMIN_NAV.flatMap((g) => g.items).find((i) => i.href === pathname.replace(/\/$/, "")) ?? null;

export function adminAtivo(pathname: string, item: AdminNavItem) {
  const p = pathname.replace(/\/$/, "") || "/";
  return item.exact ? p === item.href : p === item.href || p.startsWith(`${item.href}/`);
}
