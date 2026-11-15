# Plano: menu lateral esquerdo (como no site antigo) e topo livre para outros menus

Plano de 2026-11-15, para executar **na ordem dos passos**. Cada passo é uma entrega pequena: `npm run typecheck`,
`npm test`, `npm run build`, commit e push. Nenhuma migration, nenhuma consulta nova ao banco, nada de API paga.
Não mexe nas barras laterais **direitas** das páginas ([plano-sidebars.md](plano-sidebars.md)).

## Objetivo

- **Parte A (computador):** voltar o menu principal para uma **barra lateral esquerda** fixa (expandida ou recolhida só
  com ícones, escolha salva no navegador, sem piscar), no visual "Top 10 claro", e deixar a **barra do topo** com logo,
  busca, conta e um **espaço configurável para menus extras**.
- **Parte B (celular):** deixar o celular no jeito do site antigo (topo compacto, gaveta, barra inferior, faixas que
  rolam para o lado em vez de pilhas de cartões, rodapé em duas colunas), começando por 375 e 390 px.

## Contexto

- **Pedido do dono (2026-11-15):** "crie uma sidebar lateral esquerda no site também, como no -old, e deixe a navbar
  para adicionar outros menus". No mesmo dia: "melhorar o layout no celular, no mesmo estilo do -old".
- **Hoje no site novo:** o menu está no topo (`Header.tsx`, lista `TOP_NAV` de `app/lib/nav.ts`). No celular há um
  `<dialog>` com os grupos completos de `NAV` (Descobrir, Comunidade, Recompensas, Coleção). O cabeçalho tem 72 px,
  `sticky top-0 z-30`, e o conteúdo dele fica num contêiner `max-w-[1328px]`. A faixa `AvisoContas` vem logo abaixo.
- **Cache:** as páginas saem com cache de 60 s na CDN e não usam cookie. Então o servidor **sempre** manda o mesmo HTML;
  o estado "recolhido" só pode ser aplicado no navegador, antes da pintura, igual ao tema (`themeBootstrap`).

## Inventário do menu do site antigo (`animeprofile-old/src/components/Sidebar.tsx`)

| O quê | Como era | No site novo |
|---|---|---|
| Lugar | `<aside>` `hidden lg:flex w-[260px] h-screen sticky top-0 z-40 border-r`, ao lado de uma coluna com `TopBar` + conteúdo (cada página montava `<Sidebar/>` à mão) | Vira um componente único no `root.tsx` |
| Topo da lateral | Logo 40 px + "Anime **Profile**" + "SUA COMUNIDADE OTAKU!" | O logo fica no topo escuro (já existe); a lateral começa direto nos itens |
| Itens (uma lista só, sem títulos de grupo) | Início, News, (Explorar, Notícias, Artigos: só admin), Animes, Otaku TV, Quiz · Feed, Comunidades, (Blog: só admin) · Missões (só logado), Eventos, Ranking · Figurinhas, Quarto Otaku, Games · Administração (admin/mod) | Grupos de `NAV` com título (já aprovados no menu do celular). Comunidades, Eventos, Games e Explorar saíram. Administração fica para quando houver contas |
| Ícones | lucide 18 px | Os mesmos de `NAV` (Home, Newspaper, BookOpen, Tv, MonitorPlay, Puzzle, MessagesSquare, PenSquare, Award, Trophy, Sparkles, Sofa) |
| Item ativo | Fundo em gradiente da marca, texto branco, brilho; `aria-current="page"`; sub-rotas contam (`/` só exato); aliases (jogos sob Games) | `isActive()` de `nav.ts` (mesma regra). Visual novo abaixo |
| Bolinha "novo" | News: matéria nova desde a última visita (localStorage `ap-news-seen-at`); Games: missão aberta | Fica de fora agora (precisa de dado extra). Ideia para depois |
| Saldo AP Coins e Rubis | Só no celular, logado | Sem contas: não entra |
| Rodapé da lateral | "Tema claro / escuro" + botão; botão da decoração de datas (DecorToggle); no celular, "Preferências de cookies" | Tema entra; decoração de datas não existe no site novo; cookies ficam no rodapé do site |
| Recolher/expandir | **Não existia** | Novo (pedido implícito "melhorar o layout") |
| Celular | `MobileNav`: gaveta (Sheet) à esquerda de 280 px com o mesmo conteúdo; `MobileBottomNav` (barra inferior, só logado) | Reaproveita o `<dialog>` atual do `Header.tsx`. Barra inferior: não (sem contas) |

## Desenho novo

### Direção visual

