# Plano (temporário): robô de notícias no site novo (fase A)

## Objetivo

Fazer o site novo publicar sozinho de 3 a 10 notícias por dia, com a mesma qualidade do robô do site antigo, a partir da
virada do domínio (17/11). Tudo roda no cron do próprio site (Node na Hostinger + MySQL + Gemini grátis), sem GitHub
Actions e sem painel.

## Contexto

- **Decisão do dono (pergunta 2 da [virada](plano-virada-parcial.md)): sim.** O robô volta antes das contas, porque
  notícia nova é o que mantém o Google e o Google Notícias. Isso troca o "durante a lacuna o robô fica parado" de
  [decisoes.md](decisoes.md) (2026-11-15).
- **Como o robô antigo funciona hoje** (repositório `animeprofile-old`, só leitura; inventário completo na Parte 1):
  `pg_cron` do Supabase → `/api/public/hooks/ai-news-dispatch` → GitHub Actions `ai-news.yml` →
  `scripts/ai-news-worker.ts` → API protegida `/api/public/ai-news/worker/<ação>` do site antigo, que grava no
  Supabase. Com o Supabase fora (18/11), tudo para.
- **O que o site novo já tem e é aproveitado:**
  - cron da conta chamando `/api/cron/tick` a cada 5 min, agenda em `cron_jobs` e histórico em `cron_runs`
    (`app/server/cron/runner.server.ts`, `jobs.server.ts`);
  - a tarefa roda depois da resposta `202`, então o limite de ~55 s da CDN não pesa;
  - `posts`, `post_authors` (`kind = 'ai'`, mesmos IDs dos autores de IA antigos), `categories`, `tags`,
    `post_categories` e `post_tags` (migration 003);
  - a limpeza do HTML (`app/server/content/sanitize.server.ts`) e o `/media` (`mediaDir()` de `server-paths.mjs`);
  - a busca no AniList (`searchAniList` em `app/server/anime/anilist.server.ts`);
  - o `sitemap-news.xml` (48 h), o RSS e o canonical, que já leem `posts` sem mudança.
- **O que falta:** as tabelas de configuração do robô (fontes, lista negra, tópicos, horários, autores) **não** foram
  importadas. A exportação de conteúdo só traz `ai_news_authors` (nome, slug, avatar). As tabelas de configuração são
  só de admin no Supabase (a chave pública não as lê); por isso vêm por um SQL que o dono roda (passo 7).

## Parte 1 — Inventário do robô antigo

| Peça | Como é no antigo (arquivo) | O que fazer no novo |
|---|---|---|
| Disparo | `pg_cron` de hora em hora → `hooks/ai-news-dispatch.ts`, que calcula a cota da hora e chama o `workflow_dispatch` do GitHub. O `schedule:` do GitHub foi abandonado por falhar horas seguidas | Tarefa `robo-noticias` no `jobs.server.ts`, de hora em hora |
| Rodada | `worker/run.ts`: `start` → coleta RSS → `candidates` → `select` → um candidato por vez (scrape → mídia → AniList → Gemini → qualidade → `import`/`discard`) → `finish`. Depois, extras (artigos, traduções EN, sinopses, quizzes, títulos) | O mesmo fluxo, chamando funções em vez de HTTP. Extras ficam para DEPOIS |
| Trava | `ai_news_runs` com `status = running`; vence em 20 min; 409 se já houver um | Reserva do `cron_jobs` + a mesma regra em `ai_news_runs` |
| Limites de tempo | `fetch` com 90 s por chamada; rodada encerra em 9 min (o GitHub cobrava minutos: 64 rodadas travadas em 17 dias) | Os mesmos 90 s e 9 min |
| Fontes | `ai_news_sources` (nome, `base_url`, `rss_url`, ativo). `worker/rss.ts` lê RSS/Atom (`fast-xml-parser`), descobre o feed se não houver `rss_url` e pega 10 itens por fonte, 4 fontes por vez | Portar `rss.ts` |
| Candidatos | `ai_news_candidates`: só itens das últimas 24 h; `content` sem HTML, até 8.000 caracteres | Igual |
| Deduplicação | (1) `dedup_hash` = sha1(título normalizado + host), com índice único; (2) no `import`, semelhança de palavras (Jaccard ≥ 0,8) com títulos publicados nos últimos 30 dias (`select.server.ts`, `isSimilarToRecent`) | Os dois, e mais um: o endereço da fonte já usado (3.5 e passo 6) |
| Pontuação | `pipeline/score.server.ts`: lista negra descarta; tópicos prioritários somam peso; novidade (<6 h: 25, <24 h: 15); tamanho do texto; reforço de anime (+20); CTR por fonte e tópico (`performance.server.ts`) e termos em alta (`trends.server.ts`) | Portar sem CTR e sem "em alta" (dependem de histórico; DEPOIS) |
| Seleção | `select.server.ts`: nota ≥ 60 (senão ≥ 20); no máximo 2 por tópico em 24 h; 1 por fonte e 1 por tópico por rodada; 3 candidatos de reserva além da cota | Portar inteira |
| Leitura da matéria | `worker/scrape.ts`: `fetch` + `@mozilla/readability` + `linkedom`; Firecrawl só se vier < 400 caracteres | Portar sem Firecrawl |
| Mídia | `worker/media.ts`: imagens do RSS, `og:image` e do corpo, ≥ 360×300; capa preferindo ≥ 1200 px; sem imagem boa, descarta **antes** do Gemini. YouTube/Vimeo viram trailer e vídeos extras | Portar inteira |
| Contexto verificado | `worker/anilist-context.ts`: 1 busca no AniList pelo título, aceita só se o nome bater; dá estúdio, status, temporada e onde assistir | Portar usando `searchAniList` |
| Prompt | `worker/prompt.ts`: guia editorial fixo (voz, estrutura com H2, 450 a 700 palavras, "Para o fã brasileiro" só com dado verificado, spoiler em `<details class="spoiler-box">`, nunca inventar, `otakuRelated`, `animeFocus`) + prompt neutro de editor. A persona do autor **não** vai ao Gemini | Guia no banco (ver pergunta 1); o resto igual |
| Geração | `worker/gemini.ts`: REST `generateContent` com `responseJsonSchema`; `finishReason` tem que ser `STOP`; 429/5xx esperam 20 s e 60 s (ou o `retryDelay`); se o Google mandar esperar > 90 s, desiste até a próxima rodada | Portar inteira |
| Modelos | `constants.ts`: `gemini-3-flash-preview`, `gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-2.5-flash`. `model-chain.ts`: a cota grátis é **por modelo**; no 429 passa ao próximo; se todos esgotarem, encerra a rodada | Portar inteira |
| Qualidade | `worker/quality.ts`: título de 30 a 70 caracteres, ≥ 350 palavras, ≥ 2 H2, sem frases de IA, sem caça-clique, sem frase em inglês nem japonês, parágrafos repetidos, rumor tratado como rumor. `autoFixArticle` conserta o que dá sem outra chamada. 1 nova tentativa com a lista do que falhou | Portar inteira |
| HTML | `worker/html.ts`: trailer no topo, link interno para `/tag/<palavra-chave>`, tira "Fonte:" do modelo e põe o link da fonte no fim, garante as imagens do corpo, `H2 Mais sobre`. `html-guard.ts`: sem script/iframe fora da lista | Portar; o cartão do anime no meio do texto sai (a lateral da matéria já usa `anilist_id`) |
| Publicação | `actions.server.ts` (`importArticle`): bloqueia lista ("Top 5", "As 10 melhores"); só as categorias com autor de IA ativo (`ALLOWED_AI_CATEGORIES`: Animes e Mangás, Apps, Filmes e Séries, Eventos, Games); fora do universo otaku descarta; cota fora de anime de 33% do teto; autor por especialidade (`publish.server.ts`); slug único; rascunho se `auto_publish` for falso | Portar inteira |
| Imagens próprias | `worker/localize.ts`: baixa, converte para WebP 1280 px + miniatura 640 px (`sharp`) e guarda; GIF e SVG ficam como estão; se falhar, fica o endereço da fonte | Gravar direto em `/media/robo/` |
| Agenda e teto | `ai_news_schedule_slots` (hora → quantas); teto diário `system_config.ai_news_daily_cap` (padrão 10), contado desde 0h de Brasília | `ai_news_schedule_slots` + `system_config.robo` |
| Custo | `ai_news_costs` com tokens (custo sempre 0: plano grátis) | `ai_news_usage`, também para contar chamadas por modelo no dia |
| O que deu problema (comentários e histórico) | (1) `schedule:` do GitHub não disparava; (2) `bun.lock` desatualizado parou as notícias de 14 a 15/10; (3) chamadas sem limite de tempo travavam a rodada; (4) dormir o `retryDelay` da cota diária matava a rodada sem registro; (5) cota gasta pelos extras deixava as notícias sem cota (daí a fila de modelos); (6) slug repetido ("naruto-naruto-..."); (7) matérias saíam com imagem da fonte (hotlink) até alguém abrir o painel | (1), (2) e (3) somem ou já estão cobertos no cron do site; (4) a (7) já vêm resolvidos no código portado |

