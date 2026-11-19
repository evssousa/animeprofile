# Plano: navbar (topo) mais rica, para visitante e para logado

Plano temporário, escrito em 2026-11-19 pelo planejador. Pedido do dono: "a navbar ficou muito simples, tanto para
usuários logados e não logados, vamos colocar coisas lá para ficar mais legal". Vem depois de
[plano-menus-logado.md](plano-menus-logado.md) (entregas feitas: Check-in, Mensagens, sino e menu do usuário já estão no
topo e **continuam**). Nenhuma migration. Nenhuma biblioteca nova.

## Objetivo

Dar ao topo escuro (`night`) coisas úteis e vivas, iguais para todos no HTML (cache de 60 s da CDN): uma busca com
sugestões e atalho de teclado, um botão "Agora" com o que está acontecendo no site (última notícia, episódios de hoje,
em alta), o botão de instalar o app quando o navegador permitir e, só para a equipe, um resumo do robô e das visitas de
hoje com atalho ao painel.

## Contexto

- **Hoje** (`app/components/layout/Header.tsx`): logo, `HEADER_LINKS` (vazio), busca simples (formulário GET para
  `/busca`, só a partir de 1024 px; no celular, ícone que leva a `/busca`), tema (só abaixo de 1024 px) e:
  - visitante: "Entrar" + botão vermelho "Contas em breve" (no celular, "Em breve");
  - logado: `AcoesLogado.tsx` (Check-in, Mensagens, sino com painel vazio) + `UserMenu.tsx` (avatar, nome a partir de
    1024 px, menu da conta).
- **O antigo** (`animeprofile-old/src/components/TopBar.tsx` + `GlobalSearch.tsx`): busca global com **sugestões ao
  digitar** (animes, notícias e artigos, blog, quizzes, pessoas, figurinhas, tags), **buscas recentes**, atalho **`/` e
  Ctrl+K**, "Ver tudo" e, no celular, a busca num diálogo. Também tinha saldos, sequência, nível e XP (ficam de fora:
  nunca mostrar "0" falso) e a guirlanda das datas comemorativas (não existe no site novo).
- **Dados que já existem e são públicos** (servem ao topo sem nada novo no banco): `latestPosts`, `mostReadSince`,
  `trendingTags`, `listPosts({ search })` (`app/server/content/posts.server.ts`), `airingBetween` e `anime_catalog`
  (`app/server/anime/anime.server.ts`), `listQuizzes` (`app/server/quiz/quiz.server.ts`), o cache em memória `cached()`
  (`app/server/cache.server.ts`). Para a equipe: `getConfig()` e `roboPostsToday()` (`app/server/robot/config.server.ts`)
  e as visitas (`app/visitas/server/consultas.server.ts`).
- **PWA:** `public/sw.js`, `public/offline.html`, `public/icons/*` e `public/manifest.webmanifest` vieram do antigo, mas
  **o site novo não registra o service worker** (nenhum `navigator.serviceWorker.register` em `app/`), e o manifesto
  ainda tem a cor roxa do antigo (`#6d28d9`) e atalhos para páginas "em breve" (`/feed`, `/quarto`, `/notificacoes`).
- **Cache:** `server-app.js` (linhas 53 a 59) dá `no-store` a tudo em `/api`. Os dois endpoints novos e públicos deste
  plano precisam sair dessa regra para a CDN poder guardá-los.
- **Por que muda:** o dono achou o topo pobre. O topo é a única peça presente em todas as páginas; é onde cabe "o site
  está vivo" sem mexer no conteúdo das páginas.

## Propostas (com recomendação)

| # | Proposta | Para quem | Onde aparece | Tamanho | Recomendação |
|---|---|---|---|---|---|
| 1 | **Busca com sugestões** (animes, matérias, quizzes), buscas recentes, "Em alta" quando vazia, atalho `/` e Ctrl+K; no celular, abre num diálogo | todos | ≥ 1024 px no campo; < 1024 px no ícone | G | **Fazer** (é o que o antigo tinha e o que mais se usa) |
| 2 | **"Agora"**: botão com bolinha vermelha que abre um painel com a última hora (3 notícias), "No ar hoje" (próximos episódios com horário) e "Em alta" (tags); a bolinha pulsa só se saiu notícia nova desde a última vez que a pessoa abriu | todos | ≥ 768 px | M | **Fazer** (dá vida ao topo com dado real, igual para todos) |
| 3 | **Instalar o app** (PWA): aparece só quando o navegador oferece a instalação (Chrome, Edge, Android) ou no Safari do iPhone (leva a `/como-instalar`); some depois de instalar ou de recusar | todos | topo ≥ 1024 px; gaveta do menu no celular | P/M | **Fazer** (o arquivo do app já existe; falta registrar e arrumar o manifesto) |
| 4 | **Faixa da equipe**: duas pílulas com o robô de notícias ("Robô 4/10") e as visitas de hoje ("1,2 mil hoje"), ambas levando ao `/admin` | só equipe (`equipe:`) | ≥ 1280 px | M | **Fazer** (dado real, útil ao dono todo dia; ninguém mais vê) |
| 5 | **Menu "Mais"** com as redes sociais (Instagram, X, TikTok), o RSS e o tema claro/escuro no topo do computador | todos | ≥ 1024 px | P | **Não agora** (o rodapé e a lateral já têm; mais um botão disputaria com o "Agora") |

**Descartadas, com o motivo:**
- **Atalhos de seção no topo** (Notícias, Animes, Otaku TV...): repetem a lateral esquerda, que já está aberta a partir
  de 1024 px. `HEADER_LINKS` continua vazio.
- **Faixa rolante de "última hora"** embaixo do topo: movimento constante (ruim para leitura e acessibilidade) e
  brigaria com a faixa `AvisoContas`. A última hora entra no painel "Agora".
