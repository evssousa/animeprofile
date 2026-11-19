# Plano: painel admin com contador de visitas (base para os 4 sites)

**Status: passos 1 a 12 executados em 2026-11-19** (o dono respondeu com as recomendadas; faltam 13 a 16). Perguntas no fim. Executar **na ordem dos passos**.
Cada passo é uma entrega pequena com `npm run build`, testes, commit e push. Uma migration nova (`013_visitas.sql`):
o SQL vai colado no chat quando for criada (regra do dono).

## Objetivo

Ter em `/admin` um painel só do dono com as visitas do site, como o do site antigo: hoje, ontem, 7 dias, 30 dias e
total, gráfico dos últimos 30 dias, páginas mais vistas com título, origem do tráfego e dispositivos. A contagem é
própria, sem cookie e sem guardar IP, e funciona com a CDN da Hostinger guardando o HTML por 60 s. O código da contagem
e do painel fica num **módulo copiável** (`app/visitas/`), que depois vai para o criasite, o vibecoin e o respawnou com
poucas mudanças.

## Contexto

- **Hoje no site novo não existe nenhuma contagem.** O `posts.views_count` e o `blog_posts.views_count` estão
  **congelados** no número que veio do site antigo: nada no código novo soma visitas (conferido com busca por
  `views_count` em `app/`). Por isso o "Em alta" (30 dias, `ORDER BY p.views_count`) e o "Mais lidas" das laterais
  (`app/server/content/posts.server.ts`, linhas 146, 304 e 338; `app/server/blog/blog.server.ts`, linha 197) só mostram
  matérias antigas: as do robô ficam com 0 para sempre.
- **CDN com cache de 60 s** (`server-app.js`): as páginas públicas saem com `public, max-age=0, s-maxage=60,
  stale-while-revalidate=120` e sem cookie. O Node não vê a maioria das visitas, então contar no servidor ao montar a
  página não funciona.
- **Sem contas:** o login volta em semanas. `/admin/*` hoje cai em "volta em breve" (`ACCOUNT_PENDING` em
  `app/routes.ts`). O painel precisa de uma proteção própria até lá.
- **O que já existe e ajuda:**
  - `server-app.js` já põe `X-Robots-Tag: noindex, nofollow` e `Cache-Control: no-store` em `/admin` e `/api`;
  - `robots.txt` já tem `Disallow: /admin` e `Disallow: /api/`;
  - `isbot` já está instalado e em uso (`app/server/anime/remote-guard.server.ts`, `app/routes/quiz.tsx`);
  - `app/server/http.server.ts` tem `clientIp()` e `sameOrigin()`;
  - a tarefa `limpeza` (`app/server/cron/jobs.server.ts`, 4h30 de Brasília) é o lugar da retenção;
  - `app/server/cache.server.ts` (`cached()`) serve para guardar os títulos das páginas por 10 min.
- **Sites irmãos (respawnou, vibecoin, criasite) já têm:**
  - um painel `/admin` com login por variáveis de ambiente (`app/lib/admin/auth.server.ts`: e-mail + hash scrypt +
    `SESSION_SECRET`, cookie assinado, 5 erros por IP em 15 min), documentado em `respawnou/docs/admin.md`;
  - um contador simples (`POST /api/view`, `app/routes/view.ts`), chamado só pela página da matéria com
    `navigator.sendBeacon`, que soma `posts.views` (ignora bots, o admin logado e a mesma pessoa na mesma matéria em
    30 min, numa memória por IP).
  - **Nenhum deles tem painel de visitas.** É isso que este plano cria, já pensado para eles.
  - **Correção do pedido:** o respawnou também é React Router 8 + Express (tem `app/routes.ts`), igual aos outros.

## O que o painel do site antigo fazia

Arquivos: `src/routes/admin.index.tsx`, `src/lib/admin-analytics.functions.ts`, `src/hooks/use-page-view.ts`,
`src/routes/api/public/track-view.ts` e as migrations `20260621180656_...` (tabela `page_views`) e `20260701195628_...`
(blog). Retenção em `src/routes/api/public/hooks/lgpd-retention.ts` (24 meses).

**Coleta (navegador → API → tabela):**

1. `PageViewTracker` (no layout) disparava a cada troca de endereço, menos `/admin`. **Só com consentimento de
   cookies analíticos** (`readConsent().categories.analytics`): sem o banner aceito, nada era contado.
2. Identificação: um `session_id` aleatório no `localStorage` (`ap_pv_session`), renovado após 30 min parado; as UTM
   ficavam no `sessionStorage` (`ap_pv_utm`). Logado, mandava o token do Supabase e a visita ficava ligada à conta.
3. Nas matérias, esperava até 2,5 s pela `<meta name="ap-post-id">` para mandar o ID da matéria.
4. `fetch POST /api/public/track-view` com `keepalive` e `{ path, postId, blogPostId, sessionId, referrer, utm }`.
5. A API: ignorava `/admin`; ignorava robôs por regex no user-agent (`bot|spider|crawl|preview|fetch|monitor|
   lighthouse|axios|curl|wget`); país pelo `cf-ipcountry`; aparelho por regex (celular, tablet, computador); referrer
   reduzido ao domínio, com os próprios domínios descartados (navegação interna); descobria a matéria pelo slug;
   **anti-repetição:** mesma sessão + mesmo endereço em 10 s não contava.
6. **Uma linha por visita** em `page_views` (`occurred_at, path, post_id, blog_post_id, session_id, user_id,
   referrer_host, referrer_url, utm_*, country, device`). Um trigger somava `posts.views_count` e
   `blog_posts.views_count` a cada linha.

**O que o painel mostrava (admin):**

- Aviso vermelho de **queda de tráfego** (hoje até agora contra a média dos 7 dias anteriores no mesmo horário, ≤ −30%).
- Faixa "Hoje": **Online agora** (sessões nos últimos 5 min, com lista de quem), **Visitas** (páginas abertas hoje),
  membros ativos, cadastros, receita PIX e **leituras de posts**.
- **Tráfego** com abas Dia / Mês / Ano e escolha de data: gráfico de barras (recharts) de visitas e views de post por
  hora/dia/mês, com total do período, média por intervalo e **variação contra o período anterior**; exportar CSV.
- **Posts mais vistos** do período (título, categoria, views no período e no total, abrir e editar).
- **Origem do tráfego:** direto/sem referrer, Buscas, Redes sociais, Outros (backlinks), cada um com os domínios, %
  e um link de exemplo; lista de UTMs (`source · medium · campaign`).
- **Engajamento e dispositivos:** sessões, tempo médio, taxa de rejeição; computador, celular, tablet, outros.
- Problemas: lia linha a linha em páginas de 1.000 (lento com volume), contava só quem aceitava cookies e o
  `session_id` no `localStorage` exigia consentimento.

## Decisões de design (técnicas)

### 1. Coleta: sinal leve do navegador para `/api/v`, sem cookie

**Decisão:** um componente `<VisitBeacon />` no `App` de `app/root.tsx` manda um `navigator.sendBeacon("/api/v", ...)`
depois que a página abre no navegador e a cada troca de endereço. O servidor agrega na memória e grava no banco a cada
10 s. **Nada fica guardado no aparelho** (nem cookie, nem `localStorage`, nem `sessionStorage`).

**Por quê, e não contar no servidor:**

- Com o cache de 60 s da CDN, o Node não recebe a maioria dos pedidos de página. O beacon é um `POST` em `/api/*`
  (`no-store`), então **sempre** chega ao Node, mesmo quando o HTML veio do cache.
- Robôs de busca quase nunca executam JavaScript; os que executam são filtrados pelo `isbot`. Pré-carregamentos de link
  (`<link rel=prefetch>`, `prefetch="intent"` do React Router) não rodam o efeito, então não contam.
- É o mesmo caminho que os irmãos já usam (`sendBeacon` com `fetch keepalive` de reserva), só que no site inteiro.

**Formato do sinal** (corpo de até 1 KB, `Content-Type: text/plain`, para não haver pedido de pré-verificação):

```json
{ "p": "/noticias/slug-da-materia", "r": "https://www.google.com/", "u": "instagram|social|bio", "f": 1 }
```

