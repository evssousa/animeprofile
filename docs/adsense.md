# AdSense no animeprofile

O animeprofile já foi aprovado no AdSense (conta do editor `pub-4124845154866017`, a mesma do site antigo). Ligado em 2026-11-22.

## O que está no ar

- **`/ads.txt`** (`public/ads.txt`): `google.com, pub-4124845154866017, DIRECT, f08c47fec0942fa0`. Um teste (`tests/anuncios.test.tsx`) confere que o arquivo bate com o ID de `app/lib/ads.ts`.
- **Modo de Consentimento v2** (`app/analytics/consent.ts`, `consentBootstrap()`, desde 2026-11-26 no módulo do Google Analytics): roda no `<head>` e nega tudo por padrão (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`). Libera por categoria: Anúncios (`ad_*`) e Estatística (`analytics_storage`).
- **Banner de cookies** (`app/components/layout/CookieConsent.tsx`, lógica em `app/analytics/use-consentimento.ts`): na 1ª visita, "Só os essenciais", "Aceitar todos" ou "Personalizar" (chaves Estatística e Anúncios personalizados). Sem anúncios personalizados, o Google ainda pode mostrar anúncios genéricos. A escolha fica no `localStorage` (`ap-cookie-consent`, formato `{ v: 2, analytics, ads }`). "Preferências de cookies" no rodapé reabre em "Personalizar". Mudar `CONSENT_VERSION` (em `app/analytics/config.ts`) faz todo mundo ver o banner de novo. Visitante europeu atendido pela mensagem do Google não vê o banner próprio.
- **Espaços** (`app/components/ads/AdSlot.tsx`): nascem fechados, pedem o anúncio ~1000 px antes de aparecerem na tela, abrem com o rótulo "Publicidade" só quando o Google entrega, e somem se vier "sem anúncio" ou se o script for bloqueado. O script do AdSense só é carregado quando o 1º espaço aparece, com o navegador ocioso.
- **Nunca** aparecem no `/admin` e no `/login`, nem para quem está logado (o dono não vê nem clica nos próprios anúncios), e o HTML público continua igual para todos (os espaços só nascem no navegador).

## Onde ficam os anúncios

Regra: dentro do conteúdo ou na barra lateral, nunca em cima de botões, do player, do formulário ou de qualquer coisa que a pessoa clique para usar o site (o Google proíbe anúncio que induz clique sem querer). Máximo de 1 a 4 por página.

| Página | Anúncios |
|---|---|
| **Matéria** (notícia, artigo) | meio do texto (notícia: depois do 1º parágrafo; artigo: a cada 4, sem cortar spoiler, lista, citação nem ficar entre um título e a imagem dele), fim da matéria (depois do card do anime), barra lateral (computador), multiplex depois de "Leia também" |
| **Home** | depois do Top 10, entre as notícias e o Otaku TV, e multiplex antes de "O diferencial" |
| **Central de notícias/artigos, categoria e tag** | depois da grade e na barra lateral (computador) |
| **Animes** (lista) | depois da grade da temporada |
| **Ficha do anime** | depois dos personagens |
| **Personagem** | fim da barra lateral (computador) |
| **Calendário** | depois dos dias |
| **Quiz** (lista) | depois da grade |
| **Quiz** (jogo) | só na lateral ("Continue jogando", computador) ou abaixo dela (celular), longe dos botões do jogo |
| **Figurinhas** (lista e álbum) | depois da grade |
| **Blog** (lista, autor, categoria/tag) | depois da lista e na barra lateral |
| **Blog** (post) | meio do texto, fim do post e barra lateral |
| **Otaku TV** (matérias, trailers, músicas) | depois da grade de vídeos (a Otaku TV passou a ter a mesma largura e margens laterais das outras páginas, 1328 px) |

Blocos do AdSense usados: `inArticle` 5547770253, `endOfArticle` 2921606913, `sidebar` 8491740203, `multiplex` 6209677860, `list` 9193924697 (`app/lib/ads.ts`).

**Sem anúncio, de propósito:** login, painel, busca, páginas legais, contato, "Contas em breve", erros, sobre e "como instalar" (poucas informações; o Google pede conteúdo substancial na página que tem anúncio).

## Para desligar tudo

`ADS_ENABLED = false` em `app/lib/ads.ts` e novo deploy (some o banner, o script e os espaços).

## Conferir (dono)

1. No AdSense → **Sites**: confirmar que `animeprofile.com.br` está em "Pronto" (o domínio é o mesmo, mas o site foi recriado).
2. No AdSense → **Privacidade e mensagens**: ativar a mensagem **"Regulamentos europeus"** (CMP do Google, exigida para Europa/Reino Unido/Suíça; o banner próprio cobre o Brasil).
3. Abrir uma matéria numa janela anônima, aceitar os cookies, rolar a página e ver se o anúncio aparece (pode levar alguns dias para o Google voltar a preencher o domínio novo).
4. Se algum espaço atrapalhar a leitura no celular, dizer qual para ajustar a posição.
