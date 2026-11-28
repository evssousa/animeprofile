# Plano: Google Analytics 4 com banner de consentimento (módulo copiável)

**Status: ✅ executado em 2026-11-26** (passos 1 a 16, ID `G-GFBZ97L4WX`; passo 1: sem CSP em produção; 12b só se o DebugView pedir).

Plano temporário, escrito em 2026-11-26. O animeprofile é o piloto; respawnou, vibecoin e criasite copiam o módulo depois
(seção final).

## Objetivo

Ligar o Google Analytics 4 no animeprofile **só para quem aceitar "Estatística"** no banner de cookies, sem medir o dono
nem o painel, com page_view certo na navegação sem recarregar, e deixar tudo num módulo (`app/analytics/`) que se copia
para os outros 3 sites mudando só um arquivo de configuração e o visual do banner.

## Contexto

- **Já existe** (AdSense, 2026-11-22, [adsense.md](adsense.md)):
  - `app/lib/ads.ts`: `consentBootstrap()` roda no `<head>` (fora do `/admin` e `/login`), cria `window.dataLayer` e
    `gtag`, nega tudo por padrão (Modo de Consentimento v2, inclusive `analytics_storage`) e libera tudo se o
    `localStorage['ap-cookie-consent']` tiver `{ v: 1, choice: "all" }`. `CONSENT_VERSION = 1`.
  - `app/components/layout/CookieConsent.tsx`: banner com 2 botões ("Só os essenciais" / "Aceitar todos"), reaberto por
    "Preferências de cookies" no rodapé (`Footer.tsx`, evento `ap:cookies`). Só existe com `ADS_ENABLED`.
  - `app/lib/use-marcador.ts`: `useMarcador()` diz se há alguém logado (atributo `data-logado` posto no `<html>` pelo
    `sessionHintBootstrap`). O `AdSlot` já usa isso para não mostrar anúncio ao dono.
- **Contagem própria de visitas** (`app/visitas/`, `/api/v`, `/admin/visitas`, [plano-painel-visitas.md](plano-painel-visitas.md)):
  sem cookie, conta todo mundo. **Continua sendo o número oficial.** O GA não a substitui (ver "Como convivem").
- **Textos legais** (`app/content/paginas/legal-cookies.md` e `legal-privacidade.md`): já citam o GA4 e o `_ga`, mas com
  imprecisões ("IP anonimizado/truncado", UTM como "marketing", "Telemetria" no 2.5 da Privacidade, retenção de 24 meses).
  O passo 13 do plano de visitas (texto da contagem própria) **ainda não foi aplicado**; este plano o faz junto.
- **Cabeçalhos de segurança:** não há `Content-Security-Policy` no código (`server-app.js`, `app/server/`, `entry.server.tsx`
  não definem). Nada bloqueia `googletagmanager.com` nem `google-analytics.com`. Conferir também a resposta real (passo 1),
  porque o proxy do Coolify poderia acrescentar cabeçalho.
- **Respawnou** tem no banner a função `googleCmpApplies()` (espera o `__tcfapi` do aviso europeu do Google e, se ele
  atende o visitante, não mostra o banner próprio). O animeprofile **não tem**: quando o dono ativar "Regulamentos
  europeus" no AdSense, o visitante europeu veria dois avisos. O módulo traz essa função.

## Decisões tomadas (recomendadas; o dono pode mudar, nenhuma bloqueia)

1. **GA4 por gtag.js**, reaproveitando o `dataLayer`/`gtag` que o `consentBootstrap` já cria (sem GTM). O script
   `https://www.googletagmanager.com/gtag/js?id=G-...` só é inserido **no navegador**, **depois do `load` e com o navegador
   ocioso** (mesma técnica do `AdSlot`), e só quando **todas** valem:
   - ID de medição preenchido;
   - página fora de `/admin`, `/login`, `/sair`, `/api`;
   - ninguém logado (`useMarcador().logado === false`);
   - navegador sem a marca "não medir" (`localStorage['ap-nao-medir'] === '1'`, ligada visitando qualquer página com
     `?nao-medir=1`, desligada com `?nao-medir=0`; serve para o dono no celular sem login e para os sites irmãos sem login);
   - consentimento de **Estatística** dado.
   Se depois de carregado alguma condição deixar de valer (entrou no `/admin`, fez login, revogou), o módulo põe
   `window['ga-disable-G-...'] = true` (o gtag para de enviar na hora) e volta a `false` quando as condições voltam.
2. **Banner com 3 ações**: mantém "Só os essenciais" e "Aceitar todos" lado a lado e do mesmo tamanho, e ganha
   **"Personalizar"**, que mostra 2 chaves: **Estatística (Google Analytics)** e **Anúncios personalizados (Google AdSense)**.
   Por quê: a LGPD pede consentimento para uma finalidade determinada, e o guia de cookies da ANPD recomenda categorias
   separadas e recusar tão fácil quanto aceitar; Estatística e Anúncios são finalidades diferentes. O AdSense não exige
   categorias no Brasil (na Europa quem cuida é a CMP do Google), então isso não atrapalha os anúncios.
   - `CONSENT_VERSION` sobe para **2** e o formato salvo muda para `{ v: 2, analytics: boolean, ads: boolean, at: string }`.
   - **Compatibilidade com a escolha antiga (v1):**
     - `{ v: 1, choice: "essential" }` vira `{ v: 2, analytics: false, ads: false }` **sem mostrar o banner** (a pessoa já recusou; não insistir);
     - `{ v: 1, choice: "all" }`: o bootstrap libera **só os anúncios** (o que a pessoa aceitou no texto antigo) e o banner
       **aparece de novo uma vez**, já com "Anúncios personalizados" ligado e "Estatística" desligado em "Personalizar".
       O texto antigo não falava de estatística de audiência, então não se presume esse consentimento.
