# Plano: Otaku TV com cara de "YouTube", como no site antigo

**Status: executado em 2026-11-17** (passos 1 a 7; falta a conferência do dono). Plano de 2026-11-17, para executar **na ordem dos passos**, **depois das tarefas da virada**
([plano-virada-parcial.md](plano-virada-parcial.md)). Cada passo é uma entrega pequena: `npm run typecheck`, `npm test`,
`npm run build`, commit e push. **Nenhuma migration**, nenhuma API paga, nenhum cookie.

## Objetivo

Deixar `/otaku-tv` com a estrutura da Otaku TV do site antigo (player grande no topo, "A seguir" ao lado, abas, busca,
grade de vídeos com fileiras de outras categorias no meio), com o acabamento do "Top 10 claro": um **palco escuro** em
cima (player e fila) e a página clara embaixo (grade).

## Contexto

### Como o site antigo faz (`animeprofile-old/src/routes/otaku-tv.tsx`, `lib/otaku-tv.ts`, `lib/otaku-tv.functions.ts`)

- **Cabeçalho pequeno:** rótulo "Otaku TV" (ícone `MonitorPlay`), H1 "Vídeos de **anime**" e uma linha de introdução.
  Sem faixa escura grande: o player aparece logo.
- **Linha de controles:** 3 abas em pílula ("Das matérias", "Trailers da temporada", "Aberturas e encerramentos") à
  esquerda e a busca (320 px) à direita. Na aba de músicas, um seletor "Aberturas / Encerramentos".
- **Player + "A seguir":** grade `lg:grid-cols-[minmax(0,1fr)_340px]`. O player é 16:9, mostra a miniatura com um botão
  de play e **só carrega o iframe no clique** (`youtube-nocookie`, `rel=0`). Abaixo: título, tipo · "há 3 dias", resumo
  (3 linhas) e botões "Ler a matéria", "Ver o anime", "Ver no YouTube", "Copiar link" e "Compartilhar no Feed" (logado).
  A lista "A seguir" (10 itens, miniatura de 144 px + título) tem a **mesma altura do player + informações** (o `<aside>`
  é `relative` e a lista é `absolute inset-0` com rolagem interna). **No celular a lista some** (`hidden lg:block`).
- **Qual vídeo aparece:** o do link (`?v=<id do YouTube>`), senão o primeiro da lista, **sem tocar**. Clicar num cartão
  troca o vídeo **sem recarregar a lista** (estado no navegador + `?v=` com `replace`), já tocando, e rola até o player.
- **Lista:** "Vídeos das matérias" = só matérias **de anime** (`anilist_id` preenchido, ou artigo, ou categoria
  `animes-e-mangas`), cada vídeo uma vez. Grade `2 / lg:3 / xl:5` colunas, 20 por vez com "Carregar mais".
- **Fileiras "Veja também":** vídeos das matérias que **não** são de anime, agrupados por categoria (12 por categoria,
  a categoria com mais vídeos primeiro), com títulos divertidos ("Pausa pro controle" em Games, "Pega a pipoca" em
  Filmes e Séries, "Direto do evento", "Arrasta pra cima" em Apps; outras: "Veja também: <nome>") e o link "Mais de
  <categoria> →". Entram **a cada 10 vídeos** da grade (só na aba das matérias e sem busca); as que sobram vão no fim.
- **Trailers:** AniList da temporada, no navegador. **Músicas:** AnimeThemes (`.webm`) no navegador, com busca por anime.
- **SEO:** canônica sempre `/otaku-tv`; com `?v=` o título e a prévia (og:image = miniatura do vídeo) mudam para
  compartilhar; JSON-LD `CollectionPage` + `ItemList` com links para as **matérias** (sem `VideoObject`, de propósito:
  o vídeo é marcado onde ele é o conteúdo principal) + `BreadcrumbList`.
- **Com conta:** cada vídeo tocado conta na missão "Sessão pipoca" (`record_otaku_tv_play`), e há "Compartilhar no Feed".
- **Anúncio:** um `AdSlot` entre o player e a grade.

### Como o site novo está hoje

- **`app/routes/otaku-tv.tsx`:** `PageHeader` escuro grande (rótulo, título, introdução, abas) e, **só com `?v=`**, uma
  seção com o player e, ao lado, título, botões e um `SideCard` "A seguir" (5 itens). Sem `?v=` não há player: a página
  começa direto na grade de 4 colunas com paginação. A busca é um `<Form method="get">`.
- **Troca de vídeo:** cada cartão é um `Link` para `/otaku-tv?v=<id>`; o loader roda de novo (lista inteira de novo) e
  o player abre **já tocando** (`autoplay` sempre ligado, mesmo vindo de um link compartilhado). O link do cartão perde
  `q` e `pagina` (na página 2, clicar num vídeo volta a lista para a página 1).
- **Dados (`app/server/tv/tv.server.ts`):** `rebuildPostVideos()` lê `posts.content_html LIKE '%youtu%'`, extrai os ids
  com a regex `YT` e grava os pares em `post_videos` (migration 008). A tarefa `videos-materias` refaz a tabela a cada
  6 h (`40 */6 * * *`) e a importação também. `listPostVideos` traz **todas** as linhas a cada visita, deduplica em JS
  (fica a matéria mais recente) e pagina; **não separa anime do resto** (não há fileiras). `listTrailers` lê
  `anime_catalog.trailer_youtube` da temporada. `findVideo(id)` acha a matéria mais recente com o vídeo, ou o trailer.
- **Aba de músicas:** `ThemesTab` (em `app/components/otaku-tv.tsx`) busca no AnimeThemes pelo navegador e mostra o
  player `<video>` **numa caixa própria, acima da grade**, fora do layout de player + fila.
- **SEO:** `seo()` com canônica da aba (`/otaku-tv` ou `/otaku-tv?tab=...`), `noindex` com busca ou página > 1, **sem
  og:image** do vídeo e **sem JSON-LD**.
- **Home:** `OtakuTvPanel` (`app/routes/home.tsx`) liga para `/otaku-tv?v=<id>`.
- **Robô de notícias:** publica matérias novas, mas o vídeo delas só entra na Otaku TV na próxima rodada de
  `videos-materias` (até 6 h depois).

### O que muda e por quê

