# Plano: menus de quem está logado e barra lateral do painel admin

Plano temporário, escrito em 2026-11-19 pelo planejador. Quatro entregas, **na ordem pedida pelo dono**: (1) menu
lateral logado, (2) itens da navbar logada, (3) menu do usuário (dropdown), (4) barra lateral do painel `/admin`.
Depende da fase 1 de [plano-contas-login.md](plano-contas-login.md) (feita em 2026-11-19). Nenhuma migration.

## Objetivo

Montar agora, no formato do site antigo, os menus que só quem está logado vê (lateral, topo, menu do usuário) e a barra
lateral do painel admin, mostrando o que existe e deixando o resto como "volta em breve", **sem mudar o HTML público**
(cache de 60 s da CDN) e sem criar links indexáveis para páginas "em breve".

## Contexto

- **Hoje:** só o administrador entra (`/login`, sessão das variáveis `ADMIN_*`). `getViewer`/`requireAdmin` em
  `app/server/auth/viewer.server.ts` devolvem `papeis: ["admin"]`. O cookie marcador `ap_logado=1` (sem segredo) faz o
  script do `<head>` (`app/lib/session-hint.ts`) pôr `data-logado` no `<html>`; a variante Tailwind `logado:`
  (`app/app.css`, linha 11) mostra o `UserMenu` e esconde "Entrar". `GET /api/eu` (`app/routes/api.eu.ts`, `no-store`)
  diz nome, inicial e papéis.
- **Menu lateral:** `app/lib/nav.ts` tem `LOGGED_IN = false` e `visibleNav()`, que **tira do HTML** os itens `auth`
  (Feed, Blog, Missões, Ranking, Figurinhas, Quarto Otaku) e os grupos vazios. Resultado: logado ou não, o menu só tem
  "Descobrir". Decisão de 2026-11-17 (itens só para logados) e de 2026-11-19 (escondidos também para o admin).
- **Topo:** `Header.tsx` tem logo, `HEADER_LINKS` (vazio), busca (formulário no desktop, ícone para `/busca` no
  celular), tema (só no celular) e `UserMenu` (avatar + "Administração" + "Sair").
- **Painel:** `app/routes/admin/layout.tsx` + `app/components/admin/AdminShell.tsx` (faixa escura com logo, selo
  "Painel", tema, "Ver o site", "Sair") e uma página só, `/admin` (Visitas, módulo `app/visitas/`).
- **Por que muda:** o dono quer os menus de logado já montados, no formato do antigo, porque o admin está logado e as
  contas voltam depois (fases 2 e 3, "não agora"). Destinos que não existem continuam em `ACCOUNT_PENDING`
  (`app/routes.ts`) → `routes/contas-em-breve.tsx` (200, `noindex`).

## O que o site antigo mostra (referência)

Código lido em `animeprofile-old/src`: `components/Sidebar.tsx`, `TopBar.tsx`, `MobileNav.tsx`, `MobileBottomNav.tsx`,
`NotificationsPopover.tsx`, `components/account/*`, `components/admin/AdminLayout.tsx`, `routes/admin*.tsx`.

### Parte 1: menu lateral (`Sidebar.tsx`)

Uma lista só, **sem títulos de grupo** (os arrays `main`, `community`, `rewards`, `games` são concatenados numa seção
sem título). Item ativo com degradê da marca. Bolinha rosa em "News" quando saiu notícia depois da última visita.

| Ordem | Rótulo | Ícone (lucide) | Destino | Quem vê |
|---|---|---|---|---|
| 1 | Início | Home | `/` | todos |
| 2 | News | Newspaper | `/news` | todos (bolinha de novidade) |
| 3 | Explorar | Compass | `/explorar` | só a conta dona (`username === "animeprofile"`) |
| 4 | Notícias | Newspaper | `/noticias` | só a conta dona |
| 5 | Artigos | BookOpen | `/artigos` | só a conta dona |
| 6 | Animes | Tv | `/animes` | todos |
| 7 | Otaku TV | MonitorPlay | `/otaku-tv` | todos |
| 8 | Quiz | Puzzle | `/quiz` | todos |
| 9 | Feed | MessagesSquare | `/feed` | todos |
| 10 | Comunidades | Users | `/comunidades` | todos (se o sistema estiver ligado) |
| 11 | Blog | PenSquare | `/blog` | só a conta dona |
| 12 | Missões | Award | `/missoes` | **só logado** |
| 13 | Eventos | PartyPopper | `/eventos` | todos (se o sistema estiver ligado) |
| 14 | Ranking | Trophy | `/ranking` | todos |
| 15 | Figurinhas | Sparkles | `/figurinhas` | todos ("motivo para criar conta") |
| 16 | Quarto Otaku | Sofa | `/quarto` | todos |
| 17 | Games | Gamepad2 | `/games` | todos (bolinha com missão de jogo aberta) |
| 18 | Administração | Settings2 | `/admin` | **admin ou moderador** |

Extras: na gaveta do celular, logado, dois chips no alto com **AP Coins** (âmbar, `Coins`) e **Rubis** (vermelho, `Gem`);
no pé, "Tema claro / escuro", a decoração das datas comemorativas e "Preferências de cookies" (só no celular).
`MobileBottomNav` (só logado, some no `/admin`): Início, Feed, Comunidades (ou Quiz), Figurinhas, Perfil.

### Parte 2: navbar logada (`TopBar.tsx`)

Da esquerda para a direita: botão da gaveta (celular), logo (celular), aba "Explorar" (só a conta dona), **busca global**
(campo no desktop; ícone que abre um diálogo no celular) e, só logado:

| Ordem | Elemento | Ícone | Comportamento |
|---|---|---|---|
| 1 | Check-in do dia | CalendarCheck | link `/check-in`; bolinha rosa se o check-in do dia está pendente |
| 2 | Mensagens | MessageCircle | link `/mensagens`; contador rosa de não lidas (`9+`) |
| 3 | Notificações | Bell | popover de 360 px: título "Notificações", link "No celular" (`/notificacoes`), "Marcar lidas", lista de 400 px (avatar do autor + ícone do tipo + texto + "há X"), vazio "Nenhuma interação ainda."; abrir marca tudo como lido; contador `9+` |
| 4 | Sequência | (StreakBadge) | chama da sequência de check-in |
| 5 | AP Coins | Coins | chip âmbar com o saldo; selo rosa com o multiplicador do Premium (1,5x/2x/3x) |
| 6 | Rubis | Gem | chip vermelho com o saldo |
| 7 | Avatar | — | 40 px, anel do plano Premium (ouro/prata/bronze) ou a moldura equipada; ao lado (≥ 640 px): nome na cor equipada, ícone do plano, emblema do nick, `ChevronDown` e a barra "Nv. N" com XP `x/y` |

Visitante: "Entrar" e "Cadastrar" (degradê). Carregando: círculo cinza pulsando.

### Parte 3: menu do usuário (dropdown do `TopBar.tsx`, 224 px)

