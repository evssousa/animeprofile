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
| [plano-robo-noticias.md](plano-robo-noticias.md) | Plano (temporário): robô de notícias por IA no cron do site novo (fase A, antes das contas), com inventário do robô antigo, migration 012, ensaio sem publicar e ligação na virada |
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
| 2 | Barras laterais do site antigo: sistema único de lateral na matéria, Central, categoria/tag, blog, Otaku TV ("A seguir") e quiz ([plano](plano-sidebars.md)) | ⏳ plano pronto (2026-11-15); 3 perguntas para o dono |
| 2 | Contas: cadastro, login com senha (inclusive as do Supabase), sessão, recuperação de senha | 💤 por último (decisão do dono) |
| 2 | Base: contas, login, perfis, notícias, artigos | 💤 |
| 3 | Economia e coleção: check-in, missões, níveis, figurinhas, loja, Premium | 💤 |
| 4 | Social: Feed, mensagens, blog, comentários, quarto otaku, Otaku TV | 💤 |
| 5 | Painel admin e robôs (notícias por IA, redes sociais) | 💤 |
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

## Próximos passos

0. **URGENTE: [plano-virada-parcial.md](plano-virada-parcial.md)**, na ordem do cronograma:
   - dia 1 (15/11): **feito** (backup, imagens, páginas das contas, redirects, arquivos públicos, conferência);
   - dia 2 (16/11): conferir no navegador (375 e 1440 px, claro e escuro), SMTP do contato (opcional), ensaio, descobrir
     como ligar o domínio no teste e decidir ir ou não;
   - dia 3 (17/11): virada às 7h;
   - dia 4 (18/11): dump final.

   Tudo o que não estiver nesse plano espera.
1. Conferir no navegador `/quiz`, `/blog`, `/figurinhas`, a home e a ficha de um anime com álbum (exportação feita em 2026-11-15).
2. Barras laterais: executar [plano-sidebars.md](plano-sidebars.md) passo a passo (10 passos, P/M; dá para fazer em
   Sonnet), depois das respostas do dono às perguntas do fim do plano. **Depois da virada.**
3. Depois: contas/login (por último, decisão do dono), economia, chat, quarto otaku, painel admin, robôs.
4. Chaves externas (Google OAuth, Mercado Pago, Gemini, Turnstile, Firebase, Klipy) e a virada do domínio:
   [deploy-hostinger.md](deploy-hostinger.md).
5. **Mídia kit** em uma página "Anuncie" (o site recriado ainda não tem): público e números reais, formatos e pacotes,
   regras de conteúdo patrocinado, versão para baixar/imprimir e contato. Outra fonte de renda, vale para todos os sites.
   Fica para depois da virada do domínio; reaproveitar o que o criasite (piloto) fizer.

## Pendências suas

- **Robô de notícias (urgente para o SEO depois da virada):** responder as 4 perguntas do fim do
  [plano-robo-noticias.md](plano-robo-noticias.md) (recomendação: sim nas 4), rodar a consulta do passo 7 no editor SQL do
  Lovable e salvar o resultado em `C:\Users\evsli\animeprofile-backup\robo-config.json` (não colar no chat), e
  cadastrar `GEMINI_API_KEY` no hPanel.
- **SMTP do Contato (opcional):** cadastrar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `MAIL_FROM` no hPanel
  (caixa `contato@`). Sem isso, as mensagens só ficam no banco (`SELECT ... FROM contact_messages`).

- **URGENTE (virada parcial, [plano](plano-virada-parcial.md)):**
  - **Dia 1 (feito até aqui):** banco e storage guardados em `C:\Users\evsli\animeprofile-backup\`. TTL do DNS já em 300 s (feito).
    **Falta:** conferir a propriedade do Search Console (tipo Domínio),
    baixar a lista de páginas do Search Console para `.import/gsc-paginas.csv` e tirar foto da zona DNS e da tela de
    domínio do Lovable (já anotei os valores do DNS em [plano-virada-parcial.md](plano-virada-parcial.md)).
  - **Dia 2:** "backup ok" e `.7z` cifrado em 2 cópias, SMTP no hPanel (opcional), UptimeRobot e aviso nas redes.
  - **Dia 3:** hora H às 7h (desativar os workflows antigos, trocar `VITE_SITE_URL` e apagar `SITE_NOINDEX`, ligar o
    domínio, trocar o cron, enviar o sitemap).
  - **Dia 4:** dump final.
  - **Responder as 5 perguntas do fim do plano.**
- Exportação feita em 2026-11-15 (950 matérias, 14 quizzes, 13 posts do blog, 224 figurinhas). Na virada, rodar de novo. O token apareceu no chat: troque `CRON_TOKEN` no hPanel se quiser.
- Responder as 3 perguntas do fim de [plano-sidebars.md](plano-sidebars.md): placeholder "Em breve: com a sua conta"
  na lateral (recomendado: não), lateral da Central em todas as páginas da lista (recomendado: sim) e Guia do anime na
  lateral ou no meio do texto (recomendado: lateral).
- Se quiser as figurinhas abertas em vez de silhueta: trocar `MOSTRAR_ABERTAS` para `true` em `app/lib/stickers.ts`.

## Como atualizar o conteúdo do site de teste

- **Para atualizar o conteúdo do site de teste** (matérias, comentários e sinopses):
  `CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env`. O token está nas variáveis do
  app no hPanel.