A lateral é **clara** (mesma superfície branca do rodapé e dos cartões), separada do papel por uma linha fina: o topo
escuro continua sendo a única faixa cinematográfica, e a página não vira uma moldura escura em "L". Clima de app de
streaming organizado (referência: lateral do YouTube/Crunchyroll), nada de gradiente nem brilho no item ativo como no
antigo. Hierarquia: o olho vê primeiro o topo escuro (logo e busca), depois o item ativo em vermelho na lateral, por
último os títulos de grupo e o rodapé da lateral.

### Estrutura da página (computador)

```
┌──────────────────────────── Header (night, 72 px, sticky, largura toda) ───────────────────────────┐
│ [logo]   [links extras do slot]          [ busca .................. ]   Entrar  [Contas em breve] │
├──────────┬─────────────────────────────────────────────────────────────────────────────────────────┤
│ Lateral  │ AvisoContas (faixa rosada)                                                              │
│ 256 px   │ <main> páginas como hoje (max-w-[1328px] mx-auto, centralizado na área da direita)       │
│ ou 72 px │                                                                                          │
│ (sticky) │ Footer                                                                                   │
└──────────┴─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Ordem no `<body>`:** link "Pular para o conteúdo" → `Header` → `div.flex` com `[SideNav | coluna]`; a coluna tem
  `AvisoContas`, `<main id="conteudo">` e `Footer`. Assim a lateral encosta no topo e corre a página inteira, e o
  aviso, o conteúdo e o rodapé ficam à direita dela.
- **Contêiner das páginas:** não muda. `max-w-[1328px] mx-auto` passa a centralizar dentro da coluna da direita (a
  1440 px com lateral de 256, a coluna tem 1184 px, então o contêiner ocupa tudo com o `lg:px-14` de sempre).
  `PageHeader` e a capa da home ficam com a largura da coluna (os cantos arredondados de baixo continuam).
- **Topo:** o contêiner interno do `Header` **perde** o `max-w-[1328px] mx-auto` e passa a `px-4 sm:px-6 lg:px-5`,
  para o logo ficar alinhado à lateral (logo em cima da coluna da lateral, como no antigo).

### Larguras e pontos de quebra

| Largura da tela | Lateral | Botão de menu (☰) no topo |
|---|---|---|
| < 1024 px (abaixo de `lg`) | Escondida | Visível: abre a gaveta (`<dialog>`) |
| 1024 a 1279 px (`lg`) | **Sempre recolhida, 72 px** (só ícones + dica) | Visível: abre a gaveta com os nomes |
| ≥ 1280 px (`xl`) | 256 px expandida, ou 72 px se o visitante recolheu | Escondido; quem recolhe/expande é o botão no pé da lateral |

Motivo do `lg` sempre recolhido: com 256 px a 1024 px, sobrariam 768 px para páginas que já têm lateral direita.

### Estado recolhido sem piscar (SSR + CDN)

- Chave no localStorage: **`ap-sidebar`**, valores `"mini"` ou `"full"` (sem valor = `"full"`).
- Script inline no `<head>`, ao lado do `themeBootstrap`, exportado de `app/components/layout/SideNav.tsx`:
  ```js
  (function(){try{if(localStorage.getItem("ap-sidebar")==="mini")document.documentElement.dataset.sidebar="mini"}catch(e){}})();
  ```
- Variante nova no `app/app.css`, ao lado da de `dark`:
  ```css
  @custom-variant mini (&:where([data-sidebar="mini"], [data-sidebar="mini"] *));
  ```
- O servidor sempre manda o HTML expandido; o script troca o atributo antes da primeira pintura, então não há salto.
  O `<html>` já tem `suppressHydrationWarning`. Nada de cookie, nada no loader.
- O botão do pé da lateral alterna `document.documentElement.dataset.sidebar` (`"mini"` ou apaga o atributo) e grava
  em `ap-sidebar`; em modo privado (erro no localStorage) vale só na visita. O `aria-expanded` do botão é lido do
  atributo num `useEffect` (no SSR sai `true`; o texto visível do botão vem de CSS, então não pisca).

### Lateral (`<aside>`)

- `<aside id="menu-lateral" class="hidden shrink-0 border-r border-line bg-surface lg:block lg:w-[72px] xl:w-64 xl:mini:w-[72px] motion-safe:transition-[width] motion-safe:duration-200">`
- Dentro: `<div class="sticky top-[72px] flex h-[calc(100dvh-72px)] flex-col">` (72 px = altura do topo). `z-20`
  (o topo é `z-30`, a gaveta usa a camada própria do `<dialog>`, o "Pular" é `z-50`).
- `<nav aria-label="Menu principal" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">` (o `<nav>` do
  topo passa a se chamar `aria-label="Atalhos"`).