| Bloco | Itens (ícone → destino) |
|---|---|
| Cabeçalho | o **e-mail** da conta (truncado) |
| Conta | Meu perfil (User → `/perfil`) · Editar Perfil (Settings2 → `/configuracoes`) · App e notificações (Smartphone → `/notificacoes`) · Loja (Sparkles → `/loja`) · Compartilhar perfil (Share2 → ação: `navigator.share` ou copia `/u/<usuario>`) |
| Atalhos | Salvos (Bookmark → `/salvos`) · Indicações (Gift → `/indicacoes`) · Pagamentos (Activity → `/pagamentos`) · Privacidade (ShieldCheck → `/privacidade`, a aba de privacidade da conta: visitas ao perfil, bloqueados, cookies, e-mails, LGPD) · Reportar bug (Bug → `/reportar-bug?de=<página>`) |
| Equipe | Administração (Settings2 → `/admin`), **só admin ou moderador** |
| Fim | Sair (LogOut, vermelho) |

Observação: o antigo **não** tinha "Premium" no menu do usuário (Premium aparecia no anel do avatar, no multiplicador
das moedas e num aviso de vencimento que levava a `/premium`).

### Parte 4: painel admin (`components/admin/AdminLayout.tsx`)

Barra lateral de 260 px (recolhível para 72 px, salvo em `localStorage`), gaveta (`Sheet`) no celular. No alto:
"ANIME PROFILE" (rosa, caixa alta) + "Administração" e o botão de recolher; **busca no menu** ("Buscar no painel…",
`Ctrl K` ou `/`); grupos com título; item ativo em degradê; **contador âmbar** de pendências em Denúncias e Bug reports;
no pé, cartão "Meu perfil" (avatar, nome, papel) e "Voltar ao site". Cabeçalho do conteúdo: grupo (rosa, caixa alta),
título e a descrição do item. Papéis: **admin** vê tudo; **autor** só Posts, Mídias e Escritório (entra em Posts);
**moderador** só Painel, Denúncias, WhatsApp e Escritório.

| Grupo | Item | Ícone | Rota | Papéis |
|---|---|---|---|---|
| Visão geral | Painel | LayoutDashboard | `/admin` | admin, moderador |
| | Ver escritório | Building2 | `/admin/escritorio` | admin, autor, moderador |
| | Métricas | Activity | `/admin/retention` | admin |
| Conteúdo | Posts | Newspaper | `/admin/posts` | admin, autor |
| | Notícias IA | Bot | `/admin/ai-news` | admin |
| | Artigos com IA | PenLine | `/admin/artigos-ia` | admin |
| | Quizzes | Puzzle | `/admin/quizzes` | admin |
| | WhatsApp | MessageCircle | `/admin/whatsapp` | admin, moderador |
| | Títulos no Google | SearchCheck | `/admin/titulos-google` | admin |
| | Quarto otaku | Sofa | `/admin/quarto` | admin |
| | Redes sociais | Share2 | `/admin/redes-sociais` | admin |
| | Blog dos usuários | BookOpen | `/admin/blog` | admin |
| | Categorias e tags | FolderTree | `/admin/categories` | admin |
| | Mídias | Image | `/admin/media` | admin, autor |
| Moderação | Denúncias (contador) | Flag | `/admin/denuncias` | admin, moderador |
| | Bug reports (contador) | Bug | `/admin/bug-reports` | admin |
| | Eventos | CalendarDays | `/admin/eventos` | admin |
| Usuários | Usuários | Users | `/admin/users` | admin |
| | Segurança | ShieldAlert | `/admin/seguranca` | admin |
| Economia e gamificação | Molduras | Frame | `/admin/molduras` | admin |
| | Emblemas | Award | `/admin/emblemas` | admin |
| | Figurinhas | Album | `/admin/figurinhas` | admin |
| | Níveis e recompensas | Sparkles | `/admin/gamificacao` | admin |
| | Custos e recompensas | SlidersHorizontal | `/admin/configuracoes` | admin |
| Financeiro | Receita | DollarSign | `/admin/finances` | admin |
| Sistema | Sistemas | Power | `/admin/sistemas` | admin |
| | Agendamentos | CalendarClock | `/admin/agendamentos` | admin |
| | E-mails | Mail | `/admin/emails` | admin |

Rotas sem item: `/admin/tags` (→ Categorias, aba tags), `/admin/grants` (→ Usuários), `/admin/setup` (primeiro admin).

## Decisões de design

### D1. Estado logado sem quebrar o cache da CDN (vale para as partes 1 a 3)

O HTML público continua **igual para todos**. Técnica, em três camadas:

1. **CSS antes de pintar (sem pulo).** Os itens só de logado saem no HTML **sempre**, dentro de um `<li>` com
   `hidden logado:block` (e os grupos inteiros só de logado com `hidden logado:block` no `<div>` do grupo). O script do
   `<head>` já põe `data-logado` antes da primeira pintura, então o admin vê o menu completo de cara, e o visitante nunca
   vê nada. Não há diferença entre o HTML do servidor e o da hidratação (o atributo está no `<html>`, que já tem
   `suppressHydrationWarning`), então **não há erro de hidratação**.
2. **Papéis também no marcador.** O `ap_logado` passa a carregar os papéis: `ap_logado=admin` (vários: `admin.moderator`;
   usuário comum sem papel: `ap_logado=1`). O script do `<head>` põe `data-logado="1"` e, se o valor não for `1`,
   `data-papeis="admin moderator"` (pontos viram espaços). Variantes novas em `app.css`:
   `papel-admin:` (`[data-papeis~="admin"]`) e `equipe:` (admin **ou** moderador, como o "Administração" do antigo).
   Assim os itens por papel também aparecem antes de pintar. `/api/eu` confirma: se os papéis da resposta forem
   diferentes do atributo, atualiza `data-papeis` e devolve o marcador certo (`Set-Cookie` só quando o valor recebido for
   diferente, para não esticar o prazo). O marcador **não dá acesso a nada**: quem editar o cookie vê o link
   "Administração", mas `/admin` continua exigindo a sessão (`requireAdmin`).
3. **Sem links para "em breve" no HTML público (SEO).** Dentro do `<li>` escondido, o item de logado **não** é um `<a>`
   no HTML do servidor: é um `<span>` com as mesmas classes (mesma altura, sem pulo). Depois de montar, um hook
   `useMarcador()` lê `data-logado`/`data-papeis` e, só se a pessoa estiver logada (e tiver o papel), troca o `<span>` pelo
   `NavLink`. O Googlebot não tem o cookie, então nem o HTML nem a página renderizada por ele têm `href="/missoes"`,
   `href="/feed"` etc. Sobra no HTML só o texto dos rótulos escondidos (inofensivo). Os itens que apontam para páginas
   reais (Blog, Figurinhas) seguem a mesma regra por simplicidade (eles já são linkados pelo sitemap e pela home).

Consequências: (a) o `visibleNav()` e o `LOGGED_IN` saem (o filtro passa a ser do CSS); (b) se `/api/eu` disser
`logado:false`, o `clearSessionHint()` tira os atributos e os itens somem (raro: sessão vencida); (c) o rodapé
**não muda** (a coluna "Comunidade" continua escondida para todos; mostrar só para logado mudaria a grade de colunas).

### D2. Papéis sem tabela de usuários

- O tipo `Papel` ("admin" | "moderator" | "author") muda de `viewer.server.ts` para `app/lib/papeis.ts` (arquivo que
  roda nos dois lados), com `export function podeVer(papeisDoItem: Papel[] | undefined, papeis: Papel[])`: sem
  `papeisDoItem` → todos os logados; com → precisa ter **algum** deles; `admin` vê tudo. `viewer.server.ts` reexporta o
  tipo (quem importa de lá não muda).
