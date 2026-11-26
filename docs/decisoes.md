# Registro de decisões

Mais recente no topo. Cada decisão diz o que foi decidido, quando e por quê.

## 2026-11-26 (plano) — Migração para a VPS no módulo do criasite

Detalhes em [plano-vps.md](plano-vps.md).

- **Decisão (proposta; 7 perguntas ao dono):** mesmo caminho do criasite (Coolify, `mariadb-sites`, Dockerfile, ensaio em
  endereço `sslip.io` com noindex, dump pelo phpMyAdmin, DNS só A e sem AAAA, lições 1 a 13). Próprio do animeprofile:
  dump com gzip; mídia copiada por SSH da hospedagem em tar (recomendado) em vez da lista do dump; uma tarefa `tick` a cada
  5 min no lugar do Cron Job (os horários continuam no código); app com 1 GB; sem CDN na VPS por enquanto; migration 016
  só depois da virada; site antigo mantido 14 dias como volta; `comunidade.` (Lovable) e o `animeprofile-old` fora.
- **Por quê:** o criasite já provou o caminho na mesma VPS; o animeprofile tem banco e mídia muito maiores (milhares de
  arquivos, inclusive alguns sem referência no banco) e o robô publica todo dia, então a cópia por SSH, a janela fora dos
  horários do robô e uma volta disponível reduzem o risco.

## 2026-11-19 (plano) — Topo (navbar) mais rico, sem mudar o HTML público

Detalhes em [plano-navbar.md](plano-navbar.md).

- **Decisão (proposta; 5 perguntas ao dono, nenhuma bloqueia):**
  - **Entram:** busca com sugestões (animes do banco, matérias e quizzes; buscas recentes no aparelho; "Em alta" com o
    campo vazio; atalho `/` e Ctrl+K; diálogo de tela cheia no celular, com o formulário GET de sempre sem JS); botão
    **"Agora"** (≥ 768 px) com última hora, episódios de hoje e tags em alta, e uma bolinha que pulsa só com notícia nova
    desde a última abertura; **"Instalar app"** só quando o navegador oferece (registrar o `sw.js` que já existe e
    corrigir o manifesto herdado: cor roxa e atalhos para páginas "em breve"); **pílulas da equipe** (≥ 1280 px) com o
    robô ("4/10") e os visitantes de hoje, vindas do `/api/eu` só para admin/moderador.
  - **Ficam de fora:** atalhos de seção no topo (repetem a lateral), faixa rolante de última hora, saldos/nível/XP (sem
    economia seriam "0" falso), decoração de datas, menu "Mais" com redes e tema (pergunta ao dono).
  - **Celular (375 px):** nenhum botão novo no topo; a busca ganha sugestões no diálogo e "Instalar o app" vai para a
    gaveta. O nome no avatar passa a aparecer só a partir de 1280 px, para caber o "Agora" em 1024 px.
  - **Dados:** dois endpoints públicos e iguais para todos (`/api/agora`, `/api/sugestoes`), com cache da CDN e do
    `cached()` em memória; são as únicas rotas de `/api` sem `no-store`. As sugestões nunca chamam o AniList.
- **Por quê:** o dono achou o topo simples demais; o topo é a peça presente em todas as páginas. Tudo o que entra usa dado
  real que o site já tem, mantém o cache de 60 s (nada lido da sessão no servidor) e não cria link indexável para o que
  não existe.

## 2026-11-19 (plano) — Próximas telas do painel `/admin`, com a segurança dos loaders antes

Detalhes em [plano-telas-painel.md](plano-telas-painel.md).