- **"Estreia do dia" isolada**: entra no "No ar hoje" do painel "Agora".
- **Saldos, sequência, nível, XP, anel do Premium**: sem economia, seriam "0" falso.
- **Decoração das datas comemorativas**: o site novo não tem esse sistema.

O resto deste plano detalha as propostas **1 a 4**. A 5 fica só como pergunta.

## Direção visual

O topo continua a faixa **night** cinematográfica, com cara de app de streaming: fundo quase preto, texto branco a 70% que
acende para 100% no hover, o vermelho da marca **só** em três lugares (a bolinha do "Agora", o botão "Contas em breve" e
o foco/ativo nos painéis). Nada de degradê nem brilho do antigo; os elementos novos são "vidro escuro" (branco a 6–12%
sobre o night), discretos, com bordas de 1 px branco a 10%. Os painéis que abrem são claros no tema claro e escuros no
escuro (`surface`), iguais ao menu do usuário que já existe.

**Hierarquia (1440 px):** o olho vê primeiro o **logo** e a **busca** (o maior elemento claro, no centro), depois a
**bolinha vermelha do "Agora"** (único ponto de cor à esquerda) e por último o grupo pessoal à direita (instalar,
ações, avatar; para a equipe, as pílulas).

## Estrutura

Ordem dos elementos, da esquerda para a direita, numa linha só (sem quebra em nenhuma largura):

1. Botão da gaveta (`☰`, só de 1024 a 1279 px, como hoje).
2. Logo (como hoje).
3. **"Agora"** (proposta 2), colado ao logo, a partir de 768 px.
4. **Busca** (proposta 1), centralizada no espaço que sobra (`mx-auto`), a partir de 1024 px.
5. Grupo da direita (`ml-auto` abaixo de 1024 px), nesta ordem:
   - **Pílulas da equipe** (proposta 4), só ≥ 1280 px e só `equipe:`;
   - **Instalar app** (proposta 3), quando disponível;
   - ícone da busca (só < 1024 px; agora abre o diálogo);
   - tema (só < 1024 px, como hoje; some para logado abaixo de 640 px, como hoje);
   - visitante: "Entrar" + "Contas em breve" (como hoje);
   - logado: Check-in, Mensagens, sino (como hoje) + avatar (o **nome** passa a aparecer só a partir de 1280 px).

Larguras do campo de busca: `w-[min(22rem,26vw)]` de 1024 a 1279 px e `xl:w-[min(28rem,30vw)]` a partir de 1280 px (hoje
é `w-[min(24rem,32vw)]`; o campo cede espaço ao "Agora" em 1024 px).

### Comportamento por largura

| Largura | Visitante | Logado (admin) |
|---|---|---|
| ≥ 1440 | logo · Agora · busca (448 px) · [Instalar] · Entrar · Contas em breve | logo · Agora · busca · [Robô 4/10] [1,2 mil hoje] · ✓ 💬 🔔 · (A) Administrador ˅ |
| 1280–1439 | igual | igual (pílulas cabem: conferir em 1280) |
| 1024–1279 | ☰ · logo · Agora · busca (266 px) · [Instalar só ícone] · Entrar · Contas em breve | ☰ · logo · Agora · busca · ✓ 💬 🔔 · (A) (sem nome, sem pílulas) |
| 768–1023 | logo · Agora · 🔍 ☾ · Entrar · Contas em breve | logo · Agora · 🔍 ☾ · ✓ 💬 🔔 · (A) |
| < 768 (375) | logo · 🔍 ☾ · Em breve (igual a hoje) | logo · 🔍 ✓ 💬 🔔 (A) (igual a hoje) |

**Celular (375 px), limite de espaço:** o topo **não ganha nenhum botão novo**. Já são 4 alvos de 44 px + o logo para o
logado. O que muda no celular: o 🔍 abre o diálogo de busca com sugestões (em vez de ir para `/busca`) e o "Instalar o
app" entra na **gaveta** do menu (acima de "Tema claro / escuro"). O "Agora" não aparece abaixo de 768 px (a home já
abre com "Animes no ar hoje" e as notícias).

**Fallback se 1024 px apertar:** se, ao conferir, o topo do visitante quebrar ou o logo encolher em 1024 px, esconder o
link de texto "Entrar" abaixo de 1280 px (`hidden xl:inline-block`); ele continua na gaveta e no botão vermelho.

## Tokens

Sem cores novas: tudo vem de `app/app.css`.

| Uso | Claro | Escuro |
|---|---|---|
| Topo (`night` / `night-ink`) | `#0d0d10` / `#f4f4f6` | `#0b0b0e` / `#f4f4f6` |
| Vidro no topo (chips, campo) | `bg-white/[0.06]`, hover `bg-white/[0.12]`, borda `border-white/10` | igual |
| Texto do topo | `text-white/70`, hover `text-white` | igual |
| Painéis (`surface`) | `#ffffff` | `#1b171a` |
| Linhas (`line`) | `#efe6e6` | `#2f282b` |
| Hover de linha (`sunken`) | `#f4eded` | `#231e21` |
| Opção ativa no teclado (`brand-soft`) | `#fbedec` + texto `ink` | `#3a1b19` + texto `ink` |
| Texto (`ink` / `ink-soft`) | `#1c1414` / `#6e5f5f` | `#f4eff0` / `#ab9d9f` |
| Marca (`brand`) | `#c2352b` | `#c2352b` |
| Rótulo vermelho sobre escuro (`glow`) | `#ff9a90` | `#ff9a90` |
| Foco | global `outline 2px #2b5bd7` | igual |

- **Fonte:** Sora. Chips do topo `text-[0.85rem] font-semibold`; números `tabular-nums`; rótulos de seção dos painéis
  `text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-soft`; títulos de item `text-[0.9rem] font-semibold
  leading-snug`; linhas de apoio `text-[0.78rem] text-ink-soft`.
