# Plano: barras laterais do site antigo no site novo

Plano de 2026-11-15, para executar **na ordem dos passos**. Cada passo é uma entrega pequena: testes, `npm run build`,
commit e push. Nenhuma migration nova. Tudo sem login (contas ficam por último, decisão de 2026-11-12).

## Objetivo

Trazer para o site novo os quadros das barras laterais do site antigo (mais lidas, mais comentadas, assuntos do momento,
do blog, guia do anime, categorias, "a seguir" etc.), num **sistema único de barra lateral**: blocos reutilizáveis,
escolhidos por tipo de página e lidos no servidor, no visual "Top 10 claro".

## Contexto

- **Pedido do dono (2026-11-15):** a maioria das páginas do site antigo tem barra lateral com elementos importantes;
  mesmo com o layout diferente, o site novo deve ter esses elementos.
- **Menu à esquerda do site antigo** (`src/components/Sidebar.tsx`): é o menu de navegação. No site novo ele virou o
  topo (`Header.tsx`), então **não entra** neste plano.
- **Hoje no site novo:** três barras laterais feitas à mão, cada uma com o seu quadro:
  - `PostSidebar` em `app/components/post-extras.tsx` (matéria): anime da matéria, destaque, últimas, últimos
    comentários e, fixos no fim, índice e em alta;
  - `BlogSidebar` em `app/components/blog.tsx` (blog): mais lidos, tags em alta, quem mais escreve;
  - laterais próprias em `quiz.tsx` ("Continue jogando"), `anime.tsx` (onde assistir, ficha), `personagem.tsx`,
    `blog-author.tsx` (filtros) e `pagina.tsx` (índice).
- **Sem lateral, mas com lateral no site antigo:** a Central `/noticias` (e `/artigos`), `/categoria/:slug`,
  `/tag/:slug` e o player da Otaku TV.
- **Custo:** a matéria hoje faz 4 consultas da lateral a cada visita, sem cache. Com mais páginas usando lateral, o
  plano cria um cache curto em memória para os blocos que são iguais para todo mundo.

## Inventário do site antigo, página por página

Fonte de dados no site antigo: tudo era lido pelo navegador direto do Supabase (`useQuery`). No site novo, tudo vem do
nosso MySQL pelo `loader`.

| Página (antigo) | Componente | Bloco | De onde vinham os dados | Depende de contas/economia? |
|---|---|---|---|---|
| Matéria `/noticias/:slug`, `/artigos/:slug` | `posts/PostSidebar.tsx` | Anúncio lateral (`AdSlot sidebar`) | AdSense | Não (depende do AdSense) |
| | | "Notícia/Artigo em destaque" (a mais recente do tipo) | `posts` | Não |
| | | "Últimas notícias/artigos" (5) + "Ver tudo" | `posts` | Não |
| | | "Últimos comentários" (5, do tipo) | `post_comments` + `profiles_public` | Não (leitura) |
| | | Índice + "Em alta" (30 dias por visualizações), fixos | `posts.views_count` | Não |
| | `posts/AnimeGuideBox.tsx` (no meio do texto) | "Guia de <anime>": artigos e notícias do mesmo anime (até 6) + link para a ficha | `posts.anilist_id` | Não |
| | (fim do texto) | Recompensa de leitura (+AP) | economia | **Sim** |
| Central `/news` | `NewsHubSidebar.tsx` | "Artigos em alta" (7, categoria + minutos) | `posts` (na prática, os mais recentes) | Não |
| | | Anúncio lateral | AdSense | Não |
| | | "Do Blog" (5 mais recentes, "Por <autor>") | `blog_posts` | Não |
| | | "Tópicos do momento" (15 tags) | `post_tags` | Não |
| | | "Mais comentados do mês" (5, some se vazio) | `post_comments` 30 dias | Não |
| Categoria e tag | `taxonomy/TaxonomyListing.tsx` | "Tags relacionadas" / "Assuntos em alta aqui" (tags que aparecem em 2+ das 120 matérias mais recentes) | `post_tags` | Não |
| | | "Outras categorias" (categoria) / "Aparece em" (tag), com contagem | `post_categories` | Não |
| | | Anúncio lateral | AdSense | Não |
| | | Chamada "Central News" ("cada leitura vale AP") | fixo | Só o texto do AP |
| Blog (lista, post, categoria, tag) | `blog/BlogSidebar.tsx` (função `get_blog_sidebar`) | "Melhores da semana" (`quality_score`, 7 dias) | `blog_posts` | Não |
| | | "Mais comentados" (7 dias) | `blog_posts.comments_count` | Não |
| | | "Mais visualizados" (7 dias) | `blog_posts.views_count` | Não |
| | | "Mais postaram (mês)" | `blog_posts` 30 dias | Não |
| | | Reserva quando a semana está vazia: "Mais lidos do blog" e "Posts recentes" | `blog_posts` | Não |
| Blog do autor `/blog/u/:username` | `profile/BlogFacetsSidebar.tsx` | Facetas: categorias e tags do autor | `blog_*` | Não |
| Quiz `/quiz/:slug` | inline em `quiz.$slug.tsx` | "Mais quizzes" (fixo na tela) | `quizzes` | Não |
| Otaku TV `/otaku-tv` | inline em `otaku-tv.tsx` | "A seguir": lista ao lado do player | vídeos da página | Não |
| Figurinhas `/figurinhas` | `stickers/StickersSidebar.tsx` | Busca por anime e ordenação | `sticker_albums` | Não |
| | | Filtros Completos / Em andamento / Não iniciados | coleção do usuário | **Sim** |
| | | "Histórico de pulls" | `gacha_pulls` | **Sim** |
| | | "Poder da coleção" (explicação de estrelas e fragmentos) | fixo | **Sim** (regra da economia) |
| Feed `/feed`, `/feed/post/:id` | `RightRail` em `feed.tsx` | Ações pendentes, "Participe da comunidade" (visitante), hashtags que segue + sugestões, "Em alta" (hashtags 24 h/7 dias), "Quem seguir", anúncio | `feed_posts`, seguidores | **Sim** (feed e contas) |
| Nenhuma (código morto) | `components/RightRail.tsx` | "Melhores Otakus" (pódio por XP), "Mais lidas do mês", "Assuntos em alta" (feed), "Comunidades pra você", "Emblemas de eventos", "Suas estatísticas", "Check-in diário" | perfis, XP, feed, comunidades, eventos | **Sim** (ou saiu do escopo) |
| Comunidades, Clãs | widgets próprios | membros, enquete, ranking semanal etc. | comunidades, clãs | Saiu do escopo |
| Loja, check-in, quarto, missões, ranking | painéis da própria tela | provador, calendário etc. | economia | **Sim** (são telas da economia, não laterais) |
| Início, busca, lista de quiz, animes, álbum, autores | sem lateral | — | — | — |