- **Decisão (proposta; 10 perguntas ao dono, nenhuma bloqueia):**
  - **Etapa 0 antes de qualquer tela:** todo `loader`/`action` de `app/routes/admin/*` chama `requireAdmin` (não basta o
    layout: na navegação por clique o React Router pede só o loader filho, `/admin.data?_routes=...`, e o do layout não
    roda, então os números do painel ficavam legíveis sem login); `server-app.js` passa a dar `no-store` e `noindex` também
    a `/admin.data` e `/login.data`; `em-construcao.tsx` usa `routePath`. Um teste percorre todas as rotas do admin.
  - **Painel em `/admin`** (pendências, hoje, robô, recentes) e as visitas completas em `/admin/visitas`.
  - **Métricas sem número falso:** audiência e conteúdo com dado real (visitantes, páginas por visita, busca, conclusão
    do quiz, procura pelas contas, rendimento por origem), retrato semanal e registro de decisões (migration 014); o funil
    das contas aparece só como esqueleto "começa quando o cadastro abrir".
  - **Posts:** lista paginada no servidor e editor Tiptap (como no antigo), endereço travado depois de publicado, excluir
    só rascunho, versões e aviso de conflito, agendamento por tarefa de 5 em 5 min, imagens próprias em `/media/painel`,
    e a importação do antigo não sobrescreve matéria editada no painel (`edited_at`, migration 015).
  - **Notícias IA:** 9 abas sobre as tabelas da 012 (sai Desempenho, Tendências e Títulos alternativos por enquanto); o
    painel chama as funções do robô direto, sem o `CRON_TOKEN` no navegador.
  - **Artigos e quizzes por IA numa fila só** (`ai_requests`, migration 016, tarefa `pedidos-ia`), com a cota do Gemini
    dividida e prioridade do robô de notícias. Banco de imagens e ideias de quiz ficam para depois.
  - **Itens da barra:** Agendamentos fica (o site tem `cron_jobs`) e vem logo depois dos 6; recomendado tirar Eventos e
    Sistemas (os sistemas saíram) e, até decisão do dono, WhatsApp e Títulos no Google.
- **Por quê:** é a ordem do dono (primeiro o que o recebimento de usuários exige); o painel precisa estar seguro antes de
  guardar mais dados; reaproveitar o robô, a agenda, o módulo de Visitas e as tabelas que já existem evita refazer o que
  funciona; números de contas zerados confundiriam a leitura.

## 2026-11-19 (plano) — Menus de logado no formato do antigo, sem mudar o HTML público

Detalhes em [plano-menus-logado.md](plano-menus-logado.md).

- **Decisão (proposta; 5 perguntas ao dono, nenhuma bloqueia):**
  - Os itens só de logado saem sempre no HTML, escondidos por CSS (`hidden logado:block`); o marcador `ap_logado` passa a
    levar os papéis (`ap_logado=admin`) e o script do `<head>` põe `data-papeis`, com as variantes `papel-admin:` e
    `equipe:`. Os itens de logado viram link só no navegador e só para quem está logado: o HTML público (e o Googlebot)
    não tem `href` para páginas "em breve". Saem `LOGGED_IN` e `visibleNav()`. Supera a pergunta 3 do plano de login
    (itens `auth` escondidos também para o admin).
  - Papéis sem tabela: tipo `Papel` em `app/lib/papeis.ts` e `podeVer()`; no painel o filtro é no servidor (loader do
    `/admin`), nos menus públicos pelo marcador, confirmado por `/api/eu`.
  - Regra por item: real se a página existe; "em breve" (com selo) se volta com contas/economia/chat e já tem endereço
    pendente; de fora se o sistema saiu, se é atalho pessoal do antigo ou se mostraria saldo falso (AP Coins, Rubis,
    nível, sequência nunca aparecem com "0").
  - Topo logado: só o sino, com estado vazio; Check-in e Mensagens ficam desligados em `HEADER_ACOES`. Menu do usuário
    com os blocos do antigo (`USER_MENU`), mais "Premium"; "Reportar um problema" vai para `/contato`.
  - Painel: barra lateral com os grupos do antigo (`app/lib/admin-nav.ts`), Visitas real, 8 itens "em breve" sem link, os
    que dependem de contas/economia guardados como "depois" e os sistemas que saíram de fora; mesma pele e mesmo
    "recolher" do menu do site; específico do animeprofile (fora do módulo `app/visitas/`).
- **Por quê:** o dono quer os menus montados agora no formato do antigo; o CSS antes da pintura evita o menu pular e o
  erro de hidratação, e mantém o cache de 60 s da CDN; sem links para "em breve" no HTML, o Google não gasta rastreio em
  páginas `noindex`.

## 2026-11-19 (plano) — `/login` só para o administrador; contas de todos depois

Detalhes em [plano-contas-login.md](plano-contas-login.md).