- **Grupos** (`NAV`, nesta ordem: Descobrir, Comunidade, Recompensas, Coleção), `gap-5` entre grupos:
  - expandida: título `px-3 pb-1.5 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-ink-soft`;
  - recolhida: o título vira `sr-only` e no lugar aparece um traço `mx-auto my-1 h-px w-8 bg-line` (o primeiro grupo
    não tem traço).
- **Item** (`<NavLink>`, `h-11` = 44 px de alvo de toque, `rounded-xl`, `gap-3`, `px-3`, `text-[0.95rem] font-semibold`):
  - ícone `size-5 shrink-0`; nome `truncate`;
  - normal: `text-ink`, ícone `text-ink-soft`; hover: `bg-sunken`, ícone `text-ink`;
  - ativo: `bg-brand-soft text-brand dark:text-glow`, ícone na mesma cor, e um traço de 3 px à esquerda
    (`before:absolute before:left-0 before:inset-y-2.5 before:w-[3px] before:rounded-full before:bg-brand`, item `relative`),
    `aria-current="page"`;
  - foco: o contorno azul global (`:focus-visible`, `#2b5bd7`) já cobre; não remover;
  - recolhida (`lg` e `xl:mini`): `justify-center px-0`, nome `sr-only` (o leitor de tela continua lendo o nome).
  - Classes do nome: `truncate lg:sr-only xl:not-sr-only xl:mini:sr-only`.
- **Itens que dependem de conta** (Feed, Missões, Ranking, Quarto Otaku: já caem nas páginas `contas-em-breve`):
  continuam no menu, apontando para os mesmos endereços, com a etiqueta **"em breve"** à direita do nome
  (`ml-auto rounded-full bg-sunken px-2 py-0.5 text-[0.68rem] font-bold text-ink-soft`, some quando recolhida).
  Campo novo `soon?: true` no `NavItem` de `nav.ts`. Figurinhas e Blog já funcionam: sem etiqueta.
- **Dica (tooltip) na recolhida:** a lista tem `overflow-y-auto`, que cortaria uma dica com `absolute`. Por isso a dica
  é **um único elemento** `position: fixed` (`z-50`), posicionado por JS no `mouseenter` e no `focus` do item
  (`getBoundingClientRect`: `left = rect.right + 10`, `top = centro do item`), escondido no `mouseleave`/`blur`/rolagem.
  Visual: `rounded-lg bg-night px-2.5 py-1.5 text-[0.82rem] font-semibold text-night-ink shadow-lg`, com " · em breve"
  quando for o caso. `aria-hidden` (o nome já está no `sr-only`). Só aparece quando a lateral está recolhida
  (checar `matchMedia("(min-width:1024px) and (max-width:1279px)")` ou `dataset.sidebar === "mini"`). Sem atraso no
  foco; 150 ms de atraso no hover.
- **Pé da lateral** (`border-t border-line px-3 py-3 flex flex-col gap-1`):
  1. Linha do tema: expandida, `flex h-11 items-center justify-between rounded-xl px-3 text-[0.9rem] text-ink-soft`
     com o texto "Tema claro / escuro" e o `ThemeToggle` existente; recolhida, só o `ThemeToggle` centralizado.
  2. Links pequenos (só expandida): "Sobre · Contato · Privacidade" (`/sobre`, `/contato`, `/legal/privacidade`),
     `px-3 text-[0.8rem] text-ink-soft hover:text-ink hover:underline`. Os demais legais seguem no rodapé.
  3. Botão recolher/expandir (só `xl`, `hidden xl:flex`): `h-11 items-center gap-3 rounded-xl px-3 text-[0.9rem]
     font-semibold text-ink-soft hover:bg-sunken hover:text-ink`; ícone `PanelLeftClose` + "Recolher menu" quando
     expandida, `PanelLeftOpen` (sozinho, centralizado, com dica "Expandir menu") quando recolhida.
     `aria-controls="menu-lateral"`, `aria-expanded`, `aria-label` igual ao texto.

### Gaveta do celular (e de 1024 a 1279 px)

- **Reaproveita** o `<dialog>` de `Header.tsx` (foco preso, Esc fecha, clique fora fecha, fecha ao trocar de página).
  O botão ☰ passa de `lg:hidden` para `xl:hidden`.
- O miolo dos grupos passa a vir do mesmo componente da lateral (`<NavGroups variant="drawer" />`), para não haver
  duas listas: no `drawer` os nomes aparecem sempre (sem as classes `lg:sr-only` etc.), com a etiqueta "em breve".
- Mantém a busca no topo da gaveta e o "Entrar". Acrescenta no fim a linha do tema e os três links pequenos.
- Corrige de passagem o contraste do item ativo no escuro: `text-brand dark:text-glow`.

