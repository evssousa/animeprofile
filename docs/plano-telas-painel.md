# Plano: as próximas telas reais do painel `/admin`

Plano temporário, escrito em 2026-11-19 pelo planejador. Segue a ordem que o dono definiu no README (item 3b3): **primeiro o
que o recebimento de usuários exige, depois o resto**. As 6 primeiras telas têm desenho, dados e passos completos; as
demais têm uma ficha curta. Antes de cada tela foi lido o que ela era no `animeprofile-old` (`src/routes/admin*.tsx` e
`src/components/admin/*`).

Três migrations novas (014, 015, 016). **Regra do dono:** o SQL de cada uma vai colado no chat no passo em que for criada.

## Objetivo

Trocar, uma a uma, as páginas "Esta tela ainda está sendo construída" do painel pelas telas reais, começando por Painel,
Métricas, Posts, Notícias IA, Artigos com IA e Quizzes, reaproveitando o que o site novo já tem (robô, agenda, posts no
banco, módulo `app/visitas/`) e sem tocar no HTML público (cache de 60 s da CDN).

## Contexto

- **Hoje:** `/admin` é só Visitas (módulo `app/visitas/`). A barra (`app/lib/admin-nav.ts`) tem os 27 itens do antigo; só
  "Painel" tem `pronto: true`. O resto cai na rota coringa `admin/*` → `routes/admin/em-construcao.tsx`.
- **Login:** só o admin das variáveis `ADMIN_*` (`requireAdmin` em `app/server/auth/viewer.server.ts`, papéis `["admin"]`).
  Nada de contas de usuários por enquanto (fases 2 e 3 do [plano-contas-login.md](plano-contas-login.md), "não agora").
- **O que já existe e as telas usam:**
  - matérias em `posts` (+ `post_categories`, `post_tags`, `post_authors`, `categories`, `tags`, `tag_redirects`), com
    `origin` (`old`, `robo`) e `status` (`draft`, `published`, `scheduled`); a página pública só mostra
    `VISIBLE` (`status = 'published' AND published_at <= agora`, em `app/server/content/posts.server.ts`);
  - robô de notícias em `app/server/robot/` (tabelas `ai_news_*` da migration 012, configuração em
    `system_config.robo` e `system_config['robo.guia']`), operado hoje só por `/api/robo/*` com o `CRON_TOKEN`;
  - agenda semanal (`app/server/agenda/agenda.server.ts`, grava em `posts` com `origin = 'robo'`);
  - quizzes em `quizzes` (009), com `quizProblems()` e `quizOutcome()` em `app/server/quiz/rules.server.ts`;
  - cron com `cron_jobs`/`cron_runs` (001) e o catálogo em `app/server/cron/jobs.server.ts`; `trackRun()` em
    `app/server/cron/runner.server.ts` roda algo "em segundo plano" e registra;
  - imagens próprias gravadas com `sharp` em `/media` (`saveRobotMedia` em `app/server/content/media-import.server.ts`);
  - limpeza de HTML `sanitizePostHtml()` e `readingMinutes()` (`app/server/content/sanitize.server.ts`); `clearCache()`
    (`app/server/cache.server.ts`); `routePath()` (`app/lib/route-path.ts`).
- **Dois problemas de segurança achados ao planejar (corrigidos no passo 0.1):**
  1. **Loaders filhos do `/admin` sem `requireAdmin`.** O `loader` de `routes/admin/visitas.tsx` não confere a sessão;
     só o `layout.tsx` confere. Na navegação por clique o React Router pede só os loaders que mudaram
     (`/admin.data?_routes=routes/admin/visitas`), e o do layout não roda: **qualquer pessoa que montar esse endereço lê
     os números do painel**. Toda tela nova teria o mesmo furo.
  2. **`/admin.data` sem `no-store` nem `noindex`.** O `server-app.js` aplica os cabeçalhos com `app.use(["/admin", ...])`,
     que casa `/admin` e `/admin/...`, mas não `/admin.data` (nem `/login.data`). A resposta sai sem `Cache-Control`.
  E um defeito: `em-construcao.tsx` lê `new URL(request.url).pathname` (sem `routePath`), então ao **clicar** num item
  ainda não feito o loader recebe `/admin/posts.data` e responde 404.

## O que o site antigo tinha em cada uma das 6 telas (resumo da leitura)

| Tela | No antigo | Arquivos lidos |
|---|---|---|
| Painel | Três painéis por papel (admin, moderador, autor). Admin: aviso vermelho de queda de tráfego; **"Precisa de atenção"** (denúncias, bugs, eventos ocultos, posts agendados, PIX vencidos, cada um com atalho); faixa **"Hoje"** (online agora, visitas, membros ativos, cadastros, receita PIX, leituras de posts); a faixa do funil (`MetricsStrip`, último retrato semanal); **Tráfego** (barras por hora/dia/mês, CSV); posts mais vistos; origem; engajamento e aparelhos; botão "Novo post" | `admin.index.tsx`, `metrics/MetricsStrip.tsx` |
| Métricas (`/admin/retention`) | Funil **AARRR** só de contas: Ativação, Volta na 2ª semana, Ativos na semana, NPS, Conversão para pago (com "se piorar, faça…"); funil por coorte com a etapa de maior queda; aquisição por canal, recomendação/NPS, retenção e churn, engajamento, receita, CAC e LTV, sistema; **histórico semanal** (retrato toda segunda 9h, "Gravar retrato agora"); **decisões da reunião** (problema, decisão, motivo, quem, revisar em, discordâncias); detalhes do dia a dia (ativos, cadastros, novos usuários, hábito, "onde as pessoas travam"); números de vaidade | `admin.retention.tsx`, `metrics/GrowthSections.tsx`, `CacSystemSections.tsx` |
| Posts | Lista com abas de status (Todos, Publicados, Agendados, Rascunhos, com contagem), busca, tipo, origem (pessoas/IA), autor, ordem, seleção em lote e exclusão, 20 por página. Editor Tiptap (título grande, endereço, modelos de artigo, **marcações ✍️ que bloqueiam publicar**, resumo, nota de SEO, publicação/agendamento, checklist "Para publicar", capa com envio, categorias, tags, barra fixa com Salvar/Publicar/Agendar/Despublicar, cópia local não salva com "Recuperar", Ctrl+S) | `admin.posts.index.tsx`, `admin.posts.$id.tsx`, `PostEditor.tsx`, `RichTextEditor.tsx`, `lib/post-editor.ts` |
| Notícias IA | Uma página com submenu em 5 grupos e 12 abas (`?aba=`): Dashboard, Fontes, Tópicos e bloqueios, Candidatos, Aprovação, Horários, Histórico, Autores IA, Desempenho, Tendências, Títulos alternativos, Configurações | `admin.ai-news.tsx`, `ai-news/*Tab.tsx` |
| Artigos com IA | Pedido de artigo "evergreen" por tipo (15 tipos: ordem para assistir, parecidos, guia da temporada…), com anime do AniList, observações e "conheço o tema" (marcações ✍️) ou "modo comunidade"; **ideias de hoje** (de Search Console, mais lidos, temporada, hashtags); **banco de imagens** por anime; fila de pedidos (na fila, escrevendo, rascunho pronto, falhou, travado) com "Gerar agora", revisar, tentar de novo, cancelar | `admin.artigos-ia.tsx`, `lib/ai-news/article-kinds.ts`, `worker/articles.ts` |
| Quizzes | Lista (capa, tipo, nº de perguntas, partidas, "falta N para publicar", publicado/rascunho, apagar), **ideias** e **pedido à IA**; editor (resultados primeiro, depois perguntas; imagem por resultado/pergunta/opção; certa ou resultado por opção; explicação; "Testar") | `admin.quizzes.index.tsx`, `admin.quizzes.$id.tsx`, `quiz/QuizEditor.tsx`, `QuizAiPanel.tsx`, `QuizIdeas.tsx` |

## Decisões gerais

1. **Toda tela do painel confere a sessão no próprio `loader` e na própria `action`** (`requireAdmin(request)`), além do
   layout. É o único jeito seguro com o carregamento em paralelo do React Router. Se o React Router 8.5 tiver o
   `middleware` de rota estável (conferir pelo tipo `Route.MiddlewareFunction` gerado em `+types/layout`), o layout
   ganha também um `middleware` que chama `requireAdmin` (defesa em profundidade); a chamada em cada loader continua.
2. **Ações por formulário com `intent`** (`<fetcher.Form method="post">` com `name="intent"`), validadas com `zod`
   (já é dependência). `requireAdmin` já recusa POST de outra origem (`sameOrigin`). Nada de chamar `/api/robo/*` do
   navegador: o painel chama as funções do servidor direto, e o `CRON_TOKEN` nunca chega à tela.
3. **Nenhum segredo na tela:** da chave do Gemini, do SMTP e afins só aparece "configurada / falta". O guia editorial do
   robô aparece (é do banco e a tela é só do admin, `no-store`), mas nunca vai para log.
4. **HTML público continua igual para todos.** O painel só grava no banco; depois de gravar conteúdo chama
   `clearCache()`. Uma mudança aparece no site em até ~60 s (CDN) somados aos caches de 5 a 10 min das laterais.
5. **Prévias de rascunho ficam dentro do `/admin`** (nunca uma página pública que dependa de sessão).
6. **Endereços:** os do antigo (`/admin/posts`, `/admin/ai-news`, `/admin/artigos-ia`, `/admin/quizzes`,
   `/admin/retention`), mais `/admin/visitas` (novo). Cada tela feita ganha `pronto: true` em `app/lib/admin-nav.ts`.
7. **`meta` das páginas do painel:** em React Router, o `meta` do filho substitui o do pai. Toda página que exportar
   `meta` usa um ajudante `adminMeta("Posts")` → `[{ title: "Posts | Painel" }, { name: "robots", content: "noindex, nofollow" }]`.
8. **Um só kit visual** (`app/components/admin/ui.tsx`, seção "Base visual") para as telas não saírem cada uma de um jeito.
9. **Ficam fora das 6 telas (com motivo):** tudo o que depende de contas (membros ativos, cadastros, NPS, churn,
   receita, denúncias, bugs) aparece no máximo como "começa quando as contas abrirem", **nunca com número falso**.

## Base visual (vale para as 6 telas)

**Direção:** o mesmo painel de Visitas: página clara `paper`, cartões brancos com borda fina, vermelho só no que é ação
principal ou ativo, **um bloco escuro por tela no máximo** (o número que mais importa). Nada de degradê, brilho ou sombra
pesada do antigo. Densidade de ferramenta de trabalho: listas compactas, números com `tabular-nums`, ações sempre à
direita da linha. O olho vê primeiro o que pede ação (avisos âmbar), depois os números de hoje, por último as listas.

### Tokens

Os do site (`app/app.css`): `paper` `#faf7f7`/`#121014`, `surface` `#ffffff`/`#1b171a`, `sunken` `#f4eded`/`#231e21`,
`ink` `#1c1414`/`#f4eff0`, `ink-soft` `#6e5f5f`/`#ab9d9f`, `line` `#efe6e6`/`#2f282b`, `brand` `#c2352b`, `brand-soft`
`#fbedec`/`#3a1b19`, `night` `#0d0d10`/`#0b0b0e`, `night-ink` `#f4f4f6`, `glow` `#ff9a90`.

**Novos (só estados), em `:root` e `[data-theme="dark"]` de `app/app.css`, e registrados no `@theme inline` como
`--color-ok`, `--color-ok-soft` etc.:**

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `ok` / `ok-soft` | `#1f7a4d` / `#e8f5ee` | `#4cc98f` / `#15291f` | Publicado, ligado, rodada ok |
| `warn` / `warn-soft` | `#8a5a00` / `#fdf3dc` | `#f0b04a` / `#2e2412` | Agendado, precisa de atenção, travado |
| `info` / `info-soft` | `#2558b8` / `#e9f0fc` | `#6f9cf0` / `#18233a` | Em andamento, ensaio, na fila |
| (erro) | `brand` / `brand-soft` | `glow` / `brand-soft` | Falhou, descartado, excluir |

Todos com contraste AA para texto de 12 px sobre o `-soft` correspondente (conferido: ok 4,8:1, warn 5,1:1, info 5,7:1).

- **Fonte:** Sora. Título da tela 28/800 `tracking-[-0.02em]`; título de cartão 16/700; rótulo 11/700 maiúsculas
  `tracking-[0.08em]` `text-ink-soft`; texto 14/400; pequeno 12–13; números grandes 32/800 (o bloco escuro 44/800).