- **Decisão do dono:** por enquanto só o login do administrador e nenhuma conta nova. Importação dos usuários, login
  para todos, Google, SMTP, Turnstile e cadastro aberto ficam para as fases 2 e 3 ("não agora").
- **Decisões do plano (fase 1):**
  - `/login` no formato do site antigo (marca, título, cartão com Google, divisor, e-mail e senha, rodapé), no visual
    novo e dentro da moldura do site; Google visível e desativado com "Em breve"; sem "Esqueci minha senha"; aviso de
    que as contas da comunidade voltam em breve. `/admin/login` redireciona para `/login?redirect=/admin`.
  - O admin continua definido pelas variáveis `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` (sem tabela
    nova, sem migration). Uma função `getViewer(request)` devolve o usuário com `papeis: ["admin"]`, e `requireAdmin`
    passa a conferir o papel; na fase 2 só `getViewer` muda.
  - O cabeçalho lê o estado no navegador (`GET /api/eu`, `no-store`) e só quando existe o cookie marcador `ap_logado`
    (sem segredo); um script no `<head>` evita o "Entrar" piscar. O HTML público continua igual para todos, com
    `s-maxage=60`. `/login` e `/sair` sem cache.
  - Menu do usuário: avatar com a inicial, "Administrador", "Administração" (só com o papel admin) e "Sair". Os itens
    do menu só para logados continuam escondidos também para o admin (`LOGGED_IN = false`).
- **Por quê:** o dono quer entrar pela mesma porta que todos vão usar, sem depender de SMTP, Turnstile ou Google agora;
  ler a sessão no navegador mantém o cache da CDN, que segura o tráfego do site.

## 2026-11-19 (plano) — Contador de visitas próprio, sem cookie, e painel `/admin` sem contas

Detalhes em [plano-painel-visitas.md](plano-painel-visitas.md).

- **Decisão (proposta, falta o dono responder 6 perguntas):**
  - **Coleta:** um sinal do navegador (`sendBeacon` para `/api/v`) depois que a página abre e a cada troca de endereço.
    Sem cookie e sem nada guardado no aparelho; robôs (`isbot`), pré-carregamentos, o admin e recarregamentos em 30 s
    não contam.
  - **Visitante aproximado:** hash de IP + navegador + um sal aleatório que é trocado e apagado todo dia; o IP nunca é
    gravado. Visitantes únicos só por dia (7 e 30 dias mostram a média diária).
  - **Armazenamento:** contadores agregados por dia (`visit_daily`, `visit_pages`, `visit_dims`, `visit_seen`, migration
    013), gravados em lote a cada 10 s. Páginas e origens por 13 meses; totais por dia sem prazo.
  - **`posts.views_count` e `blog_posts.views_count` voltam a andar** pela mesma coleta (30 min por pessoa e matéria), e a
    importação do site antigo não pode mais baixar o número (`GREATEST`).
  - **Proteção:** o login do admin dos sites irmãos (e-mail + hash scrypt + `SESSION_SECRET` em variáveis de ambiente),
    cookie `__ap_admin` assinado, `HttpOnly`, `SameSite=Strict`, `Path=/`, limite de tentativas por IP e global. Troca
    pelo papel `admin` das contas quando elas voltarem, só dentro de `requireAdmin()`.
  - **Reuso:** o módulo `app/visitas/` é copiado para criasite, vibecoin e respawnou; por site mudam só `config.ts`,
    `db.ts` e as cores em `visitas.css`.
- **Por quê:**
  - **CDN:** com o HTML em cache por 60 s, o servidor não vê a maioria das visitas; o `POST` em `/api` sempre chega.
  - **LGPD e banner:** sem cookie e sem dado pessoal guardado, a contagem não depende do banner de cookies (que ainda não
    existe). O site antigo só contava quem aceitava cookies.
  - **Custo:** uma linha por visita (modelo antigo) chegaria a milhões de linhas por ano; agregado por dia fica em
    centenas de milhares no pior caso.
  - **"Em alta" parado:** desde a virada nada somava `views_count`; as matérias do robô ficavam sempre com 0.

## 2026-11-17 (plano) — Otaku TV no esquema do site antigo, com um "palco" escuro

Detalhes em [plano-otaku-tv.md](plano-otaku-tv.md).