- **Menus públicos (partes 1 a 3):** papel lido do `data-papeis` (D1) e confirmado por `/api/eu`.
- **Painel (parte 4):** o `loader` do `admin/layout.tsx` já roda `requireAdmin` (sem cache), então devolve
  `{ nome, inicial, papeis }` e a barra lateral filtra **no servidor** com `podeVer`. Na fase 2, quando moderador e autor
  existirem, só `requireAdmin` vira `requireEquipe` (decisão da fase 2, fora deste plano); os itens já levam os papéis
  do antigo.

### D3. Regra para cada item: aparece, "em breve" ou fica de fora

- **Aparece (real):** a página existe no site novo.
- **"Em breve" (aparece com o selo):** o sistema volta com as contas/economia/chat **e** já tem endereço em
  `ACCOUNT_PENDING`. Como esses itens só aparecem para quem está logado (hoje, só o admin), não confundem o leitor e não
  viram links indexáveis (D1). Servem de prévia do menu completo, que é o pedido do dono.
- **De fora:** o sistema saiu do site (Comunidades, Eventos, Games, Clãs, `/en`), ou o item não tem como funcionar sem
  dado (saldos, contadores), ou era um atalho pessoal do dono no antigo.
- Saldos (AP Coins, Rubis, nível, sequência) **nunca** aparecem com valor falso: mostrar "0" assustaria quem tinha saldo
  (a página "em breve" promete que o saldo "volta exatamente como estava").

### D4. Visual geral

**Direção:** é o mesmo site, com mais itens; nada de tela nova chamativa. Identidade "Top 10 claro" (papel rosado, topo
escuro, vermelho da marca só no ativo e nos destaques, Sora). Nada do degradê e do brilho do antigo: o formato (ordem,
grupos, rótulos, ícones, blocos do dropdown, barra do admin) vem do antigo; a pele é a do site novo. O olho vê primeiro
o item ativo e o avatar; o selo "em breve" é discreto (cinza), para não competir.

**Tokens** (de `app/app.css`; não criar cores novas):

| Uso | Claro | Escuro |
|---|---|---|
| `paper` (fundo) | `#faf7f7` | `#121014` |
| `surface` (lateral, painéis) | `#ffffff` | `#1b171a` |
| `sunken` (hover, selo) | `#f4eded` | `#231e21` |
| `line` (bordas, separadores) | `#efe6e6` | `#2f282b` |
| `ink` / `ink-soft` | `#1c1414` / `#6e5f5f` | `#f4eff0` / `#ab9d9f` |
| `brand` / `brand-ink` | `#c2352b` / `#ffffff` | `#c2352b` / `#ffffff` |
| `brand-soft` (ativo) | `#fbedec` | `#3a1b19` |
| `night` / `night-ink` (topo) | `#0d0d10` / `#f4f4f6` | `#0b0b0e` / `#f4f4f6` |
| `glow` (texto ativo no escuro) | `#ff9a90` | `#ff9a90` |

- **Fonte:** Sora. Itens de menu `text-[0.95rem] font-semibold`; títulos de grupo `text-[0.75rem] font-bold uppercase
  tracking-[0.14em] text-ink-soft` (o padrão atual do `SideNav`).
- **Selo "em breve":** o atual do `SideNav`: `rounded-full bg-sunken px-1.5 py-0.5 text-[0.65rem] font-bold text-ink-soft
  whitespace-nowrap`. Reusar em todos os menus (extrair para `app/components/layout/SeloEmBreve.tsx`).
- **Raios:** itens `rounded-xl`; painéis flutuantes `rounded-2xl`; avatar `rounded-full`.
- **Sombra dos painéis flutuantes:** `shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]` (a do `UserMenu` atual).
- **Foco:** o global do `app.css` (`outline 2px #2b5bd7`); nos itens, também `focus-visible:bg-sunken`.
- **Movimento:** abrir painéis com `opacity` + `translate-y-1 → 0` em 120 ms; tudo com `motion-reduce:transition-none`.

## Parte 1 — Menu lateral logado

### O que o site novo mostra

Mantém os **grupos com título** do site novo (Descobrir, Comunidade, Recompensas, Coleção), na ordem do antigo, e
acrescenta o grupo **Equipe** no fim (o "Administração" do antigo, que ficava como último item).

| Grupo | Item | Ícone | Destino | Visitante | Logado | Situação |
|---|---|---|---|---|---|---|
| Descobrir | Início | Home | `/` | sim | sim | real |
| | News | Newspaper | `/noticias` (ativo em `/artigos`) | sim | sim | real |
| | Animes | Tv | `/animes` | sim | sim | real |
| | Otaku TV | MonitorPlay | `/otaku-tv` | sim | sim | real |
| | Quiz | Puzzle | `/quiz` | sim | sim | real |
| Comunidade | Feed | MessagesSquare | `/feed` | não | sim | **em breve** |
| | Blog | PenSquare | `/blog` | não | sim | real (leitura) |
| Recompensas | Missões | Award | `/missoes` | não | sim | **em breve** |
| | Ranking | Trophy | `/ranking` | não | sim | **em breve** |
| Coleção | Figurinhas | Sparkles | `/figurinhas` | não | sim | real (catálogo) |
| | Quarto Otaku | Sofa | `/quarto` | não | sim | **em breve** |
| Equipe | Administração | LayoutDashboard | `/admin` | não | admin ou moderador | real |

**De fora:** Explorar, Notícias e Artigos (atalhos só da conta dona no antigo; "News" já cobre os dois e `/explorar` é
"em breve"), Comunidades, Eventos e Games (saíram do site; redirecionam), a bolinha de novidade de News e de Games
(depende de dado por pessoa; pode voltar depois), os chips de AP Coins e Rubis da gaveta (economia), a decoração das
datas e "Preferências de cookies" (não existem no site novo). A barra inferior do celular **não muda** nesta entrega
(o "Quiz → Perfil" para logado fica para a fase 2, quando existir perfil).

### Wireframes

1440 px, admin logado, claro (lateral de 256 px; o escuro troca só os tokens):

```
┌ TOPO night 72px ─────────────────────────────────────────────────────────────────────┐
├──────────────────────────┬───────────────────────────────────────────────────────────┤
│ DESCOBRIR                │                                                           │
│ ▌⌂ Início   (brand-soft) │   conteúdo da página                                      │
│  ▤ News                  │                                                           │
│  ▭ Animes                │                                                           │
│  ▶ Otaku TV              │                                                           │
│  ✚ Quiz                  │                                                           │
│ COMUNIDADE               │                                                           │
│  ☰ Feed       [em breve] │                                                           │
│  ✎ Blog                  │                                                           │
│ RECOMPENSAS              │                                                           │
│  ✪ Missões    [em breve] │                                                           │
│  🏆 Ranking   [em breve] │                                                           │
│ COLEÇÃO                  │                                                           │
│  ✦ Figurinhas            │                                                           │
│  ⌂ Quarto Otaku[em breve]│                                                           │
│ EQUIPE                   │                                                           │
│  ▦ Administração         │                                                           │
│ ──────────────────────── │                                                           │
│ Tema claro / escuro   ☾  │                                                           │
│ Sobre Contato Privacidade│                                                           │
│ ⇤ Recolher menu          │                                                           │
└──────────────────────────┴───────────────────────────────────────────────────────────┘
```

