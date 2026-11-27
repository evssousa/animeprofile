# Módulo Google Analytics + consentimento de cookies

Piloto no animeprofile (2026-11-26). Plano completo e diferenças de cada site: `docs/plano-google-analytics.md`
(seção "Como levar para respawnou, vibecoin e criasite").

## O que faz

- **Consentimento por categoria** (`consent.ts`): `{ v: 2, analytics, ads, at }` no `localStorage`. Converte a escolha
  antiga (v1): "só os essenciais" vira tudo negado sem mostrar o banner; "aceitar todos" libera só os anúncios e mostra o
  banner de novo uma vez (o texto antigo não falava de estatística).
- **Script do `<head>`** (`consentBootstrap()`): Modo de Consentimento v2, tudo negado por padrão, libera o que a pessoa já aceitou.
- **GA4 no modo básico** (`gtag.ts` + `GoogleAnalytics.tsx`): sem permissão de Estatística, o `gtag.js` nem é baixado.
  page_view manual, um por troca de endereço. Não mede painel/login, quem está logado nem navegador com `?nao-medir=1`
  (`?nao-medir=0` desfaz). Revogar apaga os cookies `_ga`. `?ga_debug=1` liga o DebugView até fechar a aba.
- **Eventos**: `medir(nome, params)` de `gtag.ts` (não faz nada sem GA ativo). Hoje: `quiz_complete` e `select_content` ("Leia também").
- **Aviso europeu do Google** (`cmp-google.ts`): se a CMP do Google atende o visitante, o banner próprio não aparece.
- **Lógica do banner** (`use-consentimento.ts`): camadas "resumo" e "personalizar"; cada site desenha o seu visual.

## Instalar em outro site

1. Copiar a pasta `app/analytics/` e `tests/analytics.test.tsx`.
2. Ajustar `config.ts` (chave do consentimento, eventos, domínio dos cookies, caminhos sem GA, ID). Nos sites com variável de
   ambiente, passar o ID pelo loader da raiz em vez da constante.
3. `root.tsx`: o script do `<head>` passa a existir com anúncios **ou** GA; montar `<GoogleAnalytics id=... />`.
4. Banner do site com as 2 camadas usando `useConsentimento`; rodapé "Preferências de cookies" com anúncios ou GA.
5. Sem o marcador `data-logado`, trocar `useMarcador()` no `GoogleAnalytics.tsx` pela regra do site (ou só `?nao-medir=1`).
6. Textos legais (Cookies e Privacidade) como os do animeprofile.
7. No GA: um fluxo Web por site; **desligar "Mudanças de página com base em eventos do histórico do navegador"** na
   medição otimizada (senão cada página conta duas vezes); retenção 14 meses; sinais do Google desligados.
