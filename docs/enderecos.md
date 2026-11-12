# Endereços

Os endereços do site antigo continuam valendo. É o que mantém a posição no Google, os links já compartilhados e os
favoritos dos usuários. Levantado em 2026-11-12 nas 138 rotas do site antigo.

## Continuam iguais

| Área | Endereços |
|---|---|
| Início e institucionais | `/`, `/sobre`, `/contato`, `/ajuda/:id`, `/como-instalar`, `/faca-parte`, `/links`, `/legal/*` (termos, privacidade, cookies, DMCA, menores, padrões editoriais), `/privacidade` |
| Notícias e artigos | `/news`, `/noticias`, `/noticias/:slug`, `/artigos`, `/artigos/:slug`, `/categoria/:slug`, `/tag/:slug`, `/autores/:slug`, `/busca` |
| Blog | `/blog`, `/blog/:username/:slug`, `/blog/u/:username`, `/blog/categoria/:slug`, `/blog/tag/:slug`, `/blog/criadores`, `/blog/editor`, `/blog/dashboard`, `/blog/rss.xml`, `/blog/u/:username/rss.xml` |
| Quiz | `/quiz`, `/quiz/:slug` |
| Animes | `/animes`, `/animes/:id`, `/animes/calendario`, `/animes/favoritos`, `/animes/seguindo`, `/animes/personagem/:id` |
| Conta | `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`, `/configuracoes`, `/perfil`, `/notificacoes`, `/salvos`, `/unsubscribe` |
| Perfil público | `/u/:username` |
| Economia e coleção | `/check-in`, `/missoes`, `/conquistas`, `/ranking`, `/loja`, `/premium`, `/rubi`, `/pagamentos`, `/figurinhas`, `/figurinhas/:slug` |
| Indicações | `/convidar`, `/indicacoes`, `/convite/:code`, `/w/:code` |
| Social | `/feed`, `/feed/post/:id`, `/mensagens`, `/explorar`, `/quarto`, `/otaku-tv` |
| Outros | `/reportar-bug` |
| Admin | `/admin/*` (as telas dos recursos que saíram não voltam) |
| Arquivos especiais | `/sitemap.xml` e os sitemaps por tipo, `/robots.txt`, `/firebase-messaging-sw.js` (mesmo nome: os celulares com notificação ativa continuam recebendo) |
| Pagamento | `/api/public/payments/webhook` e `/api/public/payments/mercado-pago` (o Mercado Pago continua chamando o mesmo endereço) |

## Saem, com redirecionamento permanente (301)

| Endereço antigo | Vai para |
|---|---|
| `/clas`, `/clas/:slug` | `/ranking` |
| `/comunidades`, `/comunidades/:slug` (inclui o fórum) | `/feed` |
| `/eventos` | `/` |
| `/fig-battle/*`, `/jogo-da-memoria`, `/games` | `/figurinhas` (os jogos usavam as figurinhas) |
| `/qg` (escritório 3D) | `/sobre` |
| `/membros` | `/explorar` |
| `/en`, `/en/*` | a mesma página sem o `/en` (`/en/news/:slug` → `/noticias/:slug`) |
| `/sitemap-en.xml` | `/sitemap.xml` |

## Saem sem substituto (uso interno do site antigo)

`/lovable/*`, `/email/*` (envio do Lovable), `/social-render/:slug` (desenho das imagens com navegador), os ganchos
`/api/public/hooks/*` (viram tarefas do cron) e `/api/public/ai-news/worker/*` (robô do GitHub Actions). Esses
endereços respondem 410 (removido).

## Como conferir na virada

Um script lê o sitemap do site antigo e pede cada endereço ao site novo. Todo endereço precisa responder 200 ou o
301 desta tabela. O teste é feito no ensaio, antes da troca do domínio.