- Visitante em 1440 px: exatamente como hoje (só "Descobrir").
- Recolhida (72 px, `mini` ou 1024 a 1279 px): só ícones, traço de 32 px entre grupos (já existe), selo some, `title`
  "Feed (em breve)".

375 px (gaveta aberta pelo "Menu" da barra inferior), admin logado:

```
┌ [logo]                       ✕ ┐  night 60px
│ [🔍 Buscar notícias, animes...] │
│ DESCOBRIR                       │
│  Início · News · Animes ·       │  (um por linha, 40px)
│  Otaku TV · Quiz                │
│ COMUNIDADE                      │
│  Feed            [em breve]     │
│  Blog                           │
│ RECOMPENSAS                     │
│  Missões         [em breve]     │
│  Ranking         [em breve]     │
│ COLEÇÃO                         │
│  Figurinhas                     │
│  Quarto Otaku    [em breve]     │
│ EQUIPE                          │
│  Administração                  │
│ ┌ (A) Administrador ──────────┐ │  UserMenuDrawer (parte 3)
│ └─────────────────────────────┘ │
│ Tema claro / escuro          ☾  │
└─────────────────────────────────┘
```

### Componentes e estados

- **`NavGroups`** (`SideNav.tsx`): passa a receber `NAV` inteiro (sem `visibleNav`). Para cada grupo, `soLogado` =
  todos os itens têm `auth`; o `<div>` do grupo ganha `hidden logado:block` quando `soLogado`, e o grupo Equipe ganha
  `hidden equipe:block`. Cada `<li>` de item `auth` ganha `hidden logado:block`; item com `papeis` = `EQUIPE` usa
  `hidden equipe:block`, e com só `admin`, `hidden papel-admin:block` (as classes ficam escritas por extenso num mapa
  no código, para o Tailwind enxergá-las).
- **Item de logado (`ItemLogado`):** antes de montar, ou se `useMarcador()` disser que não está logado, `<span
  aria-hidden="true">` com as mesmas classes do link e o mesmo conteúdo (ícone, rótulo, selo). Logado e montado:
  o `NavLink` de sempre (`aria-current`, `title`, `onNavigate`).
- **Estados:**
  - *Visitante:* itens e grupos `display:none`; nenhum `href` para "em breve".
  - *Carregando (marcador presente, `/api/eu` sem resposta):* itens já visíveis (CSS) e clicáveis assim que hidrata.
  - *Erro de rede no `/api/eu`:* o `UserMenu` já tira `data-logado` nesta visita → os itens somem junto com o avatar.
  - *Sessão vencida (`logado:false`):* `clearSessionHint()` apaga o marcador e os atributos → somem.
  - *Sem papel (logado comum, fase 2):* grupo Equipe escondido.
- **Ativo:** igual hoje (`brand-soft`, barra de 3 px `brand`, `dark:text-glow`). Item "em breve" ativo (o admin abriu
  `/feed`): mesmo estilo de ativo.
- **Acessibilidade:** `<nav aria-label="Menu principal">` (já existe); `<span>` de reserva com `aria-hidden` (não é
  focável nem lido); o link real tem `title` com "(em breve)" e, nos "em breve", o selo é texto visível (lido pelo leitor).
- **Convívio:** `FadeScroll` continua (mais itens = a borda de baixo desvanece); `contas-em-breve.tsx` continua achando
  o rótulo em `NAV` (os itens não mudam de lugar).

## Parte 2 — Navbar logada

### O que o site novo mostra

| Elemento do antigo | No site novo | Por quê |
|---|---|---|
| Busca global | **real, sem mudança** (campo ≥ 1024 px; ícone `/busca` no celular) | já existe e funciona igual para todos |
| Notificações (sino) | **aparece para logado**, com o popover no formato do antigo em **estado vazio honesto** | é o elemento mais reconhecível do topo logado; não há dado ainda, então nada de contador e nada de consulta |
| Check-in do dia | **de fora até a economia** (fase D), registrado em `HEADER_ACOES` desligado | ícone sem efeito; a página é "em breve" |
| Mensagens | **de fora até o chat** (fase 4), desligado em `HEADER_ACOES` | idem |
| Sequência, AP Coins, Rubis, multiplicador Premium | **de fora até a economia** | nunca mostrar saldo falso (D3) |
| Nome + nível + barra de XP no gatilho | **só o nome** (como hoje) | não há nível; volta com a economia |
| Anel do Premium, moldura, cor do nome, emblema | **de fora** | dependem de perfil e loja |
| Aba "Explorar" (conta dona) | **de fora** | atalho pessoal do antigo; `/explorar` é "em breve" |
| "Entrar" / "Cadastrar" (visitante) | sem mudança ("Entrar" + "Contas em breve") | fase 1 |

Estrutura para o futuro: `HEADER_ACOES` em `app/lib/nav.ts`, lista na ordem do antigo:
`[{ id: "checkin", label: "Check-in do dia", icon: CalendarCheck, to: "/check-in", ligado: false },
{ id: "mensagens", label: "Mensagens", icon: MessageCircle, to: "/mensagens", ligado: false },
{ id: "notificacoes", label: "Notificações", icon: Bell, ligado: true }]`. O topo renderiza só os `ligado`. Ligar
check-in e mensagens é trocar a flag (ou a pergunta 2 abaixo).

### Wireframes

1440 px, admin logado (claro e escuro iguais: o topo é sempre `night`):

```
[logo] Anime Profile      (🔍 Buscar notícias, animes...      )      🔔   ( (A) Administrador ˅ )
                                                                     ┌──────────── 360 px ───────────┐
                                                                     │ Notificações                   │
                                                                     │────────────────────────────────│
                                                                     │            🔔 (48px, 40%)      │
                                                                     │   Nenhuma notificação ainda    │
                                                                     │  Curtidas, respostas e avisos  │
                                                                     │  voltam junto com as contas.   │
                                                                     └────────────────────────────────┘
```

375 px, admin logado: `[logo]          🔍  🔔  (A)` (o botão de tema do topo some para logado abaixo de 400 px; o tema
continua no pé da gaveta). Visitante em 375 px: igual hoje (`🔍 ☾ [Em breve]`).

### Componentes e estados

- **`Notificacoes`** (novo, `app/components/layout/Notificacoes.tsx`), dentro de um `<div className="relative hidden
  logado:flex!">` (mesmo padrão do `UserMenu`), logo antes do `<UserMenu />` no `Header.tsx`.
  - **Gatilho:** `button` `grid size-11 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white`,
    ícone `Bell` 20 px, `aria-label="Notificações"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`.
    Sem contador (não há dado). Espaço do contador previsto: `absolute top-1.5 right-1.5 min-w-4 h-4 rounded-full
    bg-brand text-[0.65rem] font-bold text-brand-ink` (não renderizar agora).
  - **Painel:** `role="dialog"` `aria-labelledby` no título; `absolute top-[calc(100%+8px)] right-0 z-40
    w-[min(22.5rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface text-ink` + a sombra padrão. Cabeçalho
    `flex items-center justify-between border-b border-line px-4 py-3`, título "Notificações" `text-[0.95rem]
    font-bold`. Corpo vazio `px-6 py-10 text-center`: `Bell` 40 px `text-ink-soft/40`, "Nenhuma notificação ainda"
    (`font-semibold`), "Curtidas, respostas e avisos voltam junto com as contas." (`text-[0.85rem] text-ink-soft`). Sem
    "Marcar lidas" e sem "No celular" (voltam com o dado).
  - **Estados:** carregando (marcador presente, `/api/eu` sem resposta) → gatilho visível mas `disabled` com
    `opacity-60`; pronto → abre; erro → some junto com o avatar (o `div` usa `logado:`). Vazio = o único estado com
    conteúdo agora.
  - **Teclado:** `Enter`/`Espaço` abre e põe o foco no título (`tabIndex={-1}`); `Esc` fecha e devolve o foco ao sino;
    clique fora e troca de página fecham. Abrir o sino fecha o menu do usuário e vice-versa (um estado
    `painelAberto: "sino" | "conta" | null` simples, ou cada um fecha no `mousedown` fora, que já resolve).
