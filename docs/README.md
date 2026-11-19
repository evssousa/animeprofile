# Documentação e plano do Anime Profile (versão nova)

Esta pasta (`docs/`) é a memória do projeto. Tudo o que for decidido ou construído entra aqui, para que qualquer
pessoa (ou o Claude, depois de perder o contexto) saiba onde estamos e o que vem a seguir.

**Regra:** toda tarefa concluída atualiza o status abaixo e o documento da área.

O site antigo (repositório privado `animeprofile-old`) sai do ar no fim de 2026-11-18, quando acabam os créditos do
Lovable Cloud. Por isso, o domínio animeprofile.com.br passa para cá numa **virada parcial**, sem contas, em
2026-11-17 ([plano-virada-parcial.md](plano-virada-parcial.md)).

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [decisoes.md](decisoes.md) | Registro de decisões (o quê, quando e por quê) |
| [inventario.md](inventario.md) | O que vem do site antigo, o que muda e o que fica para trás |
| [arquitetura.md](arquitetura.md) | Stack, pastas, o que substitui o Supabase, login, economia, cron, imagens, variáveis |
| [banco-de-dados.md](banco-de-dados.md) | MySQL: migrations, conversão do PostgreSQL, tabelas por área, importação |
| [enderecos.md](enderecos.md) | Endereços que continuam e redirecionamentos do que saiu |
| [design.md](design.md) | Identidade visual: cores, tipografia, estrutura e componentes |
| [deploy-hostinger.md](deploy-hostinger.md) | Como o app roda na Hostinger, endereço de teste e cuidados com o domínio |
| [plano-quiz-blog-figurinhas.md](plano-quiz-blog-figurinhas.md) | Plano (temporário): Quiz, leitura do Blog da comunidade e catálogo de figurinhas, com migrations 009–011, exportação e cópia das imagens |
| [plano-virada-parcial.md](plano-virada-parcial.md) | **Plano urgente (temporário):** resgate dos dados do Lovable Cloud e virada parcial do domínio em 4 dias (sem contas), com cronograma por dia, o que é do dono e as fases depois da virada |
| [plano-sidebar-esquerda.md](plano-sidebar-esquerda.md) | Plano (temporário): menu lateral esquerdo como no site antigo (recolhível, sem piscar), topo com slot de menus extras e o celular no estilo do antigo (barra inferior, faixas que rolam, topo compacto, rodapé em 2 colunas) |
| [avisos-virada.md](avisos-virada.md) | Textos prontos dos avisos da virada para as redes (temporário) |
| [plano-robo-noticias.md](plano-robo-noticias.md) | Plano (temporário): robô de notícias por IA no cron do site novo (fase A, antes das contas), com inventário do robô antigo, migration 012, ensaio sem publicar e ligação na virada |
| [plano-otaku-tv.md](plano-otaku-tv.md) | Plano (temporário): Otaku TV com cara de "YouTube" como no site antigo (palco escuro com player e "A seguir", abas, busca, grade com fileiras de outras categorias, músicas no mesmo player, troca de vídeo sem recarregar, SEO) |
| [plano-painel-visitas.md](plano-painel-visitas.md) | Plano (temporário): painel `/admin` com contador de visitas próprio, sem cookie (sinal `/api/v`, agregado por dia, login do admin por variáveis de ambiente) e o módulo `app/visitas/` copiável para criasite, vibecoin e respawnou |
| [plano-contas-login.md](plano-contas-login.md) | Plano (temporário): `/login` no formato do site antigo, **fase 1 só para o administrador** (sessão das variáveis `ADMIN_*`, menu do usuário com "Administração", estado lido no navegador por `/api/eu` sem quebrar o cache da CDN); fases 2 (contas de todos, importação) e 3 (Google) resumidas, "não agora" |
| [plano-menus-logado.md](plano-menus-logado.md) | Plano (temporário): menus de quem está logado no formato do antigo, em 4 entregas: menu lateral, navbar (sino), menu do usuário e barra lateral do painel `/admin`, sem quebrar o cache da CDN (itens por CSS `logado:`/papéis no marcador, sem links para "em breve" no HTML público) |
| [plano-sidebars.md](plano-sidebars.md) | Plano (temporário): inventário das barras laterais do site antigo e o sistema único de lateral (blocos por página, cache curto) para a matéria, Central, categoria/tag, blog, Otaku TV e quiz |