Pedido do dono (2026-11-17): a Otaku TV deve ficar no esquema da página antiga, parecendo um "YouTube", repetindo
praticamente a mesma estrutura, com melhoria de layout (mesma instrução do menu). O que falta hoje: player sempre no
topo, fila ao lado com a altura do player, troca de vídeo sem recarregar, sem autoplay em link compartilhado, separação
anime x outras categorias com fileiras, músicas no mesmo player, prévia com a miniatura e JSON-LD.

## Decisões de design

### Direção visual

"Sala de cinema dentro do site": o topo da página é um **palco escuro** (`night`, o mesmo da faixa do topo e do
`PageHeader`, com o brilho vermelho no canto), que **contém** o cabeçalho curto, as abas, o player e a fila "A seguir",
como o modo cinema do YouTube. Embaixo, a página clara de sempre com a grade. Nada de gradiente nos botões nem brilho
rosa do site antigo; o vermelho `brand` aparece só no botão de play, no botão principal e no item tocando.

**Hierarquia:** 1) o player (maior coisa da tela, logo abaixo do topo); 2) título do vídeo e "Ler a matéria";
3) a fila "A seguir"; 4) as abas e a busca (pequenas, acima do player); 5) a grade e as fileiras.

### Estrutura em 1440 px (lateral esquerda aberta, 256 px)

Coluna de conteúdo = 1440 − 256 = 1184 px. Palco e área clara usam `max-w-[1600px]` com `lg:px-8` (largura útil
1120 px). Player: 1120 − 24 (vão) − 360 (fila) = **736 × 414 px**. Com a lateral recolhida (72 px): player de 920 px.

```
┌──────────────── Header (night, 72 px, sticky) ─────────────────────────────────────────────────┐
├ Lateral ┬ AvisoContas ───────────────────────────────────────────────────────────────────────────┤
│ 256 px  │ ┌ PALCO (bg-night, brilho vermelho, rounded-b-[28px]) ────────────────────────────────┐│
│         │ │ ▣ Otaku TV (rótulo glow)                                 [🔍 Buscar nas matérias  ]││
│         │ │ Vídeos de anime (H1 2rem)                                                          ││
│         │ │ (● Das matérias) ( Trailers da temporada ) ( Aberturas e encerramentos )           ││
│         │ │                                                                                    ││
│         │ │ ┌──────────────── player 16:9 (736 px) ───────────┐  A SEGUIR · 12               ││
│         │ │ │ [Notícia]                                       │  ┌─────┐ Título em duas       ││
│         │ │ │                                                 │  │thumb│ linhas no máximo     ││
│         │ │ │                    ( ▶ )                        │  └─────┘ Notícia · 12 nov     ││
│         │ │ │                                                 │  ┌─────┐ ...                  ││
│         │ │ └─────────────────────────────────────────────────┘  │     │  (rola por dentro,    ││
│         │ │ NOTÍCIA · 12 NOV 2026 (glow)                         └─────┘   mesma altura do     ││
│         │ │ Título do vídeo em até 3 linhas (H2 1.5rem)                    player + info)      ││
│         │ │ Resumo em 2 linhas (white/70)                                                      ││
│         │ │ [▣ Ler a matéria] [Ver o anime] [YouTube ↗] [Copiar link] [WhatsApp]               ││
│         │ └────────────────────────────────────────────────────────────────────────────────────┘│
│         │ ÁREA CLARA (max-w-[1600px] px-8 py-10)                                                 │
│         │ Vídeos das matérias (H2 1.6rem)                                       248 vídeos      │
│         │ [card] [card] [card] [card]                                                          │
│         │ [card] [card] [card] [card]   ← 12 cartões (3 linhas de 4)                            │
│         │ [card] [card] [card] [card]                                                          │
│         │ ┌ Fileira (surface, borda) ─────────────────────────────────────────────────────────┐ │
│         │ │ (🎮) Pausa pro controle                                       Mais de Games →  ‹ › │ │
│         │ │ Trailers de games que passaram pelas nossas notícias                              │ │
│         │ │ [card] [card] [card] [card] [card…  (rola para o lado)                            │ │
│         │ └───────────────────────────────────────────────────────────────────────────────────┘ │
│         │ [card] × 12                                                                           │
│         │ (demais fileiras)                                                                     │
│         │ « 1 2 3 … »  (Pagination)                                                             │
│         │ Footer                                                                                │
└─────────┴───────────────────────────────────────────────────────────────────────────────────────┘
```

### Estrutura em 375 px

```
┌ Header 60 px ───────────────┐
│ AvisoContas (1 linha)       │
├ PALCO (night, rounded-b-24) ┤
│ ▣ Otaku TV                  │
│ Vídeos de anime (1.6rem)    │
│ [🔍 Buscar nas matérias   ] │  ← largura toda, 44 px
│ (Das matérias)(Trailers)(A… │  ← uma linha, rola para o lado
│█████ player sangrando ██████│  ← -mx-4, sem cantos, 375 × 211
│ NOTÍCIA · 12 NOV 2026       │
│ Título do vídeo (1.2rem)    │
│ [   ▣ Ler a matéria       ] │  ← largura toda
│ [📺] [↗] [🔗] [WhatsApp]    │  ← ícones 44 × 44
│ A SEGUIR          Ver todos↓│
│ [thumb 128] título 2 linhas │  ← 3 itens
│ [thumb 128] ...             │
│ [thumb 128] ...             │
└─────────────────────────────┘
 Vídeos das matérias (1.35rem)
 [card][card]   ← 2 colunas
 [card][card]
 ...
 ┌ Fileira ─────────────────┐
 │ (🎮) Pausa pro controle  │
 │ [card 72%][card…  →      │
 └──────────────────────────┘
 Paginação
 BottomNav
```

### Pontos de quebra

| Largura | Player e fila | Grade |
|---|---|---|
| < 640 px | Player sangrando (`-mx-4`, sem raio); "A seguir" com 3 itens abaixo dos botões | 2 colunas |
| 640–1279 px | Player com raio; "A seguir" com 3 itens abaixo dos botões (`md:grid-cols-3`, uma linha de 3 cartões pequenos) | 3 colunas (`md`) |
| ≥ 1280 px (`xl`) | Duas colunas `xl:grid-cols-[minmax(0,1fr)_360px]`, fila ao lado com 12 itens e rolagem interna | 4 colunas |

