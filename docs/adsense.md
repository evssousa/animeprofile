# AdSense no animeprofile

O animeprofile já foi aprovado no AdSense (conta do editor `pub-4124845154866017`, a mesma do site antigo). Ligado em 2026-11-22.

## O que está no ar

- **`/ads.txt`** (`public/ads.txt`): `google.com, pub-4124845154866017, DIRECT, f08c47fec0942fa0`. Um teste (`tests/anuncios.test.tsx`) confere que o arquivo bate com o ID de `app/lib/ads.ts`.
- **Modo de Consentimento v2** (`app/lib/ads.ts`, `consentBootstrap()`): roda no `<head>` e nega tudo por padrão (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`). Só libera quem escolheu "Aceitar todos".
- **Banner de cookies** (`app/components/layout/CookieConsent.tsx`): na 1ª visita; "Só os essenciais" mantém tudo negado (o Google ainda pode mostrar anúncios não personalizados); "Aceitar todos" libera a personalização. A escolha fica no `localStorage` (`ap-cookie-consent`, o nome citado na Política de Cookies). "Preferências de cookies" no rodapé reabre. Mudar `CONSENT_VERSION` faz todo mundo ver o banner de novo.
- **Espaços** (`app/components/ads/AdSlot.tsx`): nascem fechados, pedem o anúncio ~1000 px antes de aparecerem na tela, abrem com o rótulo "Publicidade" só quando o Google entrega, e somem se vier "sem anúncio" ou se o script for bloqueado. O script do AdSense só é carregado quando o 1º espaço aparece, com o navegador ocioso.
- **Nunca** aparecem no `/admin` e no `/login`, nem para quem está logado (o dono não vê nem clica nos próprios anúncios), e o HTML público continua igual para todos (os espaços só nascem no navegador).

## Onde ficam os anúncios

| Bloco (AdSense) | Espaço | Onde |
|---|---|---|
| `inArticle` (5547770253) | meio do texto | notícia: depois do 1º parágrafo (se houver 2+); artigo: a cada 4 parágrafos, sem cortar spoiler, lista ou citação e sem ficar entre um título e a imagem dele (`app/lib/anuncios-no-texto.ts`) |
| `endOfArticle` (2921606913) | fim da matéria | depois do texto e do card do anime |
| `sidebar` (8491740203) | barra lateral | fim da barra, só no computador, na matéria e na Central de notícias/artigos |
| `multiplex` (6209677860) | "Leia também" | depois da lista de matérias relacionadas |
| `list` (9193924697) | listas | Central de notícias/artigos (depois da grade), home (antes do Otaku TV) e lista de quizzes (depois da grade) |

Fora de propósito: login, painel, páginas legais, contato, "Contas em breve", erros, página do anime e Otaku TV (player de vídeo). Dá para ligar mais depois com `<AdSlot slot="list" />`.

## Para desligar tudo

`ADS_ENABLED = false` em `app/lib/ads.ts` e novo deploy (some o banner, o script e os espaços).

## Conferir (dono)

1. No AdSense → **Sites**: confirmar que `animeprofile.com.br` está em "Pronto" (o domínio é o mesmo, mas o site foi recriado).
2. No AdSense → **Privacidade e mensagens**: ativar a mensagem **"Regulamentos europeus"** (CMP do Google, exigida para Europa/Reino Unido/Suíça; o banner próprio cobre o Brasil).
3. Abrir uma matéria numa janela anônima, aceitar os cookies, rolar a página e ver se o anúncio aparece (pode levar alguns dias para o Google voltar a preencher o domínio novo).
4. Se algum espaço atrapalhar a leitura no celular, dizer qual para ajustar a posição.