- **Espaços:** o `AdminShell` já dá `max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8`. Entre blocos 24 px
  (`space-y-6`); dentro de cartão `p-4 sm:p-5`; linhas de lista `min-h-14 px-3`.
- **Raios:** cartões 14 px (`rounded-[14px]`); botões e selos pílula (`rounded-full`); campos 10 px (`rounded-[10px]`);
  linhas de lista 10 px.
- **Sombra:** só no claro, `shadow-[0_1px_2px_rgba(28,20,20,.06)] dark:shadow-none`. Painéis flutuantes (diálogo): a do
  `UserMenu` `shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]`.
- **Foco:** o global do site (contorno 2 px `#2b5bd7`, afastado 2 px) em tudo que é clicável; nas linhas de lista também
  `focus-visible:bg-sunken`.
- **Movimento:** 150 ms em cor e opacidade; diálogos `opacity` + `translate-y-1 → 0` em 120 ms; tudo com
  `motion-reduce:transition-none`.

### Componentes do kit (`app/components/admin/ui.tsx`)

| Componente | Visual | Estados |
|---|---|---|
| `Cabecalho({ titulo, desc?, acoes? })` | `h1` 28/800; `desc` 14 `text-ink-soft` `max-w-3xl` `mt-1`; ações à direita em ≥ 640 (`flex justify-between items-end gap-4`), abaixo do título no celular (`mt-3 flex flex-wrap gap-2`) | — |
| `Cartao({ titulo?, icone?, dica?, acao?, children })` | `rounded-[14px] border border-line bg-surface p-4 sm:p-5` + sombra; título 16/700 com ícone 16 px dentro de quadrado 28 px `rounded-lg bg-brand-soft text-brand dark:text-glow`; `dica` 12 `text-ink-soft`; `acao` à direita do título | vazio: usa `Vazio` dentro |
| `Numero({ rotulo, valor, sub?, tom?, href?, escuro? })` | cartão de número: rótulo 11/700, valor 32/800 `tabular-nums`, `sub` 13 `text-ink-soft`; `escuro` = fundo `night`, texto `night-ink`, rótulo `glow`, valor 44/800, sem borda; com `href` vira link com `hover:border-ink/20` | carregando não existe (SSR) |
| `Selo({ tom, children })` | `inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.7rem] font-bold uppercase tracking-[0.06em]`; `tom` = `ok` (`bg-ok-soft text-ok`), `aviso` (`warn`), `info`, `erro` (`bg-brand-soft text-brand dark:text-glow`), `neutro` (`bg-sunken text-ink-soft`) | — |
| `Abas({ itens: { rotulo, href, n? }[], ativo })` | links com sublinhado: `h-11 px-3 text-[0.9rem] font-semibold border-b-2`, ativo `border-brand text-ink` + `aria-current="page"`, inativo `border-transparent text-ink-soft hover:text-ink`; contador `ml-1 text-[0.75rem] font-normal opacity-70`; fileira `flex overflow-x-auto border-b border-line` sem barra de rolagem (`[scrollbar-width:none]`) | — |
| `Segmentado` | o controle de período do módulo de Visitas (pílula `bg-sunken p-1`, item ativo `bg-surface` + sombra leve); como link (`?param=`) | — |
| `Botao({ variante })` | `primario`: `h-10 rounded-full bg-brand px-4 text-[0.9rem] font-bold text-brand-ink hover:bg-[#a92c23] disabled:opacity-50`; `secundario`: `border border-line bg-surface text-ink hover:bg-sunken`; `perigo`: `border border-brand/40 text-brand dark:text-glow hover:bg-brand-soft`; `fantasma`: sem borda, `text-ink-soft hover:text-ink hover:bg-sunken`; `icone`: `size-9 grid place-items-center rounded-full` + `aria-label` obrigatório. Ícone lucide 16 px à esquerda do texto. No celular todo botão tem pelo menos 44 px de altura (`h-11 sm:h-10`) | ocupado: ícone vira `Loader2 animate-spin` e o texto muda ("Salvando…"); `aria-busy` |
| `Interruptor({ ligado, rotulo })` | `button role="switch" aria-checked`; trilho 36×20 `rounded-full` (`bg-sunken border border-line` / ligado `bg-ok`), bolinha 16 px branca que anda 16 px em 150 ms | desabilitado `opacity-50`; dentro de `fetcher.Form`, muda na hora (otimista) e volta se a resposta der erro |
| `Confirmar({ titulo, texto, botao, tom })` | `<dialog>` nativo `w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5` + sombra de painel; título 18/800, texto 14, botões "Cancelar" (secundário) e o de confirmar (`perigo` ou `primario`) à direita; `Esc` e clique no fundo cancelam; foco começa em "Cancelar" | — (substitui o `window.confirm` do antigo) |
| `Vazio({ icone, titulo, texto?, acao? })` | centralizado, `py-10`, ícone 28 px `text-ink-soft/50`, título 15/700, texto 13 `text-ink-soft`, ação opcional | — |
| `Retorno` | linha `aria-live="polite"` ao lado do botão: "Salvo ✓" (`text-ok`, some em 2,5 s) ou a mensagem de erro (`text-brand`) | — |
| Avisos | `Notice` de `app/components/form.tsx` (`ok`/`erro`) + um tom novo `aviso` (`border-warn/40 bg-warn-soft text-ink`, ícone `AlertTriangle` `text-warn`) | — |

Listas (não tabelas) para itens com ações: linha `flex items-start gap-3 rounded-[10px] px-3 py-3 hover:bg-sunken/60`,
separadas por `divide-y divide-line` dentro do cartão; título 14/600 (2 linhas no máximo, `line-clamp-2`); metadados 12
`text-ink-soft` com `·` entre eles; ações à direita (`BotaoIcone`). No celular as mesmas linhas, com as ações abaixo do
título quando não couberem (`flex-wrap`). Tabelas só para números (histórico, rodadas), dentro de `overflow-x-auto`.

**Reuso:** `AdminShell`/`AdminNav` (`app/components/admin/`), `Logo`, `ThemeToggle`, `form.tsx` (`TextField`, `TextArea`,
`Select`, `Notice`, `SubmitButton`), o gráfico e as listas do módulo de Visitas (`app/visitas/ui/Grafico.tsx`, `Listas.tsx`)
e as consultas dele (`cartoes`, `serie30`, `paginas` em `app/visitas/server/consultas.server.ts`).

---

## Tela 1 — Painel (`/admin`)

### O que entra, muda e sai

| Do antigo | No novo | Por quê |
|---|---|---|
| "Precisa de atenção" (denúncias, bugs, eventos ocultos, agendados, PIX) | **Entra**, com as filas que existem hoje: rascunhos do robô esperando revisão, posts agendados, tarefas automáticas com erro, fontes do robô falhando, chave do Gemini faltando; depois das telas 5 e 6, rascunhos de artigos e quizzes prontos | é o que o dono precisa ver ao abrir o painel; denúncias, bugs e PIX voltam com as contas |
| Faixa "Hoje" | **Entra** com o que tem dado: Agora (pessoas nos últimos 5 min), páginas vistas, visitantes, publicadas hoje, partidas de quiz | membros, cadastros e receita só com contas |
| Faixa do funil (`MetricsStrip`) | **Entra** depois da tela 2: uma linha com os números do último retrato semanal e "Ver métricas →" | mesmo papel do antigo |
| Tráfego, mais vistos, origem, aparelhos | **Muda**: vai inteiro para **`/admin/visitas`** (o módulo de hoje, sem mudança); no Painel fica só um gráfico pequeno de 14 dias com "Ver visitas →" | o módulo `app/visitas/` continua copiável e sozinho; o Painel fica curto |
| Aviso de queda de tráfego | **Entra**: hoje até agora contra a média dos 7 dias anteriores **no mesmo horário** (usa `visit_daily` + a hora; só a partir das 10h, para não alarmar de madrugada), ≤ −30% | barato com o que já existe |
| Painéis de moderador e de autor | **Sai por enquanto** (só existe o admin); o `loader` já recebe `papeis` e a fase 2 decide | — |
| CSV, abas Dia/Mês/Ano, escolha de data | **Sai** (o módulo de Visitas já tem períodos) | — |
| Robô (não existia no Painel antigo) | **Entra** um cartão "Robô de notícias": modo, hoje x/teto, próximo horário, última rodada | é a parte que mais roda sozinha |

### Wireframes

1440 px (claro; no escuro trocam só os tokens):