### Tokens (todos já existem em `app/app.css`; nada novo)

| Uso | Classe | Claro / escuro |
|---|---|---|
| Palco | `bg-night text-night-ink` | `#0d0d10` / `#0b0b0e`, texto `night-ink` |
| Brilho do palco | o mesmo do `PageHeader`: `bg-[radial-gradient(620px_320px_at_85%_0%,rgba(194,53,43,.38),rgba(13,13,16,0)_70%)]` | igual |
| Rótulos no escuro | `text-glow` | `#ff9a90` |
| Texto secundário no escuro | `text-white/70` (resumo), `text-white/55` (metadados) | igual |
| Botão principal | `bg-brand text-brand-ink` | `#c2352b`, texto branco (AA) |
| Botão secundário no escuro | `bg-white/10 text-white hover:bg-white/[.18]` | igual |
| Página clara | `bg-paper`, cartões `bg-surface border-line`, texto `ink` / `ink-soft` | conforme o tema |
| Fonte | Sora (já global). Títulos 800 com `tracking-[-0.03em]` | — |
| Raios | palco `rounded-b-[28px]` (`rounded-b-3xl` no celular), player `rounded-2xl`, cartão `rounded-xl`, fileira `rounded-[22px]`, botões `rounded-[10px]`, abas `rounded-full` | — |
| Sombras | palco `shadow-[0_24px_50px_rgba(60,20,20,.16)]`; player `shadow-[0_30px_60px_rgba(0,0,0,.45)]`; botão de play `shadow-[0_10px_30px_rgba(194,53,43,.5)]` | — |
| Foco | o contorno azul global `#2b5bd7` (não remover em nada) | — |

### Componentes (em `app/components/otaku-tv.tsx`, reescrito)

**Tipo comum `TvItem`** (para YouTube e `.webm`):
`{ key: string; kind: "youtube" | "file"; src: string; title: string; subtitle: string; badge: string; thumb: string;
date: string | null; excerpt: string | null; postUrl: string | null; animeUrl: string | null }`.
Adaptadores: `fromVideo(v: TvVideo)` (key `yt:<id>`, thumb `ytThumb(id, "hq")`) e `fromTheme(t: ThemeItem)`
(key = `t.key`, kind `file`, badge "Abertura"/"Encerramento", `animeUrl` de `anilistId`).
Miniaturas: `ytThumb(id, size: "mq" | "hq" = "hq")` → `https://i.ytimg.com/vi/<id>/<mq|hq>default.jpg`.

1. **`Stage`** (o palco): `<section aria-labelledby="otaku-tv-titulo" class="relative overflow-hidden rounded-b-3xl
   bg-night text-night-ink shadow-[...] sm:rounded-b-[28px]">` + o brilho (`aria-hidden`, `pointer-events-none
   absolute inset-0`) + `<div class="relative mx-auto max-w-[1600px] px-4 pt-5 pb-7 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10">`.
   - **Linha 1** (`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`): à esquerda o rótulo
     `inline-flex items-center gap-1.5 text-[0.82rem] font-bold text-glow` com `MonitorPlay size-3.5` + "Otaku TV", e o
     H1 `id="otaku-tv-titulo" mt-1 text-[1.6rem] sm:text-[2rem] leading-tight font-extrabold tracking-[-0.03em]`
     "Vídeos de anime". À direita a **busca** (abaixo).
   - **Linha 2:** as **abas** (`mt-5`).
   - **Linha 3** (`mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]`): coluna do player (`Player` + `Info` +
     `UpNext variant="below"` com `xl:hidden`) e o `<aside class="relative hidden xl:block">` com `UpNext variant="side"`.
2. **Busca:** `<Form method="get" role="search" class="relative w-full sm:w-80">`, `input type="search" name="q"` com
   `h-11 rounded-full border border-white/10 bg-white/10 pr-10 pl-10 text-white placeholder:text-white/50
   focus:bg-white/15 focus:outline-none` (o mesmo visual da busca do `Header`), lupa à esquerda (`text-white/60`),
   `<label class="sr-only">`, campo oculto `tab` quando a aba não é a das matérias. Com `q` preenchido, um `Link`
   "Limpar busca" (ícone `X`, `size-8 rounded-full hover:bg-white/10`, `aria-label="Limpar busca"`) à direita, para a
   aba sem `q`. Placeholder: "Buscar nas matérias" / "Filtrar trailers" / "Buscar músicas de um anime".
   Na aba de músicas a busca é o campo controlado do `useThemes` (sem enviar o formulário: `onSubmit` com
   `preventDefault`).
3. **Abas:** `<nav aria-label="Seções da Otaku TV">` com 3 `Link` (`aria-current="page"` na ativa), ícones `Newspaper`,
   `Clapperboard`, `Music`. Visual atual mantido: `inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4
   text-[0.88rem] font-semibold`, ativa `bg-white text-night`, outras `bg-white/12 text-white hover:bg-white/20`.
   Contêiner `-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0
   [&::-webkit-scrollbar]:hidden`. Na aba de músicas, ao lado (ou abaixo no celular), o **seletor** Tudo / Aberturas /
   Encerramentos: `role="group" aria-label="Tipo de música" class="inline-flex rounded-full bg-white/8 p-1"`, botões
   `h-9 rounded-full px-3.5 text-[0.85rem] font-semibold` com `aria-pressed`, ativo `bg-brand text-brand-ink`, outros
   `text-white/70 hover:text-white`.