## Comparação com o site novo e classificação

Legenda: **A** = dá para fazer já com os dados que temos · **B** = depende de contas/economia/feed (placeholder
honesto ou depois) · **C** = não se aplica (saiu do escopo) · **Feito** = já existe.

| Página | Bloco | Situação no site novo | Classe |
|---|---|---|---|
| Matéria | Destaque, últimas, últimos comentários, índice, em alta | `PostSidebar` | Feito |
| Matéria | Anime da matéria | `PostSidebar` (melhor que o antigo) | Feito |
| Matéria | "Ver tudo" no quadro "Últimas" | falta | A |
| Matéria | Guia do anime (outras matérias do mesmo anime) | falta | A |
| Matéria | Recompensa de leitura | — | B (depois) |
| `/noticias`, `/artigos` | Mais lidas do mês | existe só na página 1, ao lado do destaque | A (vira bloco da lateral) |
| `/noticias`, `/artigos` | Artigos recentes / Últimas notícias, Do blog, Assuntos do momento, Mais comentadas do mês | falta | A |
| Categoria e tag | Assuntos relacionados, Outras categorias / Aparece em, chamada da Central | falta | A |
| Blog | Mais lidos, tags em alta, quem mais escreve | `BlogSidebar` | Feito |
| Blog | Destaques da semana, Mais comentados | falta | A |
| Blog do autor | Facetas | `blog-author.tsx` | Feito |
| Quiz | Mais quizzes | "Continue jogando" (não fica fixo) | Feito (ajuste A: fixar) |
| Otaku TV | A seguir | falta (só o painel de informações) | A |
| Figurinhas | Busca e ordenação | `figurinhas.tsx` | Feito |
| Figurinhas | Filtros por progresso, histórico de pulls, poder da coleção | — | B |
| Todas | Anúncio lateral | — | B (depende do AdSense e do banner de cookies) |
| Feed | Toda a lateral do feed | feed não existe | B |
| — | Ranking (pódio), check-in diário, suas estatísticas | — | B (placeholder, ver Pergunta 1) |
| — | Comunidades pra você, emblemas de eventos, widgets de clãs e comunidades | — | C |

## Desenho do sistema

### Direção visual

Os quadros laterais seguem o que já foi aprovado na matéria: cartões brancos (`surface`) com borda fina sobre o papel
rosado, título curto em Sora 800, sem ícone colorido nem gradiente. **O olho vê primeiro** o conteúdo da coluna
principal; na lateral, o primeiro quadro é sempre o mais útil da página (mais lidas, ou o anime da matéria), depois as
listas e, por último, as nuvens de assuntos e a chamada. Evitar: muitos quadros (no máximo 5 por página), quadros
vazios ("Sem dados ainda" não aparece nunca: bloco sem itens some), anúncio falso, gradientes e ícones por quadro do
site antigo.