```
┌ AdminShell (topo night + barra lateral) ─────────────────────────────────────────────────────────────┐
│ Painel                                                           [+ Novo post] [✦ Pedir artigo]       │
│ Quinta, 19/11 · atualizado às 14:32 (Brasília)                                                        │
│                                                                                                        │
│ ┌ ⚠ Queda de visitas: 312 hoje até agora, média de 520 neste horário (−40%) ─── Ver visitas → ┐ (só se houver)
│                                                                                                        │
│ PRECISA DE ATENÇÃO                                                        ✓ Tudo em dia (se tudo = 0) │
│ ┌ 3 ──────────────┐┌ 2 ──────────────┐┌ 1 ──────────────┐┌ 1 ──────────────┐┌ ok ─────────────┐       │
│ │ ✎ Rascunhos do  ││ ⏰ Posts        ││ ✕ Tarefa com    ││ 📡 Fonte do     ││ 🔑 Chave do     │       │
│ │ robô p/ revisar ││ agendados       ││ erro            ││ robô falhando   ││ Gemini ok       │       │
│ └ âmbar ──────────┘└ neutro ─────────┘└ âmbar ──────────┘└ âmbar ──────────┘└ neutro ─────────┘       │
│                                                                                                        │
│ HOJE                                                                                                   │
│ ┌ AGORA (night) ─┐┌ Páginas vistas ┐┌ Visitantes ────┐┌ Publicadas ────┐┌ Partidas de quiz ┐            │
│ │ 12             ││ 3.210          ││ 1.140          ││ 6              ││ 48               │            │
│ │ pessoas, aprox.││ até 14:32      ││ ▲ 8% vs ontem* ││ 5 robô · 1 você││ 14 quizzes       │            │
│ └────────────────┘└────────────────┘└────────────────┘└────────────────┘└──────────────────┘            │
│                                                                                                        │
│ ┌ Últimos 14 dias ─────────────────────── Ver visitas → ┐ ┌ Robô de notícias ────── Abrir → ┐          │
│ │ (gráfico de linha do módulo de Visitas, 160 px)       │ │ [PUBLICAR] modo                 │          │
│ │                                                       │ │ Hoje 4 de 10  ▓▓▓▓░░░░░░        │          │
│ │                                                       │ │ Próximo: 16h (1 matéria)        │          │
│ │                                                       │ │ Última rodada: 14:20 ✓ 1 pub.   │          │
│ └ col-span-8 ───────────────────────────────────────────┘ └ col-span-4 ───────────────────────┘          │
│                                                                                                        │
│ ┌ Publicadas recentemente ──────────── Ver posts → ┐ ┌ Mais lidas hoje ──────── Ver visitas → ┐       │
│ │ título (2 linhas) · ROBÔ · 14:20 · 312 vistas  ✎ │ │ 1  título ......................  420 │       │
│ │ ... 6 linhas                                     │ │ ... 5 linhas                          │       │
│ └ col-span-7 ──────────────────────────────────────┘ └ col-span-5 ────────────────────────────┘       │
│ (depois da tela 2) FUNIL · semana de 17/11 · Visitantes/dia 1.020 · Páginas/visita 2,4 · … Ver métricas →│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
*Variação "vs ontem no mesmo horário" só se houver dado; senão "—".

375 px:

```
┌ topo night: ☰ [logo] PAINEL   ☾ ⎋ ┐
│ Painel                             │
│ Quinta, 19/11 · 14:32              │
│ [+ Novo post] [✦ Pedir artigo]     │  (botões h-11, lado a lado)
│ PRECISA DE ATENÇÃO                 │
│ ┌ 3 Rascunhos ┐┌ 2 Agendados  ┐    │  grid-cols-2; o 5º ocupa a linha
│ ┌ 1 Tarefa    ┐┌ 1 Fonte      ┐    │
│ ┌ Chave do Gemini ok ─────────┐    │
│ HOJE                               │
│ ┌ AGORA 12 (night, linha toda) ┐   │
│ ┌ Páginas ┐┌ Visitantes ┐          │
│ ┌ Publicadas ┐┌ Quiz ┐             │
│ ┌ Robô de notícias ────────────┐   │  (o robô vem antes do gráfico no celular)
│ ┌ Últimos 14 dias (140 px) ────┐   │
│ ┌ Publicadas recentemente ─────┐   │
│ ┌ Mais lidas hoje ─────────────┐   │
└────────────────────────────────────┘
```

Grade: ≥ 1024 `grid-cols-12`; "Precisa de atenção" `grid-cols-5`; "Hoje" `grid-cols-5`; 640–1023: atenção
`grid-cols-3`, hoje `grid-cols-3` (Agora `col-span-3`), gráfico e robô empilhados; < 640 como no desenho.

### Componentes e estados

- **Cartão de pendência:** link para a fila (`/admin/ai-news?aba=aprovacao`, `/admin/posts?status=scheduled`,
  `/admin/agendamentos`*, `/admin/ai-news?aba=fontes`, `/admin/ai-news?aba=config`). `rounded-xl border p-3 flex gap-3`;
  com `n > 0`: `border-warn/40 bg-warn-soft`, ícone `text-warn`; com 0: `border-line bg-surface`, ícone `text-ink-soft`.
  Número 22/800, rótulo 12 `text-ink-soft` (`truncate`). Chave: "ok" ou "falta" (falta = âmbar). *Enquanto a tela de
  Agendamentos não existir, o cartão "Tarefa com erro" fica **sem link**, com `title` listando os nomes das tarefas com
  erro; quando Agendamentos ficar pronta, passa a levar para lá.
- **"Tudo em dia":** com todas as filas em 0, à direita do rótulo: `CheckCircle2` 16 px `text-ok` + "Tudo em dia" 12/700.
- **Cartão do robô:** `Selo` do modo (`publicar` = ok, `rascunho` = info, `ensaio` = info, `desligado` = neutro); barra
  de 8 px `bg-sunken` com preenchimento `bg-brand` em x/teto; "Próximo: 16h (1 matéria)" calculado de `activeSlots()` e
  `brasiliaHour()`; "Última rodada" com `Selo` do status e números. Sem dado: "Nenhuma rodada ainda".
- **Publicadas recentemente:** 6 últimos `posts` com `status = 'published'` por `published_at`; metadados: origem
  (`ROBÔ`, `AGENDA`* , `VOCÊ`, `SITE ANTIGO`), hora, `views_count`; ícone lápis → `/admin/posts/:id`; título abre a
  matéria em nova aba. *A agenda grava `origin = 'robo'` com `source_url` "agenda de animes": mostrar `AGENDA` quando
  `source_url LIKE 'agenda de animes%'`.
- **Mais lidas hoje:** `paginas("hoje", hoje, "materia", 5)` do módulo de Visitas (sem cópia de código).
- **Estados:** erro do banco → o `loader` devolve `{ erro: true }` e a tela mostra o aviso padrão "Não deu para ler o
  painel agora. Tente de novo." com "Tentar de novo"; cada bloco vazio usa `Vazio` ("Nada publicado hoje ainda.").
  Sem carregando (SSR); recarrega a cada 60 s com `useRevalidator` só enquanto a aba está visível.

### Dados

Nenhuma tabela nova. `app/server/admin/painel.server.ts` com uma função `resumoPainel(hoje)` que roda em
`Promise.all`: contagens de pendências (5 `SELECT COUNT(*)`), `cartoes(hoje)` e `serie30(hoje)` do módulo (corta os
últimos 14), `agora()`, publicadas hoje por origem, `quiz_plays` de hoje, o estado do robô (`getConfig`,
`roboPostsToday`, `activeSlots`, última linha de `ai_news_runs`), 6 recentes, 5 mais lidas, e a queda de tráfego.

---

## Tela 2 — Métricas (`/admin/retention`)

### O que entra, muda e sai

O antigo é quase todo de contas (ativação, retenção, NPS, pagamento). Sem contas, **mostrar zeros seria mentir**. A tela
nova faz duas coisas: (a) **métricas de audiência e conteúdo que já têm dado** (sem cookie, a partir das tabelas de
visitas, `posts` e `quiz_plays`) e (b) **deixa pronto o esqueleto do que o recebimento de usuários exige** (retratos
semanais, registro de decisões e a lista do que a fase 2 precisa gravar), para as métricas de contas nascerem com
histórico desde o primeiro cadastro.

| Do antigo | No novo |
|---|---|
| Cartões "norte" (Ativação, Volta S2, Ativos/semana, NPS, Pagam) com "se piorar…" | **Muda**: 5 cartões de hoje com dado real (ver abaixo), no mesmo formato, cada um com a frase "Se piorar: …" |
| Funil AARRR por coorte | **Fica como bloco "Contas (começa quando o cadastro abrir)"**: as 5 etapas com a definição e "—", e a lista dos eventos que a fase 2 precisa gravar |
| Histórico semanal + "Gravar retrato agora" | **Entra igual** (tabela `metrics_snapshots`, tarefa toda segunda 9h30) |
| Decisões da reunião | **Entra igual** (tabela `metrics_decisions`) |
| Aquisição por canal | **Entra** como "De onde vêm as visitas, semana a semana" (origens de `visit_dims`) |
| Engajamento | **Muda**: páginas por visita, partidas de quiz e conclusão do quiz |
| Receita, CAC/LTV, sistema, hábito, onde travam, vaidade | **Sai** até as contas e a economia (o "Sistema" do antigo é a tela Agendamentos) |
| **Novo:** "Rendimento do conteúdo" | média de páginas vistas por matéria nos **7 primeiros dias**, separada por origem (robô, agenda, você, site antigo), e as 10 matérias que mais trouxeram **entradas** em 30 dias. Responde "o teto do robô deve subir?" |

**Os 5 cartões (últimos 7 dias contra os 7 anteriores):**

| Cartão | Conta | Se piorar |
|---|---|---|
| Visitantes por dia | média de `visit_daily.visitors` | "ver em Visitas qual origem caiu antes de mudar o conteúdo." |
| Páginas por visita | `SUM(pageviews) / SUM(entries)` | "revisar os links internos e a lateral das matérias." |
| Vindas da busca | entradas `origem = busca` ÷ entradas | "conferir o Search Console (cobertura e títulos)." |
| Conclusão do quiz | `quiz_plays` ÷ páginas vistas de `kind = 'quiz'` (`/quiz/:slug`) | "olhar o quiz com mais saída e encurtar." |
| Procura pelas contas | páginas vistas de `kind = 'contas'` + `/login` | "é gente querendo entrar: sinal para priorizar a fase 2." |

### Wireframes

1440 px:

```
│ Métricas                                                                 [Gravar retrato agora]       │
│ Audiência e conteúdo, sem cookies. As métricas das contas começam a contar quando o cadastro abrir.   │
│ Calculado às 14:32 · últimos 7 dias contra os 7 anteriores                                            │
│ ┌ Visitantes/dia ┐┌ Páginas/visita ┐┌ Vindas da busca ┐┌ Conclusão quiz ┐┌ Procura p/ contas ┐         │
│ │ 1.020  ▲ 6%    ││ 2,4  ▼ 0,1     ││ 41%  ▲ 3 pts    ││ 63%  —         ││ 85  ▲ 12%        │         │
│ │ Se piorar: …   ││ Se piorar: …   ││ Se piorar: …    ││ Se piorar: …   ││ Se piorar: …     │         │
│ └────────────────┘└────────────────┘└─────────────────┘└────────────────┘└──────────────────┘         │
│ ┌ Rendimento do conteúdo (col-span-7) ─────────────┐ ┌ De onde vêm, semana a semana (col-span-5) ┐      │
│ │ Vistas por matéria nos 7 primeiros dias          │ │ barras empilhadas de 100%, 8 semanas       │      │
│ │ Robô     ▓▓▓▓▓▓▓░░░  142  (38 matérias)          │ │ (cores --vp-o-* do módulo de Visitas)      │      │
│ │ Agenda   ▓▓▓▓▓▓▓▓▓░  210  (2)                    │ │ legenda: Direto Busca Social Sites Camp.   │      │
│ │ Você     ▓▓░░░░░░░░   40  (1)                    │ │                                            │      │
│ │ Mais entradas em 30 dias: 1. título … 820        │ │                                            │      │
│ └──────────────────────────────────────────────────┘ └────────────────────────────────────────────┘      │
│ ┌ Histórico semanal ──────────────────────────────────────────────────────────────────────────────┐   │
│ │ Semana | Visitantes/dia | Páginas/visita | Busca | Quiz | Procura contas | Publicadas | Robô    │   │
│ │ 17/11  | 1.020          | 2,4            | 41%   | 63%  | 85             | 52         | 40      │   │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│ ┌ Decisões ─────────────────────────────────────────────────────────── [Registrar decisão] ───────┐   │
│ │ (formulário recolhido; lista: problema em negrito · decisão · quem · revisar em 03/12 [Revista]) │   │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│ ┌ Contas — começa quando o cadastro abrir (borda tracejada, texto ink-soft) ──────────────────────┐   │
│ │ Ativação —  · Volta na 2ª semana —  · Ativos na semana —  · NPS —  · Pagam —                     │   │
│ │ ▸ O que a fase 2 precisa gravar (details): cadastro iniciado/concluído/erro, primeiro login,      │   │
│ │   ação de valor (ler, comentar, figurinha), check-in, resposta de NPS, compra.                    │   │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
```

375 px: cartões `grid-cols-2` (o 5º na linha inteira); "Rendimento" e "De onde vêm" empilhados; o histórico rola de lado
dentro do cartão (`min-w-[640px]`, primeira coluna fixa `sticky left-0 bg-surface`); "Registrar decisão" em largura total.

### Componentes e estados

- **Cartão de métrica:** `Numero` + linha de variação (▲/▼ em `text-ok`/`text-brand`; para porcentagens, "pts"); "Se
  piorar:" 12 `text-ink-soft` em 2 linhas (`line-clamp-2`, `title` com o texto todo). Sem base: "—" e "sem dado para
  comparar".
- **Rendimento:** barras horizontais de 10 px (`bg-sunken`, preenchimento `bg-brand`; "Você" `bg-info`), número
  `tabular-nums` e "(N matérias)"; só origens com pelo menos 1 matéria nos últimos 30 dias. Lista "Mais entradas" com
  5 itens (link abre a matéria).
- **De onde vêm:** 8 colunas (semanas), cada uma uma barra vertical de 100% empilhada com as 5 cores do módulo de
  Visitas (`--vp-o-*`, importar `~/visitas/ui/visitas.css` e envolver o cartão em `.vp`); dica ao passar o mouse com
  as %; tabela equivalente em `<details>` ("Ver em tabela").
- **Histórico:** tabela; semana em `dd/mm`; a mais recente em negrito; vazio: "Ainda sem retratos. O primeiro sai na
  segunda às 9h30 (ou grave agora)."
- **Decisões:** botão abre o formulário dentro do cartão (`grid sm:grid-cols-2 gap-3`): Problema (com o número), O que
  vamos fazer, Motivo/o que perdemos, Quem faz, Revisar em (`date`), Discordâncias. Salvar grava junto o retrato atual
  (`snapshot`). Lista: cada decisão em linha; revisão vencida com `Selo aviso` "revisar"; botão "Marcar como revista".
- **Estados:** erro de banco → aviso padrão; `metrics_snapshots` ainda não existe (migration não rodou) → aviso
  "Falta rodar a migration 014." no lugar do histórico e das decisões.

### Dados — migration 014

`db/migrations/014_metricas.sql` (colar no chat ao criar):

```sql
-- 014: métricas do painel (docs/plano-telas-painel.md, tela 2). Retrato semanal e registro de decisões.
-- Datas em UTC; a semana é a segunda-feira de Brasília. JSON gravado como texto (MariaDB: nada de CAST(? AS JSON)).