- **Decisão (proposta, falta o dono responder 4 perguntas):**
  - **Estrutura do antigo:** player grande no topo (primeiro vídeo parado quando não há `?v=`), "A seguir" ao lado com
    a altura do player, abas e busca, grade só com vídeos de matérias de anime e fileiras "Veja também" das outras
    categorias a cada 12 vídeos.
  - **Acabamento novo:** cabeçalho, abas, player e fila num palco `night` (modo cinema); grade na página clara; largura
    de até 1600 px só nesta página; músicas (AnimeThemes) no mesmo player.
  - **Endereço:** continua `/otaku-tv?v=<id>`, com a canônica da aba e sem `VideoObject` na lista.
  - **Player:** iframe `youtube-nocookie` só depois do clique; toca sozinho só quando a troca vem de um clique na
    visita, nunca em link compartilhado. Trocar de vídeo não roda o loader (`shouldRevalidate`).
  - **Conta:** curtir, salvar, histórico, comentar e "Sessão pipoca" não aparecem até as contas voltarem.
- **Por quê:**
  - **Pedido do dono:** "a página Otaku TV deve ficar no esquema da página do site antigo, parecendo um YouTube", com
    melhoria de layout.
  - **Cache de 60 s e sem cookie:** o que muda por visitante (vídeo tocando) fica no navegador; o HTML é o mesmo.

## 2026-11-15 (plano) — Robô de notícias volta antes das contas, no cron do próprio site

Detalhes em [plano-robo-noticias.md](plano-robo-noticias.md).

- **Decisão:**
  - **Ordem (resposta do dono à pergunta 2 da virada):** a fase A (robô de notícias) vem antes das contas. Isso
    substitui o "durante a lacuna o robô fica parado" da decisão abaixo: a meta é ligar no dia da virada (17/11).
  - **Onde roda (plano):** tarefa `robo-noticias` no cron do site novo (Node + MySQL), sem GitHub Actions. A única
    chave é `GEMINI_API_KEY` (plano grátis, projeto sem faturamento), cadastrada pelo dono no hPanel.
  - **Ligar e desligar:** pelo modo em `system_config.robo` (`desligado`, `ensaio`, `rascunho`, `publicar`), trocado
    por `/api/robo/modo` com o `CRON_TOKEN`. Só liga `publicar` depois de um ensaio com prévias aprovadas.
  - **Proteção do que o robô publicar:** as matérias ganham `origin` (`old` ou `robo`), e a importação do site antigo
    passa a apagar e religar só as `old`.
- **Por quê:**
  - **SEO:** notícia nova é o que mantém o Google e o Google Notícias.
  - **Opção A em vez de GitHub Actions:** o repositório é público (os logs das Actions seriam públicos), o
    agendamento do GitHub já falhou neste projeto, e a tarefa roda depois do `202`, sem o limite de ~55 s da CDN.
- **Pendente:** as 4 perguntas do fim do plano (guia editorial fora do git, teto do primeiro dia, Firecrawl, cota
  fora de anime).

## 2026-11-15 — Virada parcial em 4 dias, sem contas

Detalhes em [plano-virada-parcial.md](plano-virada-parcial.md).

- **Decisão:**
  - **Prazo e escopo (decisão do dono):** o domínio passa ao site novo só com o que já existe: notícias, artigos,
    animes, personagens, Otaku TV, quiz, blog e figurinhas em leitura, páginas legais e contato. Login, moedas, chat,
    quarto, comentar e admin voltam depois, em fases.
  - **Antes de tudo, o resgate:** backup completo do Lovable Cloud (banco, `auth.users` com o hash bcrypt,
    `auth.identities`, lista e arquivos do storage, contagens). Fica fora do repositório, num `.7z` cifrado com
    AES-256, em 2 cópias.
  - **Dois dumps:** um no dia 1, como garantia, e o **dump final** no dia 4, depois da virada. As contas e os saldos
    são importados do dump final.
  - **Imagens:** todas as que o conteúdo usa vão para `/media/<bucket>/<caminho>`, sem recompressão, antes da
    virada. Os endereços são trocados no retrato da exportação.
  - **Páginas que dependem de conta:** dizem "volta em breve" (200 + `noindex`), sem link para o site antigo. Uma
    faixa em todas as páginas e a página `/site-novo` explicam a mudança.
  - **Mercado Pago e descadastro:** as notificações do Mercado Pago e os pedidos de `/unsubscribe` são só guardados,
    para processar depois.
  - **Hora da virada:** dia 3 (17/11) de manhã, deixando o dia 4 de margem para o rollback pelo DNS.
  - **Durante a lacuna:** o robô de notícias fica parado (os workflows do site antigo são desativados).