- `p`: `location.pathname` (já vem codificado em ASCII). **Nunca** a query string (a busca do visitante não é
  guardada), nem o `#`.
- `r`: `document.referrer`, só quando `f = 1`.
- `u`: `utm_source|utm_medium|utm_campaign` da URL, só quando `f = 1` e se houver alguma UTM; senão `null`.
- `f`: `1` no primeiro sinal desta carga de página, `0` nas trocas de endereço por clique (o `document.referrer` não
  muda na navegação dentro do site, então só vale no primeiro).

**Regras no navegador** (`app/visitas/client/VisitBeacon.tsx`):

- Fica dentro de `App` (não do `Layout`): a página de erro (404/500, `ErrorBoundary`) não manda sinal.
- Não manda em `/admin` nem em `/api`.
- `useEffect` com dependência em `location.pathname` (trocar só `?tab=` ou `?v=` não conta outra página).
- Se `document.prerendering` for verdadeiro (pré-renderização do Chrome), espera o evento `prerenderingchange`.
- Se a aba abriu escondida (`document.visibilityState === "hidden"`, ex.: "abrir em nova aba"), espera ficar visível
  pela primeira vez; se a pessoa fechar sem ver, não conta.
- No `pageshow` com `event.persisted` (voltar pelo histórico com a página restaurada da memória), manda um sinal com
  `f = 0`.
- `sendBeacon` com `new Blob([json], { type: "text/plain" })`; se devolver `false`, `fetch` com `keepalive: true`,
  `credentials: "same-origin"` e erro ignorado.

**Regras no servidor** (`app/routes/api.v.ts` → `app/visitas/server/coleta.server.ts`), em ordem; qualquer recusa
responde `204` vazio (nunca erro, para não poluir o console de ninguém):

1. Só `POST`; `loader` responde `405`. Corpo acima de 1.024 bytes: ignora.
2. Cabeçalho `Sec-Purpose` ou `Purpose` contendo `prefetch`: ignora.
3. `Origin` presente e de outro host, ou `Sec-Fetch-Site` presente e diferente de `same-origin`: ignora.
4. Cookie do admin presente (`__ap_admin=`): ignora (o dono não se conta).
5. `user-agent` vazio ou `isbot(ua)`: soma 1 em **robôs ignorados** do dia e para.
6. Limite por pessoa: mais de 120 sinais por minuto do mesmo código de visitante (item 8): ignora o excesso (proteção
   contra quem quiser inflar números).
7. Valida `p`: começa com `/`, até 255 caracteres, só ASCII imprimível, sem `/admin` e `/api`; tira a barra final
   (menos em `/`). Classifica o tipo de página pela configuração do site (`config.ts`).
8. **Código do visitante:** `sha256(salDoDia + ip + "|" + ua + "|" + host)`, guardado só os primeiros 16 bytes.
   - `ip` vem de `clientIp()`; o IP puro nunca é gravado nem registrado em log.
   - O **sal do dia** é aleatório (32 bytes), fica em `system_config` (`visitas.sal`, JSON
     `{"dia":"2026-11-19","sal":"<hex>"}`, gravado como texto: nada de `CAST(? AS JSON)`), e é **trocado e apagado** no
     primeiro sinal de cada dia novo (dia de Brasília). Sem o sal antigo, os códigos de ontem não voltam a ser ligados a
     ninguém.
9. **Recarregamento rápido:** a mesma pessoa (código) no mesmo endereço em menos de **30 s** não conta outra página
   (memória `Map`, limpa a cada 5 min, teto de 50.000 chaves).
10. Conta no buffer:
    - **página vista** (no dia, no total e no endereço);
    - **visitante do dia** (o código vai para `visit_seen`; só conta se ainda não estava lá);
    - **entrada** (início de visita) quando `f = 1` e o referrer não é do próprio site. Só nas entradas contam a
      **origem**, o **aparelho**, o **navegador**, o **sistema** e o **idioma/país**;
    - `f = 1` com referrer do próprio site (recarregar, abrir link em nova aba): página vista, mas não entrada.
11. **Contador por matéria** (`posts.views_count`, `blog_posts.views_count`): soma 1 se a mesma pessoa não abriu o mesmo
    endereço nos últimos **30 min** (mesma janela dos irmãos). Ver a decisão 6.

**Buffer e gravação:** os contadores ficam num objeto em memória e um `setInterval(10_000)` (com `.unref()`) grava tudo
de uma vez com `INSERT ... ON DUPLICATE KEY UPDATE n = n + VALUES(n)` (o mesmo `VALUES()` que o `upsert` da importação
já usa e que o MariaDB aceita). Se a gravação falhar, os números voltam para o buffer e tentam no ciclo seguinte (teto de
20.000 chaves; acima disso descarta e registra `console.error`). Um reinício do app perde no máximo 10 s de contagem.

### 2. Armazenamento: agregado por dia, nunca uma linha por visita

Migration nova `db/migrations/013_visitas.sql` (compatível com MariaDB: sem JSON, sem funções do MySQL 8). Dia = data
de Brasília, calculada no Node com `Intl` e `TZ` de `app/server/cron/schedule.ts`.