### Barra do topo (o que fica)

Da esquerda para a direita:

1. ☰ (`xl:hidden`).
2. Logo (como hoje).
3. **Slot de menus extras** `HEADER_LINKS` (novo em `nav.ts`), `hidden lg:flex items-center gap-6`, com o mesmo visual
   dos links de hoje (`border-b-2 py-2 text-[0.95rem] font-semibold`, ativo `border-brand text-white`, normal
   `border-transparent text-white/70 hover:text-white`). Formato:
   `{ label: string; to: string; badge?: string; external?: boolean }` (`badge` = pílula `bg-brand text-brand-ink
   text-[0.65rem] font-bold rounded-full px-1.5 ml-1.5`, ex.: "Novo"; `external` abre com `target="_blank" rel="noreferrer"`).
   Começa com **Calendário** (`/animes/calendario`), que não está na lateral. Se o slot ficar vazio, nada aparece.
   `TOP_NAV` sai (a lateral faz esse papel).
4. **Busca:** a partir de `lg`, campo de verdade (`<Form method="get" action="/busca" role="search">`,
   `ml-auto w-[min(24rem,32vw)]`, input `h-10 rounded-full border border-white/10 bg-white/10 pl-10 pr-4 text-white
   placeholder:text-white/50 focus:bg-white/15`, ícone de lupa à esquerda, placeholder "Buscar notícias, animes...").
   Abaixo de `lg`, continua o botão redondo que leva a `/busca`.
5. Tema: `ThemeToggle` só abaixo de `lg` (`lg:hidden`); no computador ele mora no pé da lateral.
6. "Entrar" e "Contas em breve" (como hoje).

### O que não muda

- `AvisoContas`, `Footer`, `PageHeader` e as páginas: nenhum ajuste de código além de onde são montados no `root.tsx`.
- Laterais direitas, `sticky top-[92px]` da matéria e `top-24` das páginas de texto: o topo continua com 72 px no
  computador (no celular ele cai para 60 px, parte B; essas posições só valem a partir de `lg`).

## Parte B: celular no estilo do site antigo

### Como o site antigo se comporta no celular

| Área | Site antigo | Site novo hoje |
|---|---|---|
| Topo | `TopBar` claro, `sticky top-0 z-50`, `py-3` (cerca de 60 px): ☰, logo de 32 px (nome só a partir de 430 px), lupa que abre a busca numa caixa, Entrar + Cadastrar em pílula | Escuro, 72 px: ☰, logo de 38 px (nome a partir de 420 px), lupa (vai a `/busca`), tema, "Contas em breve" |
| Menu | Gaveta (Sheet) à esquerda, 280 px, com o mesmo conteúdo da lateral, fecha ao tocar num item | `<dialog>` à esquerda, `min(21rem, 88vw)`, grupos de `NAV` |
| Barra inferior | `MobileBottomNav`: fixa embaixo, 5 itens com ícone 20 px e rótulo 10 px (Início, Feed, Comunidades/Quiz, Figurinhas, Perfil), traço no topo do ativo, `env(safe-area-inset-bottom)`, **só para quem está logado**, some no `/admin` | Não existe |
| Faixas da home | Notícias, Artigos e Blog viram **faixas que rolam para o lado** abaixo de `sm` (cartão com 75 a 78 % da largura, `snap-x snap-mandatory`, `-mx-3 px-3`), voltando a grade a partir de `sm`; animes da temporada e no ar em faixa (`HScroll`) | Só o Blog faz isso; Notícias (4), Quiz (4), Artigos (1 grande + 4) e Diferencial (4) ficam **empilhados** em uma coluna; animes no ar e temporada em grade de 2 colunas (8 pôsteres = 4 linhas) |
| Margens | `px-3` (12 px) no celular | `px-4` (16 px): **fica** (melhor para leitura) |
| Matéria | Índice escondido no celular (`hidden lg:block`); lateral desce para baixo do texto | Lateral inteira (com índice) desce para depois dos comentários |
| Figurinhas | Partes da lateral sobem para cima da grade no celular (`lg:hidden`) | Grade 2 colunas, `gap-5` |
| Rodapé | `grid-cols-2` no celular, logo e texto ocupando as 2 colunas; links legais numa linha que quebra | Uma coluna só: cerca de 25 links empilhados |
| Alvo de toque | Botões `p-2` (36 px, abaixo do ideal) | 44 px no topo e na paginação: **manter 44** |

### Proposta para o site novo (375 e 390 px primeiro)

Legenda: **CSS** = só trocar classes num arquivo que já existe; **Novo** = componente novo.