- **Por quê:**
  - **O prazo:** o Lovable Cloud passou a cobrar créditos, e o site antigo sai do ar no fim de 2026-11-18. Depois
    disso, não há rollback nem como recuperar dados ou imagens.
  - **Fazer as contas a tempo:** em 4 dias não dá para construir contas e economia com segurança. O que os usuários
    não podem perder (saldo, coleção, senha) fica garantido pelo backup.

## 2026-11-15 (plano) — Um sistema só de barra lateral, lido no servidor e com cache curto

Detalhes em [plano-sidebars.md](plano-sidebars.md).

- **Decisão:**
  - **Componentes únicos:** as laterais (matéria, Central, categoria/tag, blog) usam os mesmos blocos de
    `app/components/sidebar.tsx`, escolhidos por tipo de página numa tabela (`SIDEBAR_PRESETS` em `app/lib/sidebar.ts`)
    e lidos no `loader` por `app/server/sidebar.server.ts`.
  - **Cache em memória de 5 a 10 minutos** para os blocos iguais para todo mundo; a importação do conteúdo limpa o
    cache.
  - **Quadro vazio não aparece**, e cada página tem no máximo 5 quadros (a matéria, 6 contando os fixos).
  - **Fica para depois:** o que depende de contas, economia ou feed (ranking, check-in, estatísticas, histórico de
    pulls, lateral do feed) e o anúncio lateral (espera AdSense e banner de cookies). Comunidades, clãs e eventos não
    voltam.
  - **Menu à esquerda do site antigo:** não volta como lateral; ele já virou o topo.
- **Por quê:**
  - **Pedido do dono:** os elementos das laterais do site antigo são importantes, mesmo com o layout novo.
  - **Velocidade e SEO:** dados no HTML do servidor (sem pular a tela ao carregar) e sem uma consulta extra por
    quadro a cada visita.

## 2026-11-14 (plano) — Quiz pontuado no servidor; blog público em `/blog`; figurinhas em `/media`

Detalhes em [plano-quiz-blog-figurinhas.md](plano-quiz-blog-figurinhas.md).

- **Decisão:**
  - **Quiz:**
    - **Gabarito:** a página não recebe o gabarito (`correct`, `result`, `explain`, `minScore`). O servidor confere
      cada resposta do quiz de conhecimento e calcula o resultado no fim.
    - **Partidas:** são contadas sem login, no máximo uma por IP (só o hash) a cada 10 minutos por quiz, e as de
      robô não contam.
    - **Contagem do site antigo:** fica separada da nova (`plays_old` e `plays_new`). Importar de novo não apaga as
      partidas jogadas aqui.
  - **Blog:**
    - **Lista pública:** `/blog` (no site antigo era só para admin; o público lia em `/news?tipo=blog`, que agora
      leva a `/blog` com 301).
    - **`/blog/criadores`:** vai para `/blog` (302) até a economia existir.
    - **Texto:** o Markdown vira HTML na importação, com uma limpeza própria para conteúdo de usuário: sem iframe e
      sem HTML cru, e os links externos com `nofollow ugc`.
  - **Figurinhas:**
    - **Cópia das imagens:** o script no PC copia o arquivo original, sem recompressão, para
      `/media/figurinhas/<hash>`, por um endpoint protegido pelo `CRON_TOKEN`.
    - **Miniatura:** uma WebP de 400 px para as grades, gerada no PC.
    - **`season_albums`:** não vem (nenhuma tela usa, e `seasons` não vem).
- **Por quê:**
  - **Quiz:** no site antigo o gabarito ficava no código da página. Com a regra no servidor, as missões e as
    recompensas das contas já nascem protegidas.
  - **Blog:** `/blog` é o endereço que estava no sitemap, e o Google via só um carregamento.
  - **Figurinhas:**
    - **Pedido do dono:** as imagens não podem perder qualidade.
    - **Supabase:** o servidor continua sem conhecer o Supabase.