4. **`Player`** `({ item, play })`: caixa `relative aspect-video overflow-hidden bg-black -mx-4 sm:mx-0 sm:rounded-2xl
   sm:ring-1 sm:ring-white/10 sm:shadow-[0_30px_60px_rgba(0,0,0,.45)]`, `id="player"`, `scroll-mt-[84px]` (topo de 72 px +
   folga).
   - **Antes do clique (pôster):** `<button type="button" aria-label="Assistir: <título>" class="group absolute
     inset-0">` com `<img src=thumb alt="" fetchpriority="high" width="480" height="360" class="size-full object-cover">`
     (a miniatura `hq` é 4:3 com faixas pretas; o `object-cover` em 16:9 corta exatamente as faixas), degradê
     `bg-[linear-gradient(0deg,rgba(0,0,0,.55),transparent_55%)]`, selo do tipo no canto (`absolute top-3 left-3
     rounded-md bg-black/70 px-2 py-1 text-[0.72rem] font-bold text-white`) e o **botão de play** central
     `grid size-[72px] place-items-center rounded-full bg-brand text-brand-ink shadow-[0_10px_30px_rgba(194,53,43,.5)]
     motion-safe:transition-transform group-hover:scale-[1.06] group-focus-visible:scale-[1.06]` com `Play size-8
     fill-current ml-1`. Para `.webm` (capa em pé do AnimeThemes): a capa entra duas vezes, uma `object-cover blur-md
     opacity-50 scale-110` de fundo e outra `object-contain` por cima (como no antigo).
   - **YouTube tocando:** `<iframe key={src} src="https://www.youtube-nocookie.com/embed/<id>?rel=0&modestbranding=1&playsinline=1&autoplay=1"
     title={título} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
     referrerPolicy="strict-origin-when-cross-origin" class="absolute inset-0 size-full">`. O iframe **só existe depois
     do clique** (é o "lazy": a página não carrega nada do YouTube antes). O `referrerPolicy` é obrigatório: sem
     referer o YouTube recusa o embed (erro 153).
   - **`.webm` tocando:** `<video key={src} src controls autoPlay playsInline preload="none" poster={thumb}
     class="absolute inset-0 size-full bg-black object-contain">`.
   - **Regra do autoplay:** `play` só é `true` quando a troca veio de um clique **nesta visita** (estado da navegação
     `{ play: true }` ou o clique no pôster). Link aberto de fora (`/otaku-tv?v=...` compartilhado, Google, recarregar)
     mostra o **pôster parado**. Trocar de `item.key` volta para o pôster, a menos que a troca venha com `play`.
5. **`Info`** (abaixo do player, `mt-4`): metadados `text-[0.8rem] font-bold uppercase tracking-[0.08em] text-glow`
   ("Notícia · 12 nov 2026", com `formatDate`; trailer: "Trailer · Outono 2026"); H2 `mt-1.5 line-clamp-3
   text-[1.2rem] sm:text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]`; resumo `mt-2 line-clamp-2
   max-w-[70ch] text-white/70` (só se houver). **Botões** (`mt-4 flex flex-wrap gap-2`):
   - "Ler a matéria" (ícone `Newspaper`), principal, `inline-flex h-11 items-center gap-2 rounded-[10px] bg-brand px-4
     font-bold text-brand-ink hover:brightness-110`; no celular `w-full justify-center sm:w-auto`. Só com `postUrl`.
     Sem matéria (trailer, música) o primeiro botão vira "Ver o anime" no estilo principal.
   - Secundários, `inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] bg-white/10 px-3
     font-semibold text-white hover:bg-white/[.18]`, rótulo visível a partir de `sm` (`hidden sm:inline`) e
     `aria-label` + `title` sempre: "Ver o anime" (`Tv`, se ainda não for o principal), "Ver no YouTube" (`ExternalLink`,
     `target="_blank" rel="noreferrer"`, só YouTube), "Copiar link" (`Link2`; ao copiar vira `Check` + "Link copiado"
     por 2 s, com `aria-live="polite"`), "WhatsApp" (`MessageCircle`, `https://wa.me/?text=<título> <link>`).
     O link compartilhado é `absoluteUrl("/otaku-tv?v=<id>")` (+ `&tab=trailers` na aba de trailers). Música não tem
     "Copiar link" (o antigo também não).
6. **`UpNext`** `({ items, current, variant })`: a fila é **circular a partir do vídeo atual** (os que vêm depois dele
   na lista da página, depois os do começo), sem o atual. Se o atual for de uma fileira, a fila começa pelo resto da
   fileira e continua na grade.
   - `variant="side"` (≥ 1280 px): `<div class="absolute inset-0 flex flex-col">` (mesma altura do player + info,
     como no antigo); cabeçalho `flex items-baseline justify-between` com `<h2 class="text-[0.78rem] font-bold uppercase
     tracking-[0.14em] text-white/60">A seguir</h2>`; `<ol class="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1
     [scrollbar-width:thin]">` com **12** itens; um degradê no pé (`pointer-events-none h-8 bg-gradient-to-t
     from-night`) avisa que rola.
   - `variant="below"` (< 1280 px): `mt-6`, mesmo cabeçalho com o link "Ver todos" (`text-[0.85rem] font-bold
     text-glow`, âncora `#lista`), **3** itens; em `md` vira `grid grid-cols-3 gap-3` com a miniatura em cima.
   - **Item:** `Link` (`to` = `cardHref`, `state={{ play: true }}`, `preventScrollReset`) com `group flex gap-3
     rounded-xl p-2 hover:bg-white/8`; miniatura `relative w-[148px] shrink-0 aspect-video overflow-hidden rounded-lg
     bg-white/5` (128 px no celular) com `ytThumb(id, "mq")`, `loading="lazy"`, `width=320 height=180`; título
     `line-clamp-2 text-[0.88rem] leading-snug font-semibold group-hover:text-glow`; metadados `mt-0.5
     text-[0.75rem] text-white/55`.
   - Sem itens (lista de 1 vídeo): o bloco não aparece.
7. **`VideoCard`** (área clara): o cartão inteiro é um `Link` (`group block rounded-xl
   focus-visible:outline-offset-4`, `state={{ play: true }}`, `preventScrollReset`):
   - miniatura `relative aspect-video overflow-hidden rounded-xl bg-sunken` com `<img src=mq srcSet="mq 320w, hq 480w"
     sizes="(min-width:1280px) 280px, (min-width:768px) 33vw, 50vw" loading="lazy" decoding="async" width=320
     height=180 class="size-full object-cover motion-safe:transition-transform motion-safe:duration-300
     group-hover:scale-[1.03]">`;
   - selo do tipo (`absolute top-2 left-2 rounded-md bg-night/80 px-2 py-0.5 text-[0.7rem] font-bold text-white`);
   - play no hover/foco: `absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/25`, círculo
     `size-11 rounded-full bg-white/95 text-night` com `Play size-5 fill-current`, `opacity-0 group-hover:opacity-100
     group-focus-visible:opacity-100`;
   - **tocando agora** (`active`): `ring-2 ring-brand ring-offset-2 ring-offset-paper` na miniatura, o selo vira
     "Tocando" em `bg-brand text-brand-ink` com o ícone `AudioLines size-3`, e o `Link` ganha `aria-current="true"`;
   - título `mt-2.5 line-clamp-2 text-[0.92rem] sm:text-[0.95rem] leading-snug font-bold group-hover:text-brand
     dark:group-hover:text-glow`; metadados `mt-0.5 text-[0.78rem] text-ink-soft` ("Notícia · 12 nov 2026").
   - Variante `compact` (dentro das fileiras): mesmo cartão com `w-[72%] shrink-0 snap-start sm:w-[260px]`.