- **Tema no celular:** no `Header.tsx`, o `ThemeToggle` do topo (hoje `lg:hidden`) ganha `logado:max-[399px]:hidden`.
- **Busca:** nada muda.

## Parte 3 — Menu do usuário (dropdown)

### O que o site novo mostra

Lista nova `USER_MENU` em `app/lib/nav.ts` (grupos, na ordem do antigo). Usada pelo dropdown do topo **e** pela gaveta
(`UserMenuDrawer`). Itens "em breve" aparecem com o selo e levam à página "volta em breve" (o menu só existe no
navegador, depois de `/api/eu`, então não há SEO envolvido).

| Bloco | Item | Ícone | Destino | Situação | Papéis |
|---|---|---|---|---|---|
| Cabeçalho | avatar 40 px + nome + subtítulo | — | — | real | todos |
| Conta | Meu perfil | User | `/perfil` | em breve | todos |
| | Editar perfil | Settings2 | `/configuracoes` | em breve | todos |
| | App e notificações | Smartphone | `/notificacoes` | em breve | todos |
| | Loja | ShoppingBag | `/loja` | em breve | todos |
| | Premium | Crown | `/premium` | em breve | todos |
| Atalhos | Salvos | Bookmark | `/salvos` | em breve | todos |
| | Indicações | Gift | `/indicacoes` | em breve | todos |
| | Pagamentos | Receipt | `/pagamentos` | em breve | todos |
| | Privacidade e dados | ShieldCheck | `/configuracoes` | em breve | todos |
| | Reportar um problema | Bug | `/contato` | **real** | todos |
| Equipe | Administração | LayoutDashboard | `/admin` | real | admin, moderador |
| Fim | Sair | LogOut | `POST /sair` | real | todos |

- **Premium entra** (o antigo não tinha no menu): o dono citou o item e `/premium` já é "em breve"; fica ao lado de Loja.
- **"Reportar um problema" vai para `/contato`**: `/reportar-bug` já redireciona para lá (`redirects.mjs`); usar o
  destino final evita um redirecionamento.
- **"Privacidade e dados" vai para `/configuracoes`** ("em breve"): `/privacidade` virou a política (`/legal/privacidade`),
  e a aba de privacidade da conta volta dentro das configurações.
- **De fora:** "Compartilhar perfil" (não há perfil público; volta na fase 2), o e-mail no cabeçalho (decisão da fase 1:
  sem e-mail na tela).
- **Subtítulo do cabeçalho:** "Equipe Anime Profile" se tiver `admin` ou `moderator`; senão, nada (na fase 2,
  `@usuario`).
- `contas-em-breve.tsx`: o rótulo passa a ser procurado também em `USER_MENU` (ex.: `/salvos` → "Salvos volta em breve").

### Wireframes

1440 px, aberto (claro; no escuro `surface #1b171a`, `line #2f282b`):

```
                                             ( (A) Administrador ˅ )
                                ┌──────────────── 288 px ────────────────┐
                                │ (A)  Administrador                      │
                                │      Equipe Anime Profile               │
                                │ ─────────────────────────────────────── │
                                │ ☺  Meu perfil                [em breve] │
                                │ ⚙  Editar perfil             [em breve] │
                                │ ▯  App e notificações        [em breve] │
                                │ 🛍  Loja                      [em breve] │
                                │ ♛  Premium                   [em breve] │
                                │ ─────────────────────────────────────── │
                                │ 🔖 Salvos                    [em breve] │
                                │ 🎁 Indicações                [em breve] │
                                │ 🧾 Pagamentos                [em breve] │
                                │ 🛡  Privacidade e dados       [em breve] │
                                │ 🐞 Reportar um problema                 │
                                │ ─────────────────────────────────────── │
                                │ ▦  Administração                        │
                                │ ─────────────────────────────────────── │
                                │ ⎋  Sair                     (vermelho)  │
                                └─────────────────────────────────────────┘
```

375 px: o mesmo painel alinhado à direita, `w-[min(18rem,calc(100vw-2rem))]`, com `max-h-[calc(100dvh-80px)]
overflow-y-auto overscroll-contain` (com 13 linhas ele passa da altura em celular deitado). Na gaveta, o mesmo conteúdo
dentro do cartão `UserMenuDrawer` (sem rolagem própria; a gaveta já rola).

### Componentes e estados

- **`Itens`** (em `UserMenu.tsx`) passa a percorrer `USER_MENU`: separador `my-1 h-px bg-line` entre blocos; bloco
  Equipe filtrado com `podeVer`; "Sair" fica fixo no fim (formulário de hoje).
- **Item:** `flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[0.92rem] font-semibold hover:bg-sunken
  focus-visible:bg-sunken focus-visible:outline-none`, ícone 18 px `text-ink-soft` (o do Sair continua `text-brand
  dark:text-glow`), rótulo `min-w-0 flex-1 truncate`, `SeloEmBreve` `ml-auto shrink-0`. Item "em breve" com
  `aria-label="<rótulo> (em breve)"`.
- **Largura:** `w-72` (288 px) no desktop, para o selo não apertar o rótulo.
- **Estados:** carregando → gatilho com o círculo pulsando (já existe), menu não abre; pronto → lista; erro → some
  (já existe); sem papel → sem o bloco Equipe.
- **Teclado e aria:** o que já existe (`role="menu"`/`menuitem`, foco no primeiro item, setas, `Esc`, clique fora,
  troca de página). Acrescentar `Home`/`End` (primeiro/último item).

## Parte 4 — Barra lateral do painel admin

### O que o site novo mostra

O `AdminShell` vira o layout com barra lateral, no formato do antigo, mas reaproveitando a pele do próprio site (topo
`night` + lateral `surface`, como as páginas públicas). Lista `ADMIN_NAV` em `app/lib/admin-nav.ts`, com todos os itens
do antigo e um `estado` em cada um: `"ok"` (link), `"em-breve"` (aparece, sem link), `"depois"` (fica no código,
**não aparece** até a fase dele) e os "fora" nem entram no arquivo (só nesta tabela).