1. **Barra inferior (Novo, `app/components/layout/BottomNav.tsx`)**, para **todos** (no antigo era só logado; sem
   contas, o equivalente é para visitante), abaixo de `lg` (`lg:hidden`):
   - itens: **Início** (`Home`), **Notícias** (`Newspaper`), **Animes** (`Tv`), **Quiz** (`Puzzle`), **Menu** (`Menu`,
     botão que abre a gaveta). Quando as contas voltarem, Quiz dá lugar a Perfil (anotar no `nav.ts`);
   - `<nav aria-label="Navegação rápida" class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95
     backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden">`, `<ul class="grid h-16 grid-cols-5">`;
   - item: `relative flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold`, ícone
     `size-[22px]`; normal `text-ink-soft`; ativo `text-brand dark:text-glow` + traço
     `absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand`, `aria-current="page"`;
   - "Menu" abre a mesma gaveta do topo: o `<dialog>` ganha `id="menu-gaveta"` e o botão chama
     `(document.getElementById("menu-gaveta") as HTMLDialogElement | null)?.showModal()`; `aria-haspopup="dialog"`;
   - lista dos itens em `nav.ts` (`BOTTOM_NAV`), ativo com `isActive`;
   - espaço para a barra: a coluna do conteúdo ganha `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0`, e o
     `<meta name="viewport">` passa a `width=device-width, initial-scale=1, viewport-fit=cover`.
   - Com a barra no ar, o ☰ do topo some no celular: `hidden lg:grid xl:hidden` (fica só de 1024 a 1279 px).
2. **Topo compacto (CSS, `Header.tsx`)**: `h-[60px] lg:h-[72px]`; logo `size-8 lg:size-[38px]` (prop `compact` não
   muda; trocar só a classe da imagem em `Logo.tsx` para `size-8 lg:size-[38px]` mantendo `width/height`);
   "Contas em breve" vira **"Em breve"** abaixo de 400 px (`<span class="min-[400px]:hidden">Em breve</span><span
   class="hidden min-[400px]:inline">Contas em breve</span>`); tema continua no topo do celular. A gaveta passa a ter
   a faixa escura de 60 px também no celular (`h-[60px] lg:h-[72px]`).
3. **Faixa do aviso (CSS, `AvisoContas.tsx`)**: no celular, texto curto numa linha: "Login e AP Coins voltam em breve."
   + "Saiba mais" (`sm:hidden`), e o texto atual a partir de `sm` (`hidden sm:inline`). `text-[0.85rem] sm:text-[0.9rem]`.
4. **Faixa que rola para o lado (Novo, `app/components/MobileRow.tsx`)**: o padrão do Blog da home vira componente,
   para não repetir classes:
   - `MobileRow({ label, children, className })`: `<div role="region" aria-label={label} class="-mx-4 flex snap-x
     snap-mandatory scroll-pl-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
     sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0 {className}">` (o `className` traz as colunas
     de `sm`/`lg`, ex.: `sm:grid-cols-2 lg:grid-cols-4`);
   - `MobileRowItem`: `<div class="w-[78%] shrink-0 snap-start sm:w-auto">`; para pôsteres de anime, `w-[38%]`
     (mostra 2 e meio, convidando a arrastar).
   - Usar na home em: Notícias, Quiz, Artigos menores (os 4 abaixo do grande), Blog (trocar o código atual),
     Animes no ar hoje e Temporada atual (pôsteres; a partir de `sm` voltam as grades atuais de 4 e 8 colunas).
5. **Home, espaços (CSS, `home.tsx`)**: contêiner `gap-12 py-8 sm:gap-[72px] sm:py-14`; artigo grande
   `min-h-[320px] sm:min-h-[420px]`; Diferencial `grid-cols-2 gap-3 sm:gap-4` com cartão `p-4 sm:p-6` e texto
   `hidden sm:block` (no celular, só ícone e título); chamada final `py-10 sm:py-14` e título `text-[1.6rem]`.
6. **Rodapé (CSS, `Footer.tsx`)**: `grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.6fr_repeat(4,1fr)]`, bloco do logo
   `col-span-2 md:col-span-1`; links `py-1` (alvo de toque maior sem mudar o visual); a linha de baixo fica.
7. **Matéria (CSS)**: capa da matéria encostada nas bordas no celular: `-mx-4 w-[calc(100%+2rem)] max-w-none
   rounded-none sm:mx-0 sm:w-full sm:rounded-[18px]` (`post.tsx` e `blog-post.tsx`); **índice da lateral escondido
   abaixo de `lg`** (`hidden lg:block`), como no antigo. Se o [plano-sidebars.md](plano-sidebars.md) já tiver sido
   executado, aplicar no bloco de índice dele; se não, em `post-extras.tsx`. Etiquetas (tags) com `py-2` (toque).
