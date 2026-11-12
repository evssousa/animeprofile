# Registro de decisões

Mais recente no topo. Cada decisão diz o que foi decidido, quando e por quê.

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