| Grupo | Item | Ícone | Rota | Estado | Papéis | Motivo |
|---|---|---|---|---|---|---|
| Visão geral | **Visitas** | LayoutDashboard | `/admin` | **ok** | admin | é o painel de hoje (ocupa o lugar do "Painel") |
| | Métricas | Activity | `/admin/retention` | depois (contas) | admin | funil, retenção e receita pedem contas |
| | Ver escritório | Building2 | — | fora | — | o QG 3D saiu (`/qg` → `/sobre`) |
| Conteúdo | Posts | Newspaper | `/admin/posts` | em breve | admin, author | matérias já estão no banco; editor é a próxima grande peça |
| | Notícias IA | Bot | `/admin/ai-news` | em breve | admin | o robô roda (só por `/api/robo/*`); falta a tela |
| | Quizzes | Puzzle | `/admin/quizzes` | em breve | admin | quizzes no banco, sem editor |
| | Blog dos usuários | BookOpen | `/admin/blog` | em breve | admin | blog no banco (leitura) |
| | Categorias e tags | FolderTree | `/admin/categories` | em breve | admin | taxonomia no banco |
| | Mídias | Image | `/admin/media` | em breve | admin, author | imagens em `/media` |
| | Redes sociais | Share2 | `/admin/redes-sociais` | depois (robôs, fase 5) | admin | robô de redes ainda não voltou |
| | Quarto otaku | Sofa | `/admin/quarto` | depois (economia) | admin | loja do quarto |
| | WhatsApp | MessageCircle | — | fora | — | não há grupo nem rotina no site novo |
| | Títulos no Google | SearchCheck | — | fora | — | dependia do Search Console ligado ao painel antigo |
| | Artigos com IA | PenLine | — | fora | — | o robô novo só faz notícias; volta se o robô de artigos voltar |
| Moderação | Denúncias | Flag | `/admin/denuncias` | depois (contas) | admin, moderator | sem comentários de usuários |
| | Bug reports | Bug | `/admin/bug-reports` | depois (contas) | admin | relatos vão por e-mail (Contato) |
| | Eventos | CalendarDays | — | fora | — | Eventos saíram |
| Usuários | Usuários | Users | `/admin/users` | depois (contas) | admin | |
| | Segurança | ShieldAlert | `/admin/seguranca` | depois (contas) | admin | |
| Economia e gamificação | Figurinhas | Album | `/admin/figurinhas` | em breve | admin | catálogo já no banco |
| | Molduras, Emblemas, Níveis e recompensas, Custos e recompensas | Frame, Award, Sparkles, SlidersHorizontal | `/admin/molduras` etc. | depois (economia) | admin | |
| Financeiro | Receita | DollarSign | `/admin/finances` | depois (economia) | admin | |
| Sistema | Agendamentos | CalendarClock | `/admin/agendamentos` | em breve | admin | o cron roda (robô, agenda semanal, limpeza); falta a tela |
| | E-mails | Mail | `/admin/emails` | depois (contas/SMTP) | admin | |
| | Sistemas | Power | — | fora | — | ligava Comunidades e Eventos, que saíram |

Resultado hoje: 4 grupos visíveis (Visão geral 1 item, Conteúdo 6, Economia e gamificação 1, Sistema 1), 9 itens, 1
real. **Sem busca no menu** (o antigo tinha "Buscar no painel… Ctrl K" com 28 itens; com 9 não vale; volta quando
passar de 15 itens visíveis). **Sem contadores** (a estrutura `badge` fica para Denúncias e Bug reports na fase 2).

**Específico do animeprofile** (os irmãos têm abas no topo: respawnou `app/components/admin-ui.tsx` com 6 abas; criasite
e vibecoin com o `layout.tsx`/shell deles): a barra lateral com grupos, os itens "em breve", o `admin-nav.ts` e o
`AdminShell` ficam **fora** do módulo copiável `app/visitas/`. Os irmãos continuam com o painel deles.

### Wireframes

1440 px, claro (no escuro: lateral `#1b171a`, fundo `#121014`, linhas `#2f282b`; topo `night` igual):