8. **Listas (CSS)**: `/noticias`, `/artigos`, categoria, tag, autor e busca continuam com cartão grande em 1 coluna
   (igual ao antigo), mas com `gap-y-6` no celular em `PostGrid` (`gap-y-6 sm:gap-y-8`); filtros/abas que existirem
   no topo das listas ficam numa linha que rola para o lado (`flex overflow-x-auto [scrollbar-width:none]
   whitespace-nowrap`) em vez de quebrar em várias linhas.
9. **Quiz (CSS, `components/quiz.tsx`)**: alternativas com `min-h-[52px]`; as com imagem continuam em 2 colunas;
   o botão de seguir ocupa a largura toda no celular (`w-full sm:w-auto`).
10. **Figurinhas (CSS)**: grade `gap-3 sm:gap-5` em `figurinhas.tsx` e `figurinha-album.tsx`.
11. **Blog (CSS)**: nas listas do blog a lateral desce para baixo (já acontece); no post, mesma capa encostada da matéria.
12. **Proteção contra rolagem horizontal (CSS, `root.tsx`)**: a coluna do conteúdo ganha `overflow-x-clip` (não cria
    área de rolagem, então não quebra o `sticky`).

O que **não** vem do antigo: margem de 12 px, botões de 36 px, busca em caixa por cima (a página `/busca` já resolve).

## Arquivos afetados

- `app/lib/nav.ts`: `soon?: true` em Feed, Missões, Ranking, Quarto Otaku; `HEADER_LINKS`; remover `TOP_NAV`.
- `app/components/layout/SideNav.tsx` (novo): `sidebarBootstrap`, `SideNav`, `NavGroups` (variantes `rail` e
  `drawer`), dica flutuante e botão de recolher.
- `app/components/layout/Header.tsx`: slot `HEADER_LINKS`, busca em campo, ☰ `xl:hidden`, tema `lg:hidden`, gaveta
  usando `NavGroups variant="drawer"`, contêiner sem `max-w`.
- `app/root.tsx`: script `sidebarBootstrap` no `<head>`, nova estrutura do `<body>`.
- `app/app.css`: variante `mini`.
- `tests/nav.test.ts` (novo): `isActive` e conferência de `NAV`/`HEADER_LINKS`/`BOTTOM_NAV`.
- Parte B: `app/components/layout/BottomNav.tsx` (novo), `app/components/MobileRow.tsx` (novo),
  `app/components/layout/AvisoContas.tsx`, `app/components/layout/Logo.tsx`, `app/components/layout/Footer.tsx`,
  `app/routes/home.tsx`, `app/routes/post.tsx`, `app/routes/blog-post.tsx`, `app/components/post-extras.tsx` (ou o
  bloco de índice do plano-sidebars), `app/components/posts.tsx`, `app/components/quiz.tsx`,
  `app/routes/figurinhas.tsx`, `app/routes/figurinha-album.tsx`.
- `docs/design.md`: seção "Estrutura" atualizada (passo final). `docs/decisoes.md`: registrar a decisão.

## Passos

1. **(P) `nav.ts` e teste.** Acrescentar `soon?: true` ao tipo e aos 4 itens; criar `HEADER_LINKS` com Calendário;
   manter `TOP_NAV` por enquanto (ainda usado). Criar `tests/nav.test.ts`: `isActive("/", "/")` verdadeiro,
   `isActive("/noticias/x", "/")` falso, `isActive("/noticias/x", "/noticias")` verdadeiro, `isActive("/quizz", "/quiz")`
   falso; todo `to` de `NAV` é único; os itens com `soon` estão na lista `ACCOUNT_PENDING` (copiar a lista para o teste
   ou exportá-la de `app/lib`, se preferir mover; não importar `routes.ts`). Conferir: `npm test`.
2. **(P) Variante e script.** Adicionar `@custom-variant mini` ao `app.css`. Criar `SideNav.tsx` só com
   `export const sidebarBootstrap` e colocá-lo no `<head>` do `root.tsx` logo após o `themeBootstrap`.
   Conferir: no navegador, `localStorage.setItem("ap-sidebar","mini")` + recarregar → `<html data-sidebar="mini">`.
3. **(M) Componente `SideNav`.** Montar `<aside>`, grupos, itens, etiqueta "em breve", pé da lateral e botão de recolher
   (tudo do desenho acima). `NavGroups` recebe `variant: "rail" | "drawer"` e `onNavigate?` (a gaveta passa o fechar).
   Ativo por `useLocation().pathname` + `isActive` (componente, não loader).