3. **Modo de Consentimento básico** (não carregar o GA até aceitar), não o avançado. Por quê: a Política de Cookies promete
   "só ativado após consentimento" e o modo avançado manda pings sem cookie para o Google mesmo de quem recusou; a
   modelagem do avançado só liga com volume alto (mínimo de 1.000 eventos/dia de quem recusou por 7 dias), e a contagem
   total de quem recusou já existe no `/admin/visitas`. Também é mais leve (quem recusa não baixa o gtag.js).
4. **page_view manual**: `gtag('config', ID, { send_page_view: false, ... })` e um `page_view` por troca de
   `pathname + search`, com `page_location` (endereço completo sem `#`), `page_title` (lido de `document.title` depois do
   React desenhar a página nova) e `page_referrer` (endereço anterior, a partir da 2ª página). O primeiro page_view sai
   quando o GA carrega (também quando a pessoa aceita no meio da visita: mede a página atual). Proteção contra duplicar:
   guardar o último endereço enviado e não repetir (o `StrictMode` e a chegada do consentimento podem rodar o efeito duas vezes).
   Volta pelo histórico com página da memória (`pageshow` com `persisted`) envia de novo, como o `VisitBeacon`.
   **Obrigatório no painel do GA** (pendência do dono): desligar "Mudanças de página com base em eventos do histórico do
   navegador" na medição otimizada, senão cada troca de rota conta duas vezes (e com o título da página anterior).
5. **ID de medição como constante pública** em `app/analytics/config.ts` (`GA_MEASUREMENT_ID = ""`), como o `ADSENSE_CLIENT`
   do animeprofile. Vazio = GA desligado (nada carrega e o banner não mostra a chave Estatística). O ID `G-...` é público
   (sai em toda página). O componente recebe o ID por propriedade, então nos sites irmãos ele vem da variável de ambiente
   `GA_MEASUREMENT_ID` pelo loader da raiz, igual ao `ADSENSE_CLIENT` deles. Validação: `/^G-[A-Z0-9]{6,12}$/`; fora disso, desligado.
6. **Poucos eventos além do page_view:**
   - **busca:** pela medição otimizada "Pesquisa no site" do próprio GA (parâmetro `q` da `/busca`), sem código. Se no
     DebugView não aparecer `view_search_results`, aplicar o passo 12b (evento `search` manual).
   - **`quiz_complete`** quando o resultado do quiz aparece: `{ quiz_slug, quiz_tipo: "conhecimento" | "personalidade", acertos?, total? }`.
   - **`select_content`** (evento recomendado do GA) ao clicar num card de "Leia também" da matéria:
     `{ content_type: "leia_tambem", item_id: <href do card> }`. Mede se as relacionadas funcionam.
   - Nada mais (sem rolagem própria, sem cliques genéricos: a medição otimizada já mede rolagem de 90% e cliques externos).
7. **Privacidade no `config`:** `allow_google_signals: false` e `allow_ad_personalization_signals: false` (o GA não alimenta
   perfil de anúncios; os anúncios personalizados são do AdSense, com a chave própria). O GA4 não guarda IP (usa só para
   estimar a região e descarta). Sem `user_id`, sem dado pessoal em parâmetro.
8. **Revogação:** ao desligar Estatística, `gtag('consent','update',{analytics_storage:'denied'})`, `ga-disable` = true e
   apagar os cookies `_ga` e `_ga_*` (no host e em `.animeprofile.com.br`). Os cookies do AdSense são de terceiros e não dá
   para apagar daqui (a política diz como apagar no navegador).
9. **Europa:** quando a CMP do Google atende o visitante (`gdprApplies`), o banner próprio não aparece e o "Preferências de
   cookies" abre a mensagem do Google (como no respawnou). O GA **não** carrega para esses visitantes (o módulo só olha a
   escolha do banner próprio). Público europeu é mínimo num site em pt-BR; fica simples e seguro.

### Como o GA e a contagem própria convivem

| | Contagem própria (`/api/v`, `/admin/visitas`) | Google Analytics 4 |
|---|---|---|
| Quem entra | todo visitante humano (sem cookie, sem consentimento) | só quem aceitou Estatística, fora do dono e do painel |
| Para que serve | números oficiais: visitas, páginas mais vistas, origem, aparelho; o painel e as métricas semanais | comportamento: tempo de engajamento, caminho entre páginas, retorno, busca interna, quiz, "Leia também", relatórios do Search Console e do AdSense num lugar só |
| Números | maiores | menores (parte recusa ou usa bloqueador); **não comparar 1 a 1** |

Os dois rodam lado a lado em `root.tsx` (`<VisitBeacon />` e `<GoogleAnalytics />`), sem um depender do outro.

## Arquivos afetados

Criar (o módulo):
- `app/analytics/config.ts` — tudo o que muda de site para site (ID, chave do consentimento, caminhos sem GA, nomes).
- `app/analytics/consent.ts` — modelo do consentimento v2: ler/migrar/guardar, aplicar no gtag, avisar mudanças, script do `<head>`.
- `app/analytics/cmp-google.ts` — `googleCmpApplies()` (trazido do respawnou).
- `app/analytics/gtag.ts` — carregar o gtag.js, page_view, `medir()`, desligar e apagar cookies.
- `app/analytics/GoogleAnalytics.tsx` — componente sem visual que liga tudo (montado no `root.tsx`).
- `app/analytics/use-consentimento.ts` — gancho do banner (estado aberto/camada/escolhas), sem visual.
- `app/analytics/README.md` — como instalar em outro site.
- `tests/analytics.test.tsx`.