- **Raios:** chips e campo `rounded-full`; painéis `rounded-2xl`; miniaturas `rounded-md`; linhas clicáveis `rounded-xl`.
- **Sombra dos painéis:** `shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]` (a do `UserMenu`).
- **Espaços:** chips `h-9 px-3 gap-2`; painéis `p-1.5` com seções `px-3 py-2.5`; distância do topo `top-[calc(100%+8px)]`.
- **Movimento:** painéis abrem com `opacity-0 translate-y-1 → opacity-100 translate-y-0` em 120 ms (classe
  `motion-safe:animate-[ap-pop_120ms_ease-out]`, keyframe novo `ap-pop` em `app.css`); bolinha do "Agora" com
  `animate-ping` só quando há novidade; tudo respeita `prefers-reduced-motion` (já há a regra global no `app.css`).

## Componentes

### 1. Busca com sugestões (`app/components/layout/BuscaTopo.tsx`)

**Campo (≥ 1024 px):** o `<Form method="get" action="/busca" role="search">` de hoje continua (sem JS, Enter leva a
`/busca`). Por cima, comportamento de combobox:

- `input` com `role="combobox"`, `aria-expanded`, `aria-controls="sugestoes-busca"`, `aria-autocomplete="list"`,
  `aria-activedescendant` (opção ativa), `autoComplete="off"`, placeholder "Buscar notícias, animes, quizzes...".
- Classes: `h-10 w-full rounded-full border border-white/10 bg-white/10 pr-12 pl-10 text-white placeholder:text-white/50
  focus:border-white/25 focus:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30`.
- À direita, um `<kbd>` com `/`: `absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-white/15 px-1.5
  text-[0.7rem] font-semibold text-white/50`; some quando o campo tem foco ou texto e em telas de toque
  (`[@media(pointer:coarse)]:hidden`). Com texto, no lugar dele, um botão `X` (limpar, 32 px, `aria-label="Limpar busca"`).
- **Atalhos:** `/` (quando o foco não está num campo de texto) e Ctrl+K / ⌘K focam o campo; abaixo de 1024 px abrem o
  diálogo do celular. Um ouvinte só, no `BuscaTopo`.

**Painel de sugestões** (`id="sugestoes-busca"`, `role="listbox"`): `absolute top-[calc(100%+8px)] left-0 z-40
w-[min(36rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-line
bg-surface p-1.5 text-ink` + sombra padrão.

| Estado | O que aparece |
|---|---|
| Foco, campo vazio | Seção **"Buscas recentes"** (até 5, do `localStorage` `ap-buscas`; linha com ícone `Clock` 16 px, termo, e um `X` de 28 px "Remover" à direita; no fim "Limpar recentes" em `text-[0.78rem] text-ink-soft underline`). Abaixo, **"Em alta"**: até 8 tags como chips `rounded-full bg-sunken px-3 h-8 text-[0.82rem] font-semibold hover:bg-brand-soft`, cada uma link para `/tag/<slug>` (vêm de `/api/sugestoes` sem `q`). Sem recentes e sem tags: o painel não abre. |
| 1 letra | Painel com "Digite pelo menos 2 letras" (`text-ink-soft`, centralizado, `py-6`). |
| Carregando (≥ 2 letras, 200 ms de espera) | 3 linhas de esqueleto (`h-12 rounded-xl bg-sunken animate-pulse`). |
| Resultados | Seções na ordem: **Animes** (até 4: pôster 32×44 `rounded-md object-cover`, título, linha "2025 · TV"), **Notícias e artigos** (até 4: miniatura 64×40, título com `line-clamp-2`, linha "Notícia · há 2 h"), **Quizzes** (até 2: ícone `Puzzle` 18 px num quadrado `size-10 rounded-md bg-sunken`, título). No fim, duas linhas fixas: "Ver todas as matérias com “termo”" (ícone `Search`, para `/busca?q=`) e "Ver animes com “termo”" (ícone `Tv`, para `/animes?q=`), em `text-link font-semibold`. |
| Nada encontrado | "Nada encontrado para “termo”." + as duas linhas fixas (a de animes ainda pode achar no AniList). |
| Erro de rede | "Não deu para carregar as sugestões. Aperte Enter para buscar." (o Enter continua funcionando). |

- **Linha de resultado:** `<a role="option" id="sug-<n>">` com `flex items-center gap-3 rounded-xl px-3 py-2
  hover:bg-sunken`; a ativa (teclado) `bg-brand-soft` com barra de 3 px `before:bg-brand` à esquerda (o mesmo
  desenho do item ativo da lateral).
- **Teclado:** ↓/↑ percorrem as opções (dando a volta), Enter abre a ativa ou, sem ativa, envia o formulário;
  Esc fecha o painel (segundo Esc limpa o campo); Tab sai e fecha. Clique fora e troca de página fecham.
- **Ao escolher** uma opção ou enviar: guarda o termo em `ap-buscas` (sem repetir, no máximo 5, mais novo primeiro).
- **Rede:** espera de 200 ms (debounce), `AbortController` cancela o pedido anterior, cache por termo num `Map` no
  módulo (a mesma busca não pede de novo na visita), mínimo 2 letras, máximo 60 caracteres.

**Celular e telas < 1024 px:** o 🔍 continua sendo `<Link to="/busca">` (funciona sem JS), mas com JS o clique faz
`preventDefault` e abre um `<dialog id="busca-dialogo">` nativo:
- `m-0 h-dvh max-h-none w-full max-w-none bg-surface text-ink backdrop:bg-black/60` (tela cheia abaixo de 640 px; de 640
  a 1023 px, `sm:mt-16 sm:mx-auto sm:h-auto sm:max-h-[80vh] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-2xl`).
- No alto, uma faixa `night` de 60 px com o campo (mesmas classes do campo do topo, `autoFocus`) e um botão de texto
  "Cancelar" (`text-white/80 font-semibold px-2`). Abaixo, o mesmo conteúdo do painel de sugestões, sem a borda e a
  sombra (é a página do diálogo).
