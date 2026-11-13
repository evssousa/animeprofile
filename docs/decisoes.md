# Registro de decisões

Mais recente no topo. Cada decisão diz o que foi decidido, quando e por quê.

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