```sql
-- 013: contador de visitas próprio, sem cookie (docs/plano-painel-visitas.md).
-- Tudo agregado por dia de Brasília. Nada de IP nem de identificador permanente.

-- Totais do dia: páginas vistas, entradas (inícios de visita), visitantes aproximados e robôs ignorados.
CREATE TABLE IF NOT EXISTS visit_daily (
  day DATE NOT NULL PRIMARY KEY,
  pageviews INT UNSIGNED NOT NULL DEFAULT 0,
  entries INT UNSIGNED NOT NULL DEFAULT 0,
  visitors INT UNSIGNED NOT NULL DEFAULT 0,
  bots INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Páginas vistas por endereço e dia. O endereço vem de location.pathname (ASCII), sem query string.
CREATE TABLE IF NOT EXISTS visit_pages (
  day DATE NOT NULL,
  path VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind VARCHAR(20) CHARACTER SET ascii NOT NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  entries INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path),
  KEY idx_visit_pages_kind (day, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contagens por dimensão e dia, só nas entradas: origem, domínio de origem, campanha, aparelho, navegador, sistema, idioma/país.
CREATE TABLE IF NOT EXISTS visit_dims (
  day DATE NOT NULL,
  dim VARCHAR(16) CHARACTER SET ascii NOT NULL,
  value VARCHAR(120) NOT NULL,
  n INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, dim, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Códigos de visitante do dia (hash com sal diário), só para não contar a mesma pessoa duas vezes no dia.
-- A limpeza apaga tudo o que não é de hoje.
CREATE TABLE IF NOT EXISTS visit_seen (
  day DATE NOT NULL,
  vhash BINARY(16) NOT NULL,
  PRIMARY KEY (day, vhash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Dimensões (`visit_dims.dim`) e valores:**

| `dim` | Valores |
|---|---|
| `origem` | `direto`, `busca`, `social`, `site`, `campanha` |
| `ref_busca` / `ref_social` / `ref_site` | domínio sem `www.` (ex.: `google.com`, `instagram.com`, `myanimelist.net`) |
| `campanha` | `source / medium / campaign` (minúsculas, até 120 caracteres) |
| `aparelho` | `celular`, `computador`, `tablet` |
| `navegador` | `Chrome`, `Safari`, `Edge`, `Firefox`, `Samsung Internet`, `Opera`, `App do Instagram`, `App do Facebook`, `Outro` |
| `sistema` | `Android`, `iOS`, `Windows`, `macOS`, `Linux`, `ChromeOS`, `Outro` |
| `idioma` | primeira língua do `Accept-Language` (ex.: `pt-BR`, `en-US`); vira `pais` se a CDN mandar um cabeçalho de país (passo 14) |

**Visitantes únicos:** contados por dia (`visit_daily.visitors`). Para 7 e 30 dias **não dá para somar** (a mesma pessoa
em dias diferentes contaria várias vezes), então o painel mostra "média de visitantes por dia" nesses períodos e diz
isso no texto. Total de visitantes não aparece.

**Volume estimado** (páginas vistas por dia; endereços distintos por dia estimados em ~30%, ~15% e ~6%):

| Páginas vistas/dia | Linhas novas por dia (`pages` + `dims`) | `visit_seen` (só o dia) | Por ano (13 meses guardados) | Gravações no banco |
|---|---|---|---|---|
| 1.000 | ~300 + ~80 | ~500 linhas | ~140 mil linhas, ~20 MB | ≤ 5 comandos a cada 10 s |
| 10.000 | ~1.500 + ~150 | ~4.000 linhas | ~650 mil linhas, ~90 MB | ≤ 5 comandos a cada 10 s |
| 100.000 | ~6.000 + ~300 | ~35.000 linhas | ~2,5 milhões de linhas, ~350 MB | ≤ 5 comandos a cada 10 s (lotes maiores) |

Comparação: no modelo do site antigo (uma linha por visita) seriam 365 mil, 3,6 milhões e 36 milhões de linhas por ano.

**Retenção (dentro da tarefa `limpeza`, 4h30):**

- `visit_seen`: apaga `day < hoje` (o código de ontem perde o sentido junto com o sal).
- `visit_pages` e `visit_dims`: apaga o que tem mais de **400 dias** (13 meses, para comparar com o mesmo mês do ano
  anterior). O prazo fica numa constante em `app/visitas/config.ts` (`retencaoDias`).
- `visit_daily`: **sem prazo** (uma linha por dia, sem dado pessoal; é o "Total").

### 3. O que o painel mostra

Uma tela só, `/admin` (no animeprofile ainda não há outras telas de admin). Ordem: números do período → gráfico →
detalhes.

1. **Cinco cartões:** Hoje (até agora), Ontem, 7 dias, 30 dias, Total.
   - Número grande: **páginas vistas**.
   - Linha de baixo: visitantes do dia (Hoje e Ontem) ou média de visitantes por dia (7 e 30 dias); no Total, "desde
     DD/MM/AAAA" (primeiro dia em `visit_daily`).
   - Variação: Ontem contra anteontem, 7 dias contra os 7 anteriores, 30 contra os 30 anteriores. Hoje não tem variação
     (o dia ainda não acabou); mostra "até HH:MM".
2. **Gráfico de linha dos últimos 30 dias** (29 dias fechados + hoje parcial): páginas vistas e visitantes. Tabela com os
   mesmos números logo abaixo, em `<details>`.
3. **Detalhes do período** escolhido (Hoje, 7 dias, 30 dias; padrão 7 dias), por `?p=hoje|7d|30d` na URL:
   - **Páginas mais vistas**, com título e filtro por tipo (`?tipo=`): Tudo, Matérias, Animes, Quiz, Blog, Outras.
     10 itens; "Mostrar 25" (`?mais=1`).
   - **De onde vêm** (por entrada): Direto, Busca, Redes sociais, Outros sites, Campanhas (UTM), cada um abrindo os
     domínios/campanhas; e a linha "Navegação dentro do site: N páginas · X páginas por visita"
     (`(pageviews − entries) / entries`), que responde ao "internos".
   - **Aparelho**, **Navegador** e **Sistema** (por entrada).
   - Rodapé: robôs ignorados no período, e a frase de privacidade.
4. **"Agora"** no topo: pessoas diferentes nos últimos 5 min (códigos do `Map` de recarregamento com horário nos últimos
   5 min). Só na memória do processo; o texto diz "aprox.".

Fica de fora (com motivo): tempo médio e rejeição (pediriam sessão no aparelho), CSV e aviso de queda (dá para pôr depois
com os mesmos dados), lista de quem está online (depende de contas).

### 4. Proteção do `/admin` sem contas

**Decisão:** copiar o login dos irmãos (`respawnou/app/lib/admin/auth.server.ts`), que já está testado em produção, com
três ajustes: `SameSite=Strict`, limite global de tentativas e nome de cookie próprio.

- **Variáveis no hPanel** (nunca no git): `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (hash scrypt no formato
  `scrypt:N:r:p:salt:hash`, sem `$`), `SESSION_SECRET` (32+ caracteres; já está prevista em `docs/arquitetura.md` para as
  contas). O hash e o segredo saem de `npm run admin:hash` no computador do dono (script copiado de
  `criasite/scripts/admin-hash.ts`). Sem as três, `/admin/login` mostra "Painel ainda não configurado" com a lista do
  que falta (só nomes).
- **Comparação em tempo constante:** a senha sempre passa pelo scrypt (mesmo com e-mail errado) e o resultado é comparado
  com `timingSafeEqual`.
- **Limite de tentativas (memória):** 5 erros por IP em 15 min bloqueiam aquele IP; e **30 erros no total** em 15 min
  bloqueiam o login de todos por 15 min (contra tentativa espalhada por muitos IPs). Mensagem: "Muitas tentativas. Espere
  15 minutos."
- **Sessão:** cookie `__ap_admin` assinado (`createCookieSessionStorage` do React Router), `HttpOnly`, `Secure` em
  produção, `SameSite=Strict`, 7 dias.
  - **`Path=/`, e não `/admin`:** lição do respawnou. A navegação por clique pede `/admin.data`, que fica fora do
    caminho `/admin`, e o painel quebrava. O cookie só é **lido** nas rotas de `/admin` e no `/api/v` (para não contar
    o dono); as páginas públicas não o leem, então o HTML que a CDN guarda é o mesmo para todos.
  - Com `Strict`, abrir `/admin` a partir de um link em outro site (ex.: WhatsApp) pede login de novo. Aceitável para um
    só usuário.
- **Formulários:** toda `action` confere `sameOrigin()`; `/admin/sair` só por `POST`.
- **Fora do Google:** `noindex` na `meta` das telas, `X-Robots-Tag` e `no-store` (já no `server-app.js`),
  `Disallow: /admin` (já no `robots.txt`), nenhuma ligação nos menus, fora dos sitemaps.
- **Troca pelo login das contas (quando voltarem):** as rotas chamam só `requireAdmin(request)`. Quando as contas
  existirem, essa função passa a ler a sessão `ap_session` e conferir o papel `admin` em `user_roles`; `/admin/login`
  passa a levar para `/login?volta=/admin`; as três variáveis `ADMIN_*` saem; no `/api/v`, "não contar o dono" passa a
  ser "não contar sessão com papel admin". Nada do módulo de visitas muda.

### 5. Reaproveitamento nos outros sites

Tudo o que é genérico fica em `app/visitas/`. Só `config.ts` e `db.ts` mudam de um site para outro.

```
app/visitas/
  README.md                 como instalar num site (passo a passo curto, lista abaixo)
  config.ts                 ESPECÍFICO DO SITE: nome, hosts próprios, cookie do admin, tipos de página, títulos, contadores, retenção
  db.ts                     ESPECÍFICO DO SITE: reexporta query/exec do banco do site (adaptador de 3 linhas)
  core/caminho.ts           normaliza o endereço e classifica o tipo pela config (puro)
  core/origem.ts            referrer + UTM → origem e domínio (puro)
  core/ua.ts                user-agent → aparelho, navegador, sistema (puro, sem biblioteca)
  core/dia.ts               dia de Brasília, intervalos (hoje, ontem, 7d, 30d) e "anterior" (puro)
  server/sal.server.ts      sal diário em system_config
  server/coleta.server.ts   validação do sinal, código do visitante, recarregamento, buffer e gravação
  server/consultas.server.ts leituras do painel (cartões, série de 30 dias, páginas, dimensões, robôs, agora)
  server/limpeza.server.ts  retenção (chamada pela tarefa de limpeza do site)
  client/VisitBeacon.tsx    o sinal no navegador
  ui/visitas.css            variáveis --vp-* mapeadas para as cores do site (12 linhas por site)
  ui/Painel.tsx             a tela inteira (recebe os dados do loader)
  ui/Cartoes.tsx ui/Grafico.tsx ui/Paginas.tsx ui/Origem.tsx ui/Dimensoes.tsx ui/Periodo.tsx
  sql/visitas.sql           cópia da migration (o site cria com o número seguinte)
```

Regras do módulo: nada dentro de `app/visitas/` importa de fora dele, exceto `db.ts` (banco), `isbot` e `react-router`.
O login do admin **não** faz parte do módulo (os irmãos já têm o deles).