## Status

Legenda: ✅ feito · 🔄 em andamento · ⏳ próximo · 💤 depois · ❓ esperando decisão do dono

| Fase | Item | Status |
|---|---|---|
| 0 | Decisão: tudo na Hostinger, MySQL, repositório novo de portfólio | ✅ |
| 0 | Inventário do site antigo: o que vai e o que não vai | ✅ |
| 0 | Respostas do dono às perguntas do inventário | ✅ |
| 0 | Números do banco antigo (linhas por tabela, tamanho dos arquivos) | ✅ |
| 0 | Renomear o repositório antigo para `animeprofile-old` e criar o `animeprofile` | ✅ |
| 1 | Arquitetura, banco, endereços e deploy (no modelo do respawnou) | ✅ |
| 2 | Esqueleto do app no ar em `novo.animeprofile.com.br` (build, banco, migrations, cron) | ✅ |
| 2 | Layout novo "Top 10 claro" (topo, rodapé, cabeçalhos, tema claro e escuro) | ✅ |
| 2 | Páginas institucionais e legais e formulário de Contato (a página "Faça parte" saiu em 2026-11-13) | ✅ |
| 2 | Notícias e artigos: listas, matéria, categoria, tag, autor, busca e página inicial | ✅ |
| 2 | Importação das matérias do site antigo pelo script `exportar-conteudo-antigo.mjs` (refazer na virada) | ✅ |
| 2 | Sitemaps (índice, fixas, Google News, matérias, taxonomia) e RSS em `/rss.xml` | ✅ |
| 2 | Animes: `/animes` (busca, no ar hoje, Top 10, temporada), ficha `/animes/:id`, calendário e seções da home | ✅ |
| 2 | Personagens (`/animes/personagem/:id`): sobre (spoilers escondidos), ficha, animes e dublagem | ✅ |
| 2 | Matéria com barra lateral (anime da matéria, destaque, últimas, comentários, índice e em alta), compartilhar e comentários (leitura) | ✅ |
| 2 | Otaku TV: vídeos das matérias, trailers da temporada e aberturas/encerramentos (AnimeThemes, no navegador) | ✅ |
| 2 | Redirecionamentos do que saiu (Clãs, Comunidades, jogos, `/en`, Faça parte) | ✅ |
| 2 | Quiz sem login: `/quiz`, `/quiz/:slug`, pontuação no servidor, sitemap e seção da home ([plano](plano-quiz-blog-figurinhas.md) §1) | ✅ código pronto e testado; falta enviar os quizzes do site antigo (na virada) |
| 2 | Blog da comunidade (só leitura): lista, post, autor, categoria, tag, RSS e sitemap ([plano](plano-quiz-blog-figurinhas.md) §2) | ✅ código pronto e testado; falta enviar o blog do site antigo (2026-11-16, depois das 15h) |
| 2 | Catálogo de figurinhas (só ver), com as imagens copiadas para `/media` e a Coleção da home com dados reais ([plano](plano-quiz-blog-figurinhas.md) §3) | ✅ código pronto e testado, figurinhas em silhueta; falta enviar o catálogo e as imagens do site antigo (2026-11-16, depois das 15h) |
| 2 | Barras laterais do site antigo: sistema único de lateral na matéria, Central, categoria/tag, blog, Otaku TV ("A seguir") e quiz ([plano](plano-sidebars.md)) | ✅ feito (passos 1 a 8 e 10); o dono respondeu as 3 perguntas com as recomendadas em 2026-11-17 |
| 2 | Otaku TV no esquema do site antigo ("YouTube"): palco com player e "A seguir", fileiras por categoria, músicas no mesmo player ([plano](plano-otaku-tv.md)) | ✅ feito em 2026-11-17 (passos 1 a 7; dono conferindo). Recomendadas aplicadas: `?v=`, sem botões de conta, "A seguir" com 3 itens no celular. Falta o `VideoObject` na página da matéria |
| 2 | `/login` do administrador no formato do antigo, menu do usuário com "Administração", `/admin/login` → `/login`, sem cadastro ([plano](plano-contas-login.md), fase 1) | ✅ feito em 2026-11-19 (fase 1; recomendadas aplicadas) |
| 2 | Menus de quem está logado no formato do antigo: lateral, navbar, menu do usuário e barra lateral do `/admin` ([plano](plano-menus-logado.md)) | ⏳ plano pronto em 2026-11-19; 4 entregas na ordem; 5 perguntas ao dono (nenhuma bloqueia) |
| 2 | Contas: cadastro, login com senha (inclusive as do Supabase), sessão, recuperação de senha, Google ([plano](plano-contas-login.md), fases 2 e 3) | 💤 não agora (decisão do dono em 2026-11-19) |
| 2 | Base: contas, login, perfis, notícias, artigos | 💤 |
| 3 | Economia e coleção: check-in, missões, níveis, figurinhas, loja, Premium | 💤 |
| 4 | Social: Feed, mensagens, blog, comentários, quarto otaku, Otaku TV | 💤 |
| 5 | Painel admin e robôs (notícias por IA, redes sociais) | 💤 |
| 5 | Painel `/admin` de visitas sem contas (contador próprio sem cookie, base para os outros 3 sites) ([plano](plano-painel-visitas.md)) | ⏳ feito em 2026-11-19 (passos 1 a 12): login do admin, migration 013, coleta `/api/v`, `views_count` voltando a andar, limpeza e a tela. Falta conferir em produção, textos legais (13), país/idioma (14) e docs (15). Dono respondeu com as recomendadas |
| 6 | **Virada parcial (sem contas) em 4 dias:** backup completo do Lovable Cloud, imagens no `/media`, páginas das contas honestas, ensaio e DNS ([plano](plano-virada-parcial.md)) | 🔄 urgente. **Dia 1 (15/11) feito:** backup do banco validado, storage inteiro baixado (6.757 arquivos), 2.436 imagens no `/media`, páginas das contas, faixa, `/site-novo`, redirects, arquivos públicos, Mercado Pago/descadastro guardados, conferência de 1.898 endereços com zero falhas, cache de 60 s para a CDN. Faltam o ensaio e a DNS (dias 2 e 3). Site antigo sai do ar no fim do dia 4 (18/11) |
| 6 | Importação das contas e da economia a partir do dump final, em fases (A robô, B contas, C perfil e comentar, D economia, E figurinhas e missões, F resto) | 💤 depois da virada |