8. **`Shelf`** (fileira "Veja também"): `<section aria-labelledby=... class="rounded-[22px] border border-line
   bg-surface p-5 sm:p-6">`; cabeçalho `flex items-start justify-between gap-3`: ícone num círculo `grid size-9
   place-items-center rounded-full bg-brand-soft text-brand dark:text-glow` (lucide, 18 px), H3 `text-[1.15rem]
   font-extrabold`, frase `text-[0.85rem] text-ink-soft`; à direita "Mais de <categoria> →" (`text-[0.85rem] font-bold
   text-link hover:underline`, para `/categoria/<slug>`) e, a partir de `md`, as setas ‹ › (`size-9 rounded-full
   border border-line bg-surface hover:bg-sunken`, `aria-label="Anterior"/"Próximo"`, `scrollBy` de 80% da largura,
   como no `TopTen` de `app/components/anime.tsx`, com `behavior: "auto"` se "reduzir movimento"). Faixa `mt-4 -mx-5
   flex snap-x snap-mandatory scroll-pl-5 gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6
   [&::-webkit-scrollbar]:hidden`.
   Textos e ícones (sem emoji): `games` → `Gamepad2` "Pausa pro controle" / "Trailers de games que passaram pelas
   nossas notícias"; `filmes-e-series` → `Popcorn` "Pega a pipoca" / "Filmes e séries que não são anime (ninguém é
   perfeito)"; `eventos` → `Ticket` "Direto do evento" / "O que rolou nos palcos e painéis por aí"; `apps` →
   `Smartphone` "Arrasta pra cima" / "Apps e novidades para o celular"; outra → `Eye` "Veja também: <nome>" / "Vídeos de
   <nome> nas nossas matérias".
9. **`EmptyStage`** (palco sem vídeo): no lugar do player, caixa `aspect-video grid place-items-center rounded-2xl
   border border-dashed border-white/15 bg-white/[.03] text-center` com `MonitorPlay size-10 text-white/40`, frase
   `mt-3 font-semibold` e a ação abaixo (textos em "Estados vazios").
10. **`PlayerSkeleton`** (só na aba de músicas, enquanto o AnimeThemes responde): `aspect-video rounded-2xl
    bg-white/5 motion-safe:animate-pulse` + 3 linhas `h-3 rounded bg-white/10` no lugar da info; fila com 6 linhas
    iguais. Texto abaixo: "Carregando as músicas de <Temporada>. Esse serviço é lento: pode levar uns segundos."

### Reuso

- `app/components/posts.tsx`: `Pagination` (paginação da grade, já com `query`).
- `app/lib/format.ts`: `formatDate` (data absoluta; **não** usar `timeAgo` aqui: com o cache de 60 s da CDN, "há 3 h"
  ficaria velho e daria diferença de hidratação).
- `app/lib/themes.ts`: `fetchSeasonThemes`, `searchThemes`, `ThemeItem` (sem mudança).
- `app/lib/seo.ts` (`seo`) e `app/lib/site.ts` (`absoluteUrl`, `SITE`).
- `app/server/cache.server.ts`: `cached`, `clearCache`.
- `app/components/anime.tsx`: o jeito das setas do `TopTen` (copiar a lógica do `scrollBy`, não o visual).
- O visual da busca do `app/components/layout/Header.tsx` e o brilho do `app/components/PageHeader.tsx`.

## Dados

### De onde vêm os vídeos hoje

| Aba | Fonte | Onde |
|---|---|---|
| Das matérias | ids do YouTube no `posts.content_html` → `post_videos` | servidor, `tv.server.ts` |
| Trailers da temporada | `anime_catalog.trailer_youtube` (tarefa `animes-anilist`) | servidor, `tv.server.ts` |
| Aberturas e encerramentos | API do AnimeThemes | navegador, `app/lib/themes.ts` (decisão de 2026-11-15) |

### O que falta (tudo sem migration)

1. **Separar anime do resto** (regra do antigo): matéria "de anime" = `p.anilist_id IS NOT NULL OR p.post_type =
   'article' OR EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id =
   p.id AND c.slug = 'animes-e-mangas')`. A grade principal só mostra essas.
2. **Fileiras:** as outras (notícias sem anime e fora de `animes-e-mangas`), agrupadas por categoria (ignorar
   `sem-categoria`), 12 por categoria, a categoria com mais vídeos primeiro. Um vídeo que está em duas categorias
   aparece nas duas (como no antigo).
3. **Cache:** a lista inteira de cada fonte fica em `cached()` por 5 min (matérias e fileiras) e 10 min (trailers); a
   busca e a paginação são feitas em JS sobre a lista em cache. `rebuildPostVideos()` e a importação chamam
   `clearCache()`.
4. **Vídeo do robô na hora:** quando a rodada do robô publicar pelo menos uma matéria, chamar `rebuildPostVideos()` no
   fim (é uma consulta só e alguns `INSERT`), para o vídeo entrar na Otaku TV na hora, e não até 6 h depois.

Fica como está: dedupe na **matéria mais recente** com o vídeo (o antigo usava a primeira; a mais recente leva à
matéria mais atual, e a ordem da lista continua por data).

## Comportamento

- **Qual vídeo aparece no palco:** `?v=` se for um id válido (`/^[A-Za-z0-9_-]{11}$/`); senão o **primeiro da lista**
  da aba (pôster parado). Com `?v=` que não está na lista da página, o loader usa `findVideo`; se nem assim achar, um
  item genérico ("Vídeo da Otaku TV", miniatura do YouTube), como hoje. Id inválido é ignorado.