### Estrutura

- **Grade das páginas com lateral:** `grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]` dentro de
  `mx-auto max-w-[1328px] px-4 sm:px-8 lg:px-14` (igual a `post.tsx`). Lateral sempre com **340 px** nas páginas que
  usam o sistema (o blog passa de 320 para 340; o filtro do autor do blog continua com 280).
- **Elemento:** `<aside aria-label="...">` em volta da lateral, com títulos `h2` nos quadros (a página já tem o seu
  `h1`).
- **Parte fixa:** os blocos marcados `sticky` ficam juntos no fim da coluna, em
  `lg:sticky lg:top-[92px] flex flex-col gap-6` (o mesmo de hoje na matéria).
- **Celular e tablet (< 1024 px):** a lateral vai para **depois** do conteúdo principal (ordem natural do HTML), com
  `gap-6`, sem nada fixo. Blocos marcados `mobile: "hide"` recebem `hidden lg:block` (ex.: o índice da matéria, que no
  fim da página não serve). Nenhuma rolagem horizontal em 390 px.
- **Tela larga (≥ 1328 px):** a grade não passa de 1328 px; a lateral continua com 340 px.

### Tokens (os de `app/app.css`, sem cor nova)

| Uso | Classe |
|---|---|
| Cartão | `rounded-[18px] border border-line bg-surface p-5` |
| Título do cartão | `text-[1.05rem] font-extrabold` (unifica os 1,02 e 1,05 de hoje) |
| "Ver tudo" no título | à direita, `text-[0.85rem] font-bold text-link hover:underline` |
| Espaço entre título e lista | `mt-4`; entre itens de lista `gap-4` |
| Espaço entre cartões | `gap-6` (24 px) |
| Linha de matéria | `PostRow` de `app/components/posts.tsx` (miniatura `aspect-[4/3] w-24 rounded-lg`) |
| Número do ranking | o do `PostRow` com `index` (`text-[1.6rem] font-extrabold text-brand/25`) |
| Chip de assunto | `rounded-full border border-line bg-surface px-3 py-1 text-[0.82rem] font-semibold text-ink-soft hover:border-ink-soft hover:text-ink` |
| Linha de categoria | `flex items-center justify-between rounded-[9px] px-2.5 py-2 text-[0.92rem] font-semibold hover:bg-sunken` |
| Contagem da categoria | `rounded-full bg-brand-soft px-2 text-[0.78rem] font-bold tabular-nums text-link` (`text-link` e não `text-brand`: no escuro o vermelho sobre `brand-soft` não tem contraste) |
| Meta da linha (comentários, autor) | `mt-1 text-[0.78rem] text-ink-soft` |
| Chamada (CTA) | `rounded-[18px] border border-line bg-brand-soft p-5`; rótulo `text-[0.82rem] font-bold text-brand`; texto `mt-1 text-[0.92rem] text-ink-soft`; link `mt-3 inline-flex items-center gap-1 font-bold text-link hover:underline` com `ArrowRight size-4` |
| Placeholder "com a sua conta" | igual ao cartão, com rótulo `text-[0.82rem] font-bold text-brand` "Em breve" e texto `text-ink-soft` (sem botão) |

Foco: o anel azul global (`#2b5bd7`) já vale para todos os links. Alvo de toque: as linhas inteiras são clicáveis
(`after:absolute after:inset-0` do `PostRow`), com pelo menos 44 px de altura.

### Componentes (`app/components/sidebar.tsx`, novo)

Todos são de servidor-primeiro: recebem dados prontos do `loader`, sem buscar nada no navegador.

| Componente | O que mostra | Estados e acabamento |
|---|---|---|
| `SideCard({ title, more?, children })` | o cartão padrão (movido de `post-extras.tsx`) | `more = { to, text }` vira o "Ver tudo" à direita do título |
| `SidePosts({ title, items, numbered?, more?, meta? })` | lista de `PostRow` | `numbered` põe 1, 2, 3…; `meta(item)` devolve a linha de baixo (ex.: "12 comentários"). Vazio: não renderiza |
| `SideFeatured({ post })` | `PostOverlay` com `min-h-[260px]` | igual ao de hoje |
| `SideAnime({ anime, guide })` | o cartão "O anime desta matéria" de hoje + a lista **"Mais sobre <anime>"** | ver passo 3 |
| `SideComments({ items })` | últimos comentários (movido de `post-extras.tsx`) | o "há 3 h" continua calculado no `loader` (tipo `Labeled`) |
| `SideToc({ items })` | índice "Nesta matéria" (movido) | só aparece com 2+ itens |
| `SideTags({ title, items, hrefBase })` | chips `#nome` | `hrefBase` = `/tag/` ou `/blog/tag/` |
| `SideCategories({ title, items })` | linhas com contagem | link para `/categoria/<slug>` |
| `SideBlog({ title, items, more? })` | posts do blog: miniatura 4:3 `w-20` (gradiente `#2a1311 → #0d0d10` se não houver capa, como o `BlogRow`), título em 2 linhas e `@username` | vazio: não renderiza |
| `SideCta({ label, text, link })` | chamada fixa | — |
| `SideSoon()` | placeholder honesto das contas (ver Pergunta 1) | sem botão; texto fixo |
| `Sidebar({ blocks, label })` | o `<aside>` com os blocos na ordem; separa os `sticky` no fim | recebe `SideBlockData[]` (abaixo) |

