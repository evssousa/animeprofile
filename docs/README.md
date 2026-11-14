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
| 2 | Páginas institucionais e legais, formulários de Contato e Faça parte | ✅ |
| 2 | Notícias e artigos: listas, matéria, categoria, tag, autor, busca e página inicial | ✅ |
| 2 | Importação das matérias do site antigo pelo script `exportar-conteudo-antigo.mjs` (refazer na virada) | ✅ |
| 2 | Sitemaps (índice, fixas, Google News, matérias, taxonomia) e RSS em `/rss.xml` | ✅ |
| 2 | Animes: `/animes` (busca, no ar hoje, Top 10, temporada), ficha `/animes/:id`, calendário e seções da home | ✅ |
| 2 | Personagens (`/animes/personagem/:id`) | 💤 |
| 2 | Redirecionamentos do que saiu (Clãs, Comunidades, jogos, `/en`, Faça parte) | ✅ |
| 2 | Contas: cadastro, login com senha (inclusive as do Supabase), sessão, recuperação de senha | 💤 por último (decisão do dono) |
| 2 | Base: contas, login, perfis, notícias, artigos | 💤 |
| 3 | Economia e coleção: check-in, missões, níveis, figurinhas, loja, Premium | 💤 |
| 4 | Social: Feed, mensagens, blog, comentários, quarto otaku, Otaku TV | 💤 |
| 5 | Painel admin e robôs (notícias por IA, redes sociais) | 💤 |
| 6 | Importação dos dados, ensaio completo e virada do domínio | 💤 |

## Onde paramos

2026-11-13:
- **Pausa** depois de notícias e artigos (lista única em `/noticias`, com `/news` redirecionando para ela).
- **Para retomar:**
  1. Sitemaps e RSS das matérias.
  2. Animes.
- **Para atualizar o conteúdo do site de teste:**
  `CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env`. O token está nas variáveis do
  app no hPanel.