Alterar:
- `app/lib/ads.ts` — tirar `CONSENT_KEY`, `CONSENT_VERSION`, `ConsentChoice` e `consentBootstrap` daqui e reexportar do módulo
  (`export { CONSENT_KEY, CONSENT_VERSION, consentBootstrap } from "~/analytics/consent";`) para nada quebrar.
- `app/components/layout/CookieConsent.tsx` — visual novo (2 camadas) usando `use-consentimento`.
- `app/components/layout/Footer.tsx` — só se o `CookiePrefsButton` mudar de condição (passa a existir com anúncios **ou** GA).
- `app/root.tsx` — condição do bootstrap e montar `<GoogleAnalytics id={GA_MEASUREMENT_ID} />`.
- `app/app.css` — keyframes `cookies-in` (entrada do banner).
- `app/components/quiz.tsx` — evento `quiz_complete`.
- `app/routes/post.tsx` — evento `select_content` no "Leia também".
- `app/content/paginas/legal-cookies.md`, `app/content/paginas/legal-privacidade.md` — textos (passo 14).
- `tests/anuncios.test.tsx` — ajustar as asserções do bootstrap (formato v2).
- `docs/adsense.md`, `docs/arquitetura.md`, `docs/README.md`, `docs/decisoes.md`.

## Passos

1. **(P) Conferir cabeçalhos em produção.** `curl -sI https://animeprofile.com.br/ | grep -iE "content-security|permissions-policy"`.
   Esperado: nada. Se aparecer CSP, anotar aqui e incluir em `script-src` `https://www.googletagmanager.com` e em
   `connect-src`/`img-src` `https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`.
2. **(P) `app/analytics/config.ts`.** Exportar:
   ```ts
   export const GA_MEASUREMENT_ID = ""; // "G-XXXXXXX" quando o dono mandar; vazio = desligado
   export const CONSENT_KEY = "ap-cookie-consent";
   export const CONSENT_VERSION = 2;
   export const OPEN_CONSENT_EVENT = "ap:cookies";
   export const CONSENT_CHANGED_EVENT = "ap:consent-changed";
   export const NAO_MEDIR_KEY = "ap-nao-medir";
   export const SEM_ANALYTICS = /^\/(admin|login|sair|api)(\/|$)/;
   export const COOKIE_DOMAIN = ".animeprofile.com.br"; // para apagar _ga
   export function gaIdValido(id: string | null | undefined): string | null // regex /^G-[A-Z0-9]{6,12}$/
   ```
   **Verificar:** `npm run typecheck`.
3. **(M) `app/analytics/consent.ts`.**
   - `type Consentimento = { analytics: boolean; ads: boolean }`.
   - `interpretar(raw: string | null): { escolha: Consentimento | null; migrar?: Consentimento; parcial?: Consentimento }` (função pura,
     testável sem navegador): v2 válido → `escolha`; v1 `essential` → `escolha` e `migrar` `{false,false}`; v1 `all` →
     `escolha: null` e `parcial: {analytics:false, ads:true}` (pré-preenche o "Personalizar"); qualquer outra coisa → `null`.
   - `lerConsentimento()`: lê o `localStorage`, aplica `interpretar`, grava a migração se houver. Sem armazenamento → `null`.
   - `guardarConsentimento(c)`: grava `{ v: 2, analytics, ads, at }`, chama `aplicarNoGtag(c)` e dispara `CONSENT_CHANGED_EVENT`.
     Guarda também numa variável do módulo (para valer na visita mesmo sem `localStorage`).
   - `aplicarNoGtag(c)`: `gtag('consent','update', { analytics_storage, ad_storage, ad_user_data, ad_personalization })` com
     `analytics` → `analytics_storage` e `ads` → os três `ad_*`.
   - `consentBootstrap()`: o mesmo script de hoje, mas lendo v2 por categoria e v1 `all` como só anúncios:
     ```js
     window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
     gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
     try{var c=JSON.parse(localStorage.getItem('KEY')||'null'),a=0,d=0;
     if(c&&c.v===2){a=c.analytics===true;d=c.ads===true}else if(c&&c.v===1&&c.choice==='all'){d=1}
     if(a||d){var g=d?'granted':'denied';gtag('consent','update',{analytics_storage:a?'granted':'denied',ad_storage:g,ad_user_data:g,ad_personalization:g})}}catch(e){}
     ```
   **Verificar:** testes do passo 15 (interpretar e bootstrap).
4. **(P) `app/analytics/cmp-google.ts`.** Copiar `googleCmpApplies()` e as declarações `__tcfapi`/`googlefc` do
   `respawnou/app/components/CookieConsent.tsx` (linhas 10 a 40), sem mudar a lógica (espera até 1,5 s).