```
┌ night 56px: [logo] (PAINEL)                                   ☾   Ver o site ↗   ⎋ Sair ┐
├────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ ANIME PROFILE (brand)      │                                                             │
│ Administração          ⇤   │   Visitas  (h1 da página, 1.75rem)                          │
│                            │   [cartões Hoje / 7 dias / 30 dias]                         │
│ VISÃO GERAL                │   [gráfico de 30 dias]                                      │
│ ▌▦ Visitas   (brand-soft)  │   [páginas]  [origens]                                      │
│ CONTEÚDO                   │                                                             │
│  ▤ Posts        [em breve] │   conteúdo: max-w-[1200px], px-8 py-8                       │
│  ⚙ Notícias IA  [em breve] │                                                             │
│  ✚ Quizzes      [em breve] │                                                             │
│  ✎ Blog dos usuários [e.b.]│                                                             │
│  ▣ Categorias e tags [e.b.]│                                                             │
│  ▨ Mídias       [em breve] │                                                             │
│ ECONOMIA E GAMIFICAÇÃO     │                                                             │
│  ▤ Figurinhas   [em breve] │                                                             │
│ SISTEMA                    │                                                             │
│  ⏲ Agendamentos [em breve] │                                                             │
│ ────────────────────────── │                                                             │
│ (A) Administrador          │                                                             │
│     Equipe Anime Profile   │                                                             │
└────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

375 px (gaveta aberta):

```
┌ night 56px: ☰ [logo] (PAINEL)      ☾  ⎋ ┐      ┌ gaveta 288px ─────────── ✕ ┐
│                                          │  →   │ ANIME PROFILE              │
│ Visitas                                  │      │ Administração              │
│ [cartões em 1 coluna]                    │      │ VISÃO GERAL                │
│ ...                                      │      │ ▌Visitas                   │
│                                          │      │ CONTEÚDO                   │
│                                          │      │  Posts         [em breve]  │
│                                          │      │  ...                       │
│                                          │      │ ─────────────────────────  │
│                                          │      │ (A) Administrador          │
│                                          │      │ ↗ Ver o site               │
└──────────────────────────────────────────┘      └────────────────────────────┘
```

### Componentes e estados

- **Topo (`AdminShell`):** o de hoje, mas largura total (`px-4 sm:px-6`, sem `max-w-[1200px]`), com o botão `☰`
  (`grid size-11 place-items-center rounded-full hover:bg-white/10 lg:hidden`, `aria-label="Abrir menu do painel"`,
  `aria-haspopup="dialog"`) antes do logo. "Ver o site" continua `hidden sm:inline-flex` (no celular, vai para a gaveta).
- **Lateral (`AdminNav`, novo, em `app/components/admin/AdminNav.tsx`):** `<aside>` `hidden lg:block shrink-0 border-r
  border-line bg-surface lg:w-[72px] xl:w-64 xl:mini:w-[72px] motion-safe:transition-[width]` (as **mesmas** regras do
  `SideNav`, inclusive a preferência `mini` salva em `ap-sidebar`: um só "recolher" para o site e o painel). Dentro,
  `sticky top-14 h-[calc(100dvh-56px)] flex flex-col`.
  - Marca: "Anime Profile" `text-[0.7rem] font-bold uppercase tracking-[0.22em] text-brand dark:text-glow` +
    "Administração" `text-[1.1rem] font-extrabold`; some no modo recolhido.
  - Grupos: título como o do `SideNav`; itens `h-10 rounded-xl px-3 text-[0.95rem] font-semibold`.
  - **Ativo:** `bg-brand-soft text-brand dark:text-glow` + barra de 3 px à esquerda (igual ao site).
  - **Em breve:** `<span aria-disabled="true">` (sem link, sem rota nova), `text-ink-soft`, ícone a 60%, `cursor-default`,
    `title="<descrição> (em breve)"`, `SeloEmBreve` à direita. Hover: nada (não é clicável). Recolhido: só o ícone a 45%.
  - Pé: cartão `rounded-xl bg-sunken/60 p-2 flex items-center gap-3` com avatar (a mesma `Avatar` do `UserMenu`), nome e
    "Equipe Anime Profile"; abaixo, o botão "Recolher menu" (o mesmo do `SideNav`, só `xl:`).
  - Cada item tem `desc` (frase do antigo) usada no `title`.
- **Gaveta (< 1024 px):** `<dialog>` nativo como o `MobileMenu` do `Header.tsx` (foco preso, `Esc` fecha, clique no
  fundo fecha, fecha ao trocar de página), `w-[min(18rem,88vw)] h-dvh bg-surface`, com o mesmo `AdminNav` em modo
  "gaveta" (sempre com rótulos) e, no fim, "Ver o site" e "Sair".
- **Loader do `admin/layout.tsx`:** devolve `{ nome, inicial, papeis }` do `requireAdmin`; o layout filtra `ADMIN_NAV`
  com `podeVer` e `estado !== "depois"`, e some com grupos vazios.
- **Estados:** carregando → não há (SSR; o loader já exige a sessão); erro do loader → o `ErrorBoundary` do site; sem
  papel → `requireAdmin` manda para `/login`; item ativo por rota (`/admin` exato para Visitas).
- **Página:** cada página mantém o próprio `h1` (o `Painel` de Visitas já tem); o layout não põe título (evita `h1`
  duplo e mantém o módulo `app/visitas/` copiável sem mudança).
- **Acessibilidade:** `<nav aria-label="Menu do painel">`, `aria-current="page"` no ativo, `aria-disabled` nos "em
  breve", botão de recolher com `aria-expanded`/`aria-controls`.

## Arquivos afetados

- **Novos:** `app/lib/papeis.ts`, `app/lib/admin-nav.ts`, `app/components/layout/SeloEmBreve.tsx`,
  `app/components/layout/Notificacoes.tsx`, `app/components/admin/AdminNav.tsx`, `tests/menus-logado.test.ts`.
- **Alterados:** `app/lib/nav.ts` (sai `LOGGED_IN`/`visibleNav`; `papeis` no `NavItem`; grupo Equipe; `HEADER_ACOES`;
  `USER_MENU`), `app/lib/session-hint.ts` (marcador com papéis), `app/server/admin/auth.server.ts` (`hintCookie(papeis)`),
  `app/server/auth/viewer.server.ts` (tipo `Papel` de `~/lib/papeis`), `app/routes/api.eu.ts` (atualiza o marcador),
  `app/app.css` (variantes `papel-admin`, `equipe`), `app/components/layout/SideNav.tsx`, `Header.tsx`, `UserMenu.tsx`,
  `Footer.tsx` (troca `visibleNav(FOOTER_LINKS)` por um filtro local `!auth`, mesmo resultado),
  `app/routes/contas-em-breve.tsx` (rótulo de `USER_MENU`), `app/components/admin/AdminShell.tsx`,
  `app/routes/admin/layout.tsx`, `tests/nav.test.ts`, `tests/login-admin.test.ts`.
- **Docs:** `docs/README.md`, `docs/decisoes.md`, `docs/plano-contas-login.md` (nota: itens `auth` passam a aparecer
  para o admin, pergunta 3 de lá superada por este plano).

## Passos

Todos do Claude (executor Sonnet), na ordem. **Cada entrega termina com** `npm run typecheck`, `npm test`,
`npm run build`, commit, push, conferência em produção (lista "Como verificar") e atualização do README.

### Entrega 1 — base e menu lateral logado

1. **[P] Papéis no cliente.** Criar `app/lib/papeis.ts` com `export type Papel = "admin" | "moderator" | "author"`,
   `export const EQUIPE: Papel[] = ["admin", "moderator"]` e `podeVer(papeisDoItem, papeis)` (D2). Em
   `viewer.server.ts`, `import type { Papel } from "~/lib/papeis"` e `export type { Papel }`.
   *Verificar:* `npm run typecheck`.
2. **[P] Marcador com papéis.** `hintCookie(papeis: Papel[] | null)` em `auth.server.ts`: `null` → apagar (como hoje);
   lista vazia → `ap_logado=1`; senão `ap_logado=<papeis.join(".")>`. `login()` passa `["admin"]`. `session-hint.ts`:
   o bootstrap usa `/(?:^|; )ap_logado=([a-z.0-9]+)/`; põe `dataset.logado="1"` e, se o valor não for `1`,
   `dataset.papeis = valor.replace(/\./g, " ")`; `clearSessionHint()` apaga também `dataset.papeis`. Exportar
   `lerMarcador(): { logado: boolean; papeis: Papel[] }` (lê os atributos do `<html>`; no servidor devolve
   `{ logado: false, papeis: [] }`).
   *Verificar:* ajustar `tests/login-admin.test.ts` (espera `ap_logado=admin`).
3. **[P] `/api/eu` confirma o marcador.** Se logado e o valor do cookie `ap_logado` do pedido for diferente do esperado,
   anexar `Set-Cookie: hintCookie(v.papeis)`. No `UserMenu.tsx` (`consultar`), ao receber `logado:true`, pôr
   `dataset.papeis` com os papéis da resposta (ou apagar se vazio) e avisar os ouvintes.
   *Verificar:* teste do loader com cookie `ap_logado=1` + sessão → resposta com `Set-Cookie` `ap_logado=admin`.
4. **[P] Variantes.** Em `app/app.css`, depois de `logado`:
   `@custom-variant papel-admin (&:where([data-papeis~="admin"], [data-papeis~="admin"] *));`
   `@custom-variant equipe (&:where([data-papeis~="admin"], [data-papeis~="admin"] *, [data-papeis~="moderator"], [data-papeis~="moderator"] *));`
5. **[P] `nav.ts`.** Tirar `LOGGED_IN` e `visibleNav`; `NavItem` ganha `papeis?: Papel[]`; grupo novo no fim de `NAV`:
   `{ label: "Equipe", items: [{ label: "Administração", to: "/admin", icon: LayoutDashboard, auth: true, papeis: EQUIPE }] }`.
   `Footer.tsx`: `FOOTER_LINKS.map((g) => ({ ...g, items: g.items.filter((i) => !i.auth) })).filter((g) => g.items.length)`.
   `tests/nav.test.ts`: trocar os testes de `visibleNav` por testes de `podeVer` e da ordem dos grupos.
6. **[P] `SeloEmBreve`.** Extrair o selo do `SideNav` para `app/components/layout/SeloEmBreve.tsx` (prop `className`).
7. **[M] `SideNav.tsx`.** Hook `useMarcador()` (estado inicial `{ logado: false, papeis: [] }`; no `useEffect`,
   `lerMarcador()`; assina as mudanças publicadas pelo `UserMenu` — exportar dele um `onMarcador(fn)` simples, ou usar um
   `MutationObserver` no atributo do `<html>`). `NavGroups` percorre `NAV` inteiro; classes de visibilidade (D1);
   `ItemLogado` com `<span aria-hidden>` de reserva. Grupo "Equipe": `hidden equipe:block`.
   *Verificar:* local, visitante (janela anônima) e admin, 1440 e 375 px, claro e escuro; console sem aviso de hidratação;
   `curl -s localhost:<porta>/ | grep -E 'href="/(feed|missoes|ranking|quarto|admin)"'` → nada.
8. **[P] Fechar a entrega 1.** Build, testes, push, conferência em produção; README.

### Entrega 2 — navbar logada

9. **[P] `HEADER_ACOES`** em `nav.ts` (seção da Parte 2), com teste de que só `notificacoes` está ligado.
10. **[M] `Notificacoes.tsx`** (Parte 2, componentes e estados) e no `Header.tsx` antes do `<UserMenu />`; o
    `ThemeToggle` do topo ganha `logado:max-[399px]:hidden`.
    *Verificar:* 375, 390 e 1440 px logado (nada quebra linha; o logo não encolhe), teclado (Tab até o sino, Enter, Esc),
    clique fora; visitante igual a hoje.
11. **[P] Fechar a entrega 2.**

### Entrega 3 — menu do usuário

12. **[P] `USER_MENU`** em `nav.ts` (`{ label, items: { label, to, icon, soon?, papeis? }[] }[]`, tabela da Parte 3) e
    `contas-em-breve.tsx` procurando o rótulo em `NAV` e em `USER_MENU`.
13. **[M] `UserMenu.tsx`:** `Itens` percorre `USER_MENU` + "Sair" fixo; largura `w-72`; `max-h` com rolagem; subtítulo
    por papel; `Home`/`End`. O `UserMenuDrawer` usa os mesmos `Itens`.
    *Verificar:* abrir em 1440 e 375 px (claro e escuro), percorrer com setas/Home/End, abrir "Salvos" → "Salvos volta em
    breve", "Reportar um problema" → `/contato`, "Administração" → `/admin`, "Sair" → `/`.
14. **[P] Fechar a entrega 3.**

### Entrega 4 — painel admin

15. **[P] `admin-nav.ts`:** tipo `{ label, href, icon, desc, estado: "ok" | "em-breve" | "depois", fase?: string,
    papeis: Papel[], exact?: true }` e os grupos da tabela da Parte 4 (sem os "fora"); `desc` com a frase do antigo
    (para Visitas: "Visitas por dia, páginas e de onde vêm, sem cookie."). Função `adminNavVisivel(papeis)`.
    Teste: hoje são 4 grupos, 9 itens, 1 `ok`.
16. **[M] `AdminNav.tsx`:** lateral e gaveta (Parte 4). Reaproveitar do `SideNav` o `FadeScroll` (exportar) e a lógica do
    `mini` (extrair `useSidebarMini()` para o `SideNav.tsx` exportar).
17. **[M] `AdminShell.tsx` e `admin/layout.tsx`:** o topo ganha o `☰` e largura total; corpo em `flex` com `AdminNav` +
    `<main id="conteudo" className="min-w-0 flex-1"><div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8
    lg:px-8">`. O loader devolve `{ nome, inicial, papeis }`.
    *Verificar:* `/admin` em 1440, 1280, 1024 e 375 px, claro e escuro; recolher e recarregar (continua recolhido, sem
    piscar); gaveta com teclado; o painel de Visitas igual ao de antes (só mais estreito).