- **Troca de vídeo sem recarregar a lista:** os cartões e a fila são `Link`s para o `cardHref(id)` com
  `state={{ play: true }}` e `preventScrollReset`. A rota exporta `shouldRevalidate`: se de uma URL para a outra **só**
  mudou o `v`, devolve `false` (o loader não roda; a lista e as fileiras continuam as mesmas). O componente acha o vídeo
  em `loaderData` (lista + fileiras + `selected`) pelo `v` de `useSearchParams()`. Depois da troca, um `useEffect` rola
  até `#player` (`scrollIntoView({ block: "start", behavior: reduzirMovimento ? "auto" : "smooth" })`) **só se o topo do
  player estiver fora da tela**.
- **`cardHref`** preserva `tab`, `q` e `pagina` (hoje perde `q` e `pagina`) e troca só o `v`. O primeiro vídeo da
  lista também recebe `v` ao ser clicado.
- **Aba de músicas:** o `ThemesTab` some; o estado vai para um hook `useThemes()` (mesmo código de hoje: busca com
  450 ms de espera, `AbortController`, "Carregar mais", "Tentar de novo"), e a rota desenha o **mesmo palco**: player
  com o item escolhido (o primeiro da lista enquanto ninguém escolhe, parado), fila "A seguir" com os próximos e a grade
  de capas embaixo (`aspect-[3/4]`, 2 / `md`3 / `xl`5 colunas, com o selo Abertura/Encerramento). Escolher uma música
  não muda a URL (o `.webm` não tem id curto; o antigo também não). Fonte no pé: "Fonte: AnimeThemes.moe" com link.
- **Fim do vídeo:** não pula sozinho para o próximo (precisaria da API JS do YouTube; fica para depois).
- **Endereços antigos:** `/otaku-tv?v=<id>`, `?tab=trailers`, `?tab=musicas` e `?tab=materias` (= sem `tab`) continuam
  valendo, então os links do site antigo e da home seguem funcionando.

## SEO

- **URL de cada vídeo:** continua `/otaku-tv?v=<id>` (parâmetro), **com a canônica da aba** (`/otaku-tv` ou
  `/otaku-tv?tab=trailers` / `?tab=musicas`), como o antigo. Nada de `/otaku-tv/<slug>` agora (ver Perguntas).