5. **(M) `app/analytics/gtag.ts`.**
   - `declare global` com `gtag`, `dataLayer` e o índice `ga-disable-*` (tirar o `declare global` de `gtag` do `CookieConsent.tsx`).
   - `carregarGa(id, debug)`: uma vez só; depois do `load` + `requestIdleCallback` (sem ele, `setTimeout(…, 1)`): `gtag('js', new Date())`,
     `gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ...(debug && { debug_mode: true }) })`
     e o `<script async src="https://www.googletagmanager.com/gtag/js?id=...">`. Estado `parado | carregando | ativo | falhou` (onerror → `falhou`, sem tentar de novo).
   - `pausarGa(id, pausado)`: `window['ga-disable-'+id] = pausado`.
   - `enviarPageView(href, referrer?)`: `gtag('event','page_view',{ page_location: href, page_title: document.title, page_referrer })`, só se o estado for `carregando` ou `ativo` e não estiver pausado.
   - `medir(nome, params)`: mesma guarda (estado `parado`/`falhou` ou pausado → não faz nada; nunca enfileira no `dataLayer` antes do `config`).
   - `apagarCookiesGa(dominio)`: para cada cookie que começa com `_ga`, `Max-Age=0; Path=/` sem domínio e com `Domain=dominio`.
   - `debug` = `?ga_debug=1` no endereço (guardado em `sessionStorage` para seguir na navegação).
6. **(M) `app/analytics/GoogleAnalytics.tsx`** (`export function GoogleAnalytics({ id }: { id: string })`, retorna `null`).
   - `montado` (efeito vazio), `useLocation()`, `useMarcador()`, consentimento ouvido de `CONSENT_CHANGED_EVENT` (estado inicial `lerConsentimento()` no efeito).
   - Marca "não medir": no efeito de montagem, ler `?nao-medir=1|0` e gravar/apagar `NAO_MEDIR_KEY`.
   - `pode = montado && gaIdValido(id) && !SEM_ANALYTICS.test(pathname) && !logado && !naoMedir && consentimento?.analytics === true`.
   - Efeito em `[pode]`: se `pode`, `carregarGa` e `pausarGa(false)`; senão, `pausarGa(true)` (se já carregou). Se o consentimento
     de Estatística passou de sim para não, `apagarCookiesGa(COOKIE_DOMAIN)`.
   - Efeito em `[pode, pathname, search]`: se `pode`, esperar a aba visível e o fim da pré-renderização (copiar a lógica do
     `VisitBeacon.tsx`), depois `setTimeout(0)` e `enviarPageView(origin+pathname+search, anterior)`, pulando se igual ao último enviado.
     Como o script pode ainda estar carregando, o page_view entra no `dataLayer` depois do `config` (ordem certa) — por isso a
     guarda do `enviarPageView` é "carregando ou ativo", e a do `medir` também.
   - `pageshow` com `persisted`: reenviar o endereço atual (limpar o "último enviado" antes).
   **Verificar:** passo 16 (DebugView), com 1 page_view por página e nenhum no `/admin`.
7. **(M) `app/analytics/use-consentimento.ts`** (lógica do banner, sem visual).
   - Entrada: `{ ads: boolean; analytics: boolean }` (quais categorias existem no site) e `pathname`.
   - Saída: `{ aberto, camada: "resumo" | "personalizar", rascunho, setRascunho, aceitarTodos, soEssenciais, salvar, abrirPersonalizar, voltar, fechar }`.
   - Na montagem: `googleCmpApplies()`; se o Google atende, nunca abre. Senão, abre em "resumo" se `lerConsentimento()` for `null`
     (com o `parcial` da v1 como rascunho inicial).
   - Evento `OPEN_CONSENT_EVENT` (rodapé): se o Google atende e existe `googlefc.showRevocationMessage`, chama; senão abre direto em
     **"personalizar"** com a escolha atual como rascunho.
   - Não abre em `SEM_ANALYTICS` (inclui `/admin`, `/login`, `/sair`).
   - `aceitarTodos` grava `{analytics: temGa, ads: temAds}`; `soEssenciais` grava tudo falso; `salvar` grava o rascunho
     (categoria que não existe no site vai como `false`).
8. **(M) `app/components/layout/CookieConsent.tsx`** — visual da seção "Design do banner". Recebe `{ ads, analytics }` do `root.tsx`.
   `CookiePrefsButton` passa a existir se `ADS_ENABLED || analytics`. Texto do resumo muda conforme as categorias ligadas.
9. **(P) `app/app.css`** — `@keyframes cookies-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }`.
10. **(P) `app/root.tsx`.**
    - `const temGa = Boolean(gaIdValido(GA_MEASUREMENT_ID));`
    - bootstrap: `{(ADS_ENABLED || temGa) && !inAdmin && <script ... consentBootstrap() />}` (mesmo lugar de hoje, antes do `<Meta />`).
    - `App()`: `<CookieConsent ads={ADS_ENABLED} analytics={temGa} />` e, depois do `<VisitBeacon />`, `{temGa && <GoogleAnalytics id={GA_MEASUREMENT_ID} />}`.
    - Footer: o botão "Preferências de cookies" aparece com `ADS_ENABLED || temGa`.
    - `app/lib/ads.ts`: remover as definições de consentimento e reexportar do módulo.
    **Verificar:** `npm run typecheck` e `npm run build`.
11. **(P) `app/components/quiz.tsx`** — efeito em `[finish]`: quando `finish` deixa de ser `null`, uma vez por resultado (ref),
    `medir("quiz_complete", { quiz_slug: quiz.slug, quiz_tipo: knowledge ? "conhecimento" : "personalidade", ...(knowledge && finish.score != null && { acertos: finish.score, total: finish.total }) })`.