## 2026-11-15 — Otaku TV: o que vem do nosso banco e o que vem do navegador

- **Decisão:**
  - **Das matérias e Trailers da temporada:** o servidor lê do nosso banco. Os vídeos do texto das matérias ficam
    em `post_videos`, e os trailers vêm do AniList guardado em `anime_catalog`.
  - **Aberturas e encerramentos:** o navegador chama o AnimeThemes direto, como o site antigo fazia.
- **Por quê:**
  - **AnimeThemes:** a API leva de 6 a 10 s e respondeu 503 durante o desenvolvimento. Num pedido do navegador, uma
    falha mostra um aviso com "Tentar de novo" e não afeta mais nada. No servidor, travaria a página.

## 2026-11-14 — Robôs não disparam buscas no AniList

- **O que aconteceu:**
  - **O robô:** um robô percorreu o sitemap do endereço de teste, ignorando o `robots.txt`.
  - **O efeito:** cada ficha de anime aberta virou um pedido ao AniList, cerca de 1.400 em 20 minutos.
- **Decisão:**
  - **Cota de buscas por minuto e por processo:** fichas de anime ou personagem ainda não guardadas são buscadas no
    AniList dentro de uma cota. Pessoas podem fazer até 20 buscas e robôs até 5, reconhecidos pelo `isbot`
    (`app/server/anime/remote-guard.server.ts`).
  - **Sem cota:** a página responde 503 com `Retry-After` ("volte daqui a pouco"), nunca 404. O Google tenta de novo
    em vez de tirar a página do índice.
  - **Personagens:** ficam fora do sitemap.
- **Por quê:**
  - **Limite do AniList:** é de cerca de 90 pedidos por minuto. Estourar deixaria o site sem dados novos e lento.

## 2026-11-14 — Animes guardados no banco, vindos do AniList

- **Decisão:**
  - **De onde vêm os dados:**
    - **Temporada, em alta e horários:** a tarefa `animes-anilist` busca no AniList, gratuito e sem chave, a cada
      6 horas, e guarda no MySQL. São cerca de 15 pedidos, longe do limite.
    - **Fichas de animes antigos:** são buscadas na primeira visita e renovadas a cada 3 dias.
    - **No site antigo:** o navegador consultava o AniList a cada visita.
  - **Sinopses em português:** as do site antigo, traduzidas pelo Gemini, vêm na exportação. Animes sem tradução
    mostram a sinopse original em inglês, com aviso, até o robô de tradução existir.
  - **Top 10 da semana:** por enquanto é o "em alta" do AniList, preferindo os que estão em streaming no Brasil,
    como no site antigo. Os favoritos dos usuários entram quando as contas forem migradas.
- **Por quê:** a página fica mais rápida, aparece para o Google e continua no ar se o AniList cair.

## 2026-11-13 — Sem "Faça parte"; o site novo não fala com o Supabase

- **Decisão:**
  - **"Faça parte":** a página sai. O endereço antigo leva ao Contato.
  - **Importação do conteúdo, feita do computador do desenvolvedor:**
    - **Quem lê o site antigo:** o script `scripts/exportar-conteudo-antigo.mjs` lê a API pública e envia um retrato
      compactado ao site novo, em `POST /api/importar/conteudo`, protegido pelo `CRON_TOKEN`.
    - **O que o site novo sabe do Supabase:** nada, nem endereço nem chave.
    - **Repetir:** sem duplicar; o que sai do site antigo sai daqui também.
  - **Sem atualização automática:** o site de teste fica com o conteúdo da última exportação. Na hora de desligar o
    site antigo, uma última exportação traz o que foi publicado depois.
  - **Imagens das matérias:** continuam apontando para o armazenamento do site antigo até a importação final dos
    arquivos (fase 6).
- **Por quê:**
  - **"Faça parte":** não é mais necessária (decisão do dono).
  - **Importação:** a ideia é sair do Supabase. Colocar endereço e chave dele no servidor novo, mesmo
    temporariamente, ia contra isso.

## 2026-11-13 — Visual definitivo: "Top 10 claro"