**`config.ts` (contrato):**

```ts
export type TipoPagina = { tipo: string; rotulo: string; re: RegExp };
export const VISITAS = {
  site: "Anime Profile",
  hosts: ["animeprofile.com.br", "www.animeprofile.com.br", "localhost"], // referrer daqui = interno
  cookieAdmin: "__ap_admin",            // presença = não conta
  retencaoDias: 400,
  tipos: [ /* ordem importa: o primeiro que bate vence */ ] as TipoPagina[],
  filtros: [ /* abas do "Páginas mais vistas": { tipo, rotulo } */ ],
  titulos: async (porTipo: Map<string, string[]>) => new Map<string, string>(), // endereço → título
  contadores: [ /* { re, sql } que somam o contador da matéria */ ],
};
```

**O que muda em cada irmão** (cada um é uma entrega M, depois de o animeprofile rodar 3 a 7 dias sem problema):

| Site | Banco (`db.ts`) | Painel | Contador por matéria | Outras mudanças |
|---|---|---|---|---|
| criasite | o `db`/`query` de `app/lib/` do site (conferir o nome ao copiar) | nova filha `visitas` na rota `admin` + item no menu do `layout.tsx`/shell; cartões Hoje/7 dias no `home.tsx` | `posts.views` pelo `/<seção>/<slug>` (o que o `routes/view.ts` dele faz hoje) | tipos: ferramentas, guias, notícias, trilha; `cookieAdmin` do site; ligar `limparVisitas()` na tarefa de limpeza dele |
| vibecoin | idem | idem | `posts.views` (alimenta "Mais lidas", 7 dias) | tipos: matérias por editoria, guias, cotações; mapear `visitas.css` para o tema "Dia e Noite" |
| respawnou | `~/lib/db.server` (`db()`) | idem (`app/routes/admin/*`, `AdminShell` em `app/components/admin-ui.tsx`) | `posts.views` por `section` + `slug` | tipos: editorias (`noticias`, `artigos`, `reviews`, `guias`, `promocoes`), `jogos/:slug`, `arcade/:slug`, `plataforma/:slug`; corrigir o texto da página `/cookies` ("Métricas: ainda não usamos") |

Em todos os irmãos: tirar o `useEffect` do beacon de `app/routes/post.tsx`, pôr `<VisitBeacon />` no `App` do `root.tsx`,
e deixar o `POST /api/view` antigo respondendo `204` sem fazer nada por 7 dias (o HTML em cache da CDN ainda chama o
endereço antigo por alguns minutos; 7 dias dá folga), depois apagar.

### 6. `posts.views_count` volta a andar, pela mesma coleta

- **Decisão:** o mesmo `/api/v` soma `posts.views_count` (matérias `/noticias/:slug` e `/artigos/:slug`) e
  `blog_posts.views_count` (`/blog/:usuario/:slug`), com as mesmas regras de robô, prefetch e admin, mais a janela de
  30 min por pessoa e matéria. A soma vai no buffer e é gravada a cada 10 s com
  `UPDATE posts SET views_count = views_count + ? WHERE slug = ? AND status = 'published'` (um comando por matéria que
  mudou no ciclo).
- O número continua do ponto em que o site antigo parou (soma em cima do importado).
- **Proteção na importação:** `app/server/content/import-old.server.ts` grava `views_count = VALUES(views_count)` e
  zeraria a contagem nova se alguém rodar a exportação de novo. Passa a gravar
  `views_count = GREATEST(views_count, VALUES(views_count))` em `posts` e `blog_posts`.
- As laterais têm cache de 5 a 10 min (`cached()`): o "Em alta" reage em minutos, não na hora. Normal.

## Decisões de design (visual)

**Direção visual:** um painel de leitura rápida no padrão "Top 10 claro": página clara, cartões brancos com borda fina, e
**um único bloco escuro** (o cartão "Hoje"), como os painéis escuros da home. Nada de painel "dashboard genérico" com
sombras pesadas, gradientes ou 12 cores. O olho vê primeiro o número de hoje, depois a curva de 30 dias, por último as
listas.

### Tokens

Usar as variáveis de `app/app.css` (claro / escuro): `paper` `#faf7f7`/`#121014`, `surface` `#ffffff`/`#1b171a`,
`sunken` `#f4eded`/`#231e21`, `ink` `#1c1414`/`#f4eff0`, `ink-soft` `#6e5f5f`/`#ab9d9f`, `line` `#efe6e6`/`#2f282b`,
`brand` `#c2352b`, `brand-soft` `#fbedec`/`#3a1b19`, `night` `#0d0d10`/`#0b0b0e`, `night-ink` `#f4f4f6`, `glow`
`#ff9a90`. Foco: contorno 2 px `#2b5bd7`, afastado 2 px (padrão do site).

`app/visitas/ui/visitas.css` define, num seletor `.vp` (o contêiner do painel), as variáveis que os componentes usam, para
o módulo ser copiado e só este bloco mudar:

```css
.vp {
  --vp-bg: var(--paper); --vp-card: var(--surface); --vp-sunken: var(--sunken);
  --vp-ink: var(--ink); --vp-soft: var(--ink-soft); --vp-line: var(--line);
  --vp-accent: var(--brand); --vp-accent-soft: var(--brand-soft);
  --vp-hero: var(--night); --vp-hero-ink: var(--night-ink); --vp-hero-label: var(--glow);
  --vp-up: #1f7a4d; --vp-down: #b42318;
  --vp-o-direto: #6e5f5f; --vp-o-busca: #2f6fd6; --vp-o-social: #c2352b; --vp-o-site: #b7791f; --vp-o-campanha: #2e8b62;
}
[data-theme="dark"] .vp {
  --vp-up: #4cc98f; --vp-down: #ff8a80;
  --vp-o-direto: #ab9d9f; --vp-o-busca: #6f9cf0; --vp-o-social: #ff7a6e; --vp-o-site: #f0b04a; --vp-o-campanha: #4cc98f;
}
```

- **Fonte:** Sora (já carregada). Números sempre com `tabular-nums`. Formato `Intl.NumberFormat("pt-BR")`; acima de
  10.000 no eixo do gráfico, forma curta ("12 mil").
- **Tamanhos:** título da tela 28/800 (`tracking-[-0.02em]`); título de cartão 16/700; rótulo 11/700 maiúsculas com
  `tracking-[0.08em]`; número do cartão 32/800 (Hoje: 44/800); texto 14/400; texto pequeno 12–13.
- **Espaços:** contêiner `max-w-[1200px] mx-auto px-4 sm:px-6`, `py-6 sm:py-8`; distância entre blocos 24 px; padding
  dos cartões 16 px (celular) / 20 px (≥ 640).
- **Raios:** cartões 14 px; botões/abas 999 px (pílula); barras 6 px.
- **Sombra:** só no claro, `0 1px 2px rgba(28,20,20,.06)`; no escuro, nenhuma (a borda basta).

### Estrutura da tela

**Cabeçalho do painel** (substitui o topo do site em `/admin`; o `root.tsx` esconde `Header`, `SideNav`,
`AvisoContas`, `Footer` e `BottomNav` quando o endereço começa com `/admin`, como o respawnou faz):

- Faixa `night`, 56 px, `px-4 sm:px-6`. Esquerda: `Logo` (`app/components/layout/Logo.tsx`, a versão do topo escuro)
  + selo "Painel" (11/700 maiúsculas, cor `glow`, borda 1 px `glow` a 40%, pílula, `px-2 py-0.5`).
- Direita: pílula "Agora: 12" (ponto verde 8 px `#4cc98f` que pulsa de 1 → 0,4 de opacidade em 2 s; parado com
  "reduzir movimento"; `title="Pessoas diferentes nos últimos 5 minutos (aproximado)"`), `ThemeToggle`
  (`app/components/layout/ThemeToggle.tsx`), link "Ver o site ↗" (`target="_blank"`) e botão "Sair" (form `POST
  /admin/sair`, ícone `LogOut` 16 px).
- Celular (< 640): fica Logo + selo à esquerda; à direita, só `ThemeToggle` e o ícone de sair (alvo de 44 px). "Agora" e
  "Ver o site" descem para a linha do título.