12. **(P) `app/routes/post.tsx`** — na `<section aria-labelledby="relacionadas">`, `onClickCapture` que acha o `<a>` mais próximo
    e chama `medir("select_content", { content_type: "leia_tambem", item_id: a.getAttribute("href") })`. Não mexer no `PostCard`.
    12b. **(Só se o passo 16 mostrar que a busca não aparece.)** Em `app/routes/busca.tsx`, efeito em `[q]`: `if (q) medir("search", { search_term: q })`,
    e desligar "Pesquisa no site" na medição otimizada para não duplicar.
13. **(P) GA ainda vazio:** com `GA_MEASUREMENT_ID = ""`, conferir que o banner fica como hoje, só com a chave Anúncios em
    "Personalizar", e que nenhum pedido vai para `googletagmanager.com`. Pode subir assim (o GA liga quando o dono mandar o ID).
14. **(P, dono aprova) Textos legais** (mudar `updated:` para a data do deploy nas duas páginas):
    - `legal-cookies.md`:
      - Resumo: "usamos cookies *essenciais* para o site funcionar e cookies *opcionais* (estatística e anúncios personalizados) que só rodam depois que você aceita, cada um separado."
      - 2.2 vira **"Estatística (Google Analytics)"**: "Com a sua permissão, o Google Analytics 4 mede quais páginas são vistas, por quanto tempo e de onde vêm as visitas, de forma agregada. O Google não guarda o seu IP (usa só para estimar a região). Não usamos os dados para anúncios nem ligamos a sua conta Google (os 'sinais do Google' ficam desligados). Sem a sua permissão, o Google Analytics nem é carregado. Quem está logado na equipe do site não é medido. A contagem de visitas do próprio site não usa cookies nem armazenamento no seu aparelho."
      - 2.3 vira **"Anúncios personalizados (Google AdSense)"**: tirar "parâmetros de campanha (UTM)" e "referrer"; manter o resto.
      - Linha do `_ga`: "Medição de audiência (páginas vistas, sessões, aparelho) pelo Google Analytics 4, provedor Google LLC. Só com a sua permissão em Estatística. O IP não é guardado; dados guardados por 14 meses." Categoria "Estatística".
      - Linha do `ap-cookie-consent`: finalidade "Registrar suas escolhas de cookies (Estatística e Anúncios)".
      - Nova linha: `ap-nao-medir` | localStorage | Essencial | "Marca que este navegador não deve ser medido (usado pela equipe)" | Persistente.
      - 4. Gerenciar: "Na primeira visita você escolhe entre aceitar tudo, só os essenciais ou personalizar. Depois, use 'Preferências de cookies' no rodapé. Desligar a Estatística apaga os cookies `_ga` do Google Analytics deste site."
    - `legal-privacidade.md`:
      - 2.5 vira **"2.5 Contagem de visitas (sem cookies)"** com o texto do passo 13 do [plano-painel-visitas.md](plano-painel-visitas.md) (linhas 664 a 671).
      - Novo **"2.6 Google Analytics (somente com permissão)"**: "Se você aceitar 'Estatística', o Google Analytics 4 recebe as páginas que você abre, o tempo de engajamento, o tipo de aparelho e navegador, a região aproximada e eventos como busca interna e quiz concluído, ligados a um identificador aleatório guardado no cookie `_ga`. Não enviamos nome, e-mail nem conta." Renumerar o antigo 2.6 para 2.7.
      - Tabela de operadores, linha do GA: "Dados envolvidos" = "Identificador aleatório do navegador, páginas vistas e eventos; o IP só é usado para estimar a região e não é guardado".
      - Tabela de retenção: trocar "Visualizações de página (analytics) | 24 meses" pelas duas linhas: a da contagem própria (texto do plano de visitas) e "| Google Analytics (estatística com permissão) | 14 meses | Consentimento |".
    - Marcar o passo 13 do plano de visitas como feito.
15. **(M) `tests/analytics.test.tsx`** (Vitest, ambiente node como o `anuncios.test.tsx`):
    - `interpretar`: v2 válido; v1 `essential` → escolha falsa e `migrar`; v1 `all` → `null` com `parcial` só anúncios; lixo/`null` → `null`.
    - `consentBootstrap`: rodar a string com `new Function` e um `localStorage` falso; conferir o `dataLayer`:
      sem escolha → só `default` negado; v2 `{analytics:true, ads:false}` → `analytics_storage: granted` e `ad_*` negados;
      v1 `all` → `ad_*` granted e `analytics_storage` denied.
    - `gaIdValido`: `"G-ABC1234"` ok; `""`, `"UA-1"`, `"G-<script>"` → `null`.
    - SSR: `renderToString` de `<GoogleAnalytics id="G-TEST123" />` e do `CookieConsent` não contém `googletagmanager` nem "Cookies".
    - `medir` antes de carregar não acrescenta nada ao `dataLayer`.
    - Ajustar `tests/anuncios.test.tsx`: a asserção `choice==='all'` vira a do formato v2.
    **Verificar:** `npm test`.
16. **(M) Publicar e conferir** (depois que o dono mandar o ID): pôr o ID em `config.ts`, `npm run build`, `npm test`, commit,
    push; depois do deploy, o roteiro de "Como verificar". Atualizar `docs/adsense.md` (consentimento v2 e categorias),
    `docs/arquitetura.md` (pasta `app/analytics/`), `app/analytics/README.md`, o status no `docs/README.md` e `docs/decisoes.md`.

## Design do banner