- **Decisão:**
  - **O que muda:** o layout "página de mangá carimbada" sai e entra o "Top 10 claro", escolhido em 4 rodadas de
    opções.
  - **O visual novo:** capa e cabeçalhos numa faixa escura cinematográfica, página clara, fonte Sora, vermelho
    `#c2352b`, Top 10 com números gigantes e figurinhas num painel escuro.
  - **Página inicial:** mantém a divisão de seções do site atual.
  - **Detalhes:** em [design.md](design.md).
- **Por quê:**
  - **Reprovação:** o primeiro layout ficou diferente demais do site atual.
  - **Escolha:** o dono quis uma evolução bonita, que os usuários reconheçam.

## 2026-11-12 — Contas por último; visual novo com a mesma marca

- **Decisão:**
  - **Ordem:** primeiro tudo o que não precisa de conta (layout, páginas institucionais, notícias, artigos,
    animes, quiz). Cadastro, login e o que depende deles ficam por último.
  - **Visual:** a marca continua (logo e vermelho `#bb0000`), com acabamento novo, no nível do respawnou: "página de
    mangá carimbada" (ver [design.md](design.md)).
  - **Fontes:** Dela Gothic One nos títulos e M PLUS 2 no texto, no lugar de Outfit e Inter.
  - **Páginas de texto:** escritas em Markdown (`app/content/paginas/`). Mudar um texto legal não exige mexer em
    código.
  - **Textos legais atualizados para o site novo:**
    - **Operadores:** Hostinger no lugar de Lovable, Supabase, Cloudflare e Resend. Google Gemini no lugar do gateway
      do Lovable. Entraram o Firebase, o Turnstile e o Mercado Pago, que já eram usados e não estavam listados.
    - **Removidos:** Stripe e assinaturas legadas, eventos e os cookies antigos de sessão (`sb-*`) e de telemetria
      (`ap_pv_*`).
  - **Contato:** a página ganhou formulário (antes era só o e-mail). As mensagens ficam no banco, e o painel admin
    vai listá-las.
- **Por quê:**
  - **Ordem:** o dono quer deixar as contas para o fim.
  - **Visual:** o pedido foi melhorar o layout sem que os usuários estranhem.
  - **Textos legais:** precisam dizer a verdade sobre quem trata os dados.
- **Pendente antes da virada:**
  - **Datas de atualização:** conferir as datas e a versão dos Termos e da Privacidade (a mudança de operadores é
    material: pede novo aceite no login).
  - **Banner de cookies:** fazer, antes de ligar Analytics ou AdSense.

## 2026-11-12 — Arquitetura do site novo

- **Decisão:**
  - **Contas próprias:**
    - **Senhas antigas:** são conferidas no formato bcrypt do Supabase. As senhas novas usam `scrypt`.
    - **Sessão:** fica num cookie `HttpOnly`.
    - **Google:** login com cliente OAuth próprio.
  - **Regras no servidor:**
    - **Onde ficam:** as 813 funções e as regras de segurança do banco viram módulos TypeScript em `app/server/`.
    - **Dinheiro e coleção:** passam por transação, trava de linha e chave única contra pagamento duplicado.
  - **Carteira separada do perfil:**
    - **Onde ficam os saldos:** na tabela `wallets`.
    - **Extrato:** toda movimentação de AP Coins e Rubis grava uma linha no extrato.
    - **Contadores da semana e do mês:** são calculados a partir do extrato.
  - **Tempo real por consulta periódica:** a cada 3 s com o chat aberto e a cada 60 s para avisos, mais o push do
    Firebase.
  - **Uma entrada só no cron da Hostinger** (`/api/cron/tick` a cada 5 min), com a agenda das tarefas no banco.
  - **Imagens das redes sociais:** geradas com `satori` + `sharp` no próprio servidor, sem navegador e sem
    GitHub Actions.
  - **Conteúdo das matérias:** continua em HTML.
  - **Endereço de teste:** `novo.animeprofile.com.br`. O domínio principal só é ligado na virada.
- **Por quê:**
  - **Tudo na Hostinger, sem custo extra:** nenhuma dessas peças depende de serviço pago.
  - **Mesmo modelo do respawnou:** aproveita o que já funciona lá.
  - **O que os usuários não podem perder:** saldo, coleção e login.
- **Detalhes:** [arquitetura.md](arquitetura.md), [banco-de-dados.md](banco-de-dados.md),
  [enderecos.md](enderecos.md) e [deploy-hostinger.md](deploy-hostinger.md).