4. **(P) `root.tsx`.** Nova estrutura: `Header` → `<div class="flex flex-1">` com `<SideNav />` e
   `<div class="flex min-w-0 flex-1 flex-col">` contendo `AvisoContas`, `main#conteudo.flex-1` e `Footer`. O `body`
   continua `flex min-h-dvh flex-col`. O `ErrorBoundary` herda o layout (não muda). Conferir: 1280 e 1440 px.
5. **(M) Dica flutuante.** Implementar o tooltip fixo do desenho (um elemento só, eventos delegados no `<nav>`,
   esconder no `scroll` do `<nav>` e da janela). Conferir com mouse e com Tab a 1100 px e a 1440 px recolhida.
6. **(M) `Header.tsx`.** Trocar `TOP_NAV` pelo slot `HEADER_LINKS` (`aria-label="Atalhos"`), campo de busca a partir de
   `lg`, ☰ `xl:hidden`, `ThemeToggle` `lg:hidden`, contêiner `px-4 sm:px-6 lg:px-5` sem `max-w`. Na gaveta, trocar o
   `map` de `NAV` por `<NavGroups variant="drawer" onNavigate={close} />` e acrescentar tema + links pequenos no fim.
   Apagar `TOP_NAV` de `nav.ts`. Conferir: `npm run typecheck`.
7. **(P) Conferência visual e docs da parte A.** Rodar a lista de "Como verificar" (computador); atualizar a seção
   "Estrutura" de `docs/design.md`, registrar em `docs/decisoes.md` e o status no `docs/README.md`. Build, commit, push.

**Parte B (celular), em ordem de impacto.** Cada passo confere em 375 e 390 px, claro e escuro, antes do commit.

8. **(M, Novo) Barra inferior** (item 1 da proposta): `BOTTOM_NAV` em `nav.ts`, `BottomNav.tsx` no `root.tsx` (depois
   do `Footer`, fora da coluna), `id="menu-gaveta"` no `<dialog>`, espaço embaixo da coluna, `viewport-fit=cover`,
   ☰ do topo `hidden lg:grid xl:hidden`. Pular este passo se o dono disser não (pergunta 2); nesse caso o ☰ continua
   `xl:hidden`.
9. **(P, CSS) Topo compacto e aviso curto** (itens 2 e 3).
10. **(M, Novo) `MobileRow` e home** (itens 4 e 5): criar o componente, trocar Blog, Notícias, Quiz, Artigos menores,
    No ar hoje e Temporada; ajustar espaços, Diferencial e chamada final.
11. **(P, CSS) Rodapé em duas colunas e proteção contra rolagem horizontal** (itens 6 e 12).
12. **(P, CSS) Matéria e post do blog** (itens 7 e 11): capa encostada nas bordas e índice só a partir de `lg`.
13. **(P, CSS) Listas, quiz e figurinhas** (itens 8, 9 e 10).
14. **(P) Docs da parte B:** acrescentar em `docs/design.md` (Estrutura > Celular) a barra inferior, as faixas
    `MobileRow` e o topo de 60 px; status no `docs/README.md`. Build, commit, push.

## Riscos e cuidados

- **Antes da virada (17/11) ou depois?** É mudança no layout de todas as páginas. Se não houver folga no dia 2, deixar
  para depois da virada (o plano não depende dela). Decisão do dono (pergunta 3).
- **Piscar/CLS:** nunca decidir o estado recolhido no React (`useState` inicial) nem no servidor; só pelo atributo do
  `<html>` + CSS. O script tem que ficar **no `<head>`, antes de `<Links />`**, como o do tema.
- **Hidratação:** o `aria-expanded` do botão pode divergir do HTML do servidor; ler o atributo no `useEffect` e só então
  atualizar o estado (não ler `document` durante o render).
- **Rolagem horizontal:** a coluna da direita precisa de `min-w-0`, senão tabelas e carrosséis empurram a página.
  Conferir em 375 px que nada passa da tela (a lateral nem existe abaixo de `lg`).
- **Duas listas de menu:** a gaveta e a lateral têm que usar o mesmo `NavGroups`; não copiar o `map`.
- **`.server`:** nada de servidor neste plano. Nenhum loader lê `pathname` (a regra do `routePath` continua valendo,
  mas este plano não cria loader).
- **Variante `xl:mini:`:** no Tailwind 4 a ordem dos variantes empilhados vale da esquerda para a direita; conferir no
  CSS gerado que `xl:mini:w-[72px]` fica dentro de `@media (min-width: 80rem)` e com `[data-sidebar=mini]`.
- **Barra inferior fixa:** nada da página pode ficar escondido atrás dela (rodapé, botão do quiz, aviso do formulário
  de contato); o espaço vem do `pb` da coluna, não de cada página. A dica flutuante e a gaveta não aparecem atrás dela
  (a gaveta é `<dialog>` na camada de cima; a barra é `z-30`).