18. **[P] Fechar a entrega 4** e os docs (README, `decisoes.md`, nota em `plano-contas-login.md`).

## Riscos e cuidados

- **Cache:** nenhuma página pública pode chamar `getViewer` no `loader`. Tudo o que muda para logado vem do CSS
  (`data-logado`/`data-papeis`) ou do navegador. `/api/eu` continua `no-store`.
- **Hidratação:** o servidor e a primeira renderização do cliente têm de sair iguais: os itens de logado sempre como
  `<span>` de reserva; o `NavLink` só depois do `useEffect`. Nada de ler `document` durante a renderização.
- **Marcador antigo:** quem entrou antes da entrega 1 tem `ap_logado=1`; na primeira visita o "Administração" aparece
  só depois do `/api/eu` (que já corrige o cookie). Uma vez só.
- **Segurança:** o marcador é só dica visual; quem forjar `ap_logado=admin` vê o link e cai no `/login` ao abrir
  `/admin`. Não usar o marcador para nada no servidor.
- **SEO:** conferir em produção que o HTML anônimo não tem `href` para `/feed`, `/missoes`, `/ranking`, `/quarto`,
  `/admin`. `robots.txt` já bloqueia `/admin`.
- **Topo apertado em 375 px:** com o sino, são 3 botões de 44 px + o logo; por isso o tema some do topo para logado
  abaixo de 400 px.
- **Painel:** o módulo `app/visitas/` não pode importar nada do `AdminShell`/`AdminNav` (continua copiável).
- **Regras de sempre:** loaders usam `routePath(request)`; `npm run build` antes do push; commit e push ao fim de cada
  entrega; nenhuma migration; nenhum segredo no git.

## Como verificar

Em cada entrega, local (`npm run dev`) e depois em produção:

1. **Visitante** (janela anônima), 1440 e 375 px, claro e escuro: menu, topo e rodapé **iguais a hoje**.
2. **Admin logado:** recarregar várias vezes: os itens aparecem **na primeira pintura** (sem pulo do menu lateral, sem
   "Entrar" piscando); console sem erro de hidratação.
3. `curl -sI https://animeprofile.com.br/` → `cache-control: public, max-age=0, s-maxage=60...` e sem `set-cookie`.
4. `curl -s https://animeprofile.com.br/ | grep -cE 'href="/(feed|missoes|ranking|quarto|admin|perfil|salvos)"'` → `0`.
5. Teclado: Tab percorre lateral, sino, menu do usuário e a barra do admin; `Esc` fecha painéis; foco visível.
6. Entrega 4: `/admin` com a lateral (Visitas ativo, 8 "em breve" sem link), gaveta no celular, recolher salvo.
7. `npm run typecheck`, `npm test`, `npm run build` passam.

## Perguntas em aberto (para o dono)

Nenhuma bloqueia; sem resposta, o executor segue com a **recomendada**.

1. **Itens "em breve" para quem está logado** (Feed, Missões, Ranking, Quarto na lateral; Meu perfil, Loja, Salvos etc.
   no menu do usuário): mostrar com o selo "em breve" (**recomendado**: é a prévia do formato do antigo, e só o admin vê)
   ou esconder até existirem?
2. **Topo logado:** só o sino com o estado vazio (**recomendado**) ou também os ícones de Check-in e Mensagens levando ao
   "volta em breve"? (Saldos de AP Coins e Rubis ficam de fora em qualquer caso, para não mostrar "0".)
3. **Blog e Figurinhas para visitantes:** hoje só logados veem esses itens no menu (decisão de 2026-11-17), mas as
   páginas são públicas e estão no sitemap; o antigo mostrava Figurinhas para todos. Manter só para logados
   (**recomendado** até o dono decidir outra coisa, para não mudar o que já foi aprovado) ou voltar a mostrar para todos?
4. **Barra do admin:** mostrar os 8 itens "em breve" (**recomendado**: dá o mapa do que vem) ou só "Visitas" até cada
   tela existir?
5. **Próxima tela real do painel** (depois desta entrega): Notícias IA (status do robô e prévia, já há API;
   **recomendado**), Agendamentos (cron) ou Posts (editor)?