**Direção visual:** o mesmo cartão discreto de hoje (branco/grafite, borda fina, sombra longa, vermelho só no botão de
aceitar), que não parece golpe nem "parede". Clareza acima de enfeite: a pessoa lê uma frase, vê três ações do mesmo peso
visual (aceitar e recusar iguais) e, se quiser, abre as chaves no próprio cartão, sem janela nova. Evitar: botão de recusar
apagado, chaves pré-ligadas, ícone de biscoito, texto jurídico.

**Hierarquia:** 1) título "Cookies" e a frase; 2) os dois botões "Só os essenciais" e "Aceitar todos"; 3) o link "Personalizar".

### Estrutura

Posição e casca **iguais às de hoje** (classes atuais da `<section>`: `fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.45)] sm:inset-x-6 lg:bottom-6`), mais
`max-h-[calc(100dvh-6rem)] overflow-y-auto` e `animate-[cookies-in_180ms_ease-out] motion-reduce:animate-none`.

**Camada "resumo"** (1ª visita):
- `h2` "Cookies" (`text-[0.95rem] font-extrabold`).
- Parágrafo (`text-[0.88rem] leading-relaxed text-ink-soft`), conforme as categorias ligadas:
  - GA e anúncios: "Usamos cookies essenciais para o site funcionar. Com a sua permissão, também usamos o Google Analytics para saber quais páginas são lidas e o Google AdSense para mostrar anúncios do seu interesse. Você muda de ideia quando quiser em “Preferências de cookies”, no rodapé. Saiba mais na [política de cookies](/legal/cookies)."
  - Só anúncios (GA vazio): o texto de hoje.
  - Só GA (sites irmãos sem AdSense): "...também usamos o Google Analytics para saber quais páginas são lidas. Você muda..."
- Linha de ações (`flex flex-col gap-2 sm:flex-row sm:items-center`):
  - "Personalizar": botão de texto, `min-h-11 px-2 text-[0.9rem] font-bold text-ink-soft underline underline-offset-4 hover:text-ink sm:mr-auto`. No celular fica **por último**, centralizado (`order-last sm:order-first`).
  - "Só os essenciais": igual ao de hoje (`rounded-full border border-line px-5 hover:bg-sunken`).
  - "Aceitar todos": igual ao de hoje (`bg-brand text-brand-ink hover:bg-[#a92c23]`).
  - No celular os dois botões ocupam a largura toda, um sobre o outro, mesma altura (44 px).

**Camada "personalizar"** (clique em "Personalizar" ou "Preferências de cookies" no rodapé), no mesmo cartão:
- `h2` "Preferências de cookies" com `tabIndex={-1}`; o foco vai para ele ao trocar de camada.
- Lista com 3 linhas (`divide-y divide-line`, cada linha `grid grid-cols-[1fr_auto] items-start gap-4 py-3`):
  1. **Essenciais** — "Login da equipe, tema claro ou escuro e esta escolha. Sem eles o site não funciona." À direita, o texto
     "Sempre ativos" (`text-[0.78rem] font-bold text-ok`), sem chave.
  2. **Estatística** (subtítulo pequeno "Google Analytics") — "Mostra quais páginas são lidas e por quanto tempo, sem identificar você. O Google não guarda o seu IP." Chave. **Some se o GA estiver vazio.**
  3. **Anúncios personalizados** (subtítulo "Google AdSense") — "Mostra anúncios de acordo com os seus interesses. Sem isso, os anúncios continuam, mas genéricos." Chave. **Some se os anúncios estiverem desligados.**
  - Nome: `text-[0.9rem] font-bold text-ink`; subtítulo: `text-[0.75rem] font-semibold text-ink-soft`; descrição: `mt-0.5 text-[0.82rem] leading-relaxed text-ink-soft`.
- Ações: "Voltar" (botão de texto como o "Personalizar", só se veio do resumo), "Salvar escolhas" (estilo de "Só os essenciais") e "Aceitar todos" (vermelho). Mesmo arranjo do resumo no celular.
- Esc fecha **só** quando reaberto pelo rodapé (sem mudar nada). Na 1ª visita não há "fechar": é preciso escolher.

### Tokens (já existem em `app/app.css`; usar as classes, não os hex)

| Token | Claro | Escuro |
|---|---|---|
| `surface` (fundo do cartão) | `#ffffff` | `#1b171a` |
| `line` (borda, divisórias) | `#efe6e6` | `#2f282b` |
| `ink` / `ink-soft` | `#1c1414` / `#6e5f5f` | `#f4eff0` / `#ab9d9f` |
| `sunken` (hover do contorno) | `#f4eded` | `#231e21` |
| `brand` (aceitar, chave ligada) | `#c2352b` | `#c2352b` |
| `ok` ("Sempre ativos") | `#1f7a4d` | `#4cc98f` |
| chave desligada (novo, arbitrário) | `#c9bcbc` | `#4a4043` |

Fonte Sora (a do site). Raio do cartão 16 px (`rounded-2xl`), botões em pílula. Espaço interno 20 px; 16 px entre texto e ações.

### Componente chave (switch)

- `<button type="button" role="switch" aria-checked={ligado} aria-labelledby="<id do nome>" aria-describedby="<id da descrição>">`.
- Trilho `h-[26px] w-11 rounded-full` (44 × 26 px, área de toque com `p-[9px] -m-[9px]` para 44 px de altura), desligado
  `bg-[#c9bcbc] dark:bg-[#4a4043]`, ligado `bg-brand`; bolinha `h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)]`,
  `translate-x-[3px]` desligada e `translate-x-[21px]` ligada, `transition-transform duration-150 ease-out motion-reduce:transition-none`.