## Parte 2 — Desenho: onde roda

### Opção A (recomendada): tarefa do cron do próprio site

- **Como:** `robo-noticias` em `jobs.server.ts`. O `tick` reserva, responde `202` e roda em segundo plano.
- **Tempo:** sem o limite da CDN, porque a resposta já saiu. A rodada tem teto próprio de 9 min, e a reserva vence em
  15 min.
- **Segredos:** só `GEMINI_API_KEY`, cadastrada pelo dono no hPanel. Nada no GitHub.
- **Logs:** `cron_runs.stats` (resumo) e `ai_news_runs.report` (detalhe), lidos por `/api/cron/status` e
  `/api/robo/status`.
- **Custo:** zero. Sem minutos de GitHub e sem chamada HTTP entre dois sistemas.

### Opção B: GitHub Actions chamando um endpoint protegido do site novo

- **Desvantagens:**
  - **Repositório público:** os logs das Actions ficam abertos para qualquer pessoa (títulos, motivos, erros do Gemini).
  - **Segredos em dois lugares:** a chave do Gemini no GitHub e um segredo do worker no hPanel.
  - **Disparo:** o `schedule:` do GitHub já falhou neste projeto, e o `pg_cron` que o substituía some com o Supabase.
  - **Mais código:** é preciso refazer o contrato HTTP inteiro (`contract.ts`, 396 linhas).
- **Única vantagem:** o processo pesado sai do servidor. Com 1 notícia por vez e imagens de 1280 px, o peso é pequeno.