### Dados: tipos em `app/lib`, consultas em `app/server`

1. **`app/lib/sidebar.ts`** (roda nos dois lados, sem nada de servidor):
   - `type SidebarPage = "materia" | "central" | "taxonomia" | "blog"`;
   - `type SideBlockSpec = { block: SideBlockKind; limit?: number; sticky?: boolean; mobile?: "show" | "hide" }`;
   - `type SideBlockKind = "anime" | "destaque" | "ultimas" | "comentarios" | "indice" | "emAlta" | "maisLidasMes" |
     "recentesOutroTipo" | "doBlog" | "assuntos" | "maisComentadasMes" | "assuntosRelacionados" | "categorias" |
     "ctaCentral" | "blogDestaquesSemana" | "blogMaisComentados" | "blogMaisLidos" | "blogTags" | "blogAutores" |
     "emBreve"`;
   - `type SideBlockData` = união discriminada por `block`, com os dados prontos de cada um (`items`, `title`, `more`);
   - `SIDEBAR_PRESETS: Record<SidebarPage, SideBlockSpec[]>` (a tabela "Blocos por página", abaixo).
2. **`app/server/cache.server.ts`** (novo): `cached<T>(key, ttlMs, fn)` em memória, por processo:
   - guarda `{ value, expires }` num `Map`, no máximo 300 chaves (apaga a mais antiga ao passar);
   - junta pedidos iguais em andamento (guarda a `Promise`), para 10 visitas simultâneas fazerem 1 consulta;
   - erro não fica guardado;
   - `clearCache()` apaga tudo. Chamado no fim de `applySnapshot()` (`app/server/content/import-old.server.ts`), para a
     importação aparecer na hora.
   - sem banco (`hasDatabase()` falso) as funções de consulta já devolvem vazio; o cache não muda isso.
3. **`app/server/sidebar.server.ts`** (novo): `loadSidebar(page, ctx)` → `Promise<SideBlockData[]>`.
   - `ctx = { type?: PostType; excludeId?: string; categoryId?: string; tagId?: string; anilistId?: number | null;
     anime?: AnimeFull | null; toc?: {id,text}[]; now: Date }`;
   - lê o preset, roda os blocos em `Promise.all`, **tira os vazios** e devolve na ordem do preset;
   - blocos iguais para todo mundo passam por `cached()` com TTL de **5 min** (chave = bloco + tipo). Os que dependem
     da página (`assuntosRelacionados`, `categorias` da tag, `anime`) usam TTL de **10 min** com o id na chave;
   - para não perder o cache por causa da matéria aberta, os blocos de lista buscam `limit + 1` itens (no cache) e
     **tiram a matéria atual em JS** (`excludeId`) antes de cortar no `limit`.
4. **Consultas novas em `app/server/content/posts.server.ts`** (todas com `VISIBLE`):
   - `mostReadSince(days, limit, type?)`: como `trendingPosts`, sem `excludeId` obrigatório
     (`p.published_at > UTC_TIMESTAMP(3) - INTERVAL ? DAY ORDER BY p.views_count DESC`). Se voltar menos de 3, o bloco
     usa `mostRead(limit, type)` (de sempre) e o título vira "Mais lidas" em vez de "Mais lidas do mês";
   - `mostCommentedSince(days, limit, type?)`:
     ```sql
     SELECT <CARD_COLUMNS>, x.n AS comments_n FROM (
       SELECT c.post_id, COUNT(*) AS n FROM post_comments c
       WHERE c.created_at > UTC_TIMESTAMP(3) - INTERVAL ? DAY GROUP BY c.post_id
     ) x JOIN posts p ON p.id = x.post_id LEFT JOIN post_authors a ON a.id = p.author_id
     WHERE <VISIBLE> [AND p.post_type = ?] ORDER BY x.n DESC, p.published_at DESC LIMIT ?
     ```
     devolve `PostCard & { comments: number }`;
   - `relatedTags(filter: { categoryId } | { tagId }, limit = 14)`: tags que aparecem em **2 ou mais** das 120 matérias
     mais recentes da seleção, sem a própria tag. O MySQL não aceita `LIMIT` dentro de `IN (...)`, por isso a
     amostra vai numa tabela derivada:
     ```sql
     SELECT t.name, t.slug, COUNT(*) AS total FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
     JOIN (SELECT p.id FROM posts p WHERE <VISIBLE> AND <filtro> ORDER BY p.published_at DESC LIMIT 120) s ON s.id = pt.post_id
     WHERE t.id <> ? GROUP BY t.id HAVING total >= 2 ORDER BY total DESC, t.name LIMIT ?
     ```
     (o `<filtro>` usa o mesmo `EXISTS` de `where()`; na página de categoria o `t.id <> ?` recebe `''`);
   - `categoriesOfTag(tagId, limit = 6)`: mesma amostra de 120, contando `post_categories` → `categories`, sem o slug
     `sem-categoria`;
   - "Outras categorias" usa `listCategories()` que já existe, sem a categoria atual, até 10.