## Onde paramos

2026-11-14:
- **Feito até aqui:**
  - notícias e artigos com barra lateral e comentários (leitura), sitemaps e RSS;
  - animes: catálogo, ficha, calendário e personagens, com o Top 10 com setas na home e em `/animes`.
- **Quiz, leitura do blog e catálogo de figurinhas:** prontos no código (migrations 009–011). Falta só enviar o conteúdo
  do site antigo (ver "Próximos passos").
- **Decisões de 2026-11-15:** figurinhas aparecem em silhueta (constante para trocar depois); a atualização do conteúdo
  do site de teste (notícias, artigos, quizzes, blog, figurinhas) fica para 2026-11-16 depois das 15h, tudo de uma vez.
- **Migration 009 (quiz):** conferida no site de teste, rodou no deploy (`/quiz` responde 200 lendo a tabela).


## Feito em 2026-11-15 (além do dia 1 da virada)

- **Barras laterais da direita** ([plano-sidebars.md](plano-sidebars.md), passos 1 a 8 e 10): matéria (com "Mais sobre o
  anime" e "Ver tudo"), Central `/noticias` e `/artigos`, categoria e tag, blog, "A seguir" na Otaku TV e lateral fixa
  no quiz. Cache em memória de 5 a 10 min. O passo 9 (cartão "Em breve") ficou de fora, como o dono recomendou.
- **Menu lateral esquerdo e celular** ([plano-sidebar-esquerda.md](plano-sidebar-esquerda.md), passos 1 a 4, 6 a 13):
  lateral clara de 256/72 px que se recolhe, gaveta no celular, topo com busca e espaço para menus extras
  (`HEADER_LINKS`), barra inferior no celular, topo de 60 px, faixas que rolam na home e rodapé em 2 colunas. A dica
  flutuante (passo 5) ficou como `title` nativo.
- **E-mail do Contato** por SMTP (sem as variáveis `SMTP_*` só grava no banco).
- **Robô de notícias, passos 1 a 3** ([plano-robo-noticias.md](plano-robo-noticias.md)): migration 012 no ar, a importação
  do site antigo não apaga o que o robô publicar (`posts.origin`) e o spoiler passou a sobreviver à limpeza do HTML.

- **Menu como no -old (2026-11-15, noite):** "Notícias" e "Artigos" viraram "News" (ativo também em `/artigos`); o Calendário
  saiu da navbar e virou aba de Animes (Temporada, Calendário, Favoritos e Seguindo, as duas últimas "em breve"); a rolagem
  da lateral esquerda não tem mais barra (as bordas desvanecem quando há mais itens). **Contato** sem formulário: seis
  canais com `mailto:` e assunto pronto (como nos outros sites), para não receber spam.
- **Robô de notícias, passos 4 a 11 (ensaio aprovado em 2026-11-15):** `app/server/robot/` (funções puras, Gemini com
  fila de modelos e contagem de uso por modelo, RSS, leitura da matéria, mídia com cópia própria em `/media/robo/`,
  seleção, publicação numa transação, rodada `runRobot`), tarefa `robo-noticias` no cron (minuto 20), `/api/robo/{status,modo,ensaio,url,previa,config}`
  e `scripts/importar-config-robo.mjs`. O guia editorial e as personas estão no banco (nunca no git). Configuração importada
  (10 fontes, 6 autores, 10 tópicos, 14 horários, guia) com teto 6/dia, 33% fora de anime, 3 imagens, modelo
  `gemini-3-flash-preview`. **Banco da Hostinger é MariaDB:** nada de `CAST(? AS JSON)` (gravar o JSON como texto). Um tempo esgotado
  no Gemini passa ao próximo modelo da fila (90 s, raciocínio baixo no 3-flash-preview). Ensaio: 6 prévias, as 3 de anime aprovadas pelo
  dono; modo continua `desligado`. Falta: ligar `publicar` na virada.

## Próximos passos

0. **URGENTE: [plano-virada-parcial.md](plano-virada-parcial.md)**, na ordem do cronograma:
   - dia 1 (15/11): **feito** (backup, imagens, páginas das contas, redirects, arquivos públicos, conferência);
   - dia 2 (16/11): **feito pelo Claude:** exportação completa com mídia para o `novo.` (966 matérias, 36 imagens novas, 1 falha de
     envio), conferência de endereços (1.898, zero falhas), conferência visual em 375 e 1440 px (home, matéria, figurinhas, login,
     contato, tema claro e escuro) sem problema, procedimento do domínio registrado em [deploy-hostinger.md](deploy-hostinger.md)
     e textos dos avisos em [avisos-virada.md](avisos-virada.md). **Feito depois:** alias testado e virada decidida (abaixo).
     UptimeRobot adiado e aviso nas redes dispensado pelo dono em 2026-11-17;
   - dia 3 (17/11): **virada feita às 00h30** (o dono preferiu adiantar, sem tráfego): exportação final (970 matérias), alias
     `animeprofile.com.br` no app do `novo.` (`hosting_websites_add-domain`, tipo `parked`; a Hostinger reescreveu o `@` na hora
     para ALIAS `animeprofile.com.br.cdn.hstgr.net`), `www` virou CNAME para o domínio principal (301 para ele), `VITE_SITE_URL` e
     `SITE_NOINDEX` trocados pelo dono. Conferência pós-virada ok: robots liberado, canonical, sitemaps e RSS no domínio novo,
     `/sw.js`, `/ads.txt`, `/manifest.webmanifest` e `/api/health` 200, zero falhas nos 1.898 endereços. Robô em `publicar`,
     teto 6 (publica a partir das 8h de Brasília). Depois, o dono trocou o domínio do site no hPanel ("Alterar domínio": o site
     passou a se chamar `animeprofile.com.br`; o `novo.` deixou de existir) e foi preciso refazer o deploy para o app ler o `.env`.
     Cron da Hostinger recriado (o comando tinha `url` em vez de `curl`; corrigido e rodando); sitemap enviado ao Search Console.
     Menus Feed, Blog, Missões, Ranking, Figurinhas e Quarto Otaku só para logados (`auth` em `app/lib/nav.ts`; escondidos por CSS, sem `LOGGED_IN`).
     **Logs do dia (22h, 17/11):** cron rodando, `/api/health` ok, 15 páginas sem 5xx, robô com as 6 matérias do teto (8h às 13h,
     0 falhas, 13 chamadas ao Gemini sem erro; 398 a 730 palavras, parágrafos curtos, fonte no fim, canonical e RSS certos).
     Teto do robô subido para 10 às 22h25 (vale a partir das 8h de 18/11). **Falta:** (18/11) dump final e a exportação final;
   - dia 4 (18/11): dump final.

   Tudo o que não estiver nesse plano espera.
1. Conferir no navegador `/quiz`, `/blog`, `/figurinhas`, a home e a ficha de um anime com álbum (exportação feita em 2026-11-15).
2. Barras laterais: **feitas** (ver tabela de status). Respostas do dono em 2026-11-17: sem placeholder "Em breve", lateral da Central em
   todas as páginas da lista e Guia do anime dentro do cartão do anime, na lateral (tudo como recomendado e já implementado).
2a. **Otaku TV:** feita (ver tabela de status). Falta o `VideoObject` na página da matéria com vídeo (P, separado) e a conferência do dono;
    a aba de músicas depende do AnimeThemes (estava com 503 em 2026-11-17, o aviso "Tentar de novo" aparece).
3. Depois: contas/login (por último, decisão do dono), economia, chat, quarto otaku, painel admin, robôs.
   - **Agenda semanal de animes:** feita em 2026-11-19 (tarefa `agenda-semanal`, segunda às 9h de Brasília, a partir de `anime_catalog`).
     A capa gira a cada semana entre os banners dos 8 mais populares e nunca repete a da semana anterior (`source_url` guarda o banner
     de origem). Código em `app/lib/agenda.ts` e `app/server/agenda/agenda.server.ts`; a primeira automática sai em 2026-11-23.
3a. **Painel de visitas** ([plano-painel-visitas.md](plano-painel-visitas.md)): passos 1 a 12 feitos em 2026-11-19. Falta: conferir em produção
    com o login do dono, **textos legais (13)**, país ou idioma (14, olhar os cabeçalhos da CDN por 1 dia) e docs finais (15). Depois, os irmãos
    (criasite, vibecoin, respawnou) com o módulo `app/visitas/`. Importar do backup os totais por dia do site antigo (pergunta 2) fica num passo extra.
3b. **`/login` do administrador:** feito em 2026-11-19 (fase 1 do [plano-contas-login.md](plano-contas-login.md)). Só o admin entra, com **e-mail ou usuário** (usuário padrão `animeprofile`, opcional `ADMIN_USERNAME`;
    variáveis `ADMIN_*` do hPanel), sem cadastro; menu do usuário com "Administração"; `/admin/login` leva a `/login`; marcador `ap_logado` e
    `GET /api/eu` mantêm o cache da CDN. Falta conferir em produção com o dono logado.
3b2. **Menus de logado ([plano-menus-logado.md](plano-menus-logado.md)): feitos em 2026-11-19, nas 4 entregas** (menu lateral com grupo Equipe e itens só
    de logado; Check-in, Mensagens e sino no topo; menu do usuário no formato do antigo; barra lateral do `/admin` com os 27 itens do antigo, grupos
    iguais). Sem selo "em breve" (decisão do dono): os destinos que não existem levam à página "volta em breve" das contas (site) ou "Esta tela
    ainda está sendo construída" (painel, rota coringa `admin/*`). O marcador `ap_logado` agora leva os papéis (`ap_logado=admin`).
    **Falta:** o dono conferir em produção logado.
3b3. **Telas do painel, na ordem do dono (2026-11-19).** Primeiro o que o recebimento de usuários exige, depois o resto. Para cada tela, olhar antes
    como era no `animeprofile-old` (`src/routes/admin*.tsx`). Ordem: Painel (feito: Visitas) · Métricas · Posts · Notícias IA · Artigos com IA ·
    Quizzes · WhatsApp (ver se ainda é necessário) · Títulos no Google (idem) · Quarto otaku (refazer com three.js, como o QG) · Redes sociais ·
    Blog dos usuários · Categorias e tags · Mídias · Denúncias · Bug reports · Eventos · Usuários · Segurança · Molduras · Emblemas · Figurinhas ·
    Níveis e recompensas · Custos e recompensas · Receita · Sistemas (provavelmente não precisa mais) · Agendamentos (talvez não) · E-mails.
    Código da barra em `app/lib/admin-nav.ts` (campo `pronto` marca as telas feitas).
3c. **Contas de todos e Google (fases 2 e 3 do mesmo plano): não agora** (decisão do dono em 2026-11-19). Quando voltar: importação dos
    171 usuários do dump final (64 com senha, 114 identidades do Google) com todos os dados, login para todos, SMTP, Turnstile, Google OAuth.
4. Chaves externas (Google OAuth, Mercado Pago, Gemini, Turnstile, Firebase, Klipy) e a virada do domínio:
   [deploy-hostinger.md](deploy-hostinger.md).
5. **Mídia kit** em uma página "Anuncie" (o site recriado ainda não tem): público e números reais, formatos e pacotes,
   regras de conteúdo patrocinado, versão para baixar/imprimir e contato. Outra fonte de renda, vale para todos os sites.
   Fica para depois da virada do domínio; reaproveitar o que o criasite (piloto) fizer.

## Pendências suas

- **Painel de visitas:** as variáveis `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` já estão no hPanel (2026-11-19). Depois do deploy,
  entrar em `/admin` e conferir; aprovar o texto novo da Privacidade e dos Cookies (passo 13).
- **`/login` do administrador ([plano-contas-login.md](plano-contas-login.md)):** nada bloqueia. Se quiser, responda as 3 perguntas do
  plano (botão do Google visível e desativado ou escondido; limite global de 30 tentativas ou 60; itens só para logados escondidos
  também para o admin). Sem resposta, sigo com as recomendadas (visível, 30, escondidos). Depois do deploy: entrar pelo `/login`.
- **Menus de logado:** entrar pelo `/login` e conferir o menu lateral (grupo Equipe), os três ícones do topo, o menu do usuário e a barra do `/admin`
  (no celular também). Dizer o que ajustar. Decidir quais itens do painel saem (WhatsApp, Títulos no Google, Sistemas, Agendamentos).
- **Robô de notícias:** nada pendente seu agora (config e chave feitas, prévias aprovadas). Eu ligo `publicar` com teto 6
  depois da virada (17/11); no dia 18 sobe para 10.
- **SMTP:** não é mais necessário para o Contato (decisão do dono em 2026-11-17: sem formulário, só e-mail por `mailto:`). Volta a ser
  necessário na fase das contas (recuperar senha e avisos por e-mail): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `MAIL_FROM`.

- **URGENTE (virada parcial, [plano](plano-virada-parcial.md)):**
  - **Dia 1 (feito até aqui):** banco e storage guardados em `C:\Users\evsli\animeprofile-backup\`. TTL do DNS já em 300 s (feito).
    **Falta:** conferir a propriedade do Search Console (tipo Domínio),
    baixar a lista de páginas do Search Console para `.import/gsc-paginas.csv` e tirar foto da zona DNS e da tela de
    domínio do Lovable (já anotei os valores do DNS em [plano-virada-parcial.md](plano-virada-parcial.md)).
  - **Dia 2:** SMTP no hPanel (opcional). **UptimeRobot adiado** e **aviso nas redes dispensado** (decisões do dono em 2026-11-17). O dono decidiu em 2026-11-16 **não fechar o `.7z` cifrado** (a pasta `animeprofile-backup` fica só no PC).
  - **Dia 3:** hora H às 7h (desativar os workflows antigos, trocar `VITE_SITE_URL` e apagar `SITE_NOINDEX`, ligar o
    domínio, trocar o cron, enviar o sitemap).
  - **Dia 4:** dump final.
  - **Responder as 5 perguntas do fim do plano.**
- Exportação feita em 2026-11-15 (950 matérias, 14 quizzes, 13 posts do blog, 224 figurinhas). Na virada, rodar de novo. O `CRON_TOKEN` apareceu no chat; o dono decidiu não trocar.
- Conferir a Otaku TV no navegador (`/otaku-tv`, `?tab=trailers`, `?tab=musicas`, `?v=<id>`). As 4 perguntas do plano foram respondidas com as recomendadas.
- Se quiser as figurinhas abertas em vez de silhueta: trocar `MOSTRAR_ABERTAS` para `true` em `app/lib/stickers.ts`.

## Como atualizar o conteúdo do site de teste

- **Para atualizar o conteúdo do site de teste** (matérias, comentários e sinopses):
  `CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env`. O token está nas variáveis do
  app no hPanel.