- **`MobileRow`:** o `-mx-4` depende do contêiner ter `px-4` no celular (todas as páginas têm); a região que rola
  precisa de `aria-label` e os cartões continuam alcançáveis por Tab.
- **Sem conta:** os itens "em breve" levam às páginas `contas-em-breve` (status 200, com `noindex` se já tiverem); não
  criar link para nada fora de `NAV`.

## Como verificar

- `npm run typecheck`, `npm test`, `npm run build` sem erro.
- **375 px** (claro e escuro): sem lateral; ☰ abre a gaveta com os 4 grupos, "em breve" em Feed/Missões/Ranking/Quarto,
  busca, Entrar, tema e links pequenos; Esc e clique fora fecham; trocar de página fecha; sem rolagem horizontal.
- **768 px:** igual ao celular; o topo mostra logo, lupa, tema e "Contas em breve" sem quebrar linha.
- **1280 px (e 1100 px):** a 1100, lateral de 72 px só com ícones, dica ao passar o mouse e ao focar com Tab, ☰ visível
  abrindo a gaveta, sem botão de recolher. A 1280, lateral de 256 px com títulos de grupo; slot "Calendário" e campo de
  busca no topo; ☰ some.
- **1440 px:** recolher pelo pé da lateral → 72 px com animação de largura; recarregar a página → continua recolhida
  **sem piscar** (gravar a tela ou conferir com "Desativar cache" + rede lenta 3G no DevTools); expandir de novo e
  recarregar → expandida.
- **Item ativo:** em `/noticias/qualquer-materia` o ativo é "Notícias"; em `/` é "Início"; em `/animes/calendario` o ativo
  na lateral é "Animes" e no topo é "Calendário". No escuro, o texto do ativo é `#ff9a90` sobre `#3a1b19`.
- **Teclado:** Tab a partir do topo da página: "Pular para o conteúdo" → topo → itens da lateral na ordem → pé da lateral
  → conteúdo. "Pular para o conteúdo" leva ao `<main>` sem passar pela lateral.
- **Leitor de tela (recolhida):** cada item é lido pelo nome ("Notícias, link, página atual").
- Lighthouse a 1440 px: CLS 0.
- **Celular (375 e 390 px, claro e escuro; DevTools com "iPhone SE" e "iPhone 12"):**
  - topo com 60 px numa linha só (logo, lupa, tema, "Em breve" a 375 / "Contas em breve" a 400+); aviso numa linha;
  - barra inferior sempre visível, ativo certo em `/`, `/noticias/x`, `/animes/1`, `/quiz/x`; "Menu" abre a gaveta;
    o fim do rodapé não fica escondido atrás dela; no iPhone com recorte, a barra não encosta no traço de baixo;
  - home: Notícias, Quiz, Artigos, Blog, No ar e Temporada arrastam para o lado com encaixe e mostram um pedaço do
    próximo cartão; a 640 px (sm) voltam a ser grade;
  - matéria: capa de ponta a ponta; sem índice na lateral de baixo; tabela larga rola dentro da própria caixa;
  - rodapé em 2 colunas; `document.documentElement.scrollWidth === innerWidth` em todas as páginas acima (console);
  - Lighthouse móvel na home e numa matéria: CLS abaixo de 0,05 e alvos de toque sem aviso.

## Perguntas em aberto (para o dono)

1. **Cor da lateral:** clara (branca, linha fina, o topo continua a única faixa escura) ou escura (`night`, formando um
   "L" com o topo, mais parecida com o site antigo)? **Recomendo clara**: mantém o "Top 10 claro" aprovado e não
   brigar com o cabeçalho escuro das páginas, que encostaria na lateral escura.
2. **Barra inferior no celular para todos?** No antigo ela só aparecia para quem estava logado; sem contas, ninguém a
   veria. **Recomendo sim, para todos** (Início, Notícias, Animes, Quiz, Menu): é o que mais aproxima o celular do
   antigo e deixa o topo mais limpo. Se não, o passo 8 sai e o ☰ continua no topo.
3. **Quando fazer:** antes da virada (dia 2, 16/11) ou depois? **Recomendo depois da virada**, junto do
   [plano-sidebars.md](plano-sidebars.md): é mexida no layout de todas as páginas e o dia 2 já tem ensaio e conferência.
   Se quiser algo antes, só o passo 9 e o rodapé do passo 11 (CSS, sem risco; o `overflow-x-clip` nesse caso vai no
   `<main>`, porque a coluna nova ainda não existe).

Decidido no plano (fácil de mudar depois): o slot do topo começa só com **Calendário** (`HEADER_LINKS` em `nav.ts`).
