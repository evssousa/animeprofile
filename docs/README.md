# Documentação e plano do Anime Profile (versão nova)

Esta pasta (`docs/`) é a memória do projeto. Tudo o que for decidido ou construído entra aqui, para que qualquer
pessoa (ou o Claude, depois de perder o contexto) saiba onde estamos e o que vem a seguir.

**Regra:** toda tarefa concluída atualiza o status abaixo e o documento da área.

O site antigo (repositório privado `animeprofile-old`) continua no ar, sem mudanças, até este ficar pronto. O domínio
animeprofile.com.br só é ligado aqui no fim.

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
| 2 | Contas: cadastro, login com senha (inclusive as do Supabase), sessão, recuperação de senha | 💤 por último (decisão do dono) |
| 2 | Base: contas, login, perfis, notícias, artigos | 💤 |
| 3 | Economia e coleção: check-in, missões, níveis, figurinhas, loja, Premium | 💤 |
| 4 | Social: Feed, mensagens, blog, comentários, quarto otaku, Otaku TV | 💤 |
| 5 | Painel admin e robôs (notícias por IA, redes sociais) | 💤 |
| 6 | Importação dos dados, ensaio completo e virada do domínio | 💤 |

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


## Próximos passos

1. 2026-11-16, depois das 15h: exportar tudo de uma vez (notícias, artigos, quizzes, blog e figurinhas com as imagens) e
   conferir `/quiz`, `/blog`, `/figurinhas` e a seção da home no site de teste.
2. Depois: contas/login (por último, decisão do dono), economia, chat, quarto otaku, painel admin, robôs.
3. Chaves externas (Google OAuth, Mercado Pago, Gemini, Turnstile, Firebase, Klipy) e a virada do domínio:
   [deploy-hostinger.md](deploy-hostinger.md).

## Pendências suas

- Rodar a exportação amanhã depois das 15h (`CRON_TOKEN` está nas variáveis do app no hPanel) ou me avisar para eu
  rodar. As migrations 009, 010 e 011 rodam sozinhas no deploy, não precisa fazer nada no banco.
- Se quiser as figurinhas abertas em vez de silhueta: trocar `MOSTRAR_ABERTAS` para `true` em `app/lib/stickers.ts`.

## Como atualizar o conteúdo do site de teste

- **Para atualizar o conteúdo do site de teste** (matérias, comentários e sinopses):
  `CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env`. O token está nas variáveis do
  app no hPanel.
