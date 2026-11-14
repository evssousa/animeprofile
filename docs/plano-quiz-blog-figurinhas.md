# Plano: Quiz, Blog da comunidade (leitura) e Catálogo de figurinhas

Plano de 2026-11-14, para executar **nesta ordem**: 1) Quiz, 2) Blog, 3) Figurinhas. Cada área é uma entrega
separada (migration própria, testes, `npm run build`, commit e push). Tudo sem login: contas ficam por último
(decisão do dono de 2026-11-12).

## Objetivo

Trazer do site antigo, com os **mesmos endereços**, o quiz jogável sem login, a leitura do blog da comunidade e o
catálogo de figurinhas (só ver), com os dados vindos da exportação e as imagens das figurinhas copiadas para `/media`.

## Contexto

- **Hoje no site novo:** `quiz`, `blog` e `figurinhas` estão na lista `PENDING` de `app/routes.ts` (página "em
  construção"). A home tem a seção "Coleção" só de enfeite (`Collection()` em `app/routes/home.tsx`) e não tem as
  seções Quiz e Blog.
- **Exportação:** `scripts/exportar-conteudo-antigo.mjs` lê a API pública do Supabase (chave pública, sujeita ao
  RLS) e envia um retrato gzip para `POST /api/importar/conteudo`, aplicado por `applySnapshot()` em
  `app/server/content/import-old.server.ts`. As chaves novas do retrato serão **opcionais** (retratos antigos
  continuam válidos), no mesmo padrão de `anime_catalog?` e `post_comments?`.
- **O que o RLS do site antigo deixa a chave pública ler** (conferido nas migrations do `animeprofile-old`):
  - `quizzes` publicados: sim. `quiz_plays`: **não** (só admin). A contagem por resultado sai pela função pública
    `quiz_record_play(_quiz, _result)`: com um `_result` que não existe ela **não grava nada** e só devolve a
    contagem (`result_id`, `plays`). É assim que a exportação lê o "X% tiveram esse resultado".
  - `blog_posts` publicados, `blog_categories`, `blog_tags`, `blog_post_categories`, `blog_post_tags`,
    `blog_post_comments`: sim. `blog_post_reads` e `blog_post_bookmarks`: não (são por usuário; vêm na fase 6).
    Os contadores (`views_count`, `likes_count`, `claps_count`, `comments_count`, `bookmarks_count`) estão na própria
    `blog_posts`.
  - `sticker_catalog`, `sticker_albums`, `weekly_featured_album`: sim (leitura pública).
- **Quantidades:** a contagem de quizzes, posts do blog e figurinhas não está nos docs (a estatística do PostgreSQL
  não mostrou `sticker_catalog`, ver [inventario.md](inventario.md) §0). O script de exportação passa a imprimir as
  contagens de cada área.

### Comportamentos do site antigo que o plano mantém ou muda

| Área | No site antigo | No site novo |
|---|---|---|
| Quiz | Pontuação 100% no navegador, com o gabarito (`correct`, `result`, `explain`) dentro da página | Pontuação **no servidor**; a página não leva o gabarito (decisão abaixo) |
| Quiz | `?r=<resultado>` (prévia do link mostra o resultado de quem compartilhou) e `?desafio=7-10&de=Nome` | Iguais |
| Quiz | Compartilhar no Feed, imagem para stories, link com código de indicação | Ficam para depois das contas |
| Blog | `/blog` e `/blog/criadores` só para admin; o público lia em `/news?tipo=blog` | `/blog` vira a lista pública. `/news?tipo=blog` e `/noticias?tipo=blog` → 301 para `/blog`. `/blog/criadores` → 302 para `/blog` até a economia existir |
| Blog | Conteúdo em **Markdown** (string no `content` jsonb), mostrado com `react-markdown` + `rehype-sanitize`, sem HTML cru | Markdown convertido para HTML **na importação** com `marked` e limpo com uma regra própria para conteúdo de usuário |
| Blog | `/blog/:username/:slug` busca só pelo `slug` (o username é ignorado) | Busca pelo `slug`; se o username do endereço for outro, 301 para o endereço certo |
| Blog | Post promovido a artigo tem canonical em `/artigos/<slug>` | Igual |
| Figurinhas | Imagens no bucket `post-images` (`stickers/...` e `stickers/albums/...`), servidas pelo `render/image` do Supabase com `quality=70` | Arquivo **original** copiado para `/media/figurinhas/` + miniatura WebP para as grades |
| Figurinhas | Visitante vê as figurinhas que não tem como **silhueta** (borrada e escura) | Igual, por padrão (ver "Perguntas para o dono") |
| Figurinhas | `season_albums` (liga álbum a `seasons`) | **Não vem**: nenhuma tela usa e `seasons` não vem (inventário §9) |

## Decisão: onde o quiz é pontuado

**No servidor.** O `loader` de `/quiz/:slug` manda só a versão pública do quiz: perguntas, textos e imagens das
opções. Ficam de fora `correct`, `result`, `explain`, `minScore` e a lista de resultados. Duas ações respondem:

- **`responder`** (só no quiz de conhecimento): recebe a pergunta e a opção escolhida e devolve qual era a certa e a
  explicação. Mantém o "certo/errado" na hora, como no site antigo.
- **`finalizar`**: recebe todas as respostas, calcula o resultado com a mesma regra do site antigo, conta a partida
  (anônima) e devolve o resultado, o "X% tiveram esse resultado" e, no de conhecimento, a revisão das respostas.

**Por quê:**

- **Anti-cola:** o gabarito não fica no HTML nem no JSON da página. No site antigo bastava ver o código-fonte.
- **SEO:** o Google não indexa o gabarito como texto da página. O que importa para busca (título, descrição, capa,
  número de perguntas) vai no HTML.
- **Contas e missões:** quando chegarem, a regra já está no servidor e nada no navegador decide o resultado.
- **Custo:** um pedido pequeno por pergunta, só no quiz de conhecimento. O de personalidade faz um pedido só, no fim.
- **Limite conhecido:** chamando `responder` em todas as perguntas antes de jogar, dá para descobrir as certas. Sem
  recompensa, não vale a pena proteger mais. Com as contas, a partida passa a ter um token assinado.

## Arquivos afetados (visão geral)

Criar:

- `db/migrations/009_quiz.sql`, `010_blog.sql`, `011_figurinhas.sql`
- `app/lib/quiz.ts`, `app/server/quiz/quiz.server.ts`, `app/server/quiz/rules.server.ts`
- `app/components/quiz.tsx`, `app/routes/quiz-list.tsx`, `app/routes/quiz.tsx`
- `app/server/blog/blog.server.ts`, `app/server/blog/markdown.server.ts`, `app/components/blog.tsx`
- `app/routes/blog-list.tsx`, `app/routes/blog-post.tsx`, `app/routes/blog-author.tsx`, `app/routes/blog-taxonomia.tsx`,
  `app/routes/blog-feeds.ts`, `app/routes/redirect-temp.ts`
- `app/server/stickers/stickers.server.ts`, `app/lib/stickers.ts`, `app/components/stickers.tsx`,
  `app/routes/figurinhas.tsx`, `app/routes/figurinha-album.tsx`
- `app/server/http.server.ts` (`sameOrigin`, `clientIp`, `ipHash` compartilhados)
- `app/server/content/media-import.server.ts` (gravar arquivo recebido em `/media`)
- `tests/quiz.test.ts`, `tests/blog.test.ts`, `tests/stickers.test.ts`

Alterar:

- `app/routes.ts`, `app/routes/home.tsx`, `app/routes/feeds.ts`, `app/server/seo/feeds.server.ts`
- `app/server/content/import-old.server.ts`, `app/routes/api.importar.ts`, `scripts/exportar-conteudo-antigo.mjs`
- `app/server/content/sanitize.server.ts` (regra para conteúdo de usuário)
- `app/server/contact.server.ts` (passa a usar o `ipHash` de `http.server.ts`)
- `app/routes/anime.tsx` + `app/server/anime/anime.server.ts` (faixa "Colecione o álbum")
- `redirects.mjs`, `tests/content.test.ts` (redirecionamento do blog)
- `package.json` (só `sharp` como devDependency, usado pelo script no PC)
- Docs: `README.md`, `banco-de-dados.md`, `enderecos.md`, `decisoes.md`, `inventario.md` (nota do `season_albums`)

---

## Passo 0 — Preparação comum (pequeno)

1. **`app/server/http.server.ts` (novo):**
   - mover `clientIp()` e `ipHash()` de `contact.server.ts` para cá, sem mudar o comportamento, e importar de volta
     no contato;
   - criar `sameOrigin(request)`: em POST, `true` se o cabeçalho `Origin` estiver vazio ou tiver o mesmo host de
     `SITE.url` ou do próprio pedido (`request.headers.get("host")`).
   - Verificar: `npm test` (o teste de contato continua passando).
2. **`import-old.server.ts`:** exportar a função `upsert()` (hoje é interna), para os módulos novos reaproveitarem.
3. **`applySnapshot()`:** no fim, depois das sinopses, chamar `importQuizzes(s)`, `importBlog(s)` e `importStickers(s)`
   **só se a chave existir no retrato**. O resultado ganha os campos `quizzes`, `blog` e `figurinhas`. Cada área
   implementa a sua função no próprio módulo (passos abaixo).

---

## 1. QUIZ — tamanho: médio

### 1.1 Migration `db/migrations/009_quiz.sql` (esboço)

```sql
-- 009: quizzes gerados no painel admin do site antigo (vêm pela exportação) e as partidas jogadas aqui.
-- `data` guarda perguntas, opções e resultados com o gabarito; a página nunca recebe esse JSON inteiro.
CREATE TABLE IF NOT EXISTS quizzes (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  slug VARCHAR(90) NOT NULL,
  title VARCHAR(140) NOT NULL,
  description VARCHAR(600) NOT NULL DEFAULT '',
  cover_url VARCHAR(600) NULL,
  kind VARCHAR(20) NOT NULL,                       -- personalidade | conhecimento
  data JSON NOT NULL,
  questions_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'published', -- draft | published
  anilist_id INT UNSIGNED NULL,
  plays_old INT UNSIGNED NOT NULL DEFAULT 0,       -- partidas do site antigo (a importação só mexe aqui)
  plays_new INT UNSIGNED NOT NULL DEFAULT 0,       -- partidas jogadas no site novo
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),  -- sem ON UPDATE: contar partida não muda a data
  UNIQUE KEY uq_quiz_slug (slug),
  KEY idx_quiz_pub (status, published_at),
  CONSTRAINT chk_quiz_kind CHECK (kind IN ('personalidade', 'conhecimento')),
  CONSTRAINT chk_quiz_status CHECK (status IN ('draft', 'published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quantos tiveram cada resultado ("23% tiveram esse resultado").
CREATE TABLE IF NOT EXISTS quiz_result_counts (
  quiz_id CHAR(36) CHARACTER SET ascii NOT NULL,
  result_id VARCHAR(40) NOT NULL,
  plays_old INT UNSIGNED NOT NULL DEFAULT 0,
  plays_new INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada partida terminada no site novo. user_id fica NULL até as contas existirem (as missões vão contar por aqui).
CREATE TABLE IF NOT EXISTS quiz_plays (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quiz_id CHAR(36) CHARACTER SET ascii NOT NULL,
  result_id VARCHAR(40) NOT NULL,
  score SMALLINT UNSIGNED NULL,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  ip_hash CHAR(64) NULL,                           -- hash do IP com o dia (não guarda o IP); só para não contar repetido
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_plays_quiz (quiz_id, created_at),
  KEY idx_plays_ip (ip_hash, quiz_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Total de partidas mostrado = `plays_old + plays_new`. A importação **nunca** zera `plays_new`.

### 1.2 Formato do JSON das perguntas (`quizzes.data`)

Igual ao do site antigo (`src/lib/quiz.ts`), sem conversão:

```json
{
  "questions": [
    {
      "id": "q1a2b3", "text": "Qual técnica…?", "image": "https://…",
      "explain": "Só no de conhecimento: mostrado depois de responder",
      "options": [
        { "id": "o1", "text": "Opção", "image": "https://…", "result": "r1", "correct": true }
      ]
    }
  ],
  "results": [
    { "id": "r1", "title": "Você é o Gojo!", "description": "…", "image": "https://…", "minScore": 0 }
  ]
}
```

- **`result`:** só no de personalidade (a opção soma 1 ponto para esse resultado).
- **`correct`:** só no de conhecimento (exatamente uma por pergunta).
- **`minScore`:** só no de conhecimento (a faixa vale a partir de N acertos; uma faixa começa em 0).
- **Limites:** ids até 40 caracteres, até 40 perguntas, 12 opções por pergunta e 20 resultados.

**Versão pública** (o que o `loader` manda; tipo `PublicQuiz` em `app/lib/quiz.ts`):

```ts
type PublicQuiz = {
  id: string; slug: string; title: string; description: string; coverUrl: string | null;
  kind: "personalidade" | "conhecimento"; plays: number; publishedAt?: string; updatedAt?: string;
  questions: { id: string; text: string; image?: string; options: { id: string; text: string; image?: string }[] }[];
};
```

### 1.3 Formato da exportação (chaves novas do retrato)

```ts
quizzes?: { id; slug; title; description; cover_url; kind; data; status; anilist_id; plays_count;
            published_at; created_at; updated_at }[];          // só status=published
quiz_result_counts?: { quiz_id: string; result_id: string; plays: number }[];
```

**No script** (`exportar-conteudo-antigo.mjs`), depois dos comentários:

- **Quizzes:** `fetchAll("quizzes", "id,slug,title,description,cover_url,kind,data,status,anilist_id,plays_count,published_at,created_at,updated_at", "&status=eq.published", "id")`,
  com `.catch(() => [])` e aviso, como nas outras.
- **Contagem por resultado, para cada quiz:**
  - **Pedido:** `POST ${BASE}/rest/v1/rpc/quiz_record_play` com corpo
    `{"_quiz": "<id>", "_result": "__exportacao__", "_score": null}` e os mesmos cabeçalhos `apikey`/`Authorization`.
  - **Resposta:** `[{result_id, plays}]`.
  - **Por que não grava nada:** o resultado `__exportacao__` não existe, então a função só devolve a contagem
    (conferido em `20261026110000_quizzes.sql`).
  - **Ritmo:** 5 pedidos por vez.
  - **Se falhar:** guarda uma lista vazia e mostra um aviso.
- **Mensagem final:** soma `Quizzes: N (partidas: M)`.

### 1.4 Regras e servidor

1. **`app/lib/quiz.ts`** (roda nos dois lados, sem gabarito):
   - tipos `QuizKind`, `PublicQuiz` e `QuizCard`
     (`{id, slug, title, description, coverUrl, kind, plays, questions, publishedAt}`);
   - `QUIZ_KIND_INFO`: `personalidade` → "Quem você seria?" e `conhecimento` → "Teste seu conhecimento";
   - `quizShareText()`, com os textos do site antigo ("Fiz o quiz … e deu: …! Qual é o seu?" e "Acertei X de Y no
     quiz …").
2. **`app/server/quiz/rules.server.ts`** (puro, portado de `animeprofile-old/src/lib/quiz.ts`, **sem zod**):
   - **`normalizeQuizData(raw)`:** lê o JSON sem confiar nele. Aceita texto (MariaDB) ou objeto. Campo faltando vira
     vazio, textos são cortados nos limites e `image` só vale com `https://`.
   - **`quizProblems(q)`:** cópia fiel da do site antigo. A importação **pula** o quiz que tiver problema e mostra o
     slug em `puladas`.
   - **`quizOutcome(kind, data, answers)`:** cópia fiel, com o desempate pela última resposta e a maior faixa
     alcançada.
   - **`resultShare(counts, resultId)`:** cópia fiel.
   - **`publicQuiz(row)`:** monta o `PublicQuiz` e remove `correct`, `result`, `explain`, `minScore` e `results`.
3. **`app/server/quiz/quiz.server.ts`:**
   - **`listQuizzes({ kind?, order: "novos" | "jogados", limit })`:** publicados com `published_at <= UTC_TIMESTAMP(3)`.
     A ordem é `published_at DESC` ou `(plays_old + plays_new) DESC`.
   - **`quizCounts()`:** `{ todos, personalidade, conhecimento }`, para as abas.
   - **`getQuiz(slug)`:** linha completa (só o servidor usa), ou `null`.
   - **`moreQuizzes(quiz, 12)`:** primeiro os do mesmo tipo, depois os outros, mais novos antes. A página mostra 6 na
     lateral e 6 embaixo.
   - **`checkAnswer(slug, questionIndex, optionId)`:**
     - **Retorno:** `{ correta: string, explicacao?: string }`.
     - **Quando dá erro:** só funciona no de conhecimento; índice ou opção inválidos dão erro 400.
   - **`finishQuiz(slug, answers, { ipHash, bot })`:**
     - **Validação:** `answers.length` igual ao número de perguntas e cada id até 40 caracteres.
     - **Cálculo:** chama `quizOutcome`.
     - **Contar a partida:**
       - **Quando conta:** não é robô e não há partida do mesmo `ip_hash` nesse quiz nos últimos 10 minutos.
       - **Como:** numa transação, `INSERT quiz_plays`, mais
         `INSERT … ON DUPLICATE KEY UPDATE plays_new = plays_new + 1` em `quiz_result_counts` e
         `UPDATE quizzes SET plays_new = plays_new + 1`.
     - **Retorno:**
       - **Sempre:** `{ result: {id,title,description,image}, score, total, sharePct }`.
       - **No de conhecimento:** também `review: [{ questionId, escolhida, correta, explicacao }]`.
   - **`importQuizzes(s)`:**
     1. normaliza cada quiz e pula os que têm `quizProblems`;
     2. faz upsert em `quizzes` (`plays_old = plays_count`, `questions_count`, datas por `toSqlDate`; **não** inclui
        `plays_new` nas colunas do upsert);
     3. apaga os quizzes que saíram do site antigo (`DELETE … WHERE id NOT IN (…)`), junto com os
        `quiz_result_counts` e `quiz_plays` deles;
     4. em `quiz_result_counts`, faz upsert só de `plays_old`.

     Retorna `{ quizzes, partidas, pulados }`.
   - **`quizIdsForSitemap()`:** `slug`, `updated_at` e `published_at` dos publicados.

### 1.5 Páginas

**`/quiz` → `app/routes/quiz-list.tsx`**

- **Cabeçalho:** `PageHeader` com o rótulo "Quiz", o título "Qual personagem você seria? Descubra" e o texto do site
  antigo.
- **Abas:** links com query: Todos, `?tipo=personalidade` ("Quem você seria?") e `?tipo=conhecimento` ("Teste seu
  conhecimento"), cada uma com a contagem. Ordem: "Mais novos" (padrão) e `?ordem=jogados`.
- **Grade:** até 100 quizzes, com 1, 2, 3 ou 4 colunas conforme a largura. O cartão (`QuizCard`) tem capa 16:9, um
  selo do tipo, o título, "N perguntas" e "X pessoas fizeram".
- **Estado vazio:** "Os primeiros quizzes estão chegando. Volte em breve!". Com filtro e sem resultado: "Nenhum quiz
  deste tipo ainda." e o link "Ver todos".
- **Sem banco** (`hasDatabase()` falso): mostra o estado vazio, sem erro.
- **SEO:**
  - **Título:** "Quiz de anime: descubra qual personagem você seria".
  - **Descrição:** a do site antigo.
  - **JSON-LD:** `@graph` com `CollectionPage` + `ItemList` (até 30 itens) e `BreadcrumbList`.
  - **Abas:** com `?tipo` ou `?ordem`, o canonical continua `/quiz`.

**`/quiz/:slug` → `app/routes/quiz.tsx`**

- **Loader:**
  - `getQuiz(params.slug)`; não existe → `throw data(null, { status: 404 })`;
  - devolve `publicQuiz`, `more` e `extra`;
  - `shared` = o resultado `?r=` (só `{id, title, image}`, procurado no servidor);
  - `challenge` vem de `?desafio=S-T&de=Nome`, com a mesma validação do site antigo e o nome cortado em 30
    caracteres.
- **Action:**
  - `sameOrigin` falso → 403;
  - lê o `formData`: `intent=responder` (`q`, `o`) ou `intent=finalizar` (`answers` em JSON);
  - devolve JSON. Erro → `data({ erro }, { status: 400 })`.
- **Componente `QuizPlayer`** (`app/components/quiz.tsx`):
  - **Etapas:** capa → uma pergunta por tela (barra de progresso) → resultado.
  - **Personalidade:** a opção fica marcada por 350 ms e a próxima pergunta aparece.
  - **Conhecimento:** chama `responder` com `useFetcher`, marca certo e errado e espera 1,1 s; se houver
    explicação, espera o botão "Próxima pergunta".
  - **Fim:** chama `finalizar`.
  - **Opções com imagem:** viram cartões quadrados. Imagem quebrada vira um quadrado com a inicial (como o `SafeImg`
    do site antigo).
- **Resultado:**
  - imagem e título do resultado; no de conhecimento, o placar `S/T`;
  - a descrição e "X% das pessoas tiveram esse resultado";
  - o placar contra o desafio, se houver;
  - botões WhatsApp, X, "Copiar link" (`/quiz/<slug>?r=<id>`), compartilhar nativo (onde existir) e "Refazer";
  - no de conhecimento, "Desafiar um amigo" (WhatsApp com `?desafio=S-T&de=Um%20amigo`; sem login não há nome) e
    "Revise suas respostas", que abre e fecha;
  - por último, "Próximo quiz".
- **Lateral "Mais quizzes"** (fixa no computador) e "Continue jogando" embaixo.
- **Estados:**
  - **404:** "Quiz não encontrado", com o link "Ver todos os quizzes" (página de erro do `root.tsx` com essa
    mensagem).
  - **Falha no `responder` ou no `finalizar`:** aviso "Não deu para conferir agora." com o botão "Tentar de novo",
    sem perder as respostas.
- **SEO:**
  - **Título:** `quiz.title`. Com um `?r=` válido, o `og:title` vira `Deu "<resultado>" no quiz: <título>` e a
    `og:image` usa a imagem do resultado.
  - **Descrição:** `description` ou "Responda N perguntas e descubra seu resultado." (até 158 caracteres).
  - **Canonical:** sempre `/quiz/<slug>`, sem query.
  - **JSON-LD:** `@graph` com `Quiz` (name, description, url, inLanguage `pt-BR`, image, datePublished,
    dateModified, publisher) e `BreadcrumbList` (Quiz › título).
  - **Atenção:** o `seo()` aceita um só `jsonLd`, por isso tudo vai num `{ "@context": …, "@graph": [...] }`.

### 1.6 Sitemap, home e rotas

1. **Sitemap:**
   - em `feeds.server.ts`, criar `sitemapQuiz()` (`<loc>/quiz/<slug>`, `lastmod` = `updated_at` ou `published_at`,
     `monthly`, `0.7`);
   - acrescentar `/sitemap-quiz.xml` em `SITEMAPS` e `{ path: "/quiz", changefreq: "weekly", priority: "0.7" }` em
     `STATIC_PAGES`;
   - em `app/routes/feeds.ts`, acrescentar no `FILES` (`maxAge` 1800);
   - em `app/routes.ts`, acrescentar `"sitemap-quiz.xml"` na lista de feeds.
2. **Home (seção 8, depois da Otaku TV e antes da Coleção):**
   - no `loader`, `listQuizzes({ order: "novos", limit: 4 })`;
   - a seção tem o rótulo "Quiz", o título "Qual personagem você seria?", o link "Ver todos" para `/quiz` e 4
     `QuizCard` (2 colunas no celular, 4 no computador);
   - sem quiz, a seção não aparece.
3. **Rotas:** tirar `"quiz"` do `PENDING`. Acrescentar `route("quiz", "routes/quiz-list.tsx")` e
   `route("quiz/:slug", "routes/quiz.tsx")`.

### 1.7 Testes `tests/quiz.test.ts`

Mesmo modelo de `tests/content.test.ts` (MySQL descartável com `mysql-memory-server` e `migrate`). Os testes:

- **`quizOutcome`:** personalidade com empate (ganha o escolhido por último) e conhecimento nas faixas 0, 5 e 9.
- **`quizProblems`:**
  - recusa uma opção sem `result`;
  - recusa duas certas na mesma pergunta;
  - recusa quando nenhuma faixa começa em 0.
- **`publicQuiz`:** o JSON do resultado **não contém** as strings `"correct"`, `"result"`, `"explain"` nem
  `"minScore"`.
- **`applySnapshot` com `quizzes` e `quiz_result_counts`:**
  - grava;
  - pula o quiz inválido;
  - na segunda importação, sem um quiz, apaga esse quiz;
  - **não** zera `plays_new`.
- **`finishQuiz`:**
  - conta a partida, soma em `quiz_result_counts` e devolve `sharePct`;
  - repetir com o mesmo `ipHash` em menos de 10 minutos não conta de novo, mas devolve o resultado;
  - `bot: true` não conta.
- **`checkAnswer`:** devolve a certa; dá erro no de personalidade e com índice inválido.
- **`sitemapQuiz`:** contém `/quiz/<slug>`. O índice (`sitemapIndex`) contém `/sitemap-quiz.xml`.

---

## 2. BLOG DA COMUNIDADE (só leitura) — tamanho: médio

Fora do escopo:

- **Telas:** `/blog/editor` e `/blog/dashboard` continuam no `PENDING` ("em construção").
- **Recursos que dependem de contas:** comentar, reagir, salvar, seguir autor, recompensa de leitura, denunciar e
  promover a artigo.

### 2.1 Migration `db/migrations/010_blog.sql` (esboço)

```sql
-- 010: blog da comunidade (só leitura até as contas). Vem do site antigo pela exportação.
-- O texto original é Markdown (content_md); content_html é gerado e limpo na importação.
-- Os autores ficam em post_authors (kind = 'user', slug = username), a mesma tabela dos comentários.
CREATE TABLE IF NOT EXISTS blog_posts (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  author_id CHAR(36) CHARACTER SET ascii NOT NULL,
  slug VARCHAR(200) NOT NULL,
  title VARCHAR(300) NOT NULL,
  excerpt TEXT NULL,
  content_md MEDIUMTEXT NOT NULL,
  content_html MEDIUMTEXT NOT NULL,
  cover_url VARCHAR(600) NULL,
  focus_keyword VARCHAR(200) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  promoted_post_id CHAR(36) CHARACTER SET ascii NULL,   -- virou artigo oficial: canonical em /artigos/<slug>
  views_count INT UNSIGNED NOT NULL DEFAULT 0,
  likes_count INT UNSIGNED NOT NULL DEFAULT 0,
  claps_count INT UNSIGNED NOT NULL DEFAULT 0,
  bookmarks_count INT UNSIGNED NOT NULL DEFAULT 0,
  comments_count INT UNSIGNED NOT NULL DEFAULT 0,
  quality_score SMALLINT NOT NULL DEFAULT 0,
  reading_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_blog_slug (slug),
  KEY idx_blog_pub (status, published_at),
  KEY idx_blog_author (author_id, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorias e tags são de cada autor (como no site antigo); /blog/categoria/:slug junta as de mesmo slug.
CREATE TABLE IF NOT EXISTS blog_categories (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_blog_cat_user (user_id, slug),
  KEY idx_blog_cat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_tags (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_blog_tag_user (user_id, slug),
  KEY idx_blog_tag_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_post_categories (
  blog_post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  category_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (blog_post_id, category_id),
  KEY idx_bpc_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_post_tags (
  blog_post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  tag_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (blog_post_id, tag_id),
  KEY idx_bpt_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentários dos posts (só leitura por enquanto; os escondidos por denúncia não vêm).
CREATE TABLE IF NOT EXISTS blog_post_comments (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  blog_post_id CHAR(36) CHARACTER SET ascii NOT NULL,
  author_id CHAR(36) CHARACTER SET ascii NOT NULL,
  parent_id CHAR(36) CHARACTER SET ascii NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_bcomments_post (blog_post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

As tabelas por usuário (`blog_post_reactions`, `blog_post_bookmarks`, `blog_post_reads`, `blog_author_followers`,
`blog_post_milestones`) ficam para a fase das contas. Os contadores mostrados vêm das colunas `*_count`.

### 2.2 Formato da exportação

```ts
blog_posts?: { id; author_id; slug; title; content /* string Markdown (jsonb string) */; excerpt; cover_url;
               focus_keyword; status; promoted_post_id; views_count; likes_count; claps_count; bookmarks_count;
               comments_count; quality_score; published_at; created_at; updated_at }[];
blog_categories?: { id; user_id; name; slug }[];
blog_tags?: { id; user_id; name; slug }[];
blog_post_categories?: { blog_post_id; category_id }[];
blog_post_tags?: { blog_post_id; tag_id }[];
blog_post_comments?: { id; blog_post_id; author_id; parent_id; content; created_at }[];
```

**No script:**

- **Posts:** `fetchAll("blog_posts", "<colunas acima>", "&status=eq.published&hidden_by_reports=eq.false", "id")`.
- **Comentários:** `&hidden_by_reports=eq.false`, filtrados aos posts exportados.
- **Categorias e tags:** só as usadas pelos posts exportados.
- **Perfis:** acrescentar em `userIds` os `author_id` dos posts do blog e dos comentários do blog. Assim
  `profiles` traz o username deles.
- **Mensagem final:** soma `Blog: N posts, M comentários`.

**Em `applySnapshot()`** (`import-old.server.ts`, linha do `authorIds`): incluir os `author_id` de
`s.blog_posts ?? []` e de `s.blog_post_comments ?? []`. Sem isso, o perfil do autor do blog não vira `post_authors`.

**`content` que não é texto:** o padrão da coluna no site antigo era `'[]'`. Post com `content` que não seja string
fica de fora, com o slug em `puladas` (conferir no primeiro retrato real quantos são).

### 2.3 Markdown e sanitização

1. **`app/server/blog/markdown.server.ts`:**
   - **Instância própria:** `new Marked({ gfm: true, breaks: true })`. Não usar o `marked` global, que é o das
     páginas de texto.
   - **Renderer de HTML cru:** devolve o texto **escapado** (`html(token) { return escapeHtml(token.text) }`). No site
     antigo o `react-markdown` não mostrava HTML cru, só o texto.
   - **`markdownToHtml(md)`:** `sanitizeUserHtml(marked.parse(md))`.
   - **`stripMarkdown(s)`:** porta de `animeprofile-old/src/lib/strip-markdown.ts`, para resumos e descrições.
2. **`sanitize.server.ts`:** nova `sanitizeUserHtml(html)`, mais restrita que a `sanitizePostHtml`:
   - **Tags permitidas:** `p, br, hr, h2, h3, h4, strong, b, em, i, u, s, del, blockquote, code, pre, ul, ol, li, a,
     img, table, thead, tbody, tr, th, td`.
   - **Títulos:** `h1` vira `h2` (a página já tem o seu `h1`).
   - **O que sai:** `iframe`, `class`, `id` e `style`.
   - **`a`:** só `href` e `title`. Todo link externo ganha `rel="nofollow ugc noopener noreferrer"` e
     `target="_blank"`. Os links internos (`animeprofile.com.br`) ficam sem `rel`.
   - **`img`:** só `src` com `https`, mais `alt` e `title`, e `loading="lazy"`.
   - **Esquemas:** `https`, `http` e `mailto`.

### 2.4 Servidor `app/server/blog/blog.server.ts`

- **`VISIBLE_BLOG`:** `b.status = 'published' AND b.published_at <= UTC_TIMESTAMP(3)`.
- **`listBlogPosts({ order, q, categorySlug?, tagSlug?, authorSlug?, page, perPage = 20 })`:**
  - **Ordem:** `recentes` (`published_at DESC`), `populares` (`likes_count + claps_count DESC, views_count DESC`) ou
    `comentados` (`comments_count DESC`).
  - **Busca `q`:** `LIKE` em título, resumo e username.
  - **Retorno:** cartões `{ id, slug, title, excerpt, coverUrl, publishedAt, views, likes, claps, comments,
    qualityScore, readingMinutes, author: { slug, name, avatarUrl }, url }`, com `url = /blog/<username>/<slug>`.
- **`getBlogPost(slug)`:**
  - **Retorno:** o post, o autor, as categorias, as tags e `promotedArticleSlug`. Esse último sai de
    `posts.slug WHERE id = promoted_post_id AND status = 'published'`.
  - **Também calcula:** o índice com `withToc` de `posts.server.ts`, se servir para HTML; se não servir, sem índice.
- **`blogComments(postId)`:** a mesma árvore de respostas de `postComments` das matérias.
- **`relatedBlogPosts(postId, 3)`:** primeiro os que têm tag ou categoria (por slug) em comum, depois os do mesmo
  autor, depois os recentes.
- **`blogAuthor(username)`:** `post_authors` com `kind = 'user'` e `slug = ?` (collation sem maiúsculas). Também traz
  os posts do autor e as facetas (categorias e tags com contagem).
- **`blogTaxonomy("categoria" | "tag", slug)`:**
  - **Nome mostrado:** o mais comum entre as linhas com esse slug.
  - **Também traz:** a contagem e os posts.
- **`blogSidebar()`:** os 5 mais lidos (`views_count`), as 12 tags mais usadas e os autores com mais posts.
- **`latestBlogWithCover(6)`:** para a home.
- **`importBlog(s)`:**
  - **Gravação:** upsert de tudo. `content_html` = `markdownToHtml(content)`, `reading_minutes` = `readingMinutes(html)`,
    `excerpt` = `stripMarkdown(excerpt)` (até 300 caracteres) e as datas por `toSqlDate`.
  - **Ligações e comentários:** são refeitos (`DELETE` + `INSERT`), como em `replaceLinks`. Comentário de autor
    desconhecido é pulado.
  - **Limpeza:** apaga os posts, categorias e tags que saíram do site antigo.
  - **Retorno:** `{ posts, comentarios, pulados }`.
- **Feeds e sitemap:**
  - **`blogRss(username?)`:** RSS 2.0 com os 50 mais recentes (do autor, se houver username), com o mesmo canal do
    site antigo: título "Blog — Anime Profile", `/blog`, `pt-BR` e `atom:link` próprio. Usa o `xmlEscape` de
    `feeds.server.ts`.
  - **`sitemapBlog()`:**
    - **Entram:** os posts **não promovidos** (`weekly`, `0.6`) e cada autor uma vez em `/blog/u/<username>`
      (`weekly`, `0.5`).
    - **Não entram:** os promovidos, porque o canonical deles é o artigo.

### 2.5 Páginas e rotas

Em `app/routes.ts`:

- **Tirar do `PENDING`:** `"blog"`. Pôr `"blog/editor"` e `"blog/dashboard"` no lugar.
- **Rotas, nesta ordem:**
  ```ts
  route("blog", "routes/blog-list.tsx"),
  route("blog/rss.xml", "routes/blog-feeds.ts", { id: "blog-rss" }),
  route("blog/criadores", "routes/redirect-temp.ts", { id: "blog-criadores" }),  // 302 → /blog
  route("blog/categoria/:slug", "routes/blog-taxonomia.tsx", { id: "blog-categoria" }),
  route("blog/tag/:slug", "routes/blog-taxonomia.tsx", { id: "blog-tag" }),
  route("blog/u/:username/rss.xml", "routes/blog-feeds.ts", { id: "blog-rss-autor" }),
  route("blog/u/:username", "routes/blog-author.tsx"),
  route("blog/:username/:slug", "routes/blog-post.tsx"),
  ```
- **`redirect-temp.ts`:** `loader` que devolve `redirect("/blog", 302)`. É temporário: o ranking de criadores depende
  da economia (AP e Rubis ganhos).
- **`redirects.mjs`:** antes da regra do `/news`, a regra `/news` ou `/noticias` com `tipo=blog` vai para `/blog`. O
  `redirectFor` recebe o `search`, então dá para checar `tipo=blog` dentro da regra (ajustar a assinatura das regras
  para receber `search`). Teste em `tests/content.test.ts`.

**`/blog` → `blog-list.tsx`**

- **Cabeçalho:** `PageHeader` com o rótulo "Blog da comunidade", o título "Onde a sua voz ganha vida" e o texto do site
  antigo, mais um link RSS.
- **Busca e ordem:** busca `?q=` (formulário GET) e ordem `?ordem=populares|comentados`, paginação `?pagina=N` (o
  `Pagination` das listas).
- **Lista:** cartões em linha: capa à esquerda (gradiente quando não há capa), título, resumo, autor, data
  ("há 3 dias", `timeAgo`) e os contadores de leituras, curtidas e comentários.
- **Lateral:** `blogSidebar()`.
- **Estados vazios:**
  - sem posts: "Ainda não há posts publicados.";
  - busca sem resultado: "Nenhum post encontrado para “…”.";
  - sem banco: lista vazia.
- **SEO:**
  - **Título e descrição:** "Blog dos usuários" e "Posts da comunidade otaku: opiniões, listas e textos pessoais.".
  - **Link no `<head>`:** `<link rel="alternate" type="application/rss+xml" href="/blog/rss.xml">` (pelo `links` da
    rota).
  - **JSON-LD:** `CollectionPage` + `BreadcrumbList`.
  - **Com `?q`:** `noindex`. Canonical sempre `/blog`.

**`/blog/:username/:slug` → `blog-post.tsx`**

- **Loader:**
  - `getBlogPost(slug)`; não existe → 404;
  - `author.slug` diferente de `params.username` (sem diferença de maiúsculas) → `redirect(urlCerta, 301)`.
- **Layout:** o mesmo da matéria (`post.tsx`), com capa, migalhas (Início › Blog › categoria), título, resumo e
  assinatura (avatar, nome com link para `/blog/u/<username>`, data, leituras e comentários).
- **Corpo:** `content_html` em `.prose-ap`, com o índice se houver.
- **Depois do texto:**
  - as tags (links `/blog/tag/<slug>`);
  - o aviso "Este post foi promovido a artigo oficial do site.", com link para o artigo;
  - a barra de contadores (curtidas, palmas, leituras), que **só mostra os números**. Os botões ficam desativados,
    com o título "Entre para reagir (em breve)";
  - os comentários, só leitura, com o aviso "Comentar chega com as contas.";
  - "Posts relacionados".
- **Lateral:** `blogSidebar()`.
- **SEO:**
  - **Título:** o do post.
  - **Descrição:** `stripMarkdown(excerpt || content_md)` com até 158 caracteres.
  - **`og:type`:** `article`, com `publishedTime` e `modifiedTime`.
  - **Canonical:** `/artigos/<promotedArticleSlug>` quando promovido; se não, o próprio endereço. Para isso, o
    `seo()` precisa aceitar um `canonical?: string` opcional (acrescentar em `app/lib/seo.ts`; o padrão continua
    sendo o `path`).
  - **JSON-LD:** `@graph` com `BlogPosting` (headline, description, image, datePublished, dateModified, author
    `Person` com url `/blog/u/<username>`, mainEntityOfPage) e `BreadcrumbList` (Início › Blog › título).

**`/blog/u/:username` → `blog-author.tsx`**

- **Cabeçalho:** avatar, "Blog de <nome>" e "N posts". O link "Ver perfil completo" fica fora até `/u/:username`
  existir.
- **Corpo:** grade de 2 colunas com os posts. Na lateral, as facetas (categoria e tag), que filtram com
  `?categoria=` e `?tag=` (no servidor).
- **Estados:**
  - autor inexistente: 404 ("Autor não encontrado");
  - autor sem posts: "Este autor ainda não publicou nada no blog." (página com `noindex`);
  - filtro sem resultado: "Nenhum post nesse filtro.".
- **SEO:**
  - **Título e descrição:** "Blog de <nome>" e "Posts de @<username> no blog do Anime Profile.".
  - **`og:type`:** `profile`.
  - **Link no `<head>`:** `alternate` para o RSS do autor.
  - **JSON-LD:** `ProfilePage` + `BreadcrumbList`.

**`/blog/categoria/:slug` e `/blog/tag/:slug` → `blog-taxonomia.tsx`** (o `id` da rota diz qual)

- **Página:** cabeçalho "Categoria" ou "Tag" com o nome, "N posts", a lista e a lateral.
- **Estados:** slug sem nenhum post → 404. Com menos de 3 posts → `noindex` (mesma regra das tags das matérias).
- **SEO:** título "Categoria: <nome> — Blog" (ou "Tag: …"), `CollectionPage` + `BreadcrumbList`.

**`/blog/rss.xml` e `/blog/u/:username/rss.xml` → `blog-feeds.ts`**

- **Loader:** chama `blogRss()` ou `blogRss(params.username)`. Autor inexistente → 404.
- **Resposta:** `Content-Type: application/rss+xml; charset=utf-8`, `Cache-Control: public, max-age=900`.

### 2.6 Sitemap e home

1. **Sitemap:**
   - em `feeds.server.ts`, acrescentar `/sitemap-blog.xml` (`sitemapBlog`) em `SITEMAPS` e no `FILES`, e
     `"sitemap-blog.xml"` em `routes.ts`;
   - em `STATIC_PAGES`, acrescentar `{ path: "/blog", changefreq: "daily", priority: "0.8" }` (igual ao site antigo).
2. **Home (seção 10, depois da Coleção):**
   - **Dados:** `latestBlogWithCover(6)`.
   - **Cabeçalho:** `SectionHead`, com o rótulo "Blog da comunidade", o título "Posts pessoais dos otakus" e o link
     "Ver tudo" para `/blog`.
   - **Grade:** 3 colunas no computador. No celular, rolagem lateral com `snap`, como no site antigo.
   - **Cartão:** capa, título e `@username`.
   - **Sem posts:** a seção não aparece.

### 2.7 Testes `tests/blog.test.ts`

- **`markdownToHtml`:**
  - `<script>` e `<iframe>` no Markdown viram texto escapado e nunca tag;
  - `# Título` vira `<h2>`;
  - um link externo ganha `rel="nofollow ugc noopener noreferrer"`;
  - `![](javascript:…)` some;
  - quebra de linha simples vira `<br>`.
- **`stripMarkdown`:** remove `**`, `#` e `[texto](url)`, e deixa o texto.
- **`applySnapshot` com as chaves do blog:**
  - grava os posts, as ligações e os comentários;
  - o autor vira `post_authors` com `kind = 'user'`;
  - um post com `content` que não é texto vai para `pulados`;
  - na segunda importação, sem um post, apaga esse post e as ligações dele.
- **`listBlogPosts`:** as ordens, a busca e `categorySlug`, juntando as categorias de dois autores com o mesmo slug.
- **`getBlogPost`:** devolve `promotedArticleSlug` quando o artigo está publicado.
- **`sitemapBlog`:** não tem o post promovido e tem `/blog/u/<username>` uma vez só.
- **`blogRss()`:** XML válido, com `<link>` igual a `/blog/<username>/<slug>`.
- **`redirectFor`:** `("/noticias", "?tipo=blog")` vai para `/blog`, e `("/noticias", "?tipo=noticias")` continua
  `null`.

---

## 3. CATÁLOGO DE FIGURINHAS (só visualização) — tamanho: médio (grande se houver muitas imagens)

Fora do escopo:

- **Ações que dependem de contas:** abrir pacote, coleção pessoal, evoluir, favoritar, trocas, pedir ajuda,
  "Figurinha do dia" no sorteio e o ranking de poder.
- **Como os botões aparecem:** desativados, com o texto "Abrir pacotes chega com as contas".

### 3.1 Migration `db/migrations/011_figurinhas.sql` (esboço)

```sql
-- 011: catálogo de figurinhas (só visualização até as contas). Vem do site antigo pela exportação.
-- As imagens ficam em /media/figurinhas/ (arquivo original, sem recompressão) e a miniatura WebP ao lado.
CREATE TABLE IF NOT EXISTS sticker_albums (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  cover_url VARCHAR(600) NULL,
  anilist_id INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  available_from DATETIME(3) NULL,
  available_until DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_album_slug (slug),
  KEY idx_album_order (sort_order, created_at),
  KEY idx_album_anime (anilist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- O id é texto no site antigo (ex.: "ds1"); a coleção dos usuários (fase das contas) aponta para ele.
CREATE TABLE IF NOT EXISTS sticker_catalog (
  id VARCHAR(64) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  album_id CHAR(36) CHARACTER SET ascii NULL,
  name VARCHAR(160) NULL,
  rarity VARCHAR(10) NOT NULL,                     -- comum | raro | epico | lendario
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  image_url VARCHAR(600) NULL,                     -- /media/figurinhas/<hash>.<ext> (ou o endereço antigo, se a cópia falhou)
  thumb_url VARCHAR(600) NULL,                     -- /media/figurinhas/<hash>-w400.webp
  image_width SMALLINT UNSIGNED NULL,
  image_height SMALLINT UNSIGNED NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,            -- 0 = "não sai mais no sorteio" (continua no álbum)
  sort_order INT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_sticker_album (album_id, sort_order, created_at),
  CONSTRAINT chk_sticker_rarity CHECK (rarity IN ('comum', 'raro', 'epico', 'lendario'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Álbum em destaque da semana (um por semana ISO, ex.: "2026-W46"). O desconto só vale quando houver pacotes.
CREATE TABLE IF NOT EXISTS weekly_featured_album (
  week_key VARCHAR(10) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  album_id CHAR(36) CHARACTER SET ascii NULL,
  discount_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
  computed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Ordem das figurinhas:** o PostgreSQL põe `NULL` por último em `ASC` e o MySQL põe primeiro. Usar sempre
`ORDER BY s.sort_order IS NULL, s.sort_order, s.created_at`. A numeração (#1, #2…) é a posição dentro do álbum nessa
ordem, como no site antigo. **Álbuns:** `ORDER BY sort_order, created_at DESC`.

### 3.2 Imagens: onde estão e como copiar sem perder qualidade

- **Onde estão hoje:** bucket público `post-images` do Supabase Storage.
  - **Figurinhas:** `stickers/<timestamp>-<nome>.<ext>` (`uploadStickerImage` em `StickerEditorDialog.tsx`).
  - **Capas de álbum:** `stickers/albums/<timestamp>-<nome>.<ext>` (`AlbumEditorDialog.tsx`).
  - **Figurinhas antigas** (`ds1`, `op1`…): podem não ter imagem (`image_url` NULL).
  - **Imagem servida no site antigo:** `render/image` com `quality=70`, sem redimensionar. Ou seja, o original
    guardado é melhor do que o que o site mostrava.
- **Quantos arquivos e quantos MB:** **não dá para saber lendo o código.**
  - O bucket `post-images` inteiro tem 6.399 arquivos e 609 MB (inventário §0), e as figurinhas são só uma parte.
  - A contagem exata sai do próprio script: ele lista as URLs de `sticker_catalog.image_url` e
    `sticker_albums.cover_url` e imprime "Figurinhas: N arquivos, X MB (Y novos enviados)".
  - Pelo painel antigo (lotes de imagens 3:4), a expectativa é de dezenas a poucas centenas de arquivos.
  - Se passar de 300 MB, parar e avisar o dono antes de enviar (espaço do plano).
- **Como copiar** (no PC, pelo script; o servidor continua sem saber nada do Supabase):
  1. **Baixar:** o script baixa cada URL **inteira**, sem `Range` e sem o `render/image` (usa o `object/public`
     original).
  2. **Nome do arquivo:** `sha256` do conteúdo, nos 24 primeiros caracteres hexadecimais, mais a extensão real tirada
     dos bytes (`image-size` informa o tipo). Exemplo: `figurinhas/3fa9…c1.png`. O mesmo arquivo nunca é enviado duas
     vezes, e o nome nunca é reaproveitado (regra do `/media`).
  3. **Miniatura (no PC):** só se a largura passar de 400 px. Usa `sharp` para gerar
     `figurinhas/<hash>-w400.webp` com `width: 400`, `quality: 90` e `effort: 5`. O original **não** é tocado.
     - **Instalação:** `sharp` entra como **devDependency**, porque só o script usa.
     - **GIF animado:** sem miniatura (`thumb_url` = original).
  4. **Já existe?** Antes de enviar, o script faz `HEAD ${target}/media/<nome>`. Com 200, pula.
  5. **Envio:** `POST ${target}/api/importar/midia`, com o corpo em bytes crus e os cabeçalhos `x-cron-token`,
     `x-media-name: figurinhas/<arquivo>` e `Content-Type` do tipo da imagem. Vão 4 por vez.
  6. **No retrato:** cada linha leva `image_url`, `thumb_url` e `image_width`/`image_height` já trocados para
     `/media/figurinhas/...`. Se o download ou o envio falhar, mantém a URL antiga (e avisa), e a página continua
     funcionando.
- **Endpoint `/api/importar/midia`:**
  - **Rota:** em `app/routes/api.importar.ts`, aceitar `params.what === "midia"` com a mesma checagem de token.
  - **Gravação:** `app/server/content/media-import.server.ts`, função `saveImportedMedia(name, bytes)`.
  - **Nome aceito:** só nomes no formato
    `^figurinhas\/[a-f0-9]{24}(-w400)?\.(png|jpe?g|webp|gif|avif)$`. Nada de `..`, barra invertida ou outra pasta.
  - **Conteúdo:** os bytes precisam ser de imagem (assinatura de PNG, JPEG, WebP, GIF ou AVIF), com no máximo 15 MB.
  - **Escrita:** em `join(mediaDir(), name)`, criando a pasta. Grava num arquivo temporário e depois usa `rename`.
    Se o arquivo já existe, não sobrescreve.
  - **Respostas:** `{ ok: true, existia: boolean }` com status 200. Nome ou conteúdo inválido → 400.
  - **Reaproveitamento:** a fase 6 usa o mesmo endpoint para as imagens das matérias, do quiz e do blog, ampliando a
    lista de pastas.
- **Capas de quiz e do blog:** continuam apontando para o Supabase até a fase 6, como as imagens das matérias
  (decisão de 2026-11-13). As figurinhas são exceção, a pedido do dono.

### 3.3 Formato da exportação

```ts
sticker_albums?: { id; slug; name; description; cover_url /* já /media/... */; anilist_id; sort_order;
                   available_from; available_until; created_at; updated_at }[];
sticker_catalog?: { id; album_id; name; rarity; xp; image_url; thumb_url; image_width; image_height; active;
                    sort_order; created_at; updated_at }[];
weekly_featured_album?: { week_key; album_id; discount_pct; computed_at }[];   // últimas 4 semanas
```

**No script:**

- `fetchAll("sticker_albums", "id,slug,name,description,cover_url,anilist_id,sort_order,available_from,available_until,created_at,updated_at")`;
- `fetchAll("sticker_catalog", "id,album_id,name,rarity,xp,image_url,active,sort_order,created_at,updated_at")`.
  Se `active` não existir (migration antiga), repetir sem ela e usar `active = true`;
- `fetchAll("weekly_featured_album", "week_key,album_id,discount_pct,computed_at", "", "week_key")`, ficando com as 4
  últimas;
- depois, a cópia das imagens (3.2).

### 3.4 Servidor `app/server/stickers/stickers.server.ts` e `app/lib/stickers.ts`

1. **`app/lib/stickers.ts`** (nos dois lados):
   - **Constantes portadas de `animeprofile-old/src/data/stickers.ts`:**
     - `RARITIES = ["comum","raro","epico","lendario"]`;
     - `RARITY_LABEL` (Comum, Raro, Épico, Lendário) e o singular e plural ("1 lendária", "3 épicas");
     - `RARITY_WEIGHTS` (60, 28, 10, 2) e `GOLD_PULL_PCT = 0.5`.
   - **Cores do design** (as da seção Coleção da home):
     - **comum:** `white/10`;
     - **raro:** `#63e6be`;
     - **épico:** `#c8b6ff` / `#b197fc`;
     - **lendário:** `#f2c14e`.
2. **`listAlbums()`:**
   - **Retorno:** `{ id, slug, name, description, coverUrl, anilistId, total, byRarity: {comum, raro, epico, lendario},
     inactive, createdAt }`.
   - **Capa:** `cover_url` ou a imagem (miniatura) da 1ª figurinha.
   - **Consulta:** uma só, com `GROUP BY` e `SUM(rarity = '…')`.
3. **`getAlbum(slug)`:**
   - **Retorno:** o álbum e as figurinhas `{ id, number, name, rarity, imageUrl, thumbUrl, width, height, active }`
     na ordem de 3.1. Ou `null`.
4. **`weeklyFeaturedAlbum(now)`:**
   - **Semana já gravada:** lê a linha da semana ISO (o mesmo `isoWeekKey` do site antigo).
   - **Semana sem linha** (o algoritmo de `stickers-weekly-featured.functions.ts`, com os dados guardados):
     1. pega os títulos de `anime_catalog WHERE trending_rank IS NOT NULL` (`title`, `title_english` e
        `title_native`, normalizados sem acento);
     2. escolhe entre os álbuns cujo nome normalizado, com 3 letras ou mais, está contido num título;
     3. ordena por `id` e escolhe `hashString(weekKey) % n`;
     4. calcula o desconto como `10 + hashString(weekKey + ":promo") % 41`;
     5. grava com `INSERT IGNORE`.
   - **Nenhum candidato:** grava `album_id` NULL.
5. **`albumForAnime(anilistId)`:** `{ slug, name, image, total }` ou `null`, para a ficha do anime.
6. **`collectionTeaser()`** (para a home):
   - **Álbum:** o destaque da semana ou, na falta, o 1º pela ordem.
   - **Contagens:** o total de figurinhas e o de álbuns.
   - **Figurinhas de vitrine:** a lendária com imagem mais recente e uma épica com imagem. As duas escolhas são
     determinísticas pelo dia (`hashString(dia) % n`), para variar sem piscar entre os pedidos.
7. **`importStickers(s)`:**
   - **Gravação:** upsert de álbuns, figurinhas e semanas.
   - **Limpeza:** apaga os álbuns e as figurinhas que saíram do site antigo. Por enquanto ninguém tem coleção aqui;
     quando as contas existirem, a regra muda para "fora do sorteio", como no painel antigo.
   - **Raridade fora da lista:** a linha é pulada e vai para `puladas`.
   - **Retorno:** `{ albuns, figurinhas, semImagem }`.
8. **`albumsForSitemap()`:** `slug` e `updated_at` dos álbuns com pelo menos 1 figurinha.

### 3.5 Páginas e rotas

Em `app/routes.ts`: tirar `"figurinhas"` do `PENDING`. Acrescentar `route("figurinhas", "routes/figurinhas.tsx")` e
`route("figurinhas/:slug", "routes/figurinha-album.tsx")`.

**`/figurinhas` → `figurinhas.tsx`**

- **Cabeçalho:** `PageHeader` com o rótulo "Figurinhas", o título "Sorteie. Colecione. Lendárias esperam." e o texto
  do site antigo.
- **Painel escuro "Pacotes":** no visual da Coleção da home.
  - as chances por raridade (60%, 28%, 10% e 2%) e o "Gold Pull · 0,5%";
  - o botão desativado "Abrir pacotes chega com as contas";
  - o link "Conhecer o álbum da semana".
- **Destaque da semana:** cartão grande com a capa, o nome e "N figurinhas", com link para o álbum. O desconto não
  aparece enquanto não houver pacotes.
- **Grade de álbuns:**
  - cada cartão tem capa 3:4, nome, "N figurinhas" e uma barra fina por raridade (proporção de cada uma);
  - **busca por nome e ordem:** "Destaques" (padrão, `sort_order`), "Recentes", "A–Z" e "Maior". Funcionam no
    navegador, porque a lista é pequena e já vem inteira no SSR.
- **Estados vazios:**
  - sem álbuns: "Os álbuns estão chegando. Volte em breve!";
  - busca sem resultado: "Nenhum álbum com esse nome.".
- **SEO:**
  - **Título:** "Figurinhas de anime: álbuns e raridades".
  - **Descrição:** a do site antigo ("Sorteie figurinhas dos seus animes favoritos…").
  - **JSON-LD:** `CollectionPage` + `ItemList` dos álbuns e `BreadcrumbList`.

**`/figurinhas/:slug` → `figurinha-album.tsx`**

- **Loader:** `getAlbum(slug)`; não existe → 404 ("Álbum não encontrado. Este álbum não existe ou foi removido.").
- **Cabeçalho:**
  - nome, descrição, "N figurinhas" e a contagem por raridade ("2 lendárias · 5 épicas…");
  - "N não saem mais no sorteio", quando houver `active = 0`;
  - "Ver o anime" (`/animes/<anilist_id>`), quando houver.
- **Convite:** "Comece a sua coleção: crie sua conta grátis (em breve)", sem link ativo.
- **Filtros:** chips de raridade (Todas, Comum, Raro, Épico e Lendário) e ordem (Número, Raridade e Nome), no
  navegador.
- **Grade** (2 colunas no celular, 5 no computador): `StickerCard` 3:4.
  - borda e brilho pela raridade (o holográfico da lendária, como o da home);
  - `#número`, nome e rótulo da raridade;
  - imagem pela `thumb_url`. Ao clicar, abre um `<dialog>` com o **original** (`image_url`);
  - faixa "Não sai mais no sorteio", quando `active = 0`;
  - **sem imagem:** quadro com a cor da raridade e a inicial do nome;
  - **figurinhas que o visitante não tem:** aparecem como **silhueta**, por padrão (como no site antigo: `blur` +
    `brightness`, por CSS). Uma constante `MOSTRAR_ABERTAS` em `app/lib/stickers.ts` liga e desliga (ver
    "Perguntas para o dono").
- **Álbum vazio:** "Este álbum ainda não tem figurinhas." e `noindex`.
- **SEO:**
  - **Título:** `Álbum ${nome} — Figurinhas`.
  - **Descrição:** a descrição do álbum ou "Colecione as N figurinhas do álbum <nome> no Anime Profile…" (texto do
    site antigo).
  - **`og:image`:** a capa.
  - **JSON-LD:** `CollectionPage` (com `about` = o nome do anime) e `BreadcrumbList` (Figurinhas › Álbum).

### 3.6 Sitemap, home e ficha do anime

1. **Sitemap:**
   - novo `/sitemap-figurinhas.xml`, com os álbuns que têm figurinha (`weekly`, `0.5`, `lastmod` = `updated_at`). O
     site antigo não tinha; é novo e ajuda a indexar os álbuns;
   - acrescentar em `SITEMAPS`, `FILES` e `routes.ts`;
   - `STATIC_PAGES`: `{ path: "/figurinhas", changefreq: "weekly", priority: "0.6" }`.
2. **Home: ligar a seção "Coleção" aos dados reais** (`Collection()` em `home.tsx` passa a receber `teaser`):
   - **Dados:** no `loader`, `collectionTeaser()`.
   - **Texto:** "N figurinhas em M álbuns" abaixo do parágrafo.
   - **Chips de raridade:** continuam os mesmos.
   - **Botão:** "Conhecer as figurinhas" vai para `/figurinhas`.
   - **Link novo:** "Álbum da semana: <nome>" vai para `/figurinhas/<slug>`.
   - **Desenho:**
     - **O pacote:** continua, com a capa do álbum da semana no lugar do logo, quando houver.
     - **O cartão holográfico** (borda `#f2c14e`): passa a mostrar a imagem da **lendária** (`thumb_url`,
       `object-cover`), com o brilho por cima.
     - **O cartão roxo** (borda `#b197fc`): passa a mostrar a **épica**.
   - **Sem catálogo** (lista vazia): fica exatamente como hoje (o enfeite atual).
3. **Ficha do anime** (`app/routes/anime.tsx`):
   - **Dados:** no `loader`, `albumForAnime(id)`.
   - **Faixa:** se houver álbum, mostra "Colecione o álbum de <nome>: N figurinhas", com link para
     `/figurinhas/<slug>`. É o mesmo recurso do site antigo.

### 3.7 Testes `tests/stickers.test.ts`

- **`applySnapshot` com as chaves das figurinhas:**
  - grava;
  - pula a raridade inválida;
  - na segunda importação, sem uma figurinha, apaga essa figurinha.
- **`getAlbum`:** a ordem com `sort_order` NULL fica **por último**, e a numeração começa em 1.
- **`listAlbums`:** as contagens por raridade, a capa sendo a 1ª figurinha quando `cover_url` é NULL e a ordem
  `sort_order` e depois `created_at DESC`.
- **`weeklyFeaturedAlbum`:**
  - com um álbum "Naruto" e o trending "Naruto Shippuden", escolhe esse álbum;
  - chamar duas vezes na mesma semana devolve a mesma linha;
  - sem candidato, `album_id` fica NULL.
- **`saveImportedMedia`:**
  - recusa `../x.png`, `outra/abc.png` e bytes que não são imagem;
  - grava com `MEDIA_DIR` numa pasta temporária;
  - a segunda chamada devolve `existia: true` e não muda o arquivo.
- **`sitemapFigurinhas`** (nova função em `feeds.server.ts`): não tem o álbum vazio.

---

## Passos de execução (ordem e verificação)

| # | Passo | Verificação |
|---|---|---|
| 0 | Preparação comum (seção "Passo 0") | `npm test` verde |
| 1.1 | Criar `009_quiz.sql`, rodar `npm run db:migrate` local e **colar o SQL no chat** | Tabelas criadas |
| 1.2 | `rules.server.ts`, `app/lib/quiz.ts` e testes puros | `npx vitest run tests/quiz.test.ts` |
| 1.3 | `quiz.server.ts` (listas, `finishQuiz`, `checkAnswer`, `importQuizzes`) + ligar no `applySnapshot` | testes de banco do quiz |
| 1.4 | Script: quizzes + contagem por resultado | `node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env` (sem token) imprime "Quizzes: N" |
| 1.5 | Páginas `/quiz` e `/quiz/:slug`, `QuizPlayer`, rotas, sitemap, home | `npm run dev`: jogar um quiz de cada tipo; no código-fonte da página não aparece `"correct"`; clicar num quiz a partir de `/quiz` (navegação `.data`) |
| 1.6 | Docs, `npm run typecheck`, `npm test`, `npm run build`, commit e push | Build ok; no endereço de teste, depois da exportação com token, `/quiz` lista os quizzes |
| 2.1 | `010_blog.sql` + SQL no chat | Tabelas criadas |
| 2.2 | `sanitizeUserHtml`, `markdown.server.ts` + testes | testes do blog |
| 2.3 | `blog.server.ts` + `importBlog` + autores no `applySnapshot` | testes de banco do blog |
| 2.4 | Script: posts, categorias, tags, ligações, comentários e perfis do blog | o script imprime "Blog: N posts" |
| 2.5 | Rotas e páginas, RSS, `redirects.mjs`, sitemap, home | `/blog`, um post, o autor, uma categoria e uma tag abrem pelo clique; `/blog/rss.xml` valida; `/noticias?tipo=blog` → 301 |
| 2.6 | Docs, typecheck, testes, build, commit e push | |
| 3.1 | `011_figurinhas.sql` + SQL no chat | Tabelas criadas |
| 3.2 | `media-import.server.ts` + `api/importar/midia` + testes | testes de mídia |
| 3.3 | `stickers.server.ts` + `importStickers` + testes | testes das figurinhas |
| 3.4 | Script: álbuns, catálogo, semanas e cópia das imagens (`npm i -D sharp`) | sem token: imprime "Figurinhas: N arquivos, X MB". Com token: arquivos em `~/animeprofile-media/figurinhas/` e `/media/figurinhas/<hash>.png` abre |
| 3.5 | Páginas `/figurinhas` e `/figurinhas/:slug`, faixa na ficha do anime, seção Coleção, sitemap | tela de 390 px sem rolagem lateral; zoom abre o original |
| 3.6 | Docs, typecheck, testes, build, commit e push | |

## Riscos e cuidados

- **`routePath(request)`:** todo `loader` que olha o endereço usa essa função (nunca `new URL(request.url).pathname`).
  Testar **clicando** em cada link novo, por causa do `.data`.
- **`action` com `useFetcher`:** o React Router envia o POST para `<endereço>.data`, e quem trata isso é o
  `routePath`. A `action` também precisa conferir `sameOrigin`.
- **`npm run build` antes de todo push:** é cada push na `main` que publica.
- **Migrations novas:** 009, 010 e 011 são coladas no chat assim que forem criadas. Uma migration aplicada nunca é
  editada.
- **MariaDB:**
  - colunas JSON chegam como texto, então ler sempre com `json()` ou `normalizeQuizData`;
  - os `CHECK` só funcionam no MariaDB 10.2 ou mais novo (o mesmo padrão do resto do banco).
- **`NULL` em `ORDER BY`:** no MySQL vem primeiro; usar `sort_order IS NULL, sort_order` (3.1).
- **`updated_at` dos quizzes:** sem `ON UPDATE`. Contar uma partida não pode mexer no `lastmod` do sitemap.
- **Rota do blog sombreando usuários:** os usernames `u`, `categoria`, `tag`, `rss.xml`, `criadores`, `editor` e
  `dashboard` ficam escondidos por rotas fixas. É o mesmo do site antigo. Conferir no primeiro retrato se algum
  usuário tem um desses nomes.
- **HTML de usuário:** o blog usa **só** `sanitizeUserHtml`, nunca a `sanitizePostHtml` (que deixa `iframe` e
  `class`). Os links externos levam `nofollow ugc`.
- **`marked` global:** não alterar a instância das páginas de texto (`pages.server.ts`). O blog usa `new Marked()`.
- **Imagens:**
  - nunca recomprimir o original;
  - a miniatura é extra, gerada só no PC;
  - o endpoint de mídia aceita só nomes com hash numa pasta da lista, e grava com `rename` atômico;
  - antes de mandar muita coisa, confira o espaço da Hostinger (300 MB é o ponto de parar e perguntar).
- **Robôs:** `finishQuiz` não conta partidas de robô (`isbot`). As páginas novas não chamam API externa, então não
  existe risco de cota como o do AniList.
- **Exportação:** as chaves novas são opcionais, e retratos antigos continuam válidos. `validateSnapshot` não muda.
  O `MAX_BYTES` (80 MB) sobra, porque as imagens vão pelo endpoint de mídia, não no retrato.
- **Quiz dentro de matérias:** o `<div data-quiz-embed>` perde o atributo na limpeza das matérias, mas o link
  "Quiz: …" para `/quiz/<slug>` continua no texto e agora funciona. O quiz jogável dentro da matéria fica para
  depois.

## Como verificar

```bash
npm run db:migrate
npm run typecheck
npm test
npm run build
node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env            # sem token: só gera e imprime as contagens
CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env  # envia ao endereço de teste
```

No endereço de teste, depois do envio (resultado em `/api/cron/status`, tarefa `importar-conteudo`):

- `/quiz`, `/quiz/<slug>` (jogar até o fim; `?r=<id>` muda a prévia), `/sitemap-quiz.xml`.
- `/blog`, `/blog/<user>/<slug>`, `/blog/u/<user>`, `/blog/categoria/<slug>`, `/blog/tag/<slug>`, `/blog/rss.xml`,
  `/blog/u/<user>/rss.xml`, `/sitemap-blog.xml`, `/blog/criadores` (302), `/noticias?tipo=blog` (301).
- `/figurinhas`, `/figurinhas/<slug>`, `/media/figurinhas/<arquivo>`, `/sitemap-figurinhas.xml`, ficha de um anime
  com álbum.
- `/sitemap.xml` lista os três sitemaps novos; a home mostra Quiz, a Coleção com figurinhas reais e o Blog.
- Comparar com o site antigo: mesmo número de quizzes, posts e figurinhas que o script imprimiu.

## Perguntas para o dono

1. **Figurinhas abertas ou em silhueta?** No site antigo, quem não tem a figurinha vê só a silhueta (imagem borrada e
   escura). Como ninguém vai estar logado nesta fase, o catálogo inteiro apareceria em silhueta.
   - **Proposta:** mostrar as figurinhas abertas até as contas existirem. A silhueta volta para quem estiver logado
     e não tiver a figurinha.
   - **Padrão do plano, se o dono não responder:** silhueta, igual ao site antigo (a constante `MOSTRAR_ABERTAS`
     troca isso com uma linha).