CREATE TABLE IF NOT EXISTS metrics_snapshots (
  week DATE NOT NULL PRIMARY KEY,                -- segunda-feira (Brasília) da semana retratada
  data JSON NOT NULL,                            -- números da semana (formato em app/server/admin/metricas.server.ts)
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metrics_decisions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  problem VARCHAR(300) NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NULL,
  owner VARCHAR(120) NULL,
  review_at DATE NULL,
  dissent TEXT NULL,
  snapshot JSON NULL,                            -- números do momento em que foi decidida
  status VARCHAR(12) NOT NULL DEFAULT 'aberta',  -- aberta | revista
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_metrics_decisions_review (status, review_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Formato de `data` (versão 1): `{ v: 1, visitantesDia, paginasPorVisita, buscaPct, quizConclusaoPct, procuraContas,
publicadas: { robo, agenda, painel, old }, entradasPorOrigem: { direto, busca, social, site, campanha } }`. Tarefa nova
`metricas-semanal` em `jobs.server.ts`, `"30 9 * * 1"`, `leaseMinutes: 5`, grava a semana anterior com
`INSERT ... ON DUPLICATE KEY UPDATE data = VALUES(data)`.

---

## Tela 3 — Posts (`/admin/posts`, `/admin/posts/novo`, `/admin/posts/:id`)

### O que entra, muda e sai

| Do antigo | No novo | Por quê |
|---|---|---|
| Lista com abas de status, busca, tipo, origem, autor, ordem | **Entra**, paginada **no servidor** (25 por página, filtros na URL) | são 970+ matérias; o antigo baixava tudo de 1.000 em 1.000 |
| Origem "pessoas / IA" | **Muda** para 4 origens reais: Site antigo (`old`), Robô (`robo`, sem a agenda), Agenda, Painel (`painel`, nova) | o banco já separa |
| Seleção em lote + excluir | **Muda**: excluir só **rascunhos** (um ou em lote); publicado precisa ser despublicado antes | evita 404 de matéria indexada sem redirecionamento |
| Editor Tiptap com capa, categorias, tags, resumo, agendar | **Entra** (Tiptap, como no antigo) | é o que o dono já conhece; o HTML gravado continua passando por `sanitizePostHtml` |
| Marcações ✍️ que bloqueiam publicar + "Limpar marcações" | **Entra** (os rascunhos da tela 5 dependem disso) | — |
| Checklist "Para publicar" | **Entra**: título ≥ 5, ≥ 50 palavras, capa, ≥ 1 categoria, sem `[texto de modelo]`, sem marcação ✍️ | — |
| Nota de SEO (`SeoQualityScore`) | **Muda** para 4 checagens simples na lateral: palavra-chave no título, no 1º parágrafo, título de 30 a 70 caracteres, resumo de 70 a 160 | reaproveita a régua do robô (`app/server/robot/quality.ts`) |
| Modelos de artigo | **Sai** (os artigos vêm da tela 5) | — |
| Nós especiais do antigo (cartão de anime, nota de review, quiz embutido) | **Sai** nesta entrega; ficam: parágrafo, H2/H3, negrito, itálico, link, listas, citação, imagem com legenda, vídeo do YouTube, **spoiler** (`details.spoiler-box`, o mesmo que `normalizeSpoilerBoxes` já entende) e "Ver HTML" | a página pública nova não desenha esses nós; podem voltar depois |
| Endereço editável | **Muda**: editável só enquanto **nunca publicado**; depois, só leitura com cadeado | não há tabela de redirecionamento de matéria (pergunta 3) |
| Cópia local não salva + "Recuperar" | **Entra** (`localStorage`, chave `ap-post-<id>`) | — |
| — | **Novo:** histórico de versões (as 20 últimas por matéria, "Restaurar") e aviso de conflito ("este post mudou às 14:20, recarregue") | um só admin, mas o robô e a agenda também gravam em `posts` |

### Wireframes

Lista, 1440 px:

```
│ Posts                                                                              [+ Novo post]     │
│ Notícias e artigos do site: escrever, agendar e publicar.                                            │
│ Todos 972 │ Publicados 951 │ Agendados 2 │ Rascunhos 19          (abas com sublinhado)               │
│ [🔍 Buscar por título ou endereço      ] [Notícias e artigos ▾] [Todas as origens ▾] [Autor ▾] [Mais recentes ▾] [× Limpar] │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐  Mostrando 1–25 de 951                                                                         │ │
│ │ ☐ [capa 96×54] Título da matéria em até duas linhas…                                ↗  ✎  🗑     │ │
│ │                PUBLICADO · Notícia · Animes e Mangás · 🤖 Akira (IA) · 18/11 14:20 · 👁 312        │ │
│ │ ...                                                                                              │ │
│ │                                         ‹ 1 2 3 … 39 ›                                           │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ (com seleção: barra fixa no topo do cartão "2 rascunhos selecionados   [Cancelar] [Excluir]")         │
```

Lista, 375 px: abas roláveis; busca em largura total; os 4 filtros viram um botão "Filtros (2)" que abre um `<details>`
com os `select` empilhados; linhas sem a capa (só abaixo de 640 px), ações `↗ ✎` à direita e `🗑` só em rascunho.

Editor, 1440 px:

```
│ ← Posts      Editar notícia                                             (descrição: Ctrl+S salva)    │
│ ┌ coluna do texto (1fr) ──────────────────────────────────┐ ┌ lateral 320 px (sticky top-20) ──────┐  │
│ │ Título grande (textarea 30/800, sem borda, cresce)      │ │ PUBLICAÇÃO              [PUBLICADO]  │  │
│ │ Endereço: /noticias/ [slug-da-materia 🔒]  Ver no site ↗│ │ Assinado por [Akira (IA) ▾]          │  │
│ │ ┌ ⚠ Há uma versão não salva de 14:02  [Recuperar] [×] ┐ │ │ Tipo  [Notícia|Artigo] (só rascunho) │  │
│ │ ┌ ⚠ 3 marcações ✍️ … [Limpar marcações]            ┐ │ │ Data  [18/11/2026 14:20]             │  │
│ │ ┌ barra do editor: ¶ H2 H3 | B I | link | • 1. ❝ |  ┐ │ │ ☐ Agendar para depois                │  │
│ │ │ imagem ▶ YouTube ▣ Spoiler | ↶ ↷ | </> Ver HTML   │ │ │ Para publicar ✓ Título ✓ 50 palavras │  │
│ │ └─────────────────────────────────────────────────────┘ │ │   ⚠ Capa ✓ Categoria ✓ Sem marcação  │  │
│ │ (área do texto com a tipografia da matéria pública)     │ │ CAPA [imagem 16:9] [trocar] [tirar]  │  │
│ │                                                         │ │   ou cole o link                     │  │
│ │ 642 palavras · 3 min de leitura                         │ │ CATEGORIAS (pílulas que alternam)    │  │
│ │ RESUMO (textarea 3 linhas, 0/300)                       │ │ TAGS [busca + criar]                 │  │
│ │                                                         │ │ SEO  palavra-chave [____]            │  │
│ │                                                         │ │   ✓ no título ✓ no 1º parágrafo …    │  │
│ │                                                         │ │ VERSÕES  14:20 você · 13:02 robô ▸   │  │
│ └─────────────────────────────────────────────────────────┘ └──────────────────────────────────────┘  │
│ ┌ barra de ações (sticky bottom-0 do <main>, bg-surface/95 backdrop-blur, borda em cima) ───────────┐ │
│ │ [PUBLICADO] ● Alterações não salvas                  [Prévia] [Despublicar] [Salvar alterações]  │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │
```

Editor, 375 px: uma coluna; a lateral vem **depois** do resumo, com os cartões na mesma ordem; a barra de ferramentas do
editor rola de lado (`overflow-x-auto`, botões 44 px) e fica `sticky top-14` enquanto se escreve; a barra de ações fica
fixa embaixo com os rótulos curtos ("Salvar", "Publicar"); "Prévia" vira ícone.

### Componentes e estados

- **Botões da barra por status** (igual ao antigo): rascunho → "Salvar rascunho" (secundário) + "Publicar" ou "Agendar"
  (primário, conforme a caixa "Agendar"); agendado → "Cancelar agendamento" (fantasma), "Salvar", "Publicar agora";
  publicado → "Despublicar" (fantasma, com `Confirmar`), "Salvar alterações" (primário, desabilitado sem mudança).
  "Excluir" (perigo) só em rascunho, no fim da lateral.
- **Publicar com checklist incompleto:** o botão fica habilitado, mas ao clicar o servidor devolve a lista do que falta e
  a lateral rola até o checklist com os itens em `text-warn` (o servidor confere de novo; o navegador não é a regra).
- **Salvo:** "Salvo às 14:32" na barra; não salvo: bolinha 8 px `bg-warn` + "Alterações não salvas" (≥ 640) e aviso do
  navegador ao sair (`beforeunload`) e ao trocar de página (`useBlocker` do React Router com o `Confirmar`).
- **Conflito (409):** aviso âmbar no topo: "Este post foi alterado às 14:20 (robô/agenda/outra aba). Copie o que
  escreveu e recarregue." com "Recarregar" (a cópia local continua guardada).
- **Envio de imagem:** área tracejada `rounded-[10px] border-2 border-dashed border-line p-6`, `Upload` 20 px, "Enviar
  imagem de capa" / "Enviando…" com `Loader2`; erro em linha ("Imagem muito grande: até 8 MB."). No texto, o botão de
  imagem abre o seletor de arquivo e insere `<figure><img><figcaption>`; colar/arrastar imagem também envia.
- **Prévia:** abre `/admin/posts/:id/previa` em nova aba (a matéria desenhada com o mesmo componente/classes do corpo da
  página pública, faixa âmbar no topo "Prévia: não está no site").
- **Versões:** `<details>` na lateral com as 20 últimas (hora, quem: "você"/"robô"/"agenda", status); cada uma com
  "Ver" (abre a prévia daquela versão) e "Restaurar" (`Confirmar`; restaurar carrega no editor sem salvar).
- **Lista vazia:** "Nenhum post aqui." + "Limpar filtros" quando houver filtro.
- **Teclado:** Ctrl/⌘+S salva sem mudar o status; Esc fecha diálogos; a barra do editor tem `role="toolbar"` com setas.

### Dados — migration 015

`db/migrations/015_posts_painel.sql` (colar no chat ao criar):

```sql
-- 015: edição de matérias no painel (docs/plano-telas-painel.md, tela 3).
-- origin ganha 'painel' (escrita aqui). edited_at marca o que foi editado no painel: a importação do site antigo não
-- sobrescreve essas matérias.
ALTER TABLE posts
  ADD COLUMN edited_at DATETIME(3) NULL AFTER updated_at;

-- Versões anteriores de cada matéria (as 20 últimas por matéria; a limpeza apaga o resto).
CREATE TABLE IF NOT EXISTS post_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  title VARCHAR(300) NOT NULL,
  excerpt TEXT NULL,
  content_html MEDIUMTEXT NOT NULL,
  featured_image VARCHAR(600) NULL,
  status VARCHAR(20) NOT NULL,
  saved_by VARCHAR(20) NOT NULL,                 -- painel | robo | agenda
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_post_revisions_post (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **Gravar** (`app/server/admin/posts.server.ts`, `salvarPost`): numa transação, `SELECT ... FOR UPDATE` do post, confere
  `updated_at` recebido (senão 409), grava a versão atual em `post_revisions` (`saved_by = 'painel'` se a anterior era do
  painel, senão a origem), atualiza `posts` (HTML por `sanitizePostHtml`, `reading_minutes`, `image_width/height` da
  capa quando for de `/media`, `edited_at = UTC_TIMESTAMP(3)`), refaz `post_categories`/`post_tags` dessa matéria; depois
  `clearCache()` e `rebuildPostVideos()` sem esperar (`void`, erro só no log).
- **Status:** `resolveSave` do antigo (`lib/post-editor.ts`) portado para `app/lib/post-editor.ts` (puro, com testes):
  publicar com data futura vira `scheduled`; publicar rascunho sem data usa agora; despublicar volta a `draft` e
  mantém `published_at` (para não perder a data original).
- **Agendados:** tarefa nova `publicar-agendados` em `jobs.server.ts`, `"*/5 * * * *"`, `leaseMinutes: 2`:
  `UPDATE posts SET status = 'published' WHERE status = 'scheduled' AND published_at <= UTC_TIMESTAMP(3)`; se mudou algo,
  `clearCache()`.
- **Imagens:** `POST /admin/posts/imagem` (rota só de `action`, `requireAdmin`): até 8 MB, `isImageBytes`, `sharp` →
  `/media/painel/<sha1 24 hex>.webp` (lado maior até 1600 px, qualidade 82) e `-640.webp`; devolve `{ url, width, height }`.
  Generalizar `saveRobotMedia` para `saveOwnMedia(pasta: "robo" | "painel", ...)` (mesma validação do nome).
- **Importação do antigo:** `import-old.server.ts` passa a pular matérias com `edited_at IS NOT NULL` (não apaga, não
  sobrescreve, não religa categorias/tags). Teste em `tests/content.test.ts`.
- **Novo post:** `id = randomUUID()`, `origin = 'painel'`, `status = 'draft'` só ao **primeiro salvar** (abrir
  `/admin/posts/novo` não cria linha).
- **Limpeza:** na tarefa `limpeza`, apagar de `post_revisions` o que passar das 20 mais novas por matéria.

---

## Tela 4 — Notícias IA (`/admin/ai-news`)

### O que entra, muda e sai

Uma página com submenu (`?aba=`), como no antigo. As abas usam **as tabelas da migration 012 e as funções que já
existem**; a página substitui, para o dono, o uso de `/api/robo/*` (que continua para scripts).

| Aba do antigo | No novo | Conteúdo |
|---|---|---|
| Dashboard | **Visão geral** | modo (4 botões), "Ensaio agora" e "Rodada agora", hoje x/teto, horários do dia, chamadas ao Gemini nas 24 h por modelo contra o limite, últimas 10 rodadas (com o relatório), motivos de descarte das 24 h |
| Aprovação | **Aprovação** | rascunhos do robô (`posts.origin = 'robo' AND status = 'draft'`): Revisar (editor), Publicar agora (com o checklist), Descartar |
| Candidatos | **Candidatos** | `ai_news_candidates` dos últimos 3 dias por status, nota, fonte, idade; Prévia, Ensaiar este endereço, Descartar |
| Histórico | **Histórico** | `ai_news_runs` dos últimos 60 dias, 25 por página, com o relatório aberto em `<details>` |
| Fontes | **Fontes** | `ai_news_sources`: criar, editar, ligar/desligar, prioridade, "Testar fonte" (quantos itens o RSS deu) |
| Tópicos e bloqueios | **Tópicos e bloqueios** | `ai_news_terms` (`topic` com peso 1–100, `block`) |
| Horários | **Horários e limites** | `ai_news_schedule_slots` (0–23 h, 0–3 por hora), teto do dia (1–15), % fora de anime |
| Autores IA | **Autores IA** | `ai_news_authors` + `post_authors` (`kind = 'ai'`): categoria, especialidade, publica sozinho, ativo. Nome e endereço só leitura (mudar quebraria `/autores/:slug`); avatar fica para depois |
| Configurações | **Configurações** | modelo (`ALLOWED_GEMINI_MODELS`), imagens no corpo (1–10), chamadas por dia por modelo, guia editorial (texto grande), chave do Gemini "configurada/falta" |
| Desempenho, Tendências, Títulos alternativos | **Saem nesta entrega** | Desempenho volta quando houver 30 dias de `visit_pages` (vistas por fonte e tópico); os títulos alternativos já ficam na prévia |

### Wireframes

1440 px (aba Visão geral):

```
│ Notícias IA                                                                                        │
│ Quanto o robô publicou hoje, o modo e as últimas rodadas.  (desc muda com a aba)                   │
│ ┌ submenu 208 px (sticky) ┐ ┌ conteúdo ────────────────────────────────────────────────────────┐   │
│ │ VISÃO GERAL             │ │ ┌ MODO (cartão night) ──────────────────────────────────────────┐ │   │
│ │ ▌Visão geral            │ │ │ [Desligado] [Ensaio] [Rascunho] [■ Publicar]   ✓ chave Gemini │ │   │
│ │ ROBÔ                    │ │ │ Hoje 4 de 10  ▓▓▓▓░░░░░░   Próximo: 16h                        │ │   │
│ │  Aprovação (3)          │ │ │ [Ensaio agora] [Rodada agora]                                  │ │   │
│ │  Candidatos             │ │ └────────────────────────────────────────────────────────────────┘ │   │
│ │  Histórico              │ │ ┌ Horários de hoje ──────────────────────────────────────────────┐ │   │
│ │ ORIGEM                  │ │ │ 08 ● 10 ● 12 ● 14 ● 16 ○ 18 ○ 20 ○ 22 ○   (● feito ○ por vir)  │ │   │
│ │  Fontes (1 ⚠)           │ │ └────────────────────────────────────────────────────────────────┘ │   │
│ │  Tópicos e bloqueios    │ │ ┌ Gemini (24 h) ──────────┐ ┌ Por que descartou (24 h) ─────────┐ │   │
│ │  Horários e limites     │ │ │ 3-flash 13/40 ▓▓▓░░░     │ │ Muito parecida com recente   4    │ │   │
│ │ AUTORES                 │ │ │ 2.5-flash 0/40           │ │ Fora do tema                  2    │ │   │
│ │  Autores IA             │ │ └──────────────────────────┘ └───────────────────────────────────┘ │   │
│ │ SISTEMA                 │ │ ┌ Últimas rodadas ───────────────────────────────────────────────┐ │   │
│ │  Configurações          │ │ │ 14:20 [OK] publicar · limite 1 · 1 publicada · 0 desc. · 2m10 ▸│ │   │
│ └─────────────────────────┘ │ └────────────────────────────────────────────────────────────────┘ │   │
```

375 px: o submenu vira uma fileira de pílulas rolável abaixo do título (`flex overflow-x-auto gap-2`, pílula `h-11 px-4`
`rounded-full border`, ativa `bg-brand-soft border-brand text-brand`); os 4 botões de modo viram `grid-cols-2`; tabelas
viram linhas empilhadas.

Aba Fontes, 1440 px:

```
│ Fontes (10)                                                                   [+ Nova fonte]      │
│ ● Crunchyroll News   crunchyroll.com · RSS ok · prioridade 9 · há 12 min         [Testar] ✎ [⏻]   │
│ ⚠ AnimeNewsNetwork   … · falhou 3 vezes seguidas                                 [Testar] ✎ [⏻]   │
```
Editar abre `<dialog>` com Nome, Endereço do site, RSS (opcional), Prioridade (1–10, `input type=range` + número).

### Componentes e estados

- **Modo:** 4 botões num cartão `night` (`bg-night text-night-ink rounded-[14px] p-5`), botão ativo `bg-brand
  text-brand-ink`, inativos `bg-white/10 hover:bg-white/15`. Trocar para **publicar** pede `Confirmar` ("O robô vai
  publicar sozinho até o teto de N por dia."); os outros trocam direto. Sem chave do Gemini: aviso âmbar e botões de
  rodada desabilitados.
- **Ensaio agora / Rodada agora:** `fetcher` → `trackRun("robo-painel", ...)` sem esperar; resposta "Começou. Os
  resultados aparecem em Últimas rodadas em 1 a 3 minutos." e a aba recarrega a cada 15 s (`useRevalidator`) até a
  rodada sair de `running` (no máximo 10 min). Já existe rodada `running`: botões desabilitados com "Rodada em andamento".
- **Candidatos:** `Abas` de status (Na fila, Escolhidos, Ensaio, Rascunho, Publicados, Descartados, Falhas); linha com
  nota (`tabular-nums`, 13/700), título (link para a fonte, nova aba), fonte · idade; ações: "Prévia" (só com
  `result_json`), "Ensaiar" (`runRobot({ rehearsal: true, force: true, url })`), "Descartar" (`pending` →
  `discarded`, motivo "descartado no painel").
- **Prévia:** rota `/admin/ai-news/previa/:id` que devolve o HTML de hoje (`preview()` sai de `api.robo.ts` para
  `app/server/robot/painel.server.ts`, usado pelos dois); abre em nova aba.
- **Aprovação:** linhas com capa 96×54, título, autor, categoria, palavras, "há 2 h"; "Revisar" (secundário) →
  `/admin/posts/:id`; "Publicar agora" (primário; erro do checklist aparece na linha); "Descartar" (perigo, `Confirmar`,
  apaga o rascunho e marca o candidato `discarded`). Vazio: "Nenhum rascunho esperando. No modo Publicar o robô só
  deixa rascunho para autores que não publicam sozinhos."
- **Horários e limites:** grade de 24 células (≥ 1024 `grid-cols-12`, celular `grid-cols-4`), cada uma com a hora 13/700
  e um contador `− n +` (0–3); célula com 0 em `text-ink-soft` e `bg-sunken/40`; total do dia somado embaixo ("13 por dia
  pelos horários; teto 10"). Salvar grava tudo de uma vez.
- **Configurações:** guia editorial em `TextArea` monoespaçada de 18 linhas, contador de caracteres, "Salvar guia"
  separado; nunca mostra o valor de nenhuma variável de ambiente.
- **Estados gerais:** erro do banco → aviso; ação com erro → `Retorno` em vermelho na linha; contadores no submenu
  (Aprovação com rascunhos, Fontes com ⚠ quando há fonte com `fail_streak >= 3`).

### Dados

Nenhuma migration. Funções novas em `app/server/robot/painel.server.ts`: `statusRobo()` (o `status()` de hoje),
`preview(id)`, `listarCandidatos(status, pagina)`, `motivosDescarte24h()`, `listarRodadas(pagina)`, CRUD de fontes,
termos, horários e autores, `salvarConfig(patch)` (usa `setConfig`), `salvarGuia(texto)` (usa `setGuide`), `descartarRascunho(postId)`.
`api.robo.ts` passa a importar `statusRobo` e `preview` de lá (mesmo comportamento).

---

## Tela 5 — Artigos com IA (`/admin/artigos-ia`)

### O que entra, muda e sai

| Do antigo | No novo |
|---|---|
| Pedido por tipo (15 tipos), assunto, anime, personagem, observações, "conheço o tema" | **Entra igual**; os tipos e as instruções vêm de `animeprofile-old/src/lib/ai-news/article-kinds.ts` (portar para `app/server/robot/artigos/tipos.ts`) |
| Robô de artigos (rodava no worker do GitHub) | **Entra no cron do site** (tarefa `pedidos-ia`), portando `worker/articles.ts`; usa `generateWithGemini`, a fila de modelos, `checkQuality`/`autoFixArticle` e o contexto do AniList que já existem |
| Fila com estados, Gerar agora, Revisar, Tentar de novo, Cancelar, Apagar, "Travado" (30 min) | **Entra igual** |
| Ideias de hoje (Search Console, feed, mais lidos, temporada) | **Muda**: só com dado nosso: animes mais vistos nos últimos 7 dias (`visit_pages` `kind = 'anime'` e matérias com `anilist_id`) e os 10 mais populares da temporada (`anime_catalog`), sem pedido do mesmo anime em 30 dias; 6 ideias, "Outras ideias" troca o lote |
| Banco de imagens por anime | **Sai nesta entrega**: a capa vem do banner do anime (como a agenda faz) e as imagens do corpo vêm das matérias publicadas do mesmo anime (`posts.anilist_id`); volta depois, junto com a tela Mídias |
| Rascunho vai para Posts | **Igual**: `posts` com `post_type = 'article'`, `status = 'draft'`, `origin = 'robo'`, `is_ai_generated = 1`; "Revisar" abre o editor da tela 3, que já trava publicar com marcação ✍️ |

### Wireframes

1440 px:

```
│ Artigos com IA                                                             [▶ Gerar agora (2)]   │
│ Peça artigos que valem por anos. O robô escreve um rascunho com os fatos do AniList; você revisa   │
│ e publica em Posts.                                                                                │
│ ┌ Novo pedido (col-span-7) ─────────────────────────┐ ┌ Ideias de hoje (col-span-5) ─[↻ Outras]┐ │
│ │ Tipo: (pílulas que quebram linha, 15)              │ │ ⭐ RECOMENDADA                           │ │
│ │ [Ordem p/ assistir][Vai ter nova temporada?]…      │ │ Ordem para assistir — Frieren           │ │
│ │ Assunto [______________________________]           │ │ Por quê: 3ª mais vista da semana        │ │
│ │ Anime   [🔍 buscar no catálogo        ]            │ │ [+ Pedir este]                          │ │
│ │ Observações [__________________________]           │ │ ─────────────────────────────────────── │ │
│ │ ☐ Conheço esse tema e vou escrever minha opinião   │ │ Dandadan · temporada  [+ Parecidos][+…] │ │
│ │   (texto que muda: com marcações / modo comunidade)│ │ … 5 linhas                              │ │
│ │ [✦ Pedir rascunho]                                 │ │                                         │ │
│ └────────────────────────────────────────────────────┘ └─────────────────────────────────────────┘ │
│ ┌ Pedidos ──────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [NA FILA] Ordem para assistir · modo comunidade · Frieren                          [Cancelar] │ │
│ │ [ESCREVENDO] Parecidos com… · com opinião · Dandadan · começou 14:10 · tentativa 1 de 3      │ │
│ │ [RASCUNHO PRONTO] Curiosidades · Título gerado do artigo                 [✎ Revisar] [🗑]    │ │
│ │ [TRAVADO] … Sem notícia do robô há mais de 30 min.                       [↻ Tentar] [Cancelar]│ │
│ └───────────────────────────────────────────────────────────────────────────────────────────────┘ │
```

375 px: título; "Gerar agora" em largura total; "Novo pedido" com os tipos numa fileira rolável de pílulas
(`overflow-x-auto`); "Ideias de hoje" depois do pedido; "Pedidos" por último, cada pedido em cartão com o selo em cima e as
ações embaixo.

### Componentes e estados

- **Selos da fila:** Na fila (`neutro`), Escrevendo (`info`, com `Loader2` girando 12 px; parado com "reduzir
  movimento"), Rascunho pronto (`ok`), Falhou (`erro`, mensagem em 12 px `text-brand` embaixo), Cancelado (`neutro`),
  Travado (`aviso`, quando `generating` há mais de 30 min).
- **Busca de anime:** campo com `Search` 16 px; a partir de 2 letras, busca no **nosso** `anime_catalog` (título ou id)
  por um `loader` de recurso `/admin/artigos-ia/anime?q=` (debounce 300 ms); lista de até 8 (`role="listbox"`,
  setas e Enter); escolhido vira um chip "Frieren · TV · 2023 [trocar]". Id do AniList que não está no catálogo:
  "Não está no catálogo; o robô busca os fatos no AniList ao escrever." (o robô já tem `findAnimeContext`).
- **"Pedir rascunho"** desabilitado até o assunto ter 2+ letras e, nos tipos que exigem anime, o anime escolhido.
- **Gerar agora:** como o "Rodada agora" da tela 4 (processa até 2 pedidos, recarrega a cada 15 s enquanto houver
  "Escrevendo").
- **Vazio:** "Nenhum pedido em andamento. Os artigos já publicados saem daqui."; ideias vazias: "Sem ideias novas agora.
  Volte amanhã."

### Dados — migration 016

`db/migrations/016_pedidos_ia.sql` (colar no chat ao criar). A mesma fila serve aos quizzes da tela 6.

```sql
-- 016: pedidos ao robô feitos no painel (artigos e quizzes). docs/plano-telas-painel.md, telas 5 e 6.
CREATE TABLE IF NOT EXISTS ai_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(10) NOT NULL,                     -- artigo | quiz
  subkind VARCHAR(30) NOT NULL,                  -- tipo do artigo (ordem, parecidos, ...) ou do quiz (personalidade | conhecimento)
  topic VARCHAR(200) NOT NULL,
  anilist_id INT NULL,
  character_id INT NULL,
  notes VARCHAR(1000) NULL,
  knows_topic TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'pending', -- pending | generating | done | failed | canceled
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  error VARCHAR(500) NULL,
  post_id CHAR(36) CHARACTER SET ascii NULL,
  quiz_id CHAR(36) CHARACTER SET ascii NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_ai_requests_queue (status, created_at),
  KEY idx_ai_requests_kind (kind, status),
  KEY idx_ai_requests_anime (anilist_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **Tarefa `pedidos-ia`** (`"50 * * * *"`, `leaseMinutes: 15`): pega até 2 `pending` (mais antigos), marca
  `generating` e `attempts + 1`, gera, grava o rascunho e marca `done` com `post_id`; erro → `failed` (3 tentativas, depois
  fica `failed`). Antes de gerar, confere a cota: só roda se `modelCallsLast24h(modelo) <= chamadasDiaPorModelo - 10`
  (o robô de notícias tem prioridade; pergunta 7). `generating` há mais de 30 min volta a `pending` na rodada seguinte.
- **Cancelar** durante `generating`: marca `canceled`; ao terminar, o gerador confere o status antes de gravar e
  descarta o texto se estiver `canceled`.
- **Assinatura:** modo comunidade → autor de IA escolhido por `pickAuthor` (como o robô); "com opinião" → o autor do dono
  (pergunta 6).
- **Painel (tela 1):** acrescentar a pendência "Artigos para revisar" (`ai_requests` `done` cujo post ainda é `draft`).

---

## Tela 6 — Quizzes (`/admin/quizzes`, `/admin/quizzes/:id`)

### O que entra, muda e sai

| Do antigo | No novo |
|---|---|
| Lista com capa, tipo, perguntas, partidas, "falta N", publicado/rascunho, apagar | **Entra**; partidas = `plays_old + plays_new`; apagar só rascunho; publicado → "Despublicar" |
| Editor: dados, resultados primeiro, perguntas, imagens, certa/resultado por opção, explicação | **Entra igual**, sobre o `data` JSON que a migration 009 já tem; regras de `quizProblems()` |
| "Testar" | **Entra**: `/admin/quizzes/:id/testar` usa o mesmo componente da página pública com os dados do rascunho; a pontuação roda numa `action` do admin com `quizOutcome()` **sem gravar partida** |
| Pedido à IA (`QuizAiPanel`) | **Entra** na mesma fila da tela 5 (`ai_requests.kind = 'quiz'`), portando `worker/quizzes.ts`; o resultado vira quiz em rascunho |
| Ideias de quiz (`QuizIdeas`) | **Sai nesta entrega** (as ideias da tela 5 já cobrem animes em alta); volta se o dono sentir falta |
| Endereço editável | só enquanto nunca publicado (como em Posts) |

### Wireframes

Lista, 1440 px:

```
│ Quizzes                                                                     [+ Novo quiz]         │
│ Quiz de personalidade e de conhecimento, cada um com página própria em /quiz.                     │
│ ┌ Pedir quiz à IA (recolhido em <details>, aberto se não houver quiz) ─────────────────────────┐  │
│ │ Tipo [Personalidade|Conhecimento] Assunto [____] Anime [🔍] Observações [____] [✦ Pedir]     │  │
│ │ Pedidos: [ESCREVENDO] Qual Hashira você seria? …                                              │  │
│ └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│ Todos 14 │ Publicados 14 │ Rascunhos 0                                                             │
│ ┌ [capa 128×72] Qual personagem de Jujutsu Kaisen você seria?              [PUBLICADO] ↗ ✎       │ │
│ │               ✦ Personalidade · 10 perguntas · 6 resultados · 👥 4.210 partidas                  │ │
│ │ [capa]        Teste: aberturas dos anos 2000                             [RASCUNHO] ✎ 🗑        │ │
│ │               ◆ Conhecimento · 8 perguntas · falta 2 para publicar (âmbar)                       │ │
```

Editor, 1440 px:

```
│ ← Quizzes    Editar quiz                                          [▶ Testar] [Salvar] [Publicar]  │
│ ┌ coluna principal ──────────────────────────────────────────┐ ┌ lateral 320 px (sticky) ───────┐ │
│ │ DADOS                                                      │ │ PARA PUBLICAR                   │ │
│ │ Título [_____________________________]   0/140             │ │ ⚠ Resultado 3 sem descrição     │ │
│ │ Endereço /quiz/[slug] 🔒   Descrição [textarea 600]        │ │ ⚠ Pergunta 5 sem resposta certa │ │
│ │ Tipo (só rascunho) [Personalidade|Conhecimento]            │ │ ✓ título, capa, 2+ resultados   │ │
│ │ Capa [imagem 16:9] [trocar]   Anime [chip Frieren ×]       │ │ (lista vem de quizProblems)     │ │
│ │ RESULTADOS (6)                                [+ Resultado] │ │ RESUMO                          │ │
│ │ ┌ 1 [img 64] Título [______] (conhec.: a partir de [3] ✓) ┐│ │ 10 perguntas · 6 resultados     │ │
│ │ │   Descrição [textarea 3 linhas]              ↑ ↓ 🗑     ││ │ 4.210 partidas · publicado 02/10│ │
│ │ └────────────────────────────────────────────────────────┘│ └─────────────────────────────────┘ │
│ │ PERGUNTAS (10)                                [+ Pergunta]  │                                     │
│ │ ┌ 1 Texto [____________________] [img]          ↑ ↓ 🗑   ┐│                                     │
│ │ │  ○ Opção 1 [______] [img] → resultado [Gojo ▾]   🗑     ││  (conhecimento: ◉ marca a certa)    │
│ │ │  ○ Opção 2 …                       [+ Opção] (2 a 6)    ││                                     │
│ │ │  Explicação (opcional) [______]                          ││                                     │
│ │ └──────────────────────────────────────────────────────────┘│                                     │
```

375 px: uma coluna; "Para publicar" vira uma faixa âmbar recolhível logo abaixo do título ("2 coisas faltando ▸");
cada resultado e pergunta em cartão; ↑ ↓ 🗑 numa linha de ícones de 44 px embaixo do cartão; barra de ações fixa embaixo
com "Testar", "Salvar", "Publicar".

### Componentes e estados

- **Ids estáveis:** resultados `r1, r2…` e perguntas `q1…`, opções `q1o1…` gerados no navegador e **nunca
  reaproveitados** ao apagar (as contagens `quiz_result_counts` são por `result_id`). Resultado com partidas não pode ser
  apagado (botão desabilitado com `title` "Já tem N partidas com este resultado").
- **Opção (personalidade):** `select` do resultado; (conhecimento): `input type="radio"` "Certa" por pergunta.
- **Imagem:** o mesmo envio da tela 3 (`/admin/posts/imagem`, pasta `painel`), miniatura 64 px.
- **Reordenar:** botões ↑ ↓ (sem arrastar: funciona no teclado e no celular).
- **Para publicar:** a lista de `quizProblems()` em tempo real (a função pura vai para `app/lib/quiz-regras.ts`, usada
  pelo editor e pelo servidor; o arquivo **não** é importado por nenhuma rota pública). O servidor confere de novo ao
  publicar.
- **Testar:** página com a faixa âmbar "Teste: as partidas não contam" e o quiz igual ao público; no fim mostra o
  resultado e, no conhecimento, o gabarito.
- **Estados:** salvo/não salvo e conflito iguais aos de Posts; vazio da lista "Nenhum quiz ainda." + "Novo quiz".

### Dados

Nenhuma migration (usa `quizzes` da 009 e `ai_requests` da 016). Gravação em `app/server/admin/quizzes.server.ts`:
`normalizeQuizData()` antes de gravar, `questions_count`, `published_at` ao publicar a primeira vez, `updated_at` manual
(a tabela não tem `ON UPDATE`), `clearCache()`. Sitemap e home já leem `status = 'published'`.

---

## Demais itens da barra (fichas)

Ordem do README depois dos 6. "Faz sentido?" é a recomendação do planejador; quem decide é o dono (perguntas no fim).

| Item | O que era no antigo | Faz sentido no site novo? | Recomendação | Depende de | Tamanho |
|---|---|---|---|---|---|
| **WhatsApp** | Mensagens prontas para colar no grupo (pacote do dia, agenda da semana, enquete), "Enviei no grupo", visitas que vieram do grupo (UTM) e o link de convite que aparecia no fim das notícias | Só se o grupo ainda existir e for usado. O "visitas do grupo" já sai do painel de Visitas (Campanhas, UTM) | **Tirar da barra agora.** Se o grupo existir, refazer como tela P depois das contas: só o convite + o pacote do dia montado de `posts` (sem tabela nova; "Enviei" num `system_config`) | — | P |
| **Títulos no Google** | Envio do CSV do Search Console, páginas com CTR abaixo do esperado para a posição, a IA sugere títulos, troca, mede depois de 28 dias e volta se piorar | Faz, para SEO, mas exige 28+ dias de dados por página e a tela de Posts pronta | **Tirar da barra agora**; voltar depois das telas de contas, como tela M que lê o CSV no navegador (igual ao antigo) e usa a fila `ai_requests` (`kind = 'titulo'`) | Posts, 016 | M |
| **Quarto otaku** | 8 abas: móveis (imagem, tamanho, encaixe, preço, teste no quarto), quartos, configurações, conjuntos, concursos, economia, membros, denúncias | Faz, mas o quarto será **refeito com three.js** (como o QG); o painel do antigo é de quarto 2D | Fica na barra; a tela é planejada **junto** com o quarto 3D (plano próprio), começando por "Móveis" (modelo/imagem, preço, raridade) | contas, economia, quarto 3D | G |
| **Redes sociais** | Carrossel e story do Instagram de cada notícia, legenda, publicar com um clique ou automático | Faz (tráfego social), fase 5 (robôs). A arquitetura já prevê `satori` + `sharp` no servidor | Fica na barra; plano próprio na fase dos robôs de redes | robô de notícias (pronto), chave da Meta | G |
| **Blog dos usuários** | Posts que a comunidade escreve: moderar e promover a artigo oficial | Hoje o blog é só leitura (13 posts importados); moderação só faz sentido quando usuários escreverem | Depois das contas. Primeiro passo útil já agora (P): "Promover a artigo" copia um post do blog para um rascunho de Posts | contas | P (promover) / M (moderação) |
| **Categorias e tags** | Duas abas: criar, renomear, cor, tipo (notícia/artigo), mesclar tags | Faz já: o editor de Posts usa categorias e tags | **Logo depois dos 6.** Renomear tag grava `tag_redirects` (a tabela já existe); apagar categoria só sem matéria | Posts | M |
| **Mídias** | Biblioteca dos arquivos enviados, tamanho total, otimizar | Faz: há 2.436 imagens importadas + `/media/robo` + `/media/painel` | Depois de Categorias: listar `/media/painel` e `/media/robo` (disco), uso em matérias, apagar só o que nenhuma matéria usa; o banco de imagens por anime da tela 5 entra aqui | Posts | M |
| **Denúncias** | Fila de conteúdos denunciados, sanções, contador na barra | Só com contas (comentários, feed, blog de usuários) | Junto com a fase 2, antes de abrir comentários | contas | M |
| **Bug reports** | Relatos com recompensa | Hoje os relatos vão por e-mail (Contato); a recompensa é da economia | Fica na barra (volta com as contas); a tela é feita depois de Denúncias, e a recompensa liga quando a economia voltar | contas, economia | P |
| **Eventos** | Eventos da comunidade e emblemas das datas comemorativas | **Eventos saíram do site** (decisão de 2026-11-12) | **Tirar da barra.** Os emblemas de datas comemorativas vão para a tela Emblemas | — | — |
| **Usuários** | Lista, ficha do usuário, papéis, saldo, planos, bonificações (`/admin/grants`) | **Essencial antes de abrir as contas** | Primeira tela da fase 2, antes de importar os 171 usuários: busca, ficha, papéis (cria `user_roles`), bloqueio | contas (fase 2) | G |
| **Segurança** | Cadastros suspeitos, e-mails bloqueados, captcha, limites de contas novas, registro do painel | **Essencial antes de abrir o cadastro** | Junto com Usuários; o "registro do painel" (quem mudou o quê) pode nascer já com as telas 3 a 6 se o dono quiser (pergunta 9) | contas | M |
| **Molduras** | Catálogo da loja, encaixe no avatar, preço, donos | Faz quando a economia voltar | Fase D (economia), antes de importar as coleções | economia | M |
| **Emblemas** | Emblemas personalizados e de nick, donos | Idem | Fase D; recebe os emblemas de datas comemorativas | economia | M |
| **Figurinhas** | Álbuns, figurinhas, sorteio, atributos do Fig Battle | O catálogo já está no banco (só leitura); Fig Battle saiu | Fase E: álbuns e figurinhas (sem Fig Battle); antes disso, nada | economia | G |
| **Níveis e recompensas** | Trilha de níveis, o que cada um dá e libera, quantos chegam | Fase D | Fase D | economia | M |
| **Custos e recompensas** | Valores do sistema: preços, prêmios, limites | Fase D; é a primeira tela da economia (as outras leem estes valores) | Fase D, primeira | economia | M |
| **Receita** | Vendas PIX, Rubis, reembolsos | Quando o Mercado Pago voltar | Fase D/F; as notificações do Mercado Pago já estão sendo guardadas | economia, pagamento | M |
| **Sistemas** | Ligar e desligar partes do site (Comunidades, Eventos…) com página "em manutenção" | **Não**: o que ele desligava saiu; manutenção hoje é por deploy | **Tirar da barra** | — | — |
| **Agendamentos** | Tarefas do `pg_cron`: ligar/desligar, rodar agora, próximas execuções, erros | **Sim**: o site novo tem `cron_jobs`/`cron_runs` com o robô, a agenda, a limpeza e (com este plano) `publicar-agendados`, `metricas-semanal` e `pedidos-ia` | **Manter e fazer logo depois dos 6** (antes de Categorias): lista das tarefas (horário em português, ligada, última execução, status, duração), "Rodar agora" (`findJob` + `trackRun`), ligar/desligar (`cron_jobs.enabled`), últimas 50 execuções com a mensagem de erro. O cartão "Tarefa com erro" do Painel passa a levar para cá | — | M |
| **E-mails** | Registro dos e-mails enviados, falhas e barrados | Só com SMTP (recuperar senha, avisos) | Junto com a fase 2 (antes de abrir o cadastro) | contas, SMTP | P |

**Ordem sugerida depois dos 6:** Agendamentos → Categorias e tags → Mídias → (fase 2) Usuários → Segurança → E-mails →
Denúncias → Bug reports → Blog dos usuários → (economia) Custos e recompensas → Níveis → Molduras → Emblemas → Figurinhas
→ Receita → (3D) Quarto otaku → (robôs) Redes sociais → Títulos no Google → WhatsApp (se voltar). Saem: Eventos, Sistemas.

## Arquivos afetados

- **Novos:**
  - `db/migrations/014_metricas.sql`, `015_posts_painel.sql`, `016_pedidos_ia.sql`;
  - `app/components/admin/ui.tsx` (kit), `app/components/admin/EditorTexto.tsx` (Tiptap), `app/lib/admin-meta.ts`;
  - `app/lib/post-editor.ts` (`resolveSave`, checklist, marcações ✍️), `app/lib/quiz-regras.ts` (`quizProblems` puro);
  - `app/server/admin/painel.server.ts`, `metricas.server.ts`, `posts.server.ts`, `quizzes.server.ts`, `pedidos-ia.server.ts`;
  - `app/server/robot/painel.server.ts`, `app/server/robot/artigos/` (`tipos.ts`, `prompt.ts`, `gerar.server.ts`),
    `app/server/robot/quizzes/gerar.server.ts`;
  - rotas em `app/routes/admin/`: `painel.tsx` (índice), `visitas.tsx` (passa a ser `/admin/visitas`), `metricas.tsx`,
    `posts.tsx`, `post-editor.tsx`, `post-previa.tsx`, `post-imagem.ts`, `ai-news.tsx`, `ai-news-previa.ts`,
    `artigos-ia.tsx`, `artigos-ia-anime.ts`, `quizzes.tsx`, `quiz-editor.tsx`, `quiz-testar.tsx`;
  - testes: `tests/admin-seguranca.test.ts`, `tests/post-editor.test.ts`, `tests/admin-posts.test.ts`,
    `tests/metricas.test.ts`, `tests/pedidos-ia.test.ts`, `tests/quiz-regras.test.ts`.
- **Alterados:** `server-app.js` (cabeçalhos de `/admin.data` e `/login.data`), `app/routes.ts`, `app/lib/admin-nav.ts`,
  `app/routes/admin/layout.tsx`, `app/routes/admin/em-construcao.tsx`, `app/app.css` (tokens de estado),
  `app/server/cron/jobs.server.ts` (3 tarefas novas e limpeza de versões), `app/server/content/import-old.server.ts`
  (`edited_at`), `app/server/content/media-import.server.ts` (`saveOwnMedia`), `app/routes/api.robo.ts` (importa de
  `robot/painel.server.ts`), `app/server/quiz/rules.server.ts` (reexporta de `app/lib/quiz-regras.ts`), `routes/quiz.tsx`
  (extrair o componente do quiz para o "Testar" usar), `package.json` (Tiptap).
- **Docs:** `docs/README.md`, `docs/decisoes.md`, `docs/banco-de-dados.md` (014–016), `docs/arquitetura.md` (tarefas novas).

## Passos

Tamanho: P (até 1 h), M (meio dia), G (um dia). **Todo passo termina com** `npm run typecheck`, `npm test`,
`npm run build`, commit e push; cada **tela** termina com a conferência em produção (seção "Como verificar"), o item
com `pronto: true` em `admin-nav.ts` e o README atualizado.

### Etapa 0 — base (antes de qualquer tela)

1. **(P) Segurança dos loaders e cabeçalhos.**
   - `routes/admin/visitas.tsx` e `em-construcao.tsx`: chamar `await requireAdmin(request)` no começo do `loader`.
   - `em-construcao.tsx`: trocar `new URL(request.url).pathname` por `routePath(request)`.
   - `server-app.js`: trocar o `app.use(["/admin", "/api", "/login", "/sair"], …)` por um `app.use` com teste
     `/^\/(admin|api|login|sair)(?:[/.]|$)/.test(req.path)` (casa `/admin.data`, `/admin/posts.data`, `/login.data`).
   - Se `Route.MiddlewareFunction` existir no React Router instalado, `export const middleware` no `layout.tsx` com
     `requireAdmin` (se não existir, anotar em `docs/decisoes.md` e seguir só com a chamada por loader).
   - Teste `tests/admin-seguranca.test.ts`: para **cada** módulo de rota em `app/routes/admin/*` (exceto `login`/`sair`),
     chamar o `loader` (e a `action`, se houver) sem cookie e esperar redirecionamento para `/login` (ler a lista de
     arquivos com `fs.readdirSync`, para nenhuma tela futura escapar).
   **Verificar:** `curl -sI "https://animeprofile.com.br/admin.data?_routes=routes/admin/visitas"` sem cookie →
   redireciona (não 200 com dados) e tem `cache-control: no-store` e `x-robots-tag`; clicar num item "em construção"
   na barra abre a página (não 404).
2. **(M) Kit visual e tokens.** Tokens de estado em `app/app.css`; `app/components/admin/ui.tsx` com os componentes da
   "Base visual"; `app/lib/admin-meta.ts`. Uma página interna de conferência **só no desenvolvimento**
   (`import.meta.env.DEV`) em `/admin/kit` mostrando todos os componentes nos dois temas; não vai para a barra.
   **Verificar:** `/admin/kit` em 1440 e 375 px, claro e escuro; Tab percorre tudo com foco visível.

### Tela 1 — Painel

3. **(P) Visitas em `/admin/visitas`.** `routes.ts`: `index("routes/admin/painel.tsx")` e
   `route("visitas", "routes/admin/visitas.tsx")`. `admin-nav.ts`: "Painel" (`/admin`, `exact`, desc "Pendências, hoje
   e atalhos.") e "Visitas" (`/admin/visitas`, ícone `BarChart3`, desc "Visitas por dia, páginas e de onde vêm, sem
   cookie.", `pronto`). Os links internos do módulo (`?p=`, `?tipo=`, "Tentar de novo") passam a usar o endereço atual
   (`useLocation().pathname`), não `/admin` fixo, para o módulo continuar copiável.
4. **(M) `painel.server.ts`** com `resumoPainel(hoje)` (seção "Dados" da tela 1) e teste com banco em memória
   (`mysql-memory-server`, como os testes de Visitas): pendências contam certo, queda só depois das 10h.
5. **(M) Tela do Painel** (`routes/admin/painel.tsx`) exatamente como no desenho, com todos os estados.
   **Verificar:** critério de pronto da tela 1 (abaixo).

### Tela 2 — Métricas

6. **(P) Migration 014** + linha em `docs/banco-de-dados.md`; **colar o SQL no chat**.
7. **(M) `metricas.server.ts`:** os 5 cartões (7 dias contra 7 anteriores), rendimento por origem (vistas nos 7
   primeiros dias: soma de `visit_pages.views` do endereço da matéria entre `published_at` e `published_at + 7 dias`,
   só matérias publicadas há 7+ dias e nos últimos 60), entradas por origem nas últimas 8 semanas, `retratoSemana(segunda)`
   e as decisões. Tarefa `metricas-semanal`. Testes com dados semeados.
8. **(M) Tela de Métricas** e a faixa do funil no Painel (último retrato). Ações: `gravar-retrato`, `nova-decisao`,
   `decisao-revista`.

### Tela 3 — Posts

9. **(P) Migration 015** + docs; **colar o SQL no chat**. `import-old.server.ts` pula `edited_at IS NOT NULL` (teste).
10. **(M) Lista** (`routes/admin/posts.tsx` + `posts.server.ts` `listarPosts(filtros)`): contagens das abas, filtros na
    URL (`status`, `tipo`, `origem`, `autor`, `q`, `ordem`, `pagina`), seleção e exclusão de rascunhos.
11. **(P) `app/lib/post-editor.ts`** (`resolveSave`, checklist, marcações ✍️ com `contarMarcacoes`/`removerMarcacoes`
    portados de `animeprofile-old/src/lib/post-editor.ts`) com testes.
12. **(G) Editor.** Dependências: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`,
    `@tiptap/extension-image`, `@tiptap/extension-youtube`, `@tiptap/extension-placeholder` (só importadas por
    `EditorTexto.tsx`, que só a rota do editor usa; conferir no `build/client` que nenhum chunk público as contém).
    Nó de spoiler (`details.spoiler-box` + `summary`), figura com legenda, "Ver HTML" (`TextArea` monoespaçada; ao
    voltar, o Tiptap relê). Rotas `admin/posts/novo` e `admin/posts/:id`; lateral, barra de ações, cópia local, Ctrl+S,
    `useBlocker`.
13. **(M) Gravação e agendamento:** `salvarPost` (seção "Dados" da tela 3), versões, conflito 409, tarefa
    `publicar-agendados`, limpeza das versões; testes de `salvarPost` (publicar, agendar, despublicar, conflito, HTML
    perigoso sai limpo).
14. **(P) Imagens:** `saveOwnMedia` e `admin/posts/imagem`; capa e imagem no texto. Teste: arquivo que não é imagem → 400.
15. **(P) Prévia** (`admin/posts/:id/previa`) e versões ("Ver"/"Restaurar").

### Tela 4 — Notícias IA

16. **(P) `robot/painel.server.ts`:** mover `status()` e `preview()` de `api.robo.ts` (que passa a importá-los; o
    comportamento de `/api/robo/*` não muda — conferir com o teste existente, se houver, ou um `curl` com o token).
17. **(M) Página com submenu** e as abas **Visão geral** e **Configurações** (modo, rodadas, guia).
18. **(M) Aprovação, Candidatos, Histórico** e a rota da prévia.
19. **(M) Fontes, Tópicos e bloqueios, Horários e limites, Autores IA.**
    **Verificar:** trocar o modo para `ensaio` e de volta para `publicar` pelo painel e conferir em `/api/robo/status`
    (com o token) que o modo mudou; "Ensaio agora" gera uma rodada `ensaio` em Últimas rodadas.

### Tela 5 — Artigos com IA

20. **(P) Migration 016** + docs; **colar o SQL no chat**.
21. **(G) Gerador de artigos:** portar `article-kinds.ts` e `worker/articles.ts` do antigo para
    `app/server/robot/artigos/`, sobre `generateWithGemini`, `findAnimeContext`, `checkQuality`/`autoFixArticle`,
    `sanitizePostHtml`; grava o rascunho como na tela 3 (`origin = 'robo'`, `post_type = 'article'`). Testes do prompt
    e do contrato com resposta de exemplo (sem chamar o Gemini).
22. **(M) Fila:** `pedidos-ia.server.ts` (criar, cancelar, tentar de novo, apagar, travados), tarefa `pedidos-ia`, cota.
23. **(M) Tela** (pedido, busca de anime, ideias de hoje, fila, "Gerar agora") e a pendência no Painel.

### Tela 6 — Quizzes

24. **(P) `app/lib/quiz-regras.ts`** (mover `quizProblems` e `normalizeQuizData`; `rules.server.ts` reexporta) e
    `quizzes.server.ts` (listar, salvar, publicar, despublicar, apagar rascunho) com testes.
25. **(M) Lista** com o pedido à IA (`ai_requests.kind = 'quiz'`).
26. **(G) Editor** (dados, resultados, perguntas, imagens, ↑ ↓, "Para publicar").
27. **(M) Testar** (extrair o componente de `routes/quiz.tsx`; `action` do admin com `quizOutcome` sem gravar partida).
28. **(M) Gerador de quizzes** (portar `worker/quizzes.ts`) na mesma tarefa `pedidos-ia`; pendência "Quizzes para
    revisar" no Painel.
29. **(P) Fechar:** README (status, próximos passos com a ordem das fichas, pendências), `docs/decisoes.md`, e, se o dono
    aprovar (pergunta 8), tirar Eventos, Sistemas, WhatsApp e Títulos no Google de `admin-nav.ts`.

## Critério de pronto (visual), por tela

Prints em **1440 px** e **375 px**, **claro e escuro** (4 por tela), anexados na resposta ao dono:

- **Painel:** em 1440, 5 cartões de pendência numa linha (âmbar só os que têm número), "Hoje" com "Agora" escuro, gráfico
  (8 colunas) ao lado do robô (4), recentes (7) ao lado das mais lidas (5); em 375, "Agora" na linha inteira e o robô antes
  do gráfico; nenhuma rolagem horizontal da página.
- **Métricas:** 5 cartões com variação colorida e "Se piorar"; barras de rendimento; colunas semanais com as 5 cores; o
  bloco das contas tracejado e cinza; em 375, o histórico rola só dentro do cartão.
- **Posts:** lista com capa em 1440 e sem capa em 375; editor com a lateral de 320 px grudada ao rolar e a barra de ações
  sempre visível embaixo; checklist com ✓ verdes e ⚠ âmbar; spoiler e imagem com legenda funcionando; a prévia igual à
  matéria pública.
- **Notícias IA:** submenu à esquerda em 1440, pílulas roláveis em 375; cartão de modo escuro com o botão ativo vermelho;
  grade de 24 horas legível em 375 (4 colunas).
- **Artigos com IA:** pedido e ideias lado a lado em 1440; selos da fila nas 6 cores certas; "Escrevendo" com o ícone
  girando (parado com "reduzir movimento").
- **Quizzes:** lista com selos; editor com "Para publicar" na lateral (1440) e como faixa recolhível (375); ↑ ↓ funcionando
  pelo teclado.
- **Todas:** Tab percorre a tela inteira com foco azul visível; contraste AA nos dois temas; console sem erro de hidratação.

## Riscos e cuidados

- **Segurança:** todo `loader`/`action` de `app/routes/admin/*` chama `requireAdmin` (o teste do passo 1 trava quem
  esquecer). Ações só por POST com `intent` validado por `zod`; tamanhos máximos em todo texto (título 300, resumo 300,
  HTML 2 MB, guia 50 mil caracteres). O HTML das matérias **sempre** passa por `sanitizePostHtml` no servidor, mesmo vindo
  do Tiptap.
- **HTML público e cache:** nenhuma rota pública passa a ler sessão. Prévias e "Testar" ficam em `/admin`. Depois de
  gravar, `clearCache()`; avisar o dono de que o site pode levar alguns minutos (CDN 60 s + laterais).
- **React Router:** loaders que leem o endereço usam `routePath(request)`; `meta` das telas com `adminMeta`; `npm run
  build` antes de todo push; o Tiptap não pode entrar no pacote das páginas públicas (conferir o tamanho de
  `build/client/assets` antes e depois).
- **MariaDB:** nada de `CAST(? AS JSON)` (JSON vai como texto), nada de `... AS new` no `ON DUPLICATE KEY` (usar
  `VALUES(col)`); `quizzes.updated_at` não tem `ON UPDATE` (gravar à mão).
- **Migrations 014, 015, 016:** colar o SQL no chat em cada uma; elas rodam no deploy, mas o dono precisa ver antes.
- **Importação do site antigo:** depois do passo 9 ela não sobrescreve matérias editadas no painel; se a exportação final
  ainda não rodou, rodar antes de editar matérias antigas (pergunta 4).
- **Endereço de matéria:** travado depois de publicada (não há redirecionamento de matéria); trocar exige um plano à parte.
- **Cota do Gemini:** artigos e quizzes dividem a cota com o robô de notícias; a fila só roda com sobra de 10 chamadas.
- **Duas abas / robô gravando:** o conflito 409 evita perder texto; a cópia local guarda o que foi escrito.
- **Agenda semanal:** ela atualiza a matéria da semana se já existir; se o dono editar a agenda no painel, a segunda-feira
  seguinte cria outra (não sobrescreve), mas a atualização no meio da semana sobrescreveria. `agenda.server.ts` passa a não
  atualizar matéria com `edited_at` (P, junto com o passo 13).

## Como verificar

Local: `npx vitest run`, `npm run typecheck`, `npm run build`; `npm run dev` e percorrer cada tela com o login de teste.

Produção, depois de cada tela:

1. `curl -sI https://animeprofile.com.br/admin/<tela>` sem cookie → redireciona para `/login`, com `no-store` e
   `x-robots-tag`; o mesmo para `/admin/<tela>.data`.
2. `curl -s https://animeprofile.com.br/ | grep -c tiptap` → `0` (o editor não vazou para o público).
3. Painel: os números batem com `/admin/visitas` e com `/api/robo/status` (com o token).
4. Posts: criar um rascunho, enviar capa, publicar; a matéria aparece em `/noticias` em até ~1 min (CDN); despublicar → some
   (404 após o cache); agendar para daqui a 10 min → publica sozinha (tarefa `publicar-agendados` em `cron_runs`).
5. Notícias IA: trocar o modo e ver em `/api/robo/status`; "Ensaio agora" cria rodada `ensaio`.
6. Artigos com IA: um pedido "modo comunidade" vira rascunho em Posts na rodada seguinte (ou "Gerar agora"), sem marcação
   ✍️; um "com opinião" traz marcações e não deixa publicar.
7. Quizzes: editar um rascunho, "Testar" até o fim (a contagem de partidas do quiz não muda), publicar → `/quiz/<slug>`.
8. Os 4 prints de cada tela (critério de pronto).

## Perguntas em aberto (para o dono)

Nenhuma bloqueia; sem resposta, o executor segue com a **recomendada**.

1. **Visitas separada do Painel:** `/admin` vira o Painel (pendências, hoje, robô, atalhos) e as visitas completas vão
   para `/admin/visitas` (**recomendado**: o Painel fica curto e o módulo de Visitas continua copiável), ou o Painel fica
   em cima das visitas na mesma página?
2. **Assinatura dos posts que você escrever no painel:** o seu autor de pessoa que veio do site antigo em `post_authors`
   (**recomendado**, se existir) ou um autor novo "Equipe Anime Profile"?
3. **Endereço de matéria publicada:** travar (**recomendado**; mudar endereço exige redirecionamento, que hoje não existe
   para matérias) ou permitir mudar criando uma tabela de redirecionamento (passo M a mais)?
4. **Exportação final do site antigo:** já rodou? Se sim, desligar de vez a importação de conteúdo
   (`/api/importar/conteudo` responde 410) (**recomendado**; o passo 9 protege mesmo assim as matérias editadas).
5. **Excluir matéria publicada:** só despublicar, e excluir só rascunhos (**recomendado**: evita 404 de páginas que o
   Google já conhece), ou permitir excluir publicada com confirmação?
6. **Assinatura dos artigos com IA:** modo comunidade com autor de IA e "com opinião" com o seu autor (**recomendado**), ou
   sempre autor de IA?
7. **Cota do Gemini:** artigos e quizzes só rodam se sobrarem 10+ chamadas do dia no modelo (**recomendado**: o robô de
   notícias tem prioridade), ou uma cota própria (ex.: 10 por dia) separada?
8. **Itens que saem da barra agora:** Eventos e Sistemas (saíram do site) e WhatsApp e Títulos no Google (até decidir)
   (**recomendado**), ou deixar os 4 aparecendo com "em construção"? Agendamentos **fica** e entra logo depois dos 6.
9. **Registro do painel (quem mudou o quê e quando):** começar já, numa tabela `admin_log` gravada pelas telas 3 a 6 (P a
   mais, útil quando houver moderadores), ou só junto com a tela Segurança da fase 2 (**recomendado**: hoje só existe você)?
10. **WhatsApp:** o grupo ainda existe e é usado? Se sim, a tela volta como P depois das contas; se não, sai de vez
    (**recomendado** sair, salvo resposta contrária).