- Esc e "Cancelar" fecham e devolvem o foco ao 🔍; trocar de página fecha.

### 2. "Agora" (`app/components/layout/AgoraTopo.tsx`)

**Botão** (≥ 768 px, `hidden md:block`): `button` `inline-flex h-9 items-center gap-2 rounded-full border border-white/10
bg-white/[0.06] px-3 text-[0.85rem] font-semibold text-white/85 hover:bg-white/[0.12] hover:text-white`,
`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls="painel-agora"`. Dentro: a **bolinha** (`relative size-2
rounded-full`) e o texto "Agora".
- Bolinha **sem novidade** ou antes de os dados chegarem: `bg-white/40`.
- Bolinha **com novidade** (a notícia mais nova é de até 2 h atrás **e** é mais nova que `localStorage`
  `ap-agora-visto`): `bg-brand` + um `<span class="absolute inset-0 rounded-full bg-brand/70 motion-safe:animate-ping">`.
  O `aria-label` vira "Agora: notícia nova".
- Abrir o painel grava em `ap-agora-visto` a data da notícia mais nova (a bolinha apaga).

**Dados:** `GET /api/agora` uma vez quando o topo monta (em `requestIdleCallback`, ou `setTimeout(…, 1500)` onde não
houver), e de novo a cada 5 min **só com a aba visível** (`visibilitychange`). O topo persiste entre as trocas de página
do React Router, então não há um pedido por clique.

**Painel** (`id="painel-agora"`, `role="dialog"`, `aria-labelledby="titulo-agora"`): `absolute top-[calc(100%+8px)] left-0
z-40 w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface text-ink` + sombra padrão.
- **Cabeçalho** (`flex items-baseline justify-between border-b border-line px-4 py-3`): título "Agora no Anime
  Profile" (`text-[0.95rem] font-bold`, `tabIndex={-1}`, recebe o foco ao abrir) e, à direita, "N notícias hoje"
  (`text-[0.78rem] text-ink-soft tabular-nums`, **some se N = 0**).
- **Corpo** em 2 colunas a partir de 640 px (`grid sm:grid-cols-2 gap-1 p-1.5`; 1 coluna abaixo):
  - **Última hora** (rótulo vermelho `text-brand dark:text-glow` em vez de `ink-soft`, para marcar a seção): 3
    notícias (`latestPosts({ type: "news" }, 3)`): miniatura 72×48 `rounded-md`, título `line-clamp-2`, "há 12 min"
    (tempo relativo calculado no navegador). Linha final "Todas as notícias" → `/noticias`.
  - **No ar hoje:** até 4 episódios de hoje (Brasília) **a partir de agora** (`airingBetween(agora, fimDoDia, …)`); se
    não restar nenhum, os 4 primeiros de amanhã com o rótulo trocado para "Amanhã". Linha: pôster 28×40, título
    `truncate`, "Ep. 7 · 21:30" (`tabular-nums`). Linha final "Calendário da semana" → `/animes/calendario`.
- **Rodapé** (`border-t border-line px-4 py-3 flex flex-wrap items-center gap-2`): "Em alta" (rótulo) + até 6 tags de
  `trendingTags(6)` como os chips da busca, links para `/tag/<slug>`.
- **Estados:** carregando (o painel abriu antes dos dados): 3 esqueletos por coluna; erro: "Não deu para carregar agora."
  + botão "Tentar de novo" (`rounded-full border border-line px-3 h-8 text-[0.82rem] font-semibold hover:bg-sunken`);
  coluna vazia: "Nenhum episódio hoje" + o link do calendário (a coluna de notícias nunca fica vazia na prática; se
  ficar, some e a outra ocupa a largura).
- **Teclado:** Enter/Espaço abre e foca o título; Esc fecha e devolve o foco ao botão; clique fora e troca de página
  fecham. Abrir o "Agora" fecha o sino e o menu do usuário (cada um já fecha no `mousedown` fora; conferir).

### 3. Instalar o app (`app/components/layout/InstalarApp.tsx` + `app/lib/pwa.ts`)

- **`app/lib/pwa.ts`:** `registrarApp()` chamado uma vez no `useEffect` do `Header` (só no navegador, só em produção ou
  em `localhost`): `navigator.serviceWorker.register("/sw.js")`. Guarda o evento `beforeinstallprompt` (com
  `preventDefault`) numa variável do módulo e publica a mudança (mesmo padrão de ouvintes do `UserMenu`). Ouve
  `appinstalled` (some). `podeInstalar()` = há evento guardado **ou** (iPhone/iPad no Safari **e** não está em modo app:
  `!matchMedia("(display-mode: standalone)").matches && !navigator.standalone`). Respeita `localStorage`
  `ap-instalar-recusado` (data; não oferece de novo por 30 dias).
- **Botão no topo** (≥ 1024 px, só quando `podeInstalar()`): `inline-flex h-9 items-center gap-2 rounded-full border
  border-white/15 px-3 text-[0.85rem] font-semibold text-white/85 hover:bg-white/10 hover:text-white`, ícone `Download`
  16 px + "Instalar app" (de 1024 a 1279 px só o ícone, `size-9 justify-center px-0`, com `aria-label="Instalar o app"`).
  Entra com `motion-safe:animate-[ap-pop_120ms_ease-out]` (não há espaço reservado: ele aparece à esquerda do grupo
  da direita, e a busca, centralizada, só desliza um pouco).
  - Com o evento: clique chama `prompt()`; se a resposta for `dismissed`, grava `ap-instalar-recusado`.
  - No iPhone: é um `<Link to="/como-instalar">` (página real e pública).
- **Na gaveta** (< 1280 px): linha `flex h-11 items-center gap-3 rounded-xl px-3 font-semibold hover:bg-sunken` com
  `Download` + "Instalar o app", logo acima do bloco "Tema claro / escuro" (`MenuFooter`), só quando `podeInstalar()`.
