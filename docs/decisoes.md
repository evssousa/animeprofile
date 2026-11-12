# Registro de decisões

Mais recente no topo. Cada decisão diz o que foi decidido, quando e por quê.

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