- **`meta()`** (usa `loaderData` + `location.search`, para o título acompanhar a troca de vídeo sem loader):
  - sem `v`: títulos de hoje ("Otaku TV: vídeos e trailers de anime", "Trailers de anime da temporada", "Aberturas e
    encerramentos de anime"); descrição "Trailers, vídeos das matérias e aberturas e encerramentos dos animes, num lugar
    só."; `image` = miniatura `hq` do primeiro vídeo da lista;
  - com `v` achado: título `"<título do vídeo> · Otaku TV"` (o `seo()` põe " | Anime Profile"), descrição = resumo da
    matéria (ou a padrão), `image` = `ytThumb(v, "hq")` (o `seo()` já põe `summary_large_image`);
  - `path` = a canônica da aba; `noindex` com `q` ou `pagina > 1` (como hoje). A canônica sai em
    `https://animeprofile.com.br` pelo `absoluteUrl` (vem de `VITE_SITE_URL`, já trocado na virada).
- **JSON-LD** (`jsonLd` do `seo()`, num `@graph`): `CollectionPage` (`name: "Otaku TV"`, `url`, `inLanguage: "pt-BR"`,
  `isPartOf` o `WebSite`), `mainEntity` `ItemList` com até 20 `ListItem` apontando para as **matérias** (aba das
  matérias) ou para as **fichas dos animes** (trailers), e `BreadcrumbList` (Início → Otaku TV). Na aba de músicas, só a
  `CollectionPage` e o `BreadcrumbList` (a lista vem do navegador).
- **`VideoObject`: não entra em `/otaku-tv`.** As variantes `?v=` apontam a canônica para a lista, e o Google avisa
  "o vídeo não é o conteúdo principal" numa página de lista. O lugar certo é a página da matéria (ver Perguntas).
- **`links()`:** `preconnect` para `https://i.ytimg.com` (as miniaturas são o LCP).

## Acessibilidade

- H1 único ("Vídeos de anime"); título do vídeo em H2; "A seguir" H2; grade H2 com `id="lista"`; fileiras H3.
- Pôster é `<button>` com `aria-label="Assistir: <título>"`; iframe com `title`; `<video>` com `controls`.
- Cartões e itens da fila são links de verdade (funcionam sem JS, abrem em nova aba com o botão do meio); o tocando tem
  `aria-current="true"`.
- Abas: `<nav>` com `aria-current="page"`; seletor de músicas com `aria-pressed`.
- Alvos de 44 px (abas, botões, ícones do celular); foco azul global visível no escuro e no claro.
- "Reduzir movimento": sem zoom no hover, sem pulso no esqueleto, rolagem sem animação.
- Sem rolagem horizontal da página em 375 px (as faixas rolam dentro delas).
- "Link copiado" anunciado por `aria-live="polite"`.

## Estados vazios e de erro

| Situação | O que aparece |
|---|---|
| Matérias sem nenhum vídeo | Palco com `EmptyStage` "Nenhum vídeo por aqui ainda." e o botão "Ver os trailers da temporada"; grade não aparece |
| Busca sem resultado | Palco com `EmptyStage` "Nenhum vídeo encontrado para “<q>”." e o link "Limpar busca"; grade some; `noindex` |
| Trailers vazios (começo de temporada) | `EmptyStage` "Os trailers de <Temporada> ainda não chegaram." + "Ver os vídeos das matérias" |
| `?v=` não encontrado (id válido) | Item genérico "Vídeo da Otaku TV" com a miniatura do YouTube (tocável) |
| Música: carregando | `PlayerSkeleton` + texto de espera |
| Música: erro | No lugar do player, o aviso de hoje ("Não consegui carregar as músicas agora." + explicação + "Tentar de novo") |
| Música: nada encontrado | `EmptyStage` "Nenhuma música encontrada para “<q>”." |
| Fileiras vazias | Não aparecem |
| Banco fora (`hasDatabase()` falso) | Mesmo que "Matérias sem nenhum vídeo" |

## Desempenho

- A página sai com `s-maxage=60` na CDN e **sem cookie**: tudo que varia por visitante (vídeo tocando, aba das
  músicas) fica no navegador; o HTML de `/otaku-tv?v=X` é o mesmo para todos.
- Nada do YouTube carrega antes do clique (só miniaturas de `i.ytimg.com`). Primeira miniatura do palco sem `lazy` e
  com `fetchpriority="high"`; o resto `lazy`.
- Cartões com `mq` (320 × 180, ~10 KB) e `srcSet` para `hq`; `width`/`height` em todas as imagens (sem pulo de layout).
- Loader: 1 a 3 leituras de cache em memória por visita; trocar de vídeo não chama o loader (`shouldRevalidate`).
- AnimeThemes só é chamado na aba de músicas (hoje também).

## O que NÃO entra agora (depende de conta)

Curtir, salvar/favoritos, "Continue assistindo"/histórico, comentários do vídeo, "Compartilhar no Feed" e a missão
"Sessão pipoca" (`otaku_tv_plays`). **Recomendação: não mostrar nada** (nem botão desativado), como o dono já
recomendou para a lateral ("placeholder 'Em breve' na lateral: não"). Quando as contas voltarem, os botões entram na
linha de ações do `Info`, depois de "Copiar link". O `AdSlot` entre o palco e a grade também espera o AdSense.

## Arquivos afetados

| Arquivo | O que muda |
|---|---|
| `app/server/tv/tv.server.ts` | Filtro de anime, `listShelves()`, cache, `clearCache()` no `rebuildPostVideos()` |
| `app/server/robot/run.server.ts` | Chama `rebuildPostVideos()` no fim da rodada se publicou algo |
| `app/lib/tv.ts` (novo) | Funções puras: `upNext` (fila circular), `interleaveShelves`, `shelfCopy`, `cardHref`, `filterByTitle` |
| `app/components/otaku-tv.tsx` | Reescrito: `TvItem`, adaptadores, `Stage`, `Player`, `Info`, `UpNext`, `VideoCard`, `Shelf`, `EmptyStage`, `PlayerSkeleton`, `useThemes` (o `ThemesTab` sai) |
| `app/routes/otaku-tv.tsx` | Loader, `shouldRevalidate`, `meta` com JSON-LD, `links`, layout novo (sem `PageHeader`) |
| `app/routes/home.tsx` | `OtakuTvPanel`: links com `state={{ play: true }}` (quem clica na home vê o vídeo tocar) |
| `tests/tv.test.ts` (novo) | Testes das funções puras e do filtro de anime |
| `docs/plano-otaku-tv.md`, `docs/README.md`, `docs/decisoes.md` | Status e decisões ao terminar |

## Passos

Todos feitos pelo Claude (dá para fazer em Sonnet, seguindo este plano), exceto a conferência final do dono.

1. **(P) Funções puras e testes.** Criar `app/lib/tv.ts` com: `upNext<T extends { key: string }>(items, currentKey,
   n)` (circular, sem o atual); `interleaveShelves(items, shelves, every)` (igual ao antigo: a cada `every` itens uma
   fileira, sobras no fim, e nenhuma fileira se `shelves` vier vazio); `shelfCopy(slug, name)` → `{ icon, title,
   tagline }` (o ícone como nome: `"games" | "filmes" | "eventos" | "apps" | "outros"`); `cardHref({ tab, q, pagina },
   id)`; `filterByTitle(items, q)` (sem acento e sem caixa: `normalize("NFD").replace(/\p{M}/gu, "")`).
   `tests/tv.test.ts` cobre cada uma. **Verificar:** `npm test`.
2. **(M) Dados no servidor.** Em `tv.server.ts`:
   - `allAnimeVideos()` (cache `tv:materias`, 5 min): a consulta de hoje + o filtro de anime (seção "Dados"), dedupe
     em JS; `listPostVideos(q, page, perPage = 24)` passa a usar o cache + `filterByTitle` + `paginate`;
   - `listShelves(perShelf = 12)` (cache `tv:fileiras`, 5 min): `SELECT v.video_id, p.title, p.excerpt, p.post_type,
     p.slug, p.published_at, c.slug AS cat_slug, c.name AS cat_name FROM post_videos v JOIN posts p ON p.id = v.post_id
     JOIN post_categories pc ON pc.post_id = p.id JOIN categories c ON c.id = pc.category_id WHERE <VISIBLE> AND
     p.anilist_id IS NULL AND p.post_type <> 'article' AND c.slug <> 'sem-categoria' AND NOT EXISTS (... slug =
     'animes-e-mangas') ORDER BY p.published_at DESC`; agrupar em JS (dedupe por vídeo dentro da categoria, 12 por
     categoria, ordem pelo total de vídeos da categoria) → `{ slug, name, total, items: TvVideo[] }[]` com `badge` e
     `subtitle` = nome da categoria;
   - `listTrailers` com cache `tv:trailers:<temporada>` de 10 min e `filterByTitle`;
   - `rebuildPostVideos()` chama `clearCache()` no fim.
   **Verificar:** `npm run typecheck`; no site de teste, `/otaku-tv` não mostra mais vídeos de games na grade.
3. **(P) Robô.** No fim de `runRobot` (`app/server/robot/run.server.ts`), se `report.publicados.length > 0`,
   `await rebuildPostVideos().catch(() => {})` e registrar no relatório (`videos: <n>`). **Verificar:** `npm test`
   (testes do robô continuam passando).
4. **(M) Componentes.** Reescrever `app/components/otaku-tv.tsx` conforme "Componentes" (itens 1 a 10) e criar
   `useThemes()` com o código do `ThemesTab` atual (devolve `{ state, items, hasMore, loadMore, retry, q, setQ, type,
   setType, label }`). Exportar `ytThumb(id, size)`; o `home.tsx` usa `ytThumb(id)` (padrão `hq`, igual a hoje).
   **Verificar:** `npm run typecheck`.
5. **(M) Rota.** Reescrever `app/routes/otaku-tv.tsx`:
   - loader: `tab`, `q`, `pagina`, `v`; lista da aba (+ `shelves` só na aba das matérias, página 1, sem `q`);
     `selected` = item da lista/fileiras com o `v`, senão `findVideo(v)` (só se não estiver na lista), senão genérico;
     devolver também `seasonLabel` e `total`;
   - `shouldRevalidate` (só `v` mudou → `false`; qualquer outra mudança → `defaultShouldRevalidate`);
   - `meta` e `links` conforme "SEO";
   - layout: `Stage` (cabeçalho, busca, abas, player + info + fila) e a área clara `mx-auto max-w-[1600px] px-4 py-8
     sm:px-6 lg:px-8 lg:py-10` com o H2 da grade (`text-[1.35rem] sm:text-[1.6rem] font-extrabold
     tracking-[-0.025em]`, à direita "<total> vídeos" em `text-[0.9rem] text-ink-soft`), a grade `grid grid-cols-2
     gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-4` intercalada com as fileiras a cada **12**
     (12 fecha linhas inteiras em 2, 3 e 4 colunas; a página tem 24) e a `Pagination`;
   - aba de músicas com `useThemes()` no mesmo `Stage` e a grade de capas.
   **Verificar:** `npm run typecheck && npm test && npm run build`; abrir `/otaku-tv`, `/otaku-tv?v=<id>`,
   `?tab=trailers`, `?tab=musicas`, `?q=naruto`, `?pagina=2`.
6. **(P) Home.** Em `OtakuTvPanel`, os `Link`s ganham `state={{ play: true }}`. **Verificar:** clicar num vídeo da
   home abre a Otaku TV tocando; colar o mesmo endereço numa aba nova abre parado.
7. **(P) Conferência visual e docs.** Prints em 375, 768, 1280 e 1440 px, tema claro e escuro (o palco é igual nos
   dois; conferir a área clara e as fileiras). Atualizar `docs/README.md` (status ✅, "Próximos passos", "Pendências
   suas") e este plano. Commit e push.
8. **(Dono) Conferir no navegador** e responder as Perguntas em aberto.

## Riscos e cuidados

- **React Router:** os loaders usam o `routePath`; a troca de vídeo do cliente pede `/otaku-tv.data?...` quando o loader
  roda. Com o `shouldRevalidate` ele não roda ao trocar só o `v`; conferir no DevTools (aba Rede) que clicar num cartão
  **não** pede `.data`, e que trocar de aba ou de página **pede**. Rodar `npm run build` antes do push.
- **`meta` sem loader:** como o loader não roda na troca de vídeo, o `meta` precisa ler o `v` de `location.search` e
  achar o vídeo em `loaderData`; senão o título da aba do navegador fica no vídeo antigo.
- **Autoplay:** navegadores bloqueiam autoplay com som sem gesto. Como só ligamos `autoplay=1` depois de um clique, o
  YouTube costuma aceitar; se não aceitar, o player mostra o botão dele, o que é aceitável. Nunca ligar no link
  compartilhado.
- **`referrerPolicy`** no iframe: sem ele o embed falha (erro 153 do YouTube) em alguns navegadores.
- **Hidratação:** nada de "há X horas" (cache da CDN); `formatDate` com data fixa.
- **Categoria `animes-e-mangas`:** conferir que o slug existe no banco novo (veio da importação). Sem ela, todo vídeo
  de notícia sem `anilist_id` iria para as fileiras. Conferência: `SELECT slug, name FROM categories WHERE slug IN
  ('animes-e-mangas','games','filmes-e-series','eventos','apps','sem-categoria');`.
- **Largura 1600 px** é só da Otaku TV (as outras páginas usam 1328 px), de propósito: é a página do player.
- **MariaDB:** a consulta das fileiras não usa função de janela nem JSON; o agrupamento é em JS.
- **Nada de migration:** se aparecer a vontade de guardar categoria em `post_videos`, não fazer; a junção resolve.

## Como verificar

- `npm run typecheck && npm test && npm run build` sem erro.
- **1440 px, lateral aberta:** o player começa a menos de 300 px do topo da janela; player à esquerda (≈ 736 px de
  largura) e "A seguir" à direita com a **mesma altura** de player + info, rolando por dentro; grade de 4 colunas com a
  primeira fileira depois de 3 linhas.
- **1440 px, lateral recolhida:** player ≈ 920 px.
- **1280 px:** ainda duas colunas no palco. **1024 e 768 px:** fila embaixo com 3 itens; grade de 3 colunas.
- **375 px:** player encosta nas bordas da tela; abas numa linha que rola; "Ler a matéria" na largura toda; ícones de
  44 px; grade de 2 colunas; fileiras rolando com 72% por cartão; **nenhuma rolagem horizontal** da página.
- `/otaku-tv?v=<id>` aberto numa aba nova: pôster **parado** do vídeo certo, título da aba "<título> · Otaku TV |
  Anime Profile"; clicar num cartão: o vídeo troca e **toca**, a lista não pisca, sem pedido `.data`, o `?v=` da barra
  muda, e o título da aba acompanha.
- Página 2 → clicar num vídeo → a lista continua na página 2.
- Ver o código-fonte: canônica `https://animeprofile.com.br/otaku-tv` (também com `?v=`), `og:image` =
  `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, JSON-LD válido no Rich Results Test (CollectionPage + BreadcrumbList,
  sem erro).
- Aba de músicas: esqueleto enquanto carrega, depois o player com a primeira música parada; escolher outra toca; com o
  AnimeThemes fora (bloquear o domínio no DevTools), o aviso com "Tentar de novo".
- Tema escuro: área clara e fileiras com contraste; palco igual.
- Teclado: Tab passa por busca → abas → pôster → botões → fila → cartões, com o contorno azul sempre visível.

## Perguntas em aberto

1. **Endereço de cada vídeo:** manter `/otaku-tv?v=<id>` com a canônica na lista (recomendado: é o que o antigo fazia,
   os links antigos e da home continuam, e não cria centenas de páginas finas), ou criar `/otaku-tv/v/<id>`
   indexáveis, cada uma com `VideoObject`?
2. **Botões que dependem de conta** (curtir, salvar, histórico, comentar, compartilhar no Feed): não mostrar nada até as
   contas voltarem (recomendado) ou mostrar desativados com "em breve"?
3. **`VideoObject` na página da matéria** que tem vídeo (tarefa pequena, separada deste plano): fazer depois deste
   plano (recomendado, ajuda a aparecer na aba Vídeos do Google) ou deixar para depois das contas?
4. **"A seguir" no celular:** 3 itens abaixo do vídeo (proposto, mais "YouTube") ou esconder como o antigo (a grade logo
   abaixo já faz esse papel)?