- **Manifesto** (`public/manifest.webmanifest`): `theme_color` e `background_color` → `#0d0d10`; `description` →
  "Notícias de anime, Otaku TV, quizzes e figurinhas em português."; `shortcuts` trocados por Notícias (`/noticias`),
  No ar hoje (`/animes/calendario`), Otaku TV (`/otaku-tv`) e Quiz (`/quiz`) (os de hoje levam a páginas "em breve");
  `<link rel="manifest" href="/manifest.webmanifest">` em `links` do `app/root.tsx` (conferir se já não está).

### 4. Faixa da equipe (`app/components/layout/PainelEquipeTopo.tsx`)

- **Onde:** no grupo da direita, antes do "Instalar", dentro de `<div className="hidden xl:equipe:flex! items-center
  gap-1.5">` (mesmo padrão `logado:flex!` do `UserMenu`; as classes ficam escritas por extenso). Só renderiza conteúdo
  quando o `useViewer()` do `UserMenu` estiver `pronto` e trouxer `painel` (abaixo).
- **Dados:** `GET /api/eu` passa a devolver, **só para quem tem admin ou moderador**, um campo `painel: { robo: { hoje,
  teto, modo }, visitasHoje: number }`. `robo` vem de `roboPostsToday()` e `getConfig()` (`limiteDia`, `modo`);
  `visitasHoje` de uma função nova e leve `visitantesHoje(dia)` em `app/visitas/server/consultas.server.ts` (uma
  consulta só em `visit_daily` do dia; **não** usar `cartoes()`, que faz 8 consultas). Tudo dentro de
  `cached("eu-painel", 60_000, …)` e de `try/catch`: se falhar, o campo some e o `/api/eu` responde normal.
- **Pílulas:** `<Link to="/admin">` `inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5
  text-[0.8rem] font-semibold text-white/80 tabular-nums hover:bg-white/[0.12] hover:text-white`:
  - **Robô:** ícone `Bot` 15 px + "4/10". Bolinha de 6 px antes do ícone: modo `publicar` → `bg-glow`; `rascunho` ou
    `ensaio` → `bg-white/60` e texto "ensaio"/"rascunho" no lugar do número; `desligado` → `bg-white/30` e "desligado".
    `aria-label="Robô de notícias: 4 de 10 publicadas hoje, modo publicar"`, `title` igual.
  - **Visitas:** ícone `Eye` 15 px + número compacto (`Intl.NumberFormat("pt-BR", { notation: "compact" })`: "1,2 mil")
    + " hoje". `aria-label="1.234 visitantes hoje"`.
  - Com 0 visitantes: mostrar "0 hoje" (é dado real, não saldo).
- **Estados:** carregando → nada (as pílulas só entram com o dado, no mesmo instante do avatar); erro → nada.
- **Link:** `/admin` hoje. Quando a Visitas mudar para `/admin/visitas` ([plano-telas-painel.md](plano-telas-painel.md)),
  a pílula de visitas passa a apontar para lá (deixar o destino numa constante `DESTINO_VISITAS` no componente).

## Wireframes

O topo é sempre `night` nos dois temas: **claro e escuro só mudam os painéis que abrem** (anotados com os tokens).

### 1440 px, visitante (claro = escuro no topo)

```
┌ night 72px ──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo] Anime Profile  (● Agora)        (🔍 Buscar notícias, animes, quizzes...        [/])   (⤓ Instalar app)  Entrar  [Contas em breve] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
   ● = bolinha white/40; vermelha pulsando se há notícia nova      [Instalar app] só quando o navegador oferece
```

### 1440 px, admin logado