5. **Consultas novas em `app/server/blog/blog.server.ts`:**
   - `blogBestOfWeek(5)`: `published_at` nos últimos 7 dias, `ORDER BY quality_score DESC, views_count DESC`;
   - `blogMostCommented(5)`: `comments_count > 0 ORDER BY comments_count DESC, published_at DESC` (de sempre: com 13
     posts, a janela de 7 dias do antigo ficaria quase sempre vazia);
   - `blogSidebar()` continua e passa a ser usado pelos blocos `blogMaisLidos`, `blogTags`, `blogAutores`.
   - "Do blog" na Central usa `listBlogPosts({ order: "recentes" }, 1, 5).items`, que já existe.

### Blocos por página (`SIDEBAR_PRESETS`)

| Página | Blocos, na ordem (limite) | Fixos no fim (`sticky`) | Escondidos no celular |
|---|---|---|---|
| `materia` | `anime` · `destaque` · `ultimas` (6, "Ver tudo") · `comentarios` (5) | `indice` · `emAlta` (5) | `indice` |
| `central` (`/noticias`, `?tipo=noticias`, `/artigos`) | `maisLidasMes` (5, numerada) · `recentesOutroTipo` (5) · `doBlog` (5) · `assuntos` (15) · `maisComentadasMes` (5) · `emBreve` (se a Pergunta 1 for sim) | — | — |
| `taxonomia` (`/categoria/:slug`, `/tag/:slug`) | `assuntosRelacionados` (14) · `categorias` (10 ou 6) · `maisLidasMes` (5, numerada) · `ctaCentral` | — | — |
| `blog` (lista, post, categoria, tag) | `blogDestaquesSemana` (5) · `blogMaisLidos` (5) · `blogMaisComentados` (5) · `blogTags` (12) · `blogAutores` (5) | — | — |

Títulos fixos dos blocos:

- `ultimas`: "Últimas notícias" ou "Últimos artigos", com "Ver tudo" para `/noticias?tipo=noticias` ou `/artigos`;
- `maisLidasMes`: "Mais lidas do mês" (ou "Mais lidas", na reserva). Em `/artigos`: "Mais lidos do mês";
- `recentesOutroTipo`: em `/noticias` e `?tipo=noticias`, "Artigos recentes" (tipo `article`, "Ver tudo" →
  `/artigos`); em `/artigos`, "Últimas notícias" (tipo `news`, "Ver tudo" → `/noticias?tipo=noticias`);
- `doBlog`: "Do blog", "Ver tudo" → `/blog`, meta `@username`;
- `assuntos`: "Assuntos do momento" (`trendingTags(15)`, que já existe);
- `maisComentadasMes`: "Mais comentadas do mês", meta "1 comentário" / "N comentários";
- `assuntosRelacionados`: categoria → "Assuntos em alta aqui"; tag → "Assuntos relacionados";
- `categorias`: categoria → "Outras categorias"; tag → "Aparece em";
- `ctaCentral`: rótulo "Central de notícias", texto "Todas as notícias e artigos do dia, num lugar só.", link "Ir
  para a Central" → `/noticias` (o "cada leitura vale AP" do antigo sai: não existe economia);
- `blogDestaquesSemana`: "Destaques da semana" (some se não houver post nos últimos 7 dias);
- `blogMaisLidos`, `blogTags`, `blogAutores`: os títulos de hoje ("Mais lidos", "Tags em alta", "Quem mais escreve");
- `blogMaisComentados`: "Mais comentados", meta "N comentários".

---

## Passos

### Passo 1 — Cache em memória (P)

- **Arquivos:** criar `app/server/cache.server.ts`; alterar `app/server/content/import-old.server.ts` (chamar
  `clearCache()` no fim de `applySnapshot`, depois do `COMMIT`/retorno com sucesso).
