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
| 2 | Notícias e artigos (com cópia das matérias do site antigo no endereço de teste) | ⏳ |
| 2 | Redirecionamentos do que saiu (Clãs, Comunidades, jogos, `/en`) | 💤 |
| 2 | Contas: cadastro, login com senha (inclusive as do Supabase), sessão, recuperação de senha | 💤 por último (decisão do dono) |
| 2 | Base: contas, login, perfis, notícias, artigos | 💤 |
| 3 | Economia e coleção: check-in, missões, níveis, figurinhas, loja, Premium | 💤 |
| 4 | Social: Feed, mensagens, blog, comentários, quarto otaku, Otaku TV | 💤 |
| 5 | Painel admin e robôs (notícias por IA, redes sociais) | 💤 |
| 6 | Importação dos dados, ensaio completo e virada do domínio | 💤 |