```
┌ night 72px ──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo] Anime Profile  (● Agora)     (🔍 Buscar notícias, animes, quizzes... [/])   (•🤖 4/10)(👁 1,2 mil hoje)  ✓ 💬 🔔  ((A) Administrador ˅) │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Painel "Agora" aberto (1440 px), claro

```
 (● Agora)
 ┌──────────────────────────────── 640 px, surface #ffffff, borda #efe6e6 ─────────────────────────────┐
 │ Agora no Anime Profile                                                       7 notícias hoje       │
 │─────────────────────────────────────────────────────────────────────────────────────────────────────│
 │ ÚLTIMA HORA (brand)                          │ NO AR HOJE (ink-soft)                                 │
 │ [72×48] Título da notícia em até             │ [▯] Nome do anime                     Ep. 7 · 21:30   │
 │         duas linhas...          há 12 min    │ [▯] Outro anime                       Ep. 3 · 22:00   │
 │ [72×48] Título ...              há 1 h       │ [▯] ...                               Ep. 11 · 23:30  │
 │ [72×48] Título ...              há 3 h       │ [▯] ...                               Ep. 1 · 00:00   │
 │ Todas as notícias →                          │ Calendário da semana →                                │
 │─────────────────────────────────────────────────────────────────────────────────────────────────────│
 │ EM ALTA  (#One Piece) (#Jujutsu Kaisen) (#Dandadan) (#Crunchyroll) ...   chips bg #f4eded          │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Escuro: o mesmo desenho com `surface #1b171a`, borda `#2f282b`, chips `#231e21`, texto `#f4eff0`/`#ab9d9f`, rótulo
"Última hora" em `glow #ff9a90`.

### Sugestões da busca abertas (1440 px), escuro

```
          (🔍 frieren                                              ✕)
          ┌──────────────────────── 576 px, surface #1b171a, borda #2f282b ────────┐
          │ ANIMES                                                                 │
          │ ▌[▯] Sousou no Frieren          (ativa: brand-soft #3a1b19, barra brand)│
          │      2023 · TV                                                         │
          │  [▯] Sousou no Frieren 2ª temporada                                    │
          │ NOTÍCIAS E ARTIGOS                                                     │
          │  [64×40] Frieren ganha data da 2ª temporada...     Notícia · há 2 h    │
          │  [64×40] Por que Frieren conquistou...             Artigo · 12 nov     │
          │ QUIZZES                                                                │
          │  [✚] Quanto você sabe sobre Frieren?                                   │
          │ ───────────────────────────────────────────────────────────────────── │
          │ 🔍 Ver todas as matérias com “frieren”   (link #ff9a90)                │
          │ ▭  Ver animes com “frieren”                                            │
          └────────────────────────────────────────────────────────────────────────┘
```

Claro: `surface #ffffff`, borda `#efe6e6`, ativa `#fbedec`, links `#c2352b`. Campo vazio com foco: "BUSCAS RECENTES"
(🕘 termo ✕) e "EM ALTA" (chips).

### 1024 px, visitante e admin

```
visitante:
┌ night 72px ─────────────────────────────────────────────────────────────────────────────┐
│ ☰ [logo] Anime Profile (● Agora)  (🔍 Buscar notícias... [/])  (⤓)  Entrar  [Contas em breve] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
admin:
┌ night 72px ─────────────────────────────────────────────────────────────────────────────┐
│ ☰ [logo] Anime Profile (● Agora)  (🔍 Buscar notícias... [/])        ✓  💬  🔔  ((A)˅)   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
   (lateral de 72 px abaixo; sem pílulas da equipe; avatar sem o nome)
```

### 375 px

```
visitante:                                   admin:
┌ night 60px ───────────────────────┐        ┌ night 60px ───────────────────────┐
│ [logo]              🔍  ☾  [Em breve] │        │ [logo]           🔍  ✓  💬  🔔  (A) │
└───────────────────────────────────┘        └───────────────────────────────────┘

🔍 tocado (diálogo de tela cheia), claro:
┌ night 60px ───────────────────────┐
│ (🔍 frieren            ✕)  Cancelar │
├───────────────────────────────────┤  surface #ffffff (escuro #1b171a)
│ ANIMES                            │
│ [▯] Sousou no Frieren             │
│     2023 · TV                     │
│ NOTÍCIAS E ARTIGOS                │
│ [64×40] Frieren ganha data...     │
│ ...                               │
│ 🔍 Ver todas as matérias...       │
└───────────────────────────────────┘

gaveta (Menu), quando dá para instalar:
│ ...grupos do menu...              │
│ (A) Administrador / Entrar        │
│ ⤓ Instalar o app                  │
│ Tema claro / escuro            ☾  │
```

## Restrições respeitadas (conferir na execução)

- **HTML igual para todos:** nada do topo lê sessão no servidor. O "Agora" sai no HTML como botão (sem dados); os dados
  vêm de `/api/agora`, igual para todos. As pílulas da equipe vêm de `/api/eu` (`no-store`, só com o marcador).
- **Sem links indexáveis para o que não existe:** "Agora" e sugestões só levam a páginas reais e públicas, e só existem
  depois do JS. "Instalar app" é botão (ou link para `/como-instalar`, que é real). Pílulas: `/admin` (já bloqueado no
  `robots.txt`) e só para a equipe, só no navegador.
- **Sem dado falso:** "N notícias hoje" some com 0; nada de saldo; visitas e robô são números reais.
- **Itens de logado de hoje** (Check-in, Mensagens, sino, menu do usuário) não mudam, só o nome do avatar passa a
  aparecer a partir de 1280 px.
- **Performance:** nenhuma biblioteca nova; ícones do `lucide-react` (já usado); um pedido `/api/agora` por visita
  (guardado pela CDN e pelo `cached()`); sugestões só quando a pessoa digita.

## Arquivos afetados

- **Novos:**
  - `app/components/layout/BuscaTopo.tsx` (campo com sugestões + diálogo do celular + atalhos);
  - `app/components/layout/AgoraTopo.tsx`;
  - `app/components/layout/InstalarApp.tsx` (botão do topo e linha da gaveta, duas exportações);
  - `app/components/layout/PainelEquipeTopo.tsx`;
  - `app/lib/pwa.ts`, `app/lib/buscas-recentes.ts` (ler/gravar/remover `ap-buscas`), `app/lib/tempo-relativo.ts`
    (se ainda não existir algo igual em `app/lib/format.ts`: conferir antes);
  - `app/server/topo.server.ts` (`agora()` e `sugestoes(q)`);
  - `app/routes/api.agora.ts`, `app/routes/api.sugestoes.ts`;
  - `tests/topo.test.ts`.
- **Alterados:**
  - `app/components/layout/Header.tsx` (ordem, larguras, novos componentes, registro do app, gaveta com "Instalar");
  - `app/components/layout/UserMenu.tsx` (tipo `Estado` com `painel?`; exportar `useViewer`; nome do gatilho `xl:inline`
    em vez de `lg:inline`, idem o `ChevronDown`);
  - `app/components/layout/SideNav.tsx` (`MenuFooter` variante gaveta recebe a linha "Instalar o app", ou ela entra no
    `Header` logo antes do `MenuFooter`; preferir o `Header`);
  - `app/routes/api.eu.ts` (campo `painel` para a equipe);
  - `app/visitas/server/consultas.server.ts` (`visitantesHoje`, exportação nova e genérica: o módulo continua copiável);
  - `app/server/anime/anime.server.ts` (`sugerirAnimes(q, limite)`: só o banco, sem AniList);
  - `app/server/quiz/quiz.server.ts` (`sugerirQuizzes(q, limite)`);
  - `app/server/content/posts.server.ts` (`sugerirPosts(q, limite)`: mesma regra de busca do `listPosts`, sem `COUNT`);
  - `app/routes.ts` (2 rotas), `server-app.js` (exceção de cache), `app/app.css` (keyframe `ap-pop`),
    `app/root.tsx` (link do manifesto, se faltar), `public/manifest.webmanifest`.
- **Docs:** `docs/README.md`, `docs/decisoes.md`, `docs/design.md` (linha "Estrutura > Computador" passa a descrever o
  topo novo), este plano.

## Passos

Todos do executor, na ordem. **Cada entrega termina com** `npm run typecheck`, `npm test`, `npm run build`, commit,
push, conferência em produção ("Como verificar") e atualização do `docs/README.md`.

### Entrega 1: dados e busca

1. **[P] Funções de sugestão no servidor.** Em `posts.server.ts`, `sugerirPosts(q, limite = 4)` reaproveitando a
   condição de busca do `listPosts` (todos os termos, sem acento) e devolvendo `{ titulo, url, tipo, imagem,
   publicadoEm }`. Em `anime.server.ts`, `sugerirAnimes(q, limite = 4)`: `SELECT ${CARD_COLS} FROM anime_catalog c WHERE
   c.is_adult = 0 AND c.title LIKE ? ORDER BY c.popularity DESC LIMIT ?` (escapar `%` e `_` do termo; conferir como a
   coluna `title` é guardada e, se houver `title_english`, procurar nas duas). Em `quiz.server.ts`,
   `sugerirQuizzes(q, limite = 2)` (só publicados). Nenhuma chama o AniList.
   *Verificar:* `npm run typecheck`; teste com banco falso ou `hasDatabase()` falso devolvendo listas vazias.
2. **[P] `app/server/topo.server.ts`.** `sugestoes(q)`: `q` normalizado (trim, minúsculas, 60 caracteres); com menos de
   2 letras devolve `{ emAlta: trendingTags(8) }`; senão `{ animes, posts, quizzes }` em paralelo. Tudo em
   `cached("sug:" + q, 5 * 60_000, …)`. `agora(now)`: `{ noticias: latestPosts({ type: "news" }, 3), noAr, emAlta:
   trendingTags(6), hoje: <nº de matérias publicadas hoje, Brasília> }`, com `noAr` = `airingBetween(now, fimDoDia)`
   pegando os 4 primeiros (se vazio, os 4 primeiros de amanhã com `amanha: true`). Em `cached("agora", 60_000, …)`.
3. **[P] Rotas.** `app/routes/api.sugestoes.ts` (`GET ?q=`) e `app/routes/api.agora.ts`, ambas resource routes com
   `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300` (sugestões: `max-age=300,
   s-maxage=300`) e `X-Robots-Tag: noindex`. Registrar em `app/routes.ts` (`api/sugestoes`, `api/agora`). Em
   `server-app.js`, a regra das linhas 53 a 59 **não** põe `no-store` em `^/api/(sugestoes|agora)$` (continua pondo o
   `noindex`).
   *Verificar:* `curl -sI localhost:<porta>/api/agora` → `cache-control: public, max-age=60, s-maxage=60...`; `curl -s
   "localhost:<porta>/api/sugestoes?q=one"` → JSON com as 3 listas.
4. **[P] `app/lib/buscas-recentes.ts`** (ler, adicionar, remover, limpar; `try/catch` para modo privado) e o keyframe
   `ap-pop` em `app/app.css`.
5. **[G] `BuscaTopo.tsx`, campo do computador.** Combobox, painel, estados, teclado e atalhos (seção "Componentes > 1").
   Trocar o `<Form>` do `Header.tsx` por `<BuscaTopo variante="topo" />`, com as larguras novas.
   *Verificar:* 1440 e 1024 px, claro e escuro: foco vazio (recentes + em alta), digitar "one", setas, Enter, Esc, `/`,
   Ctrl+K; sem JS (desligar no navegador), Enter ainda leva a `/busca?q=`.
6. **[M] Busca no celular.** Diálogo de tela cheia aberto pelo 🔍 (seção "Componentes > 1, Celular"), com o mesmo
   conteúdo do painel. O ícone continua `<Link to="/busca">`.
   *Verificar:* 375 e 768 px, claro e escuro; teclado virtual não cobre o campo; "Cancelar" e Esc devolvem o foco.
7. **[P] Fechar a entrega 1.**

### Entrega 2: "Agora" e instalar o app

8. **[M] `AgoraTopo.tsx`** (seção "Componentes > 2") no `Header.tsx`, logo depois do `<Logo />`, `hidden md:block`.
   *Verificar:* 1440, 1024 e 768 px, claro e escuro; bolinha cinza → vermelha com notícia nova (para testar, apagar
   `ap-agora-visto` no `localStorage`); abrir apaga a bolinha; painel com teclado; erro (bloquear `/api/agora` no
   DevTools) mostra "Tentar de novo".
9. **[P] Manifesto e registro do app.** `public/manifest.webmanifest` (cores, descrição, atalhos) e `app/lib/pwa.ts`;
   `registrarApp()` no `useEffect` do `Header`; `<link rel="manifest">` no `root.tsx` se faltar.
   *Verificar:* DevTools > Application: manifesto sem erro, service worker `sw.js` ativo; `offline.html` aparece sem rede.
10. **[P] `InstalarApp.tsx`** no topo (≥ 1024 px) e na gaveta (seção "Componentes > 3").
    *Verificar:* Chrome no computador (aparece; instalar; some), Chrome no Android (linha na gaveta), Safari no iPhone
    (linha leva a `/como-instalar`; conferir se o texto dessa página fala do site novo), Firefox (não aparece).
11. **[P] Fechar a entrega 2.**

### Entrega 3: faixa da equipe e acabamento

12. **[P] `visitantesHoje(dia)`** em `app/visitas/server/consultas.server.ts` e o campo `painel` no `api.eu.ts` (só com
    `admin` ou `moderator`, em `cached` e `try/catch`). `UserMenu.tsx`: tipo `Estado` com `painel?`, `useViewer`
    exportado. Teste: `/api/eu` com sessão de admin devolve `painel.robo.teto`; sem sessão, não tem `painel`.
13. **[M] `PainelEquipeTopo.tsx`** (seção "Componentes > 4") no `Header.tsx`; nome do avatar a partir de 1280 px.
    *Verificar:* admin em 1440 e 1280 px (pílulas cabem, nada quebra linha), 1279 px (somem); visitante nunca vê;
    `ap_logado=1` forjado sem sessão não mostra pílulas (o `/api/eu` não devolve `painel`).
14. **[P] Conferência de larguras.** 1440, 1280, 1024, 768, 390 e 375 px, visitante e admin, claro e escuro; aplicar o
    fallback do "Entrar" se 1024 px apertar.
15. **[P] Fechar a entrega 3** e os docs (README, `decisoes.md`, `design.md`).

## Riscos e cuidados

- **Cache da CDN:** nenhuma página pública pode chamar `getViewer` no `loader`; nada do topo muda o HTML por pessoa. Os
  endpoints novos são públicos e iguais para todos; o `/api/eu` continua `no-store`.
- **Exceção no `server-app.js`:** casar só os dois caminhos exatos (`^/api/(sugestoes|agora)$`), para nenhuma outra rota
  de `/api` (robô, cron, importar) ganhar cache por engano.
- **Hidratação:** "Agora" e "Instalar" não podem ler `localStorage`, `matchMedia` ou `navigator` durante a renderização;
  só em `useEffect`. O HTML do servidor do "Agora" é sempre a bolinha cinza.
- **AniList:** as sugestões **nunca** chamam o AniList (cota de 90 por minuto; ver decisão de 2026-11-14). "Ver animes
  com “termo”" leva à `/animes?q=`, que já tem a cota.
- **Busca sem JS e sem foco preso:** o formulário GET continua; o diálogo do celular é `<dialog>` nativo (foco preso e
  Esc de graça), como a gaveta.
- **Service worker:** o `sw.js` não guarda páginas (rede primeiro, só a `offline.html`), então não prende ninguém numa
  versão velha. Não mudar o nome do arquivo (os celulares com o app do site antigo usam o mesmo).
- **Admin:** o campo `painel` só para quem `getViewer` disser `admin`/`moderator` (nunca pelo marcador); falha nas
  consultas não pode derrubar o `/api/eu` (o avatar some se ele falhar).
- **Atalho Ctrl+K:** não capturar com o foco em `input`, `textarea`, `select` ou `contenteditable` (o `/` só fora deles;
  Ctrl+K em qualquer lugar, como no antigo).
- **Regras de sempre:** loaders usam `routePath(request)`; `npm run build` antes do push; commit e push ao fim de cada
  entrega; nenhuma migration; nenhum segredo no git.

## Como verificar

Local (`npm run dev`) e depois em produção, em cada entrega:

1. **Visitante** (janela anônima), 1440, 1024, 768 e 375 px, claro e escuro: o topo fica numa linha; o logo não encolhe;
   bate com os wireframes.
2. `curl -s https://animeprofile.com.br/ | grep -cE 'href="/(feed|missoes|ranking|quarto|admin|perfil|salvos)"'` → `0`
   (nada novo de logado no HTML).
3. `curl -sI https://animeprofile.com.br/` → `cache-control: public, max-age=0, s-maxage=60...` e sem `set-cookie`.
4. `curl -sI https://animeprofile.com.br/api/agora` e `.../api/sugestoes?q=naruto` → `cache-control: public...`;
   `curl -sI https://animeprofile.com.br/api/eu` → `no-store`.
5. **Admin logado:** recarregar; pílulas e avatar entram juntos; os números batem com o `/admin` (visitantes de hoje) e
   com `/api/robo/status` (publicadas hoje e teto).
6. **Teclado:** Tab percorre logo → Agora → busca → instalar → ações → avatar; `/` e Ctrl+K focam a busca; Esc fecha
   qualquer painel e devolve o foco; foco azul visível sobre o topo escuro.
7. **Leitor de tela** (NVDA ou VoiceOver, uma passada): a busca é anunciada como caixa de combinação com lista; o
   "Agora" como botão com diálogo; as pílulas leem o `aria-label` inteiro.
8. **Reduzir movimento** ligado no sistema: sem `ping` na bolinha e sem animação de abrir.
9. `npm run typecheck`, `npm test`, `npm run build` passam.

**Critério de pronto (visual):** em 1440 px escuro, o topo mostra logo, "● Agora", a busca centralizada com o `/`, e à
direita só o que a pessoa tem (visitante: Entrar + Contas em breve; admin: 2 pílulas + 3 ícones + avatar com nome); o
único vermelho visível com tudo fechado é a bolinha (quando há novidade) e o botão "Contas em breve". Os painéis abertos
batem com os wireframes (largura, seções, rótulos em caixa alta, ativa com barra vermelha).

## Perguntas em aberto (para o dono)

Nenhuma bloqueia; sem resposta, o executor segue com a **recomendada**.

1. **Nome do botão:** "Agora" (**recomendado**: curto e honesto) ou "Ao vivo" (sugere vídeo ao vivo, que o site não tem)?
2. **Botão vermelho do visitante:** manter "Contas em breve" (**recomendado** até as contas abrirem; é a decisão da
   fase 1) ou trocar por "Instalar app" quando o navegador permitir?
3. **Proposta 5 (menu "Mais" com redes sociais, RSS e tema no topo do computador):** não fazer agora (**recomendado**) ou
   incluir na entrega 2?
4. **Faixa da equipe:** robô + visitas (**recomendado**) ou também um botão "Nova matéria"? (Recomendado: o "Nova
   matéria" entra junto com a tela Posts do [plano-telas-painel.md](plano-telas-painel.md), quando existir o destino.)
5. **Sugestões da busca:** animes, matérias e quizzes (**recomendado**) ou também o blog da comunidade? (O blog é público,
   mas no menu só aparece para logados; recomendado esperar as contas.)