**Recomendação: A.** É o que [arquitetura.md](arquitetura.md) já previa ("GitHub Actions → tarefas do cron no próprio
servidor").

### Fluxo de uma rodada (opção A)

1. **Modo:** lê `system_config.robo`. Com `modo = desligado`, termina.
2. **Rodadas presas:** marca como `expired` as rodadas `running` com mais de 20 min e devolve os candidatos
   `selected` delas para `pending`. Se ainda houver rodada viva, termina ("já rodando").
3. **Cota da hora:** `ai_news_schedule_slots[hora de Brasília].posts`, limitada a `limiteDia` menos as matérias
   `origin = 'robo'` criadas desde 0h de Brasília. Se der 0, termina. Tabela vazia = horários padrão
   8, 10, 12, 14, 16, 18, 20 e 22 h, com 1 matéria cada.
4. **Coleta:** RSS das fontes ativas, 4 por vez. Grava os candidatos novos com `INSERT IGNORE` pelo `dedup_hash`.
5. **Pontuação e seleção:** cota mais 3 de reserva.
6. **Um candidato por vez:** scrape → mídia → AniList → Gemini (no máximo 2 tentativas) → qualidade → publicação.
   Para quando atingir a cota, quando a cota do Gemini acabar em todos os modelos ou quando faltarem menos de 2,5 min
   para os 9 min.
7. **Fim:** fecha a rodada e devolve resumo para `cron_runs.stats`: modo, hora, cota, coletados, novos,
   publicados (slugs), descartados (título e motivo, no máximo 10), falhas e chamadas por modelo.

## Parte 3 — O que muda no site novo

### 3.1 Migration nova `db/migrations/012_robo_noticias.sql`

O SQL completo, que vai colado no chat quando o arquivo for criado:

```sql
-- 012: robô de notícias (fase A). Configuração vinda do site antigo, candidatos, rodadas e uso do Gemini.
-- Datas em UTC (o código grava com UTC_TIMESTAMP(3)).

-- De onde veio cada matéria: 'old' (importada do site antigo) ou 'robo' (publicada aqui).
-- A importação do site antigo só apaga e religa as matérias 'old'.
ALTER TABLE posts
  ADD COLUMN origin VARCHAR(10) NOT NULL DEFAULT 'old' AFTER is_ai_generated,
  ADD COLUMN source_url VARCHAR(600) NULL AFTER origin,
  ADD KEY idx_posts_origin (origin, created_at),
  ADD KEY idx_posts_source (source_url(255));

CREATE TABLE IF NOT EXISTS ai_news_sources (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,   -- mesmo UUID do site antigo
  name VARCHAR(120) NOT NULL,
  base_url VARCHAR(600) NOT NULL,
  rss_url VARCHAR(600) NULL,
  priority SMALLINT NOT NULL DEFAULT 5,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_fetched_at DATETIME(3) NULL,
  last_status VARCHAR(20) NULL,                            -- ok | discovered | no_rss | failed
  fail_streak SMALLINT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuração dos autores de IA. O nome, o slug e o avatar ficam em post_authors (kind = 'ai'), mesmo id.
CREATE TABLE IF NOT EXISTS ai_news_authors (
  author_id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL,                     -- ex.: 'Animes e Mangás' (igual a categories.name)
  specialty TEXT NULL,                                     -- system_prompt antigo: só para escolher o autor
  auto_publish TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lista negra (kind = 'block') e tópicos prioritários (kind = 'topic', com peso).
CREATE TABLE IF NOT EXISTS ai_news_terms (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(10) NOT NULL,
  term VARCHAR(160) NOT NULL,
  weight SMALLINT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ai_news_terms (kind, term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quantas notícias em cada hora (horário de Brasília). Vazia = horários padrão do código.
CREATE TABLE IF NOT EXISTS ai_news_schedule_slots (
  hour TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  posts SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_news_candidates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_id CHAR(36) CHARACTER SET ascii NULL,
  dedup_hash CHAR(40) CHARACTER SET ascii NOT NULL,        -- sha1(título normalizado | host)
  title VARCHAR(400) NOT NULL,
  summary TEXT NULL,
  content MEDIUMTEXT NULL,
  source_url VARCHAR(600) NOT NULL,
  image_url VARCHAR(600) NULL,
  video_url VARCHAR(600) NULL,
  published_at DATETIME(3) NULL,
  score SMALLINT NOT NULL DEFAULT 0,
  score_breakdown JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',           -- pending | selected | published | draft | discarded | failed | rehearsal
  discard_reason VARCHAR(500) NULL,
  result_json MEDIUMTEXT NULL,                             -- texto gerado no ensaio (para a prévia)
  post_id CHAR(36) CHARACTER SET ascii NULL,
  run_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ai_news_candidates_hash (dedup_hash),
  KEY idx_ai_news_candidates_status (status, score),
  KEY idx_ai_news_candidates_created (created_at),
  KEY idx_ai_news_candidates_url (source_url(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_news_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  status VARCHAR(20) NOT NULL,                             -- running | finished | expired | error
  mode VARCHAR(12) NOT NULL,                               -- ensaio | rascunho | publicar
  slot CHAR(2) NULL,
  limit_n SMALLINT NOT NULL DEFAULT 0,
  generated SMALLINT NOT NULL DEFAULT 0,
  discarded SMALLINT NOT NULL DEFAULT 0,
  failed SMALLINT NOT NULL DEFAULT 0,
  report JSON NULL,
  KEY idx_ai_news_runs_started (started_at),
  KEY idx_ai_news_runs_status (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada chamada ao Gemini (também as que deram 429): conta o uso do dia por modelo.
CREATE TABLE IF NOT EXISTS ai_news_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT UNSIGNED NULL,
  candidate_id BIGINT UNSIGNED NULL,
  model VARCHAR(60) NOT NULL,
  status_code SMALLINT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_ai_news_usage_created (created_at, model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuração do robô. Nasce desligado: só liga de propósito (passo 13).
INSERT IGNORE INTO system_config (name, value) VALUES
  ('robo', JSON_OBJECT(
    'modo', 'desligado',
    'limiteDia', 10,
    'foraDeAnimePct', 33,
    'imagensCorpo', 3,
    'modelo', 'gemini-3-flash-preview',
    'chamadasDiaPorModelo', 40
  ));
```

- **`origin`:** as 950 matérias que já estão no banco ficam com `'old'` pelo padrão.
- **Guia editorial:** vai em `system_config` com `name = 'robo.guia'` (`{"texto": "..."}`), gravado pela importação da
  configuração (passo 7). Fica fora da migration porque o repositório é público.

### 3.2 Arquivos novos (`app/server/robot/`)

Cada módulo portado do antigo mantém a lógica e os números; muda só o acesso a dados (MySQL em vez de Supabase/HTTP).

| Arquivo | Origem no antigo | O que faz |
|---|---|---|
| `constants.ts` | `ai-news/constants.ts`, `anime-quota.ts` | Categorias permitidas, modelos, cota fora de anime, `looksLikeAnime`, `LISTICLE_RE` (de `publish.server.ts`) |
| `text.ts` | `utils.server.ts` | `makeSlug` (sem dependência: `normalize("NFD")`, minúsculas, `[^a-z0-9]+` → `-`), `ensureSlug`, `dedupHash`, `stripHtml`, `decodeEntities` |
| `rss.server.ts` | `worker/rss.ts` | Leitura de RSS/Atom e descoberta do feed |
| `scrape.server.ts` | `worker/scrape.ts` | `fetch` + Readability, **sem Firecrawl** |
| `media.server.ts` | `worker/media.ts` + `worker/localize.ts` | Extrai e valida as imagens, escolhe a capa e converte para WebP. Grava em `/media/robo/<24 hex>.webp` e `-640.webp`. Devolve `width` e `height` da capa |
| `anilist-context.server.ts` | `worker/anilist-context.ts` | Contexto verificado via `searchAniList(query, 5)` |
| `prompt.ts` | `worker/prompt.ts` | `buildSystemPrompt(guia)`, `buildUserPrompt`, `buildRetryInstruction`, `NEUTRAL_EDITOR_PROMPT`. O guia chega como parâmetro, lido de `robo.guia`. Sem guia no banco, a rodada termina com erro "guia editorial não importado" (nunca gera sem ele) |
| `gemini.server.ts` | `worker/gemini.ts` | Chamada REST com `ARTICLE_JSON_SCHEMA`. Cada resposta, inclusive 429, grava uma linha em `ai_news_usage`. A chave vai no cabeçalho `x-goog-api-key` e nunca aparece em log nem em mensagem de erro |
| `model-chain.ts` | `worker/model-chain.ts` | Fila de modelos. Antes de chamar, pula o modelo que já tem `chamadasDiaPorModelo` chamadas nas últimas 24 h em `ai_news_usage` |
| `contract.ts` | `GeneratedArticle` de `worker/contract.ts` | Validação do JSON do Gemini com `zod` |
| `quality.ts` | `worker/quality.ts` | `checkQuality` e `autoFixArticle` |
| `html.ts` | `worker/html.ts` + `html-guard.ts` + `normalizeSpoilerBoxes` (de `src/lib/spoiler-html`) | Ajustes de SEO e checagem do HTML. Sem `insertAnimeCardEmbed` |
| `select.server.ts` | `pipeline/score.server.ts` + `pipeline/select.server.ts` + `freshness.ts` | Pontuação (sem CTR e sem "em alta"), seleção e `isSimilarToRecent` |
| `publish.server.ts` | `importArticle` de `actions.server.ts` + `pickAuthorWithinCategory` | Regras de bloqueio e gravação numa transação (passo 6) |
| `config.server.ts` | `computeSlotLimit`, `startRun` | Lê `system_config.robo`, `robo.guia`, horários, autores, termos e fontes. Calcula a cota da hora |
| `run.server.ts` | `worker/run.ts` | `runRobot({ mode, limit?, url? })`: a rodada da Parte 2 |
| `config-import.server.ts` | — | Grava o JSON da configuração vinda do site antigo (passo 7) |
| `app/routes/api.robo.ts` | — | Endpoints de operação (passo 11) |
| `scripts/importar-config-robo.mjs` | — | Envia a configuração do PC para o site (passo 7) |

### 3.3 Arquivos alterados

- `app/server/cron/jobs.server.ts`:
  - tarefa nova `{ name: "robo-noticias", schedule: "20 * * * *", leaseMinutes: 15, run: () => runRobot({}) }`;
  - **por que o minuto 20:** não cruza com `animes-anilist` (:10) nem com `videos-materias` (:40), que rodariam
    depois do robô no mesmo tick;
  - a `limpeza` passa a apagar: `ai_news_candidates` com mais de 30 dias (menos os `published`), `ai_news_usage` e
    `ai_news_runs` com mais de 60 dias.
- `app/server/content/import-old.server.ts` (**obrigatório antes de ligar o robô**):
  - o `DELETE` final passa a ser `SELECT id FROM posts WHERE origin = 'old'`;
  - `replaceLinks` deixa de apagar a tabela inteira: apaga só os vínculos das matérias `origin = 'old'`
    (`DELETE t FROM post_categories t JOIN posts p ON p.id = t.post_id WHERE p.origin = 'old'`, e o mesmo para
    `post_tags`);
  - **o problema de hoje:** a importação apaga toda matéria que não está no retrato e todos os vínculos de categoria
    e tag. Uma exportação depois da primeira notícia do robô apagaria as notícias dele.
- `app/server/content/sanitize.server.ts`:
  - `details` e `summary` entram em `allowedTags`;
  - **o problema de hoje:** a limpeza tira o `<details class="spoiler-box">` e deixa o spoiler à mostra, inclusive
    nas matérias antigas importadas.
- `app/app.css` (ou o CSS global do site):
  - estilo do `.spoiler-box`: `rounded-[9px] border border-line bg-sunken`;
  - `summary` com `cursor-pointer font-semibold px-4 py-3`, e o conteúdo com `px-4 pb-4`;
  - aberto, a borda fica `brand`;
  - mesmos tokens no tema escuro.
- `app/server/content/media-import.server.ts`:
  - função nova `saveRobotMedia(key, bytes, suffix)` com o padrão `^robo/[a-f0-9]{24}(-640)?\.webp$`;
  - mesma escrita atômica, com o arquivo `.tmp` e depois `rename`.
- `app/routes.ts`: `route("api/robo/:acao", "routes/api.robo.ts")`.
- `package.json`:
  - `sharp` sai de `devDependencies` e vai para `dependencies` (agora roda no servidor);
  - entram em `dependencies`: `fast-xml-parser`, `@mozilla/readability`, `linkedom` e `zod`.
- `.env.example`: `GEMINI_API_KEY=` com o comentário "chave do AI Studio, projeto sem faturamento".
- `tests/`: `robot.test.ts` (as funções puras, portando os testes de `src/lib/ai-news/worker/__tests__`) e
  `robot-db.test.ts` (`mysql-memory-server`: publicação, deduplicação, cota e a importação que não apaga as do robô).

### 3.4 Variáveis de ambiente (o dono cadastra no hPanel)

| Nome | Para quê |
|---|---|
| `GEMINI_API_KEY` | Chave **nova**, criada no Google AI Studio num projeto **sem faturamento** (assim nunca há cobrança) |

Só isso. `CRON_TOKEN` já existe e protege `/api/robo/*`. Firecrawl não entra (pergunta 3).

### 3.5 Como evitar notícia repetida

1. **Índice único `dedup_hash` nos candidatos:** a mesma notícia da mesma fonte entra uma vez só.
2. **Mesmo endereço da fonte nos últimos 7 dias:** se já existe matéria com `posts.source_url` igual, ou uma matéria
   antiga cujo `content_html LIKE '%<endereço>%'` (o site antigo punha o link da fonte no fim), o candidato é
   descartado com o motivo "fonte já usada". É o que impede repetir o que o site antigo publicou nas últimas horas
   antes da virada.
3. **Título parecido (Jaccard ≥ 0,8) nos últimos 30 dias**, contra todas as matérias publicadas, antigas e novas.
4. **Saturação:** no máximo 2 matérias por tópico prioritário em 24 h, e 1 por tópico em cada rodada.
5. **Trava:** uma rodada por vez (reserva do cron + `ai_news_runs`).

### 3.6 Como respeitar o limite grátis do Gemini

- **Ritmo:** um candidato por vez, no máximo 2 gerações por candidato (a original e 1 correção), e a mídia validada
  **antes** de chamar o Gemini.
- **Por dia:** `chamadasDiaPorModelo` (40) por modelo nas últimas 24 h, contado em `ai_news_usage`. No 429, o modelo
  sai da fila até o fim da rodada. Se todos esgotarem, a rodada para. A próxima tenta de novo.
- **Mensagem de espera longa:** se o Google mandar esperar mais de 90 s, o robô desiste e não dorme.
- **Teto do site:** `limiteDia` (10) matérias por dia.
- **Conta:** 10 notícias são cerca de 13 a 20 chamadas, espalhadas em 4 modelos.
- **Cuidado:** a cota grátis real muda sem aviso. O robô descobre o limite pelo 429, sem quebrar, e o
  `/api/robo/status` mostra as chamadas por modelo no dia.
- **Sem extras:** artigos, traduções, sinopses, quizzes e títulos ficam fora da fase A, e a cota inteira fica para as
  notícias.

### 3.7 Autor, categoria e tags

- **Autor:**
  - **De onde vem:** `posts.author_id` = `post_authors.id` do autor de IA (mesmo id do site antigo). Ele aparece na
    página `/autores/<slug>`, que já existe.
  - **Como é escolhido:** entre os autores ativos de `ai_news_authors` da categoria escolhida, pela especialidade
    (`pickAuthorWithinCategory`). No empate, vai quem publicou há mais tempo.
  - **Sem autor ativo na categoria:** o candidato é descartado.
- **Categoria:**
  - o Gemini escolhe o slug entre as categorias de `categories` (`kind = 'news'`) que têm autor ativo;
  - fora dessa lista, o candidato é descartado;
  - grava 1 linha em `post_categories`.
- **Tags:**
  - até 8, com a palavra-chave sempre incluída, para o link interno `/tag/<palavra-chave>` nunca dar 404;
  - cada tag é procurada pelo `slug` em `tags` e, se não houver, também em `tag_redirects` (para reaproveitar a atual);
  - se não existir, é criada com `randomUUID()`.
- **Marcação da matéria:** `is_ai_generated = 1`, `origin = 'robo'`, `post_type = 'news'`, `focus_keyword` e
  `anilist_id` (só com `animeFocus = 'main'`).

### 3.8 Imagem de capa

- **De onde vem:** do RSS, do `og:image` ou do corpo da matéria original, a de maior largura (de preferência
  ≥ 1200 px).
- **Direitos:** são imagens de divulgação da fonte, usadas como o site antigo usava, com o link da fonte no fim do
  texto.
- **Cópia:**
  - **Formato:** convertida para WebP com 1280 px de largura (e a miniatura de 640 px) e gravada em
    `/media/robo/<sha1 do endereço, 24 hex>.webp`. O endereço é sempre o mesmo para a mesma imagem, então rodar de
    novo não duplica.
  - **Na matéria:** `featured_image` = `/media/robo/...webp`, com `image_width` e `image_height` medidos. A home só põe
    na capa grande as imagens com ≥ 1280 px, como hoje.
  - **Imagens do corpo:** até `imagensCorpo` (3), copiadas do mesmo jeito.
  - **Se a cópia falhar:** fica o endereço da fonte. GIF e SVG ficam como estão.
- **Sem nenhuma imagem utilizável:** o candidato é descartado antes do Gemini.

### 3.9 SEO

- **Canonical:** `VITE_SITE_URL` + `/noticias/<slug>`. A página `post.tsx` já monta, e a matéria do robô não muda isso.
- **Datas:**
  - `published_at` = o momento da publicação (UTC) e `created_at` igual;
  - o `NewsArticle` de `post.tsx` usa `published_at` como `datePublished`;
  - a matéria entra sozinha no `/sitemap-news.xml` (48 h), no `/sitemap.xml` das matérias e no `/rss.xml`, porque
    todos leem `posts` com `VISIBLE`.
- **Cache:** as páginas públicas têm `s-maxage=60`, então a matéria aparece na home em até 1 min. Se o cache das
  laterais ([plano-sidebars.md](plano-sidebars.md)) já existir, a publicação limpa esse cache.
- **Modo rascunho:** grava `status = 'draft'`, e a matéria fica fora de tudo (o `VISIBLE` exige `published`).
- **`reading_minutes`:** calculado com `readingMinutes()`.

## Parte 4 — Passos (na ordem)

Cada passo termina com `npm test` e `npm run build` passando, commit e push. Rotas novas usam `params` ou
`routePath(request)`, nunca `new URL(request.url).pathname`.

### Mínimo para a virada

1. **[Claude] P — Migration 012:** criar `db/migrations/012_robo_noticias.sql` com o SQL da 3.1 e colar o SQL no chat.
   **Verificar:** o deploy no `novo.` sobe sem erro de migration (logs pelo MCP), e
   `SELECT COUNT(*) FROM posts WHERE origin='old'` dá o total de matérias.
2. **[Claude] P — Importação que não apaga o robô:** alterar `import-old.server.ts` (3.3). Teste novo em
   `robot-db.test.ts`: uma matéria `origin='robo'` com categoria e tag continua igual depois de `applySnapshot`.
   **Verificar:** o teste passa.
3. **[Claude] P — Spoiler:** liberar `details` e `summary` em `sanitize.server.ts` e acrescentar o CSS do
   `.spoiler-box`. Teste: o `<details class="spoiler-box">` sobrevive à limpeza.
   **Verificar:** numa matéria antiga com spoiler (depois da exportação de 16/11), o trecho aparece fechado, abre com
   clique e com Enter, nos temas claro e escuro.
4. **[Claude] M — Funções puras:** portar `constants.ts`, `text.ts`, `prompt.ts`, `contract.ts`, `quality.ts`,
   `html.ts`, `model-chain.ts` e a parte pura de `rss`/`media`, com os testes antigos adaptados (rss, html,
   html-guard, quality, quality-autofix, prompt, model-chain, media, anime-names, titles do slug).
   Instalar `fast-xml-parser`, `@mozilla/readability`, `linkedom` e `zod`, e passar `sharp` para `dependencies`.
   **Verificar:** `npm test` com os testes novos verdes.
5. **[Claude] M — Rede e mídia:**
   - `rss.server.ts`, `scrape.server.ts`, `anilist-context.server.ts`, `gemini.server.ts` e `media.server.ts`;
   - `saveRobotMedia` em `media-import.server.ts`;
   - todo `fetch` com `AbortSignal.timeout` (20 s nas páginas e imagens, 120 s no Gemini) e o User-Agent
     `Mozilla/5.0 (compatible; AnimeProfileBot/1.0; +https://animeprofile.com.br)`.
   **Verificar:** teste do `media.server.ts` com uma imagem local (o `sharp` gera o WebP de 1280 px e o de 640 px no
   lugar certo, dentro de uma pasta temporária via `MEDIA_DIR`).
6. **[Claude] M — Banco do robô:** `config.server.ts`, `select.server.ts` e `publish.server.ts`.
   - **A publicação é uma transação só:** `posts`, `post_categories`, `post_tags` (tags criadas se faltarem) e o
     candidato marcado como `published` com o `post_id`.
   - **Slug:** `ensureSlug`. Se já existir em `posts`, recebe o sufixo `-<4 letras de Date.now().toString(36)>`, com
     até 5 tentativas.
   - **Testes com banco** (`robot-db.test.ts`):
     - a cota do dia (com `limiteDia = 2`, a terceira não sai);
     - a cota fora de anime;
     - a deduplicação pelo endereço da fonte (inclusive o `LIKE` no `content_html` antigo);
     - o título parecido;
     - o bloqueio de lista;
     - o autor por especialidade.
7. **[Dono] P + [Claude] P — Configuração do site antigo:**
   - **[Dono], até 16/11 de manhã:** rodar no editor SQL do Lovable Cloud a consulta abaixo e salvar o resultado
     (um JSON) em `C:\Users\evsli\animeprofile-backup\robo-config.json`. Não colar no chat (tem os prompts dos
     autores).
     ```sql
     select json_build_object(
       'sources', (select coalesce(json_agg(s), '[]') from (select id, name, base_url, rss_url, priority, active from ai_news_sources) s),
       'authors', (select coalesce(json_agg(a), '[]') from (select id, name, slug, category, system_prompt, auto_publish, active from ai_news_authors) a),
       'blacklist', (select coalesce(json_agg(b), '[]') from (select term, active from ai_news_blacklist) b),
       'topics', (select coalesce(json_agg(t), '[]') from (select topic, weight, active from ai_news_priority_topics) t),
       'slots', (select coalesce(json_agg(x), '[]') from (select * from ai_news_schedule_slots) x),
       'settings', (select coalesce(json_agg(x), '[]') from (select key, value from ai_news_settings) x),
       'system_config', (select coalesce(json_agg(x), '[]') from (select key, value_int from system_config where key like 'ai_news%') x),
       'recent_sources', (select coalesce(json_agg(c.source_url), '[]') from ai_news_candidates c where c.status = 'published' and c.created_at > now() - interval '7 days')
     );
     ```
     Se alguma coluna der erro, troque a lista daquela linha por `*` e anote.
   - **[Claude]:** `scripts/importar-config-robo.mjs <robo-config.json> [site]` (padrão `https://novo.animeprofile.com.br`).
     - Lê o JSON e extrai o guia editorial de `../animeprofile-old/src/lib/ai-news/worker/prompt.ts`: o texto entre
       ``const EDITORIAL_GUIDE = ` `` e `` `.trim(); ``, trocando `` \` `` por `` ` ``.
     - Envia por `POST /api/robo/config` (cabeçalho `x-cron-token`, corpo em gzip).
     - Imprime só contagens: fontes, autores, termos, horários e se o guia foi enviado.
   - **No servidor (`config-import.server.ts`), com "insere ou atualiza":**
     - fontes → `ai_news_sources`;
     - autores → `ai_news_authors`, só os que existem em `post_authors` com `kind = 'ai'`. Os outros são contados e
       ignorados;
     - lista negra e tópicos → `ai_news_terms`;
     - horários → `ai_news_schedule_slots` (com `posts_per_slot`, ou 1 se a coluna não existir);
     - `settings.model` e `system_config.ai_news_daily_cap` / `ai_news_non_anime_max_pct` /
       `ai_news_body_image_limit` → os campos de `system_config.robo` (sem mexer em `modo`);
     - `recent_sources` → candidatos com `status = 'published'` e `dedup_hash = sha1('fonte-antiga|' + url)`, só
       para a deduplicação.
   - **Verificar:** `/api/robo/status` mostra as fontes, os autores ativos por categoria, os horários e `guia: true`.
8. **[Dono] P — Chave do Gemini:** criar a chave no AI Studio, num projeto sem faturamento, e cadastrar
   `GEMINI_API_KEY` nas variáveis do app no hPanel (o app reinicia sozinho).
   **Verificar:** o `/api/robo/status` passa a mostrar `chave: true`. Ele mostra só se a chave existe, nunca o valor.
9. **[Claude] M — Rodada:** `run.server.ts` (Parte 2) e a tarefa `robo-noticias` em `jobs.server.ts`.
   - Com `modo = desligado`, a tarefa termina com `{ modo: "desligado" }`.
   - O prazo de 9 min é conferido antes de cada candidato. Se faltarem menos de 2,5 min, para e devolve à fila os
     selecionados não tratados.
   - `cron_runs.stats` recebe o resumo da Parte 2, item 7, sem prompt, sem texto gerado e sem chave.
10. **[Claude] P — Endpoints de operação (`app/routes/api.robo.ts`):**
    - **Proteção:** o mesmo `authorized()` de `api.cron.ts` (cabeçalho `x-cron-token` ou `?token=`). Sem token, 404.
      Respostas com `Cache-Control: no-store` e `X-Robots-Tag: noindex`.
    - **`GET /api/robo/status`:**
      - modo e chave presente (true/false);
      - fontes (ativas, falhando);
      - autores ativos por categoria e horários de hoje com a cota;
      - matérias do robô hoje;
      - chamadas por modelo nas últimas 24 h;
      - as 10 últimas rodadas.
    - **`GET /api/robo/modo?valor=desligado|ensaio|rascunho|publicar[&limiteDia=N]`:** grava `system_config.robo.modo`
      e, se vier, `limiteDia` (inteiro de 1 a 15; fora disso, 400). É assim que o robô liga, desliga e muda o teto,
      sem hPanel e sem deploy.
    - **`GET /api/robo/ensaio?limite=N`** (N de 1 a 3, padrão 1):
      - responde 202 e roda uma rodada **agora**, em modo ensaio, ignorando o horário e o teto do dia;
      - aparece em `cron_runs` como `robo-ensaio` (via `trackRun`);
      - o resultado fica em `ai_news_candidates.result_json`, com `status = 'rehearsal'`. **Não cria matéria.**
    - **`GET /api/robo/url?u=<endereço>`:** ensaio de um endereço só, no lugar do `--url` do antigo. Não grava em
      `posts`.
    - **`GET /api/robo/previa?id=<candidato>`:** página HTML simples (noindex) para conferir antes de publicar:
      - título, variantes, palavra-chave, meta description, resumo, categoria, autor escolhido, tags e capa;
      - o HTML já limpo pelo `sanitizePostHtml`;
      - o número de palavras e o resultado da checagem de qualidade.
      Serve para os candidatos `rehearsal` e `draft`.
    - **`POST /api/robo/config`:** recebe a configuração do passo 7.
    **Verificar:** sem token, 404 em todos; com token, `status` responde.
11. **[Claude] P — Ensaio no `novo.` (16/11, antes das 15h):**
    - `api/robo/url` com 2 matérias reais de fontes diferentes, e depois `api/robo/ensaio?limite=3`;
    - abrir as prévias e conferir: português natural, sem frases proibidas, ≥ 380 palavras, H2 informativos,
      "Para o fã brasileiro" só com contexto, a capa em `/media/robo/`, link da fonte no fim e nenhum spoiler no
      título;
    - mandar ao dono os 3 links de prévia (o dono abre com o token);
    - se a qualidade não bater, ajustar e repetir. Cada ensaio gasta cota do dia, então no máximo 3 ensaios.
    **Verificar:** 3 prévias aprovadas pelo dono, e `/api/robo/status` sem erro de fonte em massa.
12. **[Claude] P — Durante a exportação de 16/11 (15h):** o modo continua `ensaio` ou `desligado`. Depois da
    exportação, conferir que nenhuma matéria `origin='robo'` existe ainda (`/api/robo/status`).
13. **[Dono+Claude] P — Ligar na virada (17/11):**
    - **Quando:** depois do H+30 da [hora H](plano-virada-parcial.md) (DNS e SSL ok, workflows antigos desativados no
      H-60 e a última exportação feita no H-45).
    - **Como:** `GET https://animeprofile.com.br/api/robo/modo?valor=publicar&limiteDia=6&token=...` (teto de 6 no
      primeiro dia, pergunta 2).
    - **Na primeira rodada (minuto 20 da hora seguinte), conferir:**
      - a matéria abre em `/noticias/<slug>` com a capa;
      - o canonical é `https://animeprofile.com.br/noticias/<slug>`;
      - ela aparece no `/sitemap-news.xml` e no `/rss.xml`;
      - o autor de IA está certo, com a página dele listando a matéria.
    **Verificar:** no fim do dia 17, entre 4 e 6 matérias do robô. O dono olha 2 delas no celular.
14. **[Claude] P — Acompanhar:** nos dias 17 e 18, de manhã e à noite, `/api/robo/status` e os logs pelo MCP:
    fontes falhando, 429 e descartes por qualidade. No dia 18, se tudo estiver bem, o teto sobe para 10 com
    `/api/robo/modo?valor=publicar&limiteDia=10`.
15. **[Claude] P — Docs:** atualizar `docs/README.md` (status, próximos passos, pendências), `decisoes.md`,
    `arquitetura.md` (variável e tarefa) e `banco-de-dados.md` (tabelas `ai_news_*` da 012).

### Depois (fora do mínimo, em ordem)

1. **Painel admin do robô**, junto com as contas e o `/admin`: fontes, lista negra, tópicos, horários, autores,
   candidatos (marcar "publicar este" = `status selected`, como o antigo), aprovação de rascunhos e rodadas.
2. **Pontuação completa:** CTR por fonte e tópico (`performance.server.ts`, com `views_count`) e termos em alta
   (`trends.server.ts`).
3. **Extras no modelo secundário:** sinopses dos animes em português (a página de anime já espera), artigos e quizzes
   pedidos no painel e testes de título.
4. **Instagram e redes** (`satori` + `sharp`, já previsto em [arquitetura.md](arquitetura.md)).
5. **Firecrawl ou outro leitor** para fontes que bloqueiam o servidor, só se o dono decidir (pergunta 3).

## Cronograma até a virada

| Quando | Claude | Dono |
|---|---|---|
| **Dom 15/11 (noite)** | Passos 1 a 4 (migration, importação segura, spoiler, funções puras) | Passo 8 (chave do Gemini no hPanel), se der |
| **Seg 16/11, manhã até 14h** | Passos 5, 6, 9 e 10; deploy no `novo.` com `modo = desligado`; importação da configuração (passo 7); ensaio (passo 11) | Passo 7 (SQL no Lovable) logo cedo; aprovar as 3 prévias |
| **Seg 16/11, 15h** | Exportação de conteúdo já combinada; passo 12 | — |
| **Ter 17/11** | Passo 13 depois do H+30; passo 14 | Aprovar a ligação; olhar 2 matérias |
| **Qua 18/11** | Passo 14; `limiteDia` 10 se estiver tudo bem; passo 15 | — |

- **Se atrasar:**
  - o robô liga no dia 18 ou 19, e a lacuna sem notícias cresce 1 ou 2 dias, o que é aceitável;
  - nunca ligar `publicar` sem o ensaio aprovado;
  - o passo 2 (importação segura) é obrigatório antes de qualquer matéria do robô existir.
- **Corte, se o tempo apertar:**
  - o CSS do spoiler fica simples (o passo 3 continua, porque sem ele o spoiler aparece);
  - a prévia vira só JSON em vez de HTML;
  - a pontuação fica só com lista negra + tópicos + novidade.

## Riscos e cuidados

- **Importação apagando o robô:** o passo 2 vem antes de tudo. Depois da virada não há mais exportação, mas o ensaio
  de 16/11 e a última exportação de 17/11 acontecem com o código novo.
- **Fonte bloqueando o IP da Hostinger** (Cloudflare e afins): a fonte aparece como `failed` no status, e as outras
  seguem. Se a maioria falhar no ensaio, a pergunta 3 volta.
- **Reinício do app no meio da rodada** (deploy ou troca de variável): a rodada fica `running`. A próxima marca como
  `expired` depois de 20 min e devolve os candidatos. Não fazer deploy no minuto 20.
- **Memória e CPU:** um candidato por vez e imagens de no máximo 15 MB na entrada. O `sharp` processa uma imagem por
  vez.
- **`auto_publish` falso** em algum autor importado deixa as matérias dele em rascunho, invisíveis. Conferir no
  `/api/robo/status` depois do passo 7 e avisar o dono.
- **Segredos:**
  - `GEMINI_API_KEY` só no hPanel; nenhum log imprime chave, prompt ou o JSON da configuração;
  - o `robo-config.json` fica na pasta de backup, fora do repositório;
  - o guia editorial e as personas ficam no banco (pergunta 1);
  - antes de cada commit, `git status` sem arquivo fora das pastas conhecidas.
- **Variáveis do hPanel:** o Claude não altera pela API. O dono cadastra.
- **Robô antigo:** os workflows "AI News Worker" e "Social Post" são desativados no H-60 (já está na hora H). Se um
  deles rodar depois, chama `/api/public/ai-news/worker/*`, que dá 404 no site novo.
- **`sharp` em produção:** se o build da Hostinger não instalar o binário, o robô publica com a imagem da fonte, como
  o antigo fazia sem conversor. Conferir no ensaio que a capa saiu em `/media/robo/`.
- **Regras de sempre:** `routePath(request)` nas rotas, `npm run build` antes do push, migration nova com o SQL colado
  no chat, commit e push ao fim de cada passo.

## Como verificar (resumo)

- `npm test` e `npm run build` passam (testes novos: `robot.test.ts` e `robot-db.test.ts`).
- `GET /api/robo/status?token=...` mostra chave, guia, fontes, autores, horários e chamadas por modelo.
- Ensaio: `GET /api/robo/ensaio?limite=3&token=...` → em até 9 min, 3 candidatos `rehearsal` com prévia, e
  `SELECT COUNT(*) FROM posts WHERE origin='robo'` = 0.
- Depois de ligar: a matéria nova em `/noticias/<slug>`, no `/sitemap-news.xml` e no `/rss.xml`, com o canonical
  do domínio principal e a capa em `/media/robo/`.
- Repetição: a mesma fonte não gera duas matérias (`SELECT source_url, COUNT(*) FROM posts WHERE origin='robo' GROUP BY 1 HAVING COUNT(*) > 1` vazio).

## Perguntas em aberto (para o dono)

1. **Guia editorial e personas dos autores fora do git** (no banco, enviados pelo script a partir do repositório
   antigo e do JSON da configuração)? **Recomendação: sim.** O repositório é público, e o guia é a "receita" do
   robô. O código público fica só com a montagem do prompt.
2. **Primeiro dia publicando direto, com teto de 6** (subindo para 10 no dia 18), em vez de rascunho? **Recomendação:
   sim.** Sem painel, rascunho fica invisível e só atrasa. O ensaio com 3 prévias aprovadas faz o papel da revisão.
3. **Sem Firecrawl** (fontes que bloqueiam o servidor ficam de fora até o painel)? **Recomendação: sim.** O
   respawnou funciona sem, e o antigo só o usava como reserva.
4. **Manter a cota de 33% para notícias fora de anime** (games, filmes, apps com ligação otaku), como no site antigo?
   **Recomendação: sim.**