**Linha do título:** `h1` "Visitas" e, embaixo, em `ink-soft` 14 px: "Contagem própria, sem cookies · horário de
Brasília · atualizado às 14:32". Em ≥ 640, à direita do título fica o link "Ver o site ↗".

**Faixa de cartões** (grade):

- ≥ 1024: 5 colunas iguais, `gap-3`.
- 640–1023: `grid-cols-6`; Hoje `col-span-6` (linha inteira); Ontem, 7 dias e 30 dias `col-span-2` cada; Total
  `col-span-6` (linha inteira, mais baixo: número e "desde" lado a lado).
- < 640: `grid-cols-2`; Hoje `col-span-2`, depois Ontem e 7 dias, depois 30 dias e Total.
- **Cartão Hoje (o destaque):** fundo `--vp-hero`, texto `--vp-hero-ink`, rótulo "HOJE" em `--vp-hero-label`, número
  44/800, linha "1.234 visitantes · até 14:32" em `night-ink` a 70%. Sem borda.
- **Demais cartões:** fundo `--vp-card`, borda 1 px `--vp-line`, rótulo em `--vp-soft`, número 32/800 em `--vp-ink`,
  linha de visitantes 13 px `--vp-soft`, e a **variação** como texto pequeno: "▲ 12%" em `--vp-up` ou "▼ 8%" em
  `--vp-down`, com `aria-label="12% a mais que nos 7 dias anteriores"`. Sem base (anterior = 0): "—".
- Total: número + "desde 19/11/2026" no lugar da variação.

**Cartão do gráfico** (largura total):

- Topo: "Últimos 30 dias" (16/700) à esquerda; legenda à direita: traço sólido 16×2 px `--vp-accent` "Páginas vistas" e
  traço tracejado `--vp-soft` "Visitantes".
- Área do gráfico: altura 220 px (≥ 640) e 180 px (< 640). Técnica (sem biblioteca):
  - Um `<svg viewBox="0 0 1000 220" preserveAspectRatio="none" class="w-full h-full">` só com linhas e área;
    `vector-effect="non-scaling-stroke"` em todas as linhas para a espessura não distorcer.
  - **Páginas vistas:** linha 2 px `--vp-accent`, cantos `stroke-linejoin="round"`, área embaixo com
    `--vp-accent` a 10% de opacidade (`fill-opacity="0.1"`).
  - **Visitantes:** linha 1,5 px `--vp-soft`, `stroke-dasharray="4 3"`.
  - **Hoje (parcial):** o último trecho (ontem → hoje) das duas linhas é tracejado `2 3`, e o ponto de hoje é um círculo
    vazado de 4 px; o rótulo do dia no eixo diz "hoje".
  - **Grade:** 5 linhas horizontais (0, ¼, ½, ¾ e o máximo "redondo": 1, 2 ou 5 × 10ⁿ acima do maior valor), 1 px
    `--vp-line`. Fins de semana com faixa vertical `--vp-sunken` a 60% atrás das linhas.
  - **Rótulos dos eixos em HTML** (não no SVG, para não deformar): valores do eixo Y à esquerda (12 px `--vp-soft`,
    alinhados à direita, coluna de 44 px); datas no eixo X a cada 7 dias (≥ 640) ou 10 dias (< 640), "dd/mm",
    posicionadas por porcentagem (`left: i/29*100%`, `translateX(-50%)`).
  - **Passar o mouse:** 30 colunas invisíveis por cima (`flex`, uma por dia). Na coluna sob o ponteiro: linha vertical
    1 px `--vp-ink` a 30%, pontos de 4 px nas duas linhas e uma dica (cartão `--vp-card`, borda `--vp-line`, raio 10 px,
    12 px de texto, sombra `0 4px 16px rgba(0,0,0,.12)`): "qua, 18/11 · 3.210 páginas · 1.140 visitantes" (+ "parcial" em
    hoje). A dica troca de lado perto da borda direita. Some ao sair. Transição de 120 ms na opacidade (nenhuma com
    "reduzir movimento").