## 2026-11-12 — O que continua e o que sai, item a item

- **Decisão:**
  - **Continuam:** mensagens diretas (com o histórico), quarto otaku e pets, Otaku TV, blog dos usuários,
    comentários nas notícias e os quizzes gerados no painel admin.
  - **Saem:** eventos, Rádio, Liga semanal e os pedidos de matéria e de quiz feitos pelos usuários.
- **Por quê:** continua o que é usado ou guarda algo dos usuários. Com 171 usuários e um banco pequeno, trazer o
  histórico inteiro do que fica é simples.

## 2026-11-12 — Sem jogos e sem versão em inglês; só a branch main

- **Decisão:**
  - **Fora do site novo:** os jogos (Fig Battle e Jogo da Memória) e a versão em inglês (`/en`). Não vêm nem as
    telas nem os dados.
  - **Repositório:** só a branch `main`, sem `develop`. Cada push em `main` publica.
- **Por quê:** menos coisa para construir e manter. A versão em inglês dobraria o trabalho de cada tela.
- **Consequência:** os endereços `/en/...` e os dos jogos levam, com redirecionamento permanente, para a página
  equivalente em português ou para a mais próxima.

## 2026-11-12 — O site antigo congela

- **Decisão:** nenhuma melhoria ou alteração no site antigo enquanto o novo é construído.
- **Por quê:** para não precisar refazer no novo o que mudar no antigo, e para o inventário não mudar no meio do caminho.

## 2026-11-12 — O que não vem para o site novo

- **Decisão:**
  - **Recursos que saem:** Stripe, Clãs, Fórum e Comunidades. Não vêm nem as funções nem os dados.
  - **Feed:** continua como recurso, mas as publicações antigas não vêm, porque o feed se renova sozinho.
- **Por quê:** não são mais usados. Menos coisa para manter significa menos custo.

## 2026-11-12 — O que precisa vir

- **Decisão:** usuários (com as mesmas senhas), figurinhas, AP Coins e Rubis vêm obrigatoriamente. O resto está em
  [inventario.md](inventario.md).
- **Por quê:** é o que os usuários construíram. Perder isso seria sentido por eles.

## 2026-11-12 — Recriar do zero, tudo na Hostinger

- **Decisão:**
  - **Onde:** o Anime Profile é recriado num repositório novo e público (portfólio, todos os direitos reservados),
    no mesmo modelo do respawnou: React Router + Express no Node.js da Hostinger, MySQL, migrations aplicadas
    ao iniciar, cron da Hostinger e `docs/` como memória.
  - **Repositório antigo:** vira `animeprofile-old` e continua privado.
- **Por quê:**
  - **Custo:** o Lovable saiu caro, e o Supabase cobraria à parte no futuro.
  - **Tudo num lugar só:** todos os sites, os atuais e os próximos, ficam na Hostinger.
  - **Melhoria:** a recriação permite melhorar a arquitetura.
  - **Repositório limpo:** o antigo tem o `.env` com chaves no histórico e nunca pode virar público.
- **Consequências:**
  - **Contas:** passam a ser feitas pelo próprio site (antes, pelo Supabase).
  - **Permissões:** a checagem sai do banco e vai para o servidor.
  - **Tempo real:** o chat e as notificações passam a buscar novidades a cada poucos segundos (o plano Business não
    aceita conexão permanente).
  - **Arquivos:** ficam no disco da Hostinger.

## 2026-11-19: menus de logado (respostas do dono)

- Sem selo "em breve" nos menus de logado: tudo será construído antes de importar as contas dos outros usuários, testando com o admin (`animeprofile`).
- Topo logado: Check-in, Mensagens e sino, como no antigo (sem saldos nem nível por enquanto). Blog e Figurinhas só para logados.
- Barra do painel mostra os itens do antigo (26, sem "Ver escritório" e sem WhatsApp); telas feitas na ordem listada no README (3b3), primeiro o que o recebimento de usuários exige.
- Quarto otaku do painel será refeito com three.js; Títulos no Google, Sistemas e Agendamentos a reavaliar.
- Menu WhatsApp removido do painel (não será mais usado, 2026-11-19). "Níveis e recompensas" virou "Níveis" e "Custos e recompensas" virou "Custos".