- Foco: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`. Hover: `hover:brightness-95`.
- Sempre nasce **desligada** (salvo a escolha atual ao reabrir, ou o pré-preenchimento da v1 `all`).

### Estados

- **Normal / vazio:** não há lista vazia; categorias desligadas no site simplesmente não aparecem.
- **Carregando:** nenhum (o banner só aparece depois da checagem da CMP do Google, até 1,5 s; não mostrar esqueleto).
- **Erro:** sem `localStorage`, a escolha vale só na visita (sem aviso). Sem `gtag`, as chaves funcionam igual.
- **Teclado:** ordem de Tab = texto (link da política) → Personalizar/Voltar → Só os essenciais/Salvar → Aceitar todos; nas chaves, Espaço/Enter alternam.

### Reuso

Classes e tokens de hoje do `CookieConsent.tsx`; `Link` para `/legal/cookies`; padrão de "nasce só no navegador" do `AdSlot`.
Nenhum componente de chave existe no site: este é o primeiro (deixar dentro do `CookieConsent.tsx`; não criar biblioteca).

### Critério de pronto (visual)

- 375 px (claro e escuro): resumo com os dois botões de largura total e "Personalizar" embaixo; o cartão fica acima da barra
  inferior; a camada "personalizar" cabe com rolagem interna, sem cortar os botões.
- 1440 px: tudo numa linha, "Personalizar" à esquerda, os dois botões à direita do mesmo tamanho.
- Chave: anima 150 ms, foco visível, leitor de tela anuncia "Estatística, chave, desligada".
- Reabrir pelo rodapé abre direto em "Preferências de cookies" com as escolhas atuais.
- Anexar 4 prints ao dono (375 e 1440 px, resumo e personalizar).

## Riscos e cuidados

- **Duplicar page_view:** se a medição otimizada de "eventos do histórico" ficar ligada no GA, tudo conta em dobro. Conferir no DebugView antes de dar como pronto.
- **Ordem no `dataLayer`:** `js` e `config` precisam entrar antes do 1º `page_view`; `medir()` não pode enfileirar com o GA desligado (vazaria para depois do consentimento).
- **Hidratação:** nada do GA nem do banner no HTML do servidor (o cache da CDN e o HTML público continuam iguais para todos). Tudo em efeitos.
- **Dono medido sem querer:** o marcador `ap_logado` só existe com login; no celular sem login, usar `?nao-medir=1` uma vez.
- **Compatibilidade da v1:** quem aceitou tudo verá o banner de novo uma vez (esperado). Quem recusou não vê.
- **AdSense:** a chave Anúncios desligada mantém `ad_*` negados (anúncios genéricos/limitados, como "Só os essenciais" hoje). Não mexer no `AdSlot`.
- **`ads.ts` reexporta** o consentimento; não duplicar `CONSENT_KEY` em dois lugares.
- `npm run build` antes do push (React Router; loaders por `routePath`). Sem migration neste plano.

## Como verificar

1. `npm run typecheck`, `npm test`, `npm run build`.
2. Janela anônima em `https://animeprofile.com.br/`: o banner aparece; aba Rede filtrada por `google`: **nenhum** pedido a
   `googletagmanager.com`/`google-analytics.com` antes de aceitar.
3. "Personalizar" → ligar só Estatística → Salvar. Aparece `gtag/js?id=G-...` e um pedido `collect?...en=page_view`.
   `localStorage['ap-cookie-consent']` = `{"v":2,"analytics":true,"ads":false,...}`.
4. Navegar por 3 páginas pelo menu: 1 `page_view` por página, com o título certo (GA → Administrador → DebugView, abrindo
   o site com `?ga_debug=1`; ou Relatórios → Tempo real).
5. Abrir uma busca (`/busca?q=naruto`): `view_search_results` (senão, passo 12b). Terminar um quiz: `quiz_complete`. Clicar
   num "Leia também": `select_content`.
6. "Preferências de cookies" → desligar Estatística → Salvar: cookies `_ga*` somem (DevTools → Application → Cookies) e não
   sai mais `collect`.
7. Entrar pelo `/login` e voltar ao site: nenhum `collect`. `/admin`: nada do GA.
8. Navegador com `{"v":1,"choice":"essential"}` gravado à mão: recarregar, banner **não** aparece e o valor vira v2 falso.
   Com `{"v":1,"choice":"all"}`: banner aparece; "Personalizar" mostra Anúncios ligado e Estatística desligado.
9. `curl -sI https://animeprofile.com.br/` sem CSP (passo 1).

## Pendências do dono

1. **Criar a conta e a propriedade GA4** em analytics.google.com: uma conta "Sites" (ou a que preferir) e **uma propriedade
   por site** (animeprofile agora; respawnou, vibecoin e criasite quando forem implementar), fuso "Brasil/São Paulo", moeda BRL,
   cada uma com **um fluxo de dados da Web** (`https://animeprofile.com.br`).
2. **Mandar o ID de medição** (`G-...`, em Administrador → Fluxos de dados → o fluxo). É público, pode vir no chat.
3. No fluxo → **Medição otimizada** → engrenagem: **desligar "Mudanças de página com base em eventos do histórico do navegador"**
   (fica em "Visualizações de página" → Configurações avançadas) e "Interações de formulário"; manter rolagens, cliques
   externos, pesquisa no site (parâmetro `q`), engajamento com vídeo e downloads.
