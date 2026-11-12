# Banco de dados

O banco é MySQL ou MariaDB, o que estiver na Hostinger. Charset `utf8mb4`, collation `utf8mb4_unicode_ci` (busca sem
acento e sem maiúsculas). Datas em UTC. Engine InnoDB, com transações e chaves estrangeiras.

**Compatibilidade:** o SQL é escrito para rodar nos dois. Os testes usam MySQL 8, e a Hostinger pode ser MariaDB,
que devolve JSON como texto (o helper `json()` trata os dois casos).

## Migrations

| Arquivo | Conteúdo | Rodada na Hostinger? |
|---|---|---|
| `001_sistema.sql` | `system_config` (configurações), `cron_jobs` (agenda: estado e trava de cada tarefa), `cron_runs` (histórico) | ✅ 2026-11-12 (automática no primeiro deploy) |

- **Produção:** são aplicadas automaticamente quando o app inicia (`db/migrate.mjs`), registradas em
  `schema_migrations`. O MySQL da Hostinger só aceita conexão local.
- **Local:** `npm run db:migrate`.
- **No chat:** toda migration nova é colada no chat quando criada (combinado com o dono).
- **Imutáveis:** uma migration já aplicada nunca é editada. Correção é sempre uma migration nova.

## Do PostgreSQL para o MySQL

| PostgreSQL (antigo) | MySQL (novo) |
|---|---|
| `uuid` | `CHAR(36) CHARACTER SET ascii`. Os IDs antigos são mantidos; os novos são UUID v7 (ordenáveis, bons para o InnoDB) |
| `timestamptz` | `DATETIME(3)` em UTC (o pool usa `timezone: "Z"`) |
| `date` | `DATE` |
| `jsonb`, `text[]` | `JSON` |
| `boolean` | `TINYINT(1)` |
| `integer`, `bigint`, `serial` | `INT` / `BIGINT`, `AUTO_INCREMENT` nas tabelas de registro |
| `numeric` | `DECIMAL` (valores em reais) |
| `enum` | `VARCHAR` + `CHECK` (mudar a lista não exige alterar o tipo) |
| `citext`, `ilike` | collation `utf8mb4_unicode_ci` |
| busca com `tsvector` | `FULLTEXT` (ou `LIKE` enquanto o volume for pequeno) |
| RLS, triggers, funções | código no servidor (ver [arquitetura.md](arquitetura.md)) |

## Princípios

1. **Mesmos nomes do site antigo:** tabelas e colunas mantêm o nome antigo sempre que fizer sentido. A importação
   fica simples e dá para conferir lado a lado.
2. **Carteira separada do perfil:** saldos (`ap_coins`, `rubis`, `xp`, `level`) ficam em `wallets`, uma linha por
   usuário. A trava de saldo não bloqueia a edição do perfil.
3. **Extrato de tudo:** toda movimentação de AP Coins e Rubis grava uma linha em `wallet_ledger`, com
   `UNIQUE(user_id, ref_key)` (a chave que impede pagar duas vezes). No antigo, só os Rubis e o XP tinham extrato.
4. **Contadores semanais e mensais calculados:** `weekly_xp`, `monthly_coins` e afins saem do extrato do período, em
   vez de serem zerados por rotina. Uma rotina que falha não zera ninguém por engano.
5. **Sem colunas de recursos que saíram:** clã, fórum, escritório e `_en` não vêm.

## Tabelas por área

Lista de partida, sem os detalhes de coluna. Cada área ganha o detalhe aqui quando a migration dela for escrita.

| Área | Tabelas | Fase |
|---|---|---|
| Contas | `users` (e-mail, hash da senha, confirmação), `user_identities` (Google), `sessions`, `password_resets`, `user_roles`, `login_attempts` | 2 |
| Perfil | `profiles`, `user_follows`, `user_blocks`, `user_sanctions`, `user_consents`, `notification_prefs`, `suppressed_emails` | 2 |
| Conteúdo | `posts`, `post_categories`, `tags`, `post_tags`, `post_redirects`, `ai_news_authors`, `media_assets`, `post_comments`, `post_bookmarks`, `post_reads` | 2 |
| Economia | `wallets`, `wallet_ledger`, `xp_ledger`, `check_ins`, `user_streaks`, `level_rewards`, `level_reward_claims`, `premium_subscriptions`, `rubi_purchases`, `processed_mp_notifications` | 3 |
| Figurinhas | `sticker_catalog`, `sticker_albums`, `user_stickers`, `user_album_completions`, `gacha_pulls`, `trade_sessions`, `sticker_help_requests` | 3 |
| Cosméticos | `profile_frames`, `user_profile_frames`, `name_colors`, `emblems`, `user_emblems`, `achievements`, `user_achievements` | 3 |
| Missões e ranking | `quest_catalog`, `user_quest_slots`, `quest_progress`, `ranking_week_winners`, `leaderboard_snapshots` | 3 |
| Indicações | `referral_codes`, `referrals`, `referrer_progress` | 3 |
| Animes | `anime_catalog`, `anime_favorites`, `anime_follows`, `anime_user_status`, `anime_votes`, `anime_reviews` | 4 |
| Social | `feed_posts`, `feed_comments`, `feed_reactions`, `chat_conversations`, `chat_members`, `chat_messages`, `blog_*` | 4 |
| Quarto otaku | `room_*`, `user_pets`, `otaku_tv_plays` | 4 |
| Quiz | `quizzes`, `quiz_plays` | 4 |
| Avisos | `notifications`, `push_tokens`, `push_queue`, `email_queue` | 2–4 |
| Sistema | `system_config`, `cron_jobs`, `cron_runs`, `ai_news_*` (configuração), `social_accounts`, `instagram_post_queue`, `content_reports`, `bug_reports` | 2–5 |

## Importação do site antigo (fase 6)

1. O dono roda no SQL do Lovable as consultas de exportação, uma por tabela (JSON), e salva os arquivos na pasta
   `.import/`, que nunca vai para o Git.
2. `scripts/import/` lê esses arquivos e grava no MySQL, uma área por vez, aplicando as regras do
   [inventario.md](inventario.md). Exemplos: os últimos 60 dias de check-in, a semana atual do XP e a troca dos
   endereços das imagens.
3. Ao final, a contagem de linhas e a soma dos saldos (AP Coins, Rubis, figurinhas por usuário) são comparadas com o
   banco antigo. Se der diferença, a importação não segue.