- **Acessibilidade:** o `<svg>` tem `role="img"` e `aria-label` com o resumo ("Páginas vistas nos últimos 30 dias: de
  1.020 a 3.400 por dia, total 58.200"). As colunas de mouse são `aria-hidden`. Logo abaixo, `<details>` com o resumo
  "Ver os números em tabela" (13 px, `--vp-accent`): tabela Dia | Páginas vistas | Visitantes | Entradas, cabeçalho
  fixo em `--vp-sunken`, números à direita, `max-h-80 overflow-auto`, hoje marcado "(parcial)".

**Seletor de período dos detalhes:** linha com o título "Detalhes" (18/700) e, à direita (no celular, embaixo e com
largura total), um controle segmentado com 3 links: Hoje · 7 dias · 30 dias (`?p=`, mantendo `?tipo=`). Contêiner
`--vp-sunken`, pílula, `p-1`; item `h-9` (`h-11` no celular), `px-4`, 13/600; ativo com fundo `--vp-card`, texto
`--vp-ink`, sombra leve e `aria-current="page"`; inativo `--vp-soft`, passa a `--vp-ink` no hover. Funciona sem
JavaScript (é link); com JavaScript, `preventScrollReset`.

**Grade dos detalhes:**

- ≥ 1024: 12 colunas. "Páginas mais vistas" `col-span-7`; "De onde vêm" `col-span-5`. Abaixo, 3 cartões iguais
  (Aparelho, Navegador, Sistema), `grid-cols-3`.
- < 1024: uma coluna, nessa ordem; os 3 cartões ficam `grid-cols-3` em 640–1023 e em coluna única abaixo de 640.

**Cartão "Páginas mais vistas":**

- Título + filtros como pílulas (links `?tipo=`): Tudo, Matérias, Animes, Quiz, Blog, Outras. Pílula `h-8`
  (`h-11` no celular, com rolagem horizontal da fileira sem barra visível e máscara de esmaecer na borda), `px-3`, 12/600,
  borda 1 px `--vp-line`; ativa com fundo `--vp-accent-soft`, texto e borda `--vp-accent`.
- Lista numerada (`<ol>`), cada item um link que abre a página em nova aba:
  - grade `[28px | 1fr | auto]`, altura mínima 52 px, `px-3`, raio 10 px, hover `--vp-sunken`;
  - posição (13/800, `--vp-soft`);
  - título (14/600, `--vp-ink`, uma linha com reticências) e, embaixo, o endereço (12 px, `--vp-soft`, reticências);
    na aba "Tudo", antes do endereço, o tipo em 11/700 maiúsculas ("MATÉRIA · /noticias/...");
  - à direita: número (14/700) e porcentagem do período (12 px `--vp-soft`);
  - **barra de fundo:** um `div` absoluto atrás do conteúdo, largura = vistas ÷ maior da lista, cor
    `--vp-accent-soft`, raio 10 px (fica como um "preenchimento" discreto da linha);
  - ícone `ExternalLink` 14 px aparece no hover e no foco.
- Título não encontrado (matéria apagada, anime sem ficha): mostra o endereço como título e "(sem título)" em
  `--vp-soft`.
- Embaixo: link "Mostrar 25" / "Mostrar 10" (`?mais=1`).

**Cartão "De onde vêm":**

- Título + subtítulo 12 px `--vp-soft` "por visita (primeira página aberta)".
- **Barra empilhada** de 100%, 12 px de altura, pílula, segmentos nas cores `--vp-o-*` separados por 2 px de
  `--vp-card`; segmento abaixo de 1% não aparece.
- Lista das 5 origens: bolinha 10 px da cor, nome (14/600), número (tabular) e % (`--vp-soft`). Cada origem, menos
  Direto, é um `<details>` com seta (`ChevronDown` 14 px que gira 180° ao abrir, 150 ms) e abre os 8 maiores domínios
  ou campanhas em linhas de 13 px com número e %. Origem com zero: linha esmaecida (opacidade 50%), sem seta.
- Linha final, separada por borda `--vp-line`: "Navegação dentro do site: 3.210 páginas · 2,4 páginas por visita".

**Cartões "Aparelho", "Navegador", "Sistema":**

- Título 16/700; até 5 linhas + "Outros" somado.
- Cada linha: rótulo 14 px (em Aparelho, com ícone `Smartphone` / `Monitor` / `Tablet` de 16 px em `--vp-soft`), % à
  direita (14/700) e número (12 px `--vp-soft`); embaixo, trilha de 6 px `--vp-sunken`, pílula, com o preenchimento
  `--vp-accent` (Aparelho) ou `--vp-soft` (os outros dois) na largura da %.

**Rodapé da tela:** 12 px `--vp-soft`, centralizado: "Robôs ignorados no período: 312 · Sem cookies e sem guardar IP
(só um código que muda todo dia) · Visitantes são aproximados."

### Estados

- **Sem nenhum dado ainda** (`visit_daily` vazia): cartões com "0" e "—"; no lugar do gráfico, uma linha reta tracejada
  `--vp-line` e o texto centralizado "As visitas aparecem aqui alguns segundos depois que alguém abrir o site." (14 px
  `--vp-soft`, ícone `BarChart3` 24 px acima); listas com "Nenhuma visita neste período."
- **Período sem dados** (ex.: "Hoje" às 0h05): cada lista diz "Nenhuma visita neste período."
- **Carregando** (trocando `?p=`/`?tipo=`): o bloco de detalhes recebe `aria-busy="true"` e `opacity-60`
  (`transition-opacity 150ms`), a partir de `useNavigation().state !== "idle"`. A primeira carga é do servidor, sem
  esqueleto.
- **Erro do banco:** o `loader` devolve `{ erro: true }` em vez de lançar; a tela mostra um aviso em `--vp-accent-soft`
  com borda `--vp-accent` a 40%: "Não deu para ler as visitas agora. Tente de novo em instantes." e o link "Tentar de
  novo" (recarrega). O cabeçalho continua funcionando.
- **Login** (`/admin/login`, sem o topo do site): fundo `paper`, cartão central `max-w-sm` em `--vp-card`, raio 16 px,
  `p-6`; acima do cartão, `Logo` sobre uma faixa `night` arredondada de 64 px; título "Painel do Anime Profile" 20/800;
  campos e botão de `app/components/form.tsx` (botão `brand`, largura total, `h-11`); erro em aviso; estado "não
  configurado" com a lista de problemas (só nomes) e "Depois de salvar no hPanel, o app reinicia; recarregue esta
  página."; estado bloqueado com a mensagem de espera.

### Reuso no animeprofile

- `app/components/layout/Logo.tsx` e `ThemeToggle.tsx` (topo do painel e login);
- `app/components/form.tsx` (campos, botão e avisos do login);
- `app/server/http.server.ts` (`clientIp`, `sameOrigin`); `app/server/cache.server.ts` (`cached`, títulos por 10 min);
- `isbot` (já é dependência); ícones `lucide-react` (já é dependência).

### Critério de pronto (visual)

Conferir com print em **1440 px** e **375 px**, nos temas **claro e escuro** (4 prints), com dados reais de pelo menos
um dia:

- em 1440: 5 cartões numa linha, "Hoje" escuro; gráfico com área clara sob a linha vermelha, visitantes tracejado,
  trecho de hoje tracejado, faixas de fim de semana; "Páginas mais vistas" à esquerda (mais largo) e "De onde vêm" à
  direita; 3 cartões embaixo;
- em 375: "Hoje" ocupando a largura, depois 2 colunas; gráfico com datas a cada 10 dias sem texto sobreposto; filtros
  de tipo com rolagem lateral só dentro da fileira; **nenhuma rolagem horizontal da página**;
- passar o mouse no gráfico mostra a dica; a tabela abre no `<details>`; Tab percorre topo → período → filtros → lista →
  origens com contorno azul visível;
- contraste AA nos dois temas (números em `--vp-ink`, textos secundários em `--vp-soft` sobre `--vp-card`);
- no escuro, as 5 cores de origem distinguíveis entre si.

## Arquivos afetados

**Novos:**

- `db/migrations/013_visitas.sql`
- `app/visitas/**` (lista na decisão 5)
- `app/routes/api.v.ts`
- `app/server/admin/auth.server.ts` (cópia adaptada do respawnou)
- `app/routes/admin/layout.tsx`, `app/routes/admin/visitas.tsx` (índice), `app/routes/admin/login.tsx`,
  `app/routes/admin/sair.ts`
- `app/components/admin/AdminShell.tsx` (topo do painel; específico do site)
- `scripts/admin-hash.ts` + `"admin:hash"` no `package.json` (cópia do criasite)
- `tests/visitas-core.test.ts`, `tests/visitas-db.test.ts`, `tests/admin-auth.test.ts`

**Alterados:**

- `app/routes.ts` (tira `"admin/*"` de `ACCOUNT_PENDING`; rotas do admin e `api/v`)
- `app/root.tsx` (esconde o topo/rodapé do site em `/admin`; `<VisitBeacon />` no `App`)
- `app/server/cron/jobs.server.ts` (`limpeza` chama `limparVisitas()`)
- `app/server/content/import-old.server.ts` (`GREATEST` no `views_count`)
- `app/content/paginas/legal-privacidade.md` e `legal-cookies.md` (texto da contagem sem cookie)
- `.env.example` (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`; `SESSION_SECRET` já existe)
- `docs/README.md`, `docs/decisoes.md`, `docs/arquitetura.md` (variáveis e pasta `app/visitas`),
  `docs/banco-de-dados.md` (linha da 013)

## Passos

Tamanho: P (até 1 h), M (meio dia), G (um dia). "Claude" = executor; "Dono" = só o dono faz.

1. **(P, Claude) Login do admin, parte de servidor.** Copiar `respawnou/app/lib/admin/auth.server.ts` para
   `app/server/admin/auth.server.ts`; trocar o cookie para `__ap_admin`, `sameSite: "strict"`; trocar o `clientIp`/
   `sameOrigin` locais pelos de `app/server/http.server.ts`; acrescentar o limite global (30 erros em 15 min). Copiar
   `criasite/scripts/admin-hash.ts` e o script `admin:hash` do `package.json` dele. `ADMIN_EMAIL` e
   `ADMIN_PASSWORD_HASH` no `.env.example`. Teste `tests/admin-auth.test.ts`: hash e conferência, senha errada,
   bloqueio por IP após 5, bloqueio global após 30.
   **Verificar:** `npx vitest run tests/admin-auth.test.ts` verde.
2. **(M, Claude) Rotas e casca do admin.** Em `app/routes.ts`: tirar `"admin/*"` de `ACCOUNT_PENDING` e acrescentar
   `route("admin/login", "routes/admin/login.tsx")`, `route("admin/sair", "routes/admin/sair.ts")`,
   `route("admin", "routes/admin/layout.tsx", [index("routes/admin/visitas.tsx")])`. `layout.tsx` chama
   `requireAdmin` no `loader` e desenha `AdminShell`. `root.tsx`: `useLocation()` no `Layout` e, com `/admin`, não
   renderizar `Header`, `SideNav`, `AvisoContas`, `Footer` e `BottomNav`. `meta` com `robots: noindex, nofollow` nas
   três telas. `visitas.tsx` provisório com "Painel em construção".
   **Verificar:** `npm run build`; local sem as variáveis, `/admin` leva a `/admin/login` com "não configurado"; com
   variáveis de teste, entra, navega por clique (pedido `/admin.data` com cookie) e sai. Cabeçalhos de `/admin`:
   `no-store` e `X-Robots-Tag`.
3. **(P, Dono) Variáveis no hPanel.** Rodar `npm run admin:hash` no computador, colar `ADMIN_EMAIL`,
   `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` em Sites → animeprofile.com.br → Node.js → Variáveis de ambiente. O Claude
   confere só os nomes com `hosting_nodejs_list-environment-variables` e, se faltar, avisa (no respawnou a primeira
   tentativa não gravou). Depois do deploy, entrar em `https://animeprofile.com.br/admin`.
4. **(P, Claude) Migration 013.** Criar `db/migrations/013_visitas.sql` com o SQL da decisão 2 e **colar no chat**.
   Linha nova em `docs/banco-de-dados.md`. Copiar para `app/visitas/sql/visitas.sql`.
   **Verificar:** `npm run db:migrate` local; `SHOW CREATE TABLE visit_pages` igual ao plano.
5. **(M, Claude) Núcleo puro** (`app/visitas/core/`), com testes em `tests/visitas-core.test.ts`:
   - `caminho.ts`: `normalizar(p)` (regras do item 7 da coleta) e `classificar(p, tipos)`;
   - `origem.ts`: `origemDe(referrer, utm, hosts)` → `{ origem, dim, valor }`. UTM presente = `campanha`. Listas:
     busca (`google.`, `bing.`, `duckduckgo.`, `yahoo.`, `ecosia.`, `yandex.`, `search.brave.`, `news.google.`,
     `android-app://com.google.android.googlequicksearchbox`), social (`instagram.com`, `l.instagram.com`,
     `facebook.com`, `m.facebook.com`, `lm.facebook.com`, `fb.com`, `t.co`, `x.com`, `twitter.com`, `threads.net`,
     `bsky.app`, `tiktok.com`, `youtube.com`, `youtu.be`, `reddit.com`, `discord.com`, `linkedin.com`,
     `pinterest.com`, `t.me`, `whatsapp.com`, `wa.me`), comparando o domínio exato ou terminado em `.<domínio>`;
     referrer dos `hosts` = interno; vazio ou inválido = `direto`;
   - `ua.ts`: aparelho (`Sec-CH-UA-Mobile: ?1` = celular quando existir; `iPad|Tablet|Android` sem `Mobile` = tablet;
     `Mobi|iPhone|Android` = celular; resto = computador), navegador na ordem `Instagram` → `FBAN|FBAV` → `Edg/` →
     `OPR/|Opera` → `SamsungBrowser` → `Firefox|FxiOS` → `Chrome|CriOS` → `Safari` → `Outro`, sistema (`Android`,
     `iPhone|iPad|iPod` = iOS, `Windows`, `Mac OS X` = macOS, `CrOS`, `Linux`);
   - `dia.ts`: `diaBrasilia(date)`, `intervalo("hoje"|"ontem"|"7d"|"30d")` e o período anterior de mesmo tamanho.
   **Verificar:** pelo menos 30 casos (10 referrers, 10 user-agents reais de celular/computador/apps, endereços com
   barra final, query, `/admin`, não ASCII). Tudo verde.
6. **(P, Claude) `app/visitas/config.ts` do animeprofile.** Tipos, na ordem:
   `/` → `inicio` ("Página inicial"); `/(noticias|artigos)/:slug` → `materia`; `/blog/(categoria|tag|u)/...` →
   `lista`; `/blog/:usuario/:slug` → `blog`; `/animes/personagem/:id` → `personagem`; `/animes/:id` (número) → `anime`;
   `/quiz/:slug` → `quiz`; `/figurinhas/:slug` → `figurinhas`; `/otaku-tv` → `otaku-tv`; endereços da lista
   `ACCOUNT_PENDING` (importar de `routes.ts` ou repetir) → `contas` ("Volta em breve"; mostra a procura pelas contas);
   `/noticias`, `/artigos`, `/categoria/:slug`, `/tag/:slug`, `/autores/:slug`, `/animes`, `/animes/calendario`,
   `/quiz`, `/blog`, `/figurinhas`, `/busca` → `lista`; resto → `outra`. Filtros: Tudo, Matérias (`materia`), Animes
   (`anime`, `personagem`), Quiz, Blog, Outras (o resto). `titulos()`: uma consulta por tipo com `IN (...)`:
   `posts.title` por `slug`, `anime_catalog.title` por `anilist_id`, `quizzes.title` por `slug`, `blog_posts.title`
   por `slug`, `sticker_albums.name` por `slug`, `categories.name`/`tags.name`/`post_authors.name` por `slug`,
   personagem pela tabela de `006_personagens.sql` (conferir a coluna do nome); fixos num mapa ("Página inicial",
   "Notícias", "Artigos", "Animes", "Calendário", "Quiz", "Blog", "Figurinhas", "Otaku TV", "Busca", "Sobre",
   "Contato" e as páginas legais). Envolver em `cached("visitas:titulos:<hash da lista>", 10 min)`. Contadores:
   matéria → `posts.views_count`; blog → `blog_posts.views_count`.
   **Verificar:** teste rápido de `classificar` para cada tipo (entra em `visitas-core.test.ts`).
7. **(G, Claude) Coleta no servidor.** `app/visitas/server/sal.server.ts`, `coleta.server.ts` e `app/routes/api.v.ts`
   (`action` chama `registrar(request)` e devolve `204` com `Cache-Control: no-store`; `loader` devolve `405`).
   Regras e ordem exatamente como na decisão 1; gravação a cada 10 s como na decisão 1; `visit_seen` com
   `INSERT IGNORE ... VALUES (?, ?), ...` e `affectedRows` somado em `visit_daily.visitors`. Exportar
   `gravarAgora()` (para testes) e `agora()` (pessoas nos últimos 5 min). Testes em `tests/visitas-db.test.ts` com
   `mysql-memory-server`: 3 sinais iguais em 30 s = 1 página; robô = 0 páginas e +1 robô; cookie do admin = 0; `f=1`
   com referrer do Google = 1 entrada e `ref_busca/google.com`; `f=0` = página sem entrada; visitante repetido no dia =
   1; matéria aberta 2 vezes em 30 min = `views_count + 1`; troca de dia gera sal novo.
   **Verificar:** testes verdes; `npm run build`.
8. **(P, Claude) Sinal no navegador.** `app/visitas/client/VisitBeacon.tsx` com as regras da decisão 1 e
   `<VisitBeacon />` dentro do `App` de `app/root.tsx`.
   **Verificar:** `npm run dev`, abrir 3 páginas por clique e uma recarregando: na aba Rede, um `POST /api/v` por
   página (`204`), nenhum em `/admin`, nenhum na página 404; em 10 s, linhas em `visit_daily` e `visit_pages`.
9. **(P, Claude) `views_count` e importação.** Ligar os contadores da config ao buffer (decisão 6) e trocar, em
   `import-old.server.ts`, o `views_count = VALUES(views_count)` por `GREATEST(...)` em `posts` e `blog_posts` (o
   `upsert` genérico ganha um parâmetro opcional de expressões por coluna).
   **Verificar:** teste da importação (`tests/content.test.ts`) continua verde; teste novo: importar com número menor
   não baixa o contador.
10. **(P, Claude) Retenção.** `app/visitas/server/limpeza.server.ts` com `limparVisitas()` (decisão 2) e chamada dentro
    da tarefa `limpeza`, somando `visitasSeenApagadas`, `visitasPaginasApagadas`, `visitasDimsApagadas` ao resumo.
    **Verificar:** teste com linhas antigas; `GET /api/cron/run?token=...&nome=limpeza&wait=1` local devolve os campos.
11. **(M, Claude) Consultas do painel.** `app/visitas/server/consultas.server.ts`: `cartoes()`, `serie30()`
    (preenche dias sem linha com 0), `paginas(periodo, tipo, limite)` (`SUM(views)` por `path`, `kind`, com títulos),
    `dimensoes(periodo)` (todas as `dim` de uma vez, agrupadas no Node), `robos(periodo)`, `navegacaoInterna(periodo)`.
    Cada uma é um `SELECT` agregado com `WHERE day BETWEEN ? AND ?` (usa a chave primária). Loader de
    `app/routes/admin/visitas.tsx` lê `?p`, `?tipo`, `?mais`, chama tudo em `Promise.all` e devolve
    `{ erro: true }` se o banco falhar.
    **Verificar:** teste com dados semeados de 40 dias: totais de 7/30 dias, anterior, média de visitantes, série com 30
    pontos.
12. **(G, Claude) Tela do painel** (`app/visitas/ui/*`, `visitas.css` importado pela rota, `AdminShell`) exatamente
    como em "Decisões de design (visual)", com todos os estados.
    **Verificar:** o "Critério de pronto (visual)" acima, com os 4 prints anexados na resposta ao dono.
13. **(P, Claude; Dono aprova o texto) Textos legais.** Em `legal-privacidade.md`, trocar o 2.5 (título "2.5 Contagem de
    visitas (sem cookies)") pelo texto: "Contamos as visitas de forma agregada, **sem cookies e sem guardar o seu IP**.
    Quando uma página termina de abrir, o navegador avisa o nosso servidor qual página foi aberta, de onde você veio
    (o site anterior ou os parâmetros UTM do link) e o tipo de aparelho, navegador e idioma. Para não contar a mesma
    pessoa duas vezes no mesmo dia, o servidor calcula um código a partir do IP e do navegador com uma chave que é
    trocada e apagada todos os dias; esse código só vale naquele dia e não permite identificar ninguém. Robôs não são
    contados." Na tabela de retenção, trocar a linha das visualizações por: "| Contagem de visitas (números por dia,
    página, origem e aparelho, sem dado pessoal) | 13 meses; os totais por dia ficam sem prazo | Legítimo interesse |".
    Em `legal-cookies.md`, uma frase no começo da seção de analíticos: "A contagem de visitas do próprio site não usa
    cookies nem armazenamento no seu aparelho." Conferir a data de atualização das páginas.
    **Verificar:** `/legal/privacidade` e `/legal/cookies` renderizam; dono aprova.
14. **(P, Claude) País ou idioma.** Por 1 dia depois do deploy, o `/api/v` registra em log **só os nomes** dos
    cabeçalhos recebidos (uma vez por hora, no máximo 5 vezes). Se aparecer um cabeçalho de país da CDN (ex.:
    `cf-ipcountry`, `x-country-code`, `x-geo-country`), gravar a `dim` `pais` com o valor (2 letras) no lugar de
    `idioma` e mostrar "País" como 4º cartão de dimensões; senão, fica `idioma`. Tirar o log em seguida.
    **Verificar:** resultado anotado neste plano e em `docs/decisoes.md`.
15. **(P, Claude) Publicar e conferir em produção.** `npm run build`, testes, commit, push; depois do deploy, o roteiro
    de "Como verificar". Atualizar `docs/README.md` (status, próximos passos, pendências), `docs/arquitetura.md`
    (pasta `app/visitas`, variáveis `ADMIN_*`) e escrever `app/visitas/README.md` (instalação em outro site: copiar a
    pasta, ajustar `config.ts`, `db.ts` e `visitas.css`, criar a migration com o número seguinte e colar no chat, ligar
    `<VisitBeacon />`, `/api/v`, a rota do painel e `limparVisitas()`).
16. **(M cada, Claude; depois de 3 a 7 dias de animeprofile estável) Irmãos**, na ordem que o dono escolher (pergunta 5):
    seguir `app/visitas/README.md` e a tabela da decisão 5. Cada um com plano curto próprio em `docs/` do site, se o
    executor achar diferença grande.

## Riscos e cuidados

- **React Router:** loaders do admin não leem `new URL(request.url).pathname` direto; usar `routePath(request)` se
  precisarem do endereço (regra de `docs/arquitetura.md`). `?p`, `?tipo` e `?mais` podem vir de `new URL(request.url)
  .searchParams` (a query não muda com o `.data`).
- **Cookie do admin com `Path=/admin` quebra a navegação por clique** (`/admin.data`). Manter `Path=/`.
- **`npm run build` antes de todo push** (regra do dono).
- **Migration nova:** colar o SQL no chat. Nada de `CAST(? AS JSON)`; o sal vai como texto em `system_config.value`.
  Nada de `ON DUPLICATE KEY UPDATE ... AS new` (sintaxe só do MySQL 8): usar `VALUES(col)`.
- **IP atrás da CDN:** se o `x-forwarded-for` trouxer o IP da CDN e não o do visitante, todos viram "1 visitante". O
  quiz já depende disso; conferir em produção (ver "Como verificar").
- **Mais de um processo Node:** cada um tem seu buffer e sua memória de recarregamento; os totais somam certo no banco
  (soma por `ON DUPLICATE KEY`), só a regra de 30 s pode deixar passar uma repetição. O sal é lido do banco, então é o
  mesmo para todos.
- **Bloqueadores de anúncio** bloqueiam endereços como `/track`, `/collect`, `/analytics`; por isso `/api/v`. Mesmo
  assim, uma parte pequena pode não contar.
- **Números menores que os do site antigo:** o antigo contava toda troca de endereço, sem pausa de 30 s, e o número dele
  incluía só quem aceitava cookies. Os dois não são comparáveis; avisar o dono.
- **Contagem inflada de propósito:** o limite de 120 sinais por minuto por código ajuda, mas quem trocar de IP e de
  navegador consegue somar. Aceitável para um contador sem cookie.
- **Limite global de login:** um ataque pode bloquear o login do dono por 15 min. Aceitável (um só usuário, senha forte).
- **Privacidade:** nunca registrar em log o corpo do `/api/v`, o IP ou o user-agent. O `console.error` da gravação
  registra só a contagem de chaves.
- **Peso da página pública:** o `VisitBeacon` não pode importar nada além de `react-router` (meta: menos de 1 KB).

## Como verificar

Local:

- `npx vitest run` (todos), `npm run typecheck`, `npm run build`.

Produção (depois do deploy):

1. `curl -sI https://animeprofile.com.br/admin` → `302` para `/admin/login`, com `cache-control: no-store` e
   `x-robots-tag: noindex, nofollow`.
2. `curl -s -o /dev/null -w "%{http_code}" -X POST https://animeprofile.com.br/api/v -d '{"p":"/","f":1}'` → `204`
   (com `curl` o `isbot` recusa: deve somar em robôs, não em páginas).
3. Abrir o site no celular (4G) e no computador (Wi-Fi), 3 páginas em cada; em até 10 s, `/admin` mostra **2
   visitantes** e 6 páginas em "Hoje" (o dono logado não conta: testar numa janela anônima ou em outro navegador).
4. Abrir uma matéria vindo de uma busca no Google: "De onde vêm" → Busca → `google.com`.
5. Abrir `https://animeprofile.com.br/?utm_source=teste&utm_medium=link&utm_campaign=painel`: Campanhas →
   `teste / link / painel`.
6. Recarregar a mesma página 3 vezes em 10 s: conta 1.
7. `views_count` da matéria aberta subiu 1 (`/api/cron/status` não mostra; conferir na lateral "Em alta" após o cache
   ou com uma consulta no phpMyAdmin).
8. `GET /api/cron/run?token=...&nome=limpeza&wait=1` → resumo com os 3 campos `visitas*`.
9. Login: 5 senhas erradas → "Muitas tentativas"; o cookie `__ap_admin` aparece com `HttpOnly; Secure;
   SameSite=Strict; Path=/`.
10. Os 4 prints do critério de pronto.

## Perguntas em aberto

1. **Login do painel:** e-mail + senha, igual aos outros três sites (recomendado; um só jeito de entrar em todos), ou só
   uma senha? O plano segue e-mail + senha.
2. **Histórico do site antigo:** o backup local (`C:\Users\evsli\animeprofile-backup`) tem a tabela `page_views`
   inteira. Quer importar **só os totais por dia** (páginas vistas e visitantes aproximados por `session_id`) para o
   "Total" e para comparar meses? Recomendado: **sim, só os totais por dia**, num passo extra P (script no PC enviando
   para `/api/importar/visitas` com o `CRON_TOKEN`). Os detalhes por página e origem ficam de fora.
3. **País:** se a CDN da Hostinger não mandar um cabeçalho de país (passo 14), aceitar **idioma do navegador** no lugar
   (recomendado, grátis e sem dado pessoal) ou instalar uma base gratuita de IP → país (DB-IP Lite, ~6 MB, atualização
   mensal, exige citar a fonte)?
4. **"Em alta" e "Mais lidas":** depois de 2 semanas de dados, trocar o critério para "mais vistas nos últimos 7 dias"
   (lido de `visit_pages`) em vez do `views_count` acumulado? Recomendado: sim, as matérias novas do robô passam a
   aparecer.
5. **Ordem dos irmãos:** criasite → vibecoin → respawnou (recomendado: o criasite é o piloto e o mídia kit dele já
   espera o número `reads-30d` deste painel), ou outra ordem?
6. **Retenção** de 13 meses para páginas e origens (e totais por dia sem prazo): ok?