- **Testes:** `tests/sidebar.test.ts` (novo): `cached` devolve o mesmo valor dentro do TTL e chama de novo depois
  (`vi.useFakeTimers`); 2 chamadas simultâneas = 1 execução; erro não fica guardado; `clearCache` força nova leitura;
  passa de 300 chaves e a mais antiga sai.
- **Conferir:** `npm test`.

### Passo 2 — Componentes da lateral, sem mudar nada na tela (M)

- **Arquivos:** criar `app/components/sidebar.tsx` com `SideCard`, `SidePosts`, `SideFeatured`, `SideAnime` (só o
  cartão de hoje), `SideComments`, `SideToc`, `SideTags`, `SideCategories`, `SideBlog`, `SideCta`, `SideSoon` e
  `Sidebar`; alterar `app/components/post-extras.tsx` (o `PostSidebar` passa a montar a tela com esses componentes; o
  `Avatar` e o tipo `Labeled` vão junto para `sidebar.tsx` e são reexportados de onde já são importados);
  `app/components/posts.tsx` (`PostRow` ganha `meta?: string`, mostrada abaixo do título com a classe de "Meta da
  linha").
- **Regra:** `sidebar.tsx` só importa tipos (`import type`) de `app/server` e de `app/lib/sidebar.ts`; nada de
  `.server` em tempo de execução.
- **Conferir:** `npm run typecheck`, `npm run build`, e abrir uma notícia em 1280 px e 390 px: a lateral tem que estar **idêntica** à de antes (comparar
  com print tirado antes do passo).

### Passo 3 — Presets e `loadSidebar`; a matéria passa a usar o sistema (M)

- **Arquivos:** criar `app/lib/sidebar.ts` e `app/server/sidebar.server.ts`; alterar `posts.server.ts`
  (`mostReadSince`, `mostCommentedSince`, `relatedTags`, `categoriesOfTag`); `app/routes/post.tsx` (o `loader` chama
  `loadSidebar("materia", { type, excludeId, anilistId, anime, toc, now })` e o componente usa
  `<Sidebar blocks label="Mais do Anime Profile" />`); `post-extras.tsx` (apagar o `PostSidebar`, que ficou sem uso).
- **Novidades na matéria:**
  1. **"Ver tudo"** no quadro "Últimas" (destino na tabela de títulos).
  2. **Guia do anime** dentro do cartão `SideAnime`: entre o bloco de streaming e o link "Ficha completa", uma lista
     **"Mais sobre <título do anime>"** com até 6 matérias do mesmo `anilist_id` (sem a atual), mais recentes primeiro
     (`latestPosts({ anilistId, excludeIds: [post.id] }, 6)`, cache de 10 min por anime). Cada item: ícone
     `Newspaper` (notícia) ou `BookOpen` (artigo) `size-4 text-ink-soft`, título em 2 linhas `text-[0.88rem]
     font-semibold hover:underline`. Separada por `border-t border-line px-5 py-4`, título da lista
     `text-[0.82rem] font-bold text-brand`. Sem matérias: a lista não aparece. **Matéria com `anilist_id` mas sem
     ficha guardada** (`anime` nulo): mostrar só a lista, num `SideCard` "Mais sobre este anime".
  3. **Índice** com `mobile: "hide"`.
- **Testes** (`tests/sidebar.test.ts`, com o MySQL descartável do `tests/content.test.ts`): preset `materia` devolve os
  blocos na ordem e sem os vazios; `emAlta` e `ultimas` nunca trazem a matéria aberta, mesmo vindo do cache;
  `mostCommentedSince` conta só os comentários da janela; teste puro: todo `block` de `SIDEBAR_PRESETS` tem tratamento
  em `loadSidebar` (percorrer os presets e checar que nenhum lança "bloco desconhecido").
- **Conferir:** `npm test`, `npm run build`; abrir uma matéria com anime (procurar uma com `anilist_id`) e uma sem; em
  390 px o índice some e o resto vem depois dos comentários; **clicar** de uma matéria para outra pela lateral (o
  `.data` do React Router) e confirmar que abre sem "não encontrada".

### Passo 4 — Central `/noticias`, `?tipo=noticias` e `/artigos` com lateral (M)

- **Arquivos:** `app/routes/posts-list.tsx`; usa `app/components/sidebar.tsx`.
- **Layout novo:**
  - `PageHeader` e os chips de categoria continuam como estão, na largura toda;
  - abaixo dos chips, a grade `lg:grid-cols-[minmax(0,1fr)_340px] gap-12`:
    - coluna principal: na página 1, o destaque `PostOverlay` (`min-h-[420px]`) na largura da coluna, depois
      `PostGrid cols={3}`; nas outras páginas, só a grade; a paginação no fim da coluna;
    - lateral: `<Sidebar>` com o preset `central` (o quadro "Mais lidas" que ficava ao lado do destaque **sai** dali e
      vira o primeiro bloco da lateral).
  - A lateral aparece em todas as páginas da lista (vem do cache).
- **Loader:** `loadSidebar("central", { type: cfg.type, now })` em paralelo com `listPosts` e `listCategories`; tirar o
  `mostRead` que ficou sem uso. Continua usando `routePath(request)`.
- **Conferir:** `/noticias`, `/noticias?tipo=noticias`, `/artigos` e `/noticias?pagina=2` em 1280, 1024 e 390 px:
  a grade principal fica com 3 colunas no computador e 2 a partir de 640 px; a lateral tem no máximo 5 quadros; nenhum
  quadro vazio; "Do blog" leva para `/blog/<username>/<slug>`; no celular a lateral vem depois da paginação.

### Passo 5 — Categoria e tag com lateral (P/M)

- **Arquivos:** `app/routes/taxonomia.tsx`.
- **Layout:** só para `categoria` e `tag` (o autor de IA continua sem lateral, como no site antigo):
  `lg:grid-cols-[minmax(0,1fr)_340px] gap-12`, `PostGrid cols={3}` e a paginação na coluna principal.
- **Loader:** `loadSidebar("taxonomia", { categoryId | tagId, now })`. A contagem de matérias do cabeçalho continua.
- **Testes:** `relatedTags` não devolve a própria tag nem tags com 1 aparição; `categoriesOfTag` não devolve
  `sem-categoria`.
- **Conferir:** uma categoria grande e uma tag com poucas matérias (a lateral tem que ficar curta, sem quadros vazios);
  `/autores/<slug>` igual a antes.

### Passo 6 — Blog: destaques da semana e mais comentados (P)

- **Arquivos:** `app/server/blog/blog.server.ts` (`blogBestOfWeek`, `blogMostCommented`); `app/routes/blog-list.tsx`,
  `blog-post.tsx`, `blog-taxonomia.tsx` (trocar `blogSidebar()` + `BlogSidebar` por `loadSidebar("blog")` +
  `<Sidebar>`; lateral com 340 px); `app/components/blog.tsx` (apagar o `BlogSidebar`, que ficou sem uso).
- **Testes** (`tests/blog.test.ts`): `blogBestOfWeek` ignora posts com mais de 7 dias; `blogMostCommented` ignora os
  sem comentário.
- **Conferir:** `/blog`, um post e uma tag do blog: os três quadros de hoje continuam; "Destaques da semana" só aparece
  se houver post recente.

### Passo 7 — Otaku TV: "A seguir" (P)

- **Arquivos:** `app/routes/otaku-tv.tsx`.
- **O que muda:** com um vídeo aberto (`selected`) nas abas "Das matérias" e "Trailers", a coluna da direita do player
  (340 px) ganha, abaixo dos botões "Ler a matéria"/"Ver o anime", um `SideCard` "A seguir" com os **5 próximos**
  vídeos da lista da página (`list.items`, sem o aberto). Cada item é um `Link` para `cardHref(id)`: miniatura
  `ytThumb(id)` (de `app/components/otaku-tv.tsx`) em `aspect-video w-28 shrink-0 rounded-lg object-cover`, título em
  2 linhas `text-[0.88rem] font-semibold` e o `subtitle` em `text-[0.78rem] text-ink-soft`. Hover: `bg-sunken` na
  linha (`rounded-[10px] p-1.5 -m-1.5`). Não usar `preventScrollReset`: ao trocar de vídeo a página volta ao topo, com
  o player à vista (o mesmo que os cartões da lista fazem hoje).
- **Sem `selected` ou na aba de músicas:** nada muda.
- **Conferir:** `/otaku-tv?v=<id>` em 1280 e 390 px; clicar em um "A seguir" troca o vídeo; no celular a lista fica
  abaixo do player e dos botões.

### Passo 8 — Quiz: "Continue jogando" fixo na tela (P)

- **Arquivos:** `app/routes/quiz.tsx`.
- **O que muda:** o `<aside>` ganha `lg:sticky lg:top-[92px] lg:self-start`, como no site antigo. Nada mais.
- **Conferir:** um quiz longo em 1280 px: a lateral acompanha a rolagem; em 390 px, igual a antes.

### Passo 9 — Placeholder das contas (P, só se a Pergunta 1 for "sim")

- **Arquivos:** `app/lib/sidebar.ts` (incluir `emBreve` no fim do preset `central`), `app/components/sidebar.tsx`
  (`SideSoon`).
- **Texto fixo:** rótulo "Em breve"; título "Com a sua conta"; texto "Check-in diário, missões, ranking dos otakus e a
  sua coleção de figurinhas voltam quando as contas chegarem ao site novo. Por enquanto, tudo aqui é aberto e sem
  login." Sem botão (não há cadastro ainda).
- **Conferir:** aparece só na Central, no fim da lateral.

### Passo 10 — Docs, build e push (P)

- Atualizar `docs/design.md` (tabela de componentes: `app/components/sidebar.tsx`; seção "Barras laterais" com a
  tabela de presets), `docs/README.md` (status e próximos passos) e marcar este plano como executado.
- `npm test`, `npm run build`, commit e push.

## Riscos e cuidados

- **Loaders e endereço:** nenhum loader lê `new URL(request.url).pathname` direto; use `routePath(request)` (os que
  precisam do endereço já usam). Query string (`?tipo`, `?pagina`) continua via `new URL(request.url).searchParams`.
- **`.server` só em loader/action:** `sidebar.server.ts`, `cache.server.ts` e as consultas só são chamados nos
  `loader`. Os componentes recebem dados prontos; tipos compartilhados ficam em `app/lib/sidebar.ts`.
- **Consultas por página:** a Central passa a fazer até 5 consultas de lateral; com o cache de 5 min isso vira poucas
  por minuto. `mostCommentedSince` usa o índice `idx_comments_recent (created_at)`. `relatedTags` faz uma amostra de
  120 matérias pelo `idx_posts_published`. `latestPosts({ anilistId })` não tem índice em `posts.anilist_id`: com ~950
  matérias é imperceptível; se passar de ~20 mil, criar o índice numa migration (não agora).
- **Cache por processo:** cada processo do Node na Hostinger tem o seu cache; no pior caso, uma matéria nova demora
  até 5 min para aparecer na lateral (a lista principal não usa cache). A importação limpa o cache do processo que a
  recebeu; os outros expiram sozinhos em 5 min.
- **Matéria aberta dentro do cache:** sempre buscar `limit + 1` e filtrar a atual em JS (teste no passo 3), senão a
  matéria aparece na própria lateral.
- **SEO:** a lateral vem no HTML do servidor (links internos que o Google vê). Títulos dos quadros em `h2`, sem `h1`.
  Nada de `nofollow` em link interno. Páginas com `?q` ou `?pagina` mantêm as regras de canonical/noindex de hoje.
- **CLS:** nada é buscado no navegador; as miniaturas têm proporção fixa (`aspect-[4/3]`, `aspect-video`) e
  `loading="lazy"`. O anúncio lateral, quando o AdSense chegar, precisa de altura reservada (`min-h-[600px]` no
  computador e nenhum no celular), num bloco `anuncio` novo do preset, só depois do banner de cookies.
- **Hidratação:** textos relativos ("há 3 h") continuam calculados no loader (`Labeled`); não usar `Date.now()` no
  componente.
- **Build:** `npm run build` antes de cada push (as rotas com `.data` só quebram no clique, não ao recarregar).

## Como verificar (no fim)

1. `npm test` e `npm run build` sem erro.
2. No site de teste, em **1280 px** e **390 px**, abrir: uma notícia, um artigo com anime, `/noticias`,
   `/noticias?tipo=noticias`, `/artigos`, `/noticias?pagina=2`, uma categoria, uma tag, `/autores/<slug>`, `/blog`, um
   post do blog, `/otaku-tv?v=<id>`, um quiz.
3. Em cada uma: nenhum quadro vazio; no máximo 5 quadros (a matéria pode ter 6 contando os fixos); a parte fixa só
   gruda no computador; no celular a lateral vem depois do conteúdo; nenhuma rolagem horizontal.
4. Navegar **clicando** entre páginas pela lateral (não só recarregando).
5. Tema escuro: as contagens das categorias e os links continuam legíveis.

## Perguntas em aberto

1. **Placeholder das contas na lateral?** O site antigo mostrava ranking, check-in e estatísticas para quem estava
   logado. Opções: (a) um cartão "Em breve: com a sua conta" só na Central (passo 9); (b) nada até as contas existirem.
   **Recomendação: (b)**, porque um quadro sem ação ocupa espaço nobre e o topo já tem "Entrar/Criar conta"; o passo 9
   fica pronto para ligar depois.
2. **Lateral na Central em todas as páginas da lista ou só na primeira?** **Recomendação: em todas** (vem do cache e
   ajuda quem chega pela página 2 pelo Google).
3. **Guia do anime na lateral ou no meio do texto, como no antigo?** No antigo ele entrava depois de um parágrafo do
   texto. **Recomendação: na lateral** (dentro do cartão do anime), que não mexe no HTML das matérias; no celular ele
   aparece depois dos comentários. Se o dono preferir no meio do texto, vira um passo à parte (inserir depois do 3º
   parágrafo no servidor).