4. Administrador → **Retenção de dados**: eventos em **14 meses** (o padrão é 2; a política vai dizer 14).
5. Administrador → **Coleta de dados**: deixar os **Sinais do Google desligados**.
6. Opcional: **vincular o Search Console** (Administrador → Vinculações de produtos) e o **AdSense** (para ver a receita por página no GA).
   Opcional: marcar `quiz_complete` como **evento-chave**.
7. Aprovar o texto novo da Política de Cookies e da Privacidade (passo 14).
8. Já pendente: ativar no AdSense a mensagem **"Regulamentos europeus"** (com o passo 4 do plano, o banner próprio se cala para quem a vê).

## Critérios de pronto

- Sem consentimento de Estatística, nenhum pedido ao Google Analytics (nem o script).
- Com consentimento: 1 page_view por página com título certo, inclusive na navegação sem recarregar; nenhum no `/admin`,
  `/login`, para quem está logado ou com `?nao-medir=1`.
- Banner com as 3 ações e a camada "personalizar" conforme "Critério de pronto (visual)".
- Escolhas v1 tratadas como descrito; `CONSENT_VERSION = 2`.
- Textos legais aprovados e no ar; testes passando; build ok; docs atualizados.
- `app/analytics/README.md` explica a instalação em outro site.

## Como levar para respawnou, vibecoin e criasite

**O que se copia igual:** a pasta `app/analytics/` inteira e `tests/analytics.test.tsx` (trocando os nomes do `config.ts`).
**O que cada site faz por conta:** `config.ts`, o visual do próprio `CookieConsent.tsx` (mantendo o estilo do site, com as
mesmas 2 camadas, os mesmos textos e a mesma chave), o `root.tsx`, o rodapé e os textos legais.

Diferenças comuns aos três (o animeprofile é o único com constante; eles usam variável de ambiente):
- **ID pelo ambiente:** `GA_MEASUREMENT_ID` no Coolify, lido em `app/lib/ads.ts` (ou `app/analytics/config.ts` só no servidor) como
  o `adsenseClient()`, repassado pelo loader da raiz (`gaId: gaIdValido(process.env.GA_MEASUREMENT_ID)`) e zerado no `/admin`
  como o `adsClient`. Sem novo build ao mudar (é lido em tempo de execução; basta reiniciar).
- **Portão do banner:** hoje o `consentBootstrap` e o `<CookieConsent />` só existem com `adsClient`. Passa a ser
  `adsClient || gaId`; o banner recebe `ads={Boolean(adsClient)} analytics={Boolean(gaId)}`.
- **Logado:** não há o marcador `data-logado` do animeprofile. Usar só a regra de caminho (`/admin`) e a marca "não medir"
  (`?nao-medir=1` no navegador do dono). Se o site tiver um cookie de sessão do admin legível, adaptar a condição no `GoogleAnalytics.tsx` pelo `config.ts`.
- **Migração v1 → v2:** igual (todos estão em `CONSENT_VERSION = 1` com `choice: "all" | "essential"`).
- **Textos legais** ficam em TSX (`app/routes/cookies.tsx` e `app/routes/privacy.tsx` no vibecoin e no criasite; conferir o
  equivalente no respawnou), não em Markdown: aplicar o mesmo conteúdo do passo 14.
- Uma propriedade GA4 por site (pendência 1).

| Site | Chave do consentimento | Evento de reabrir | AdSense hoje | Particularidades |
|---|---|---|---|---|
| **respawnou** | `respawnou_consent` | `respawnou:cookies` | ligado (`ADSENSE_CLIENT` no ambiente desde 2026-11-22) | Já tem o `googleCmpApplies()` dentro do `CookieConsent.tsx`: apagar de lá e usar o do módulo. Visual de terminal (títulos `> COOKIES` em mono e caixa alta, classes `ch`/`chs`, `bg-ink-2`, acento `acc`): os botões ficam "SÓ OS ESSENCIAIS", "ACEITAR TODOS", "PERSONALIZAR" e a chave usa `bg-acc` ligada. O banner não esconde no `/admin` pelo caminho (só pelo `adsClient` zerado): o `use-consentimento` já cobre. `SEM_ANALYTICS` fica só com `/admin` e `/api` (os jogos em `/arcade/<jogo>` não têm anúncio, mas medir o GA neles é útil). Página de cookies em `/cookies`. |
| **vibecoin** | `vibecoin_consent` | `vibecoin:cookies` | **desligado** (sem `ADSENSE_CLIENT`) | Com GA e sem AdSense, o banner mostra só Estatística (texto "só GA"); o `Footer adsOn` vira `prefsOn = adsOn || gaOn`. Visual "Dia e Noite" (`rounded-xl`, `border-night-line-2`, acento `violet`/`glow`): chave ligada em `bg-violet`. O `/admin` ainda é da fase 3 (regra de caminho já cobre). |
| **criasite** | `criasite_consent` | `criasite:cookies` | **desligado** (conferir no README dele) | Igual ao vibecoin no código (mesma estrutura de `root.tsx`, `Footer adsOn` e páginas TSX). Visual próprio (`violet`, `glow`, `rounded-xl`). Sem CMP ainda: o módulo traz. |

Ordem recomendada: respawnou (já tem AdSense e CMP, mais parecido com o piloto) → vibecoin → criasite. **respawnou ✅ 2026-11-28** (`G-SDG7DBP241`; teste em `respawnou/app/analytics/analytics.teste.tsx`, formato `node:assert` porque o respawnou não usa Vitest). Em cada um: copiar a pasta,
ajustar `config.ts`, `root.tsx`, banner, rodapé e textos, rodar o roteiro de "Como verificar" trocando o domínio.
