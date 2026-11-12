# Inventário: o que vem do site antigo

Levantado em 2026-11-12 no código do site antigo: 319 tabelas no banco e 138 páginas. Cada item tem uma situação:

- **✅ vem:** recurso e dados vêm para o site novo.
- **🆕 vem sem o histórico:** o recurso continua, mas os dados antigos ficam para trás.
- **❌ não vem:** nem recurso nem dados.
Todas as decisões foram tomadas pelo dono em 2026-11-12.

## 0. Tamanho do site antigo (2026-11-12)

O site é pequeno, e isso simplifica a importação: tudo cabe com folga na Hostinger, e dá para conferir conta por
conta no ensaio.

| O quê | Número |
|---|---|
| Usuários | 171 (22 entraram nos últimos 30 dias) |
| Notícias e artigos (`posts`) | 945 |
| Animes no catálogo | 118 (62 MB, quase tudo dados brutos do AniList que podem ser buscados de novo) |
| Imagens das matérias (`post-images`) | 6.399 arquivos, 609 MB |
| Fotos e capas de perfil (`profile-media`) | 175 arquivos, 36 MB |
| Outros arquivos (`feed-images`, `images`, `emblemas-personalizados`, `bug-reports`) | menos de 4 MB no total |
| Maiores tabelas que **não** vêm | telemetria (32 mil linhas), candidatas do robô (25 MB), visitas de página (16 MB) |

- **Contagem aproximada:** a contagem de linhas vem da estatística do PostgreSQL. Tabelas pouco usadas podem
  aparecer com número baixo ou nem aparecer (é o caso de `chat_*` e `sticker_catalog`). A contagem exata, com
  `count(*)`, é feita no ensaio da importação.
- **Arquivo `database_export_23_08_26`:** é um export antigo do banco guardado no armazenamento (11 MB). Não vem
  para o site novo e, como pode ter dados pessoais, deve ser apagado do site antigo antes de ele ser desligado.

## 1. Contas e perfil — ✅ vem

| Dados | Situação | Observação |
|---|---|---|
| Usuários (e-mail, senha, login com Google) | ✅ | As senhas do Supabase usam bcrypt, que o site novo lê: ninguém precisa trocar de senha. O login com Google é reconhecido pelo e-mail e pela conta Google |
| Perfil (`profiles`): nome, @, foto, capa, bio, aniversário, gênero, local, data de cadastro | ✅ | Fotos copiadas para a Hostinger e convertidas para WebP |
| Papéis (`user_roles`): admin, autor, moderador | ✅ | |
| Seguidores (`user_follows`) | ✅ | |
| Bloqueios e punições (`user_blocks`, `user_sanctions`) | ✅ | Segurança: quem foi bloqueado continua bloqueado |
| Consentimentos LGPD (`user_consents`), descadastro de e-mail (`suppressed_emails`, `email_unsubscribe_tokens`) | ✅ | Obrigação legal: quem pediu para não receber e-mail continua sem receber |
| Preferências de notificação e push (`notification_prefs`, `push_preferences`, `user_push_tokens`) | ✅ | Com o mesmo projeto do Firebase e o mesmo domínio, as notificações no celular continuam |
| Visitas ao perfil, primeiros passos, seções visitadas, gostos (`profile_visits`, `user_first_actions`, `user_onboarding*`, `user_visited_sections`, `user_taste_prefs`) | 🆕 | Quem já passou do início não deve ver os primeiros passos de novo: vem só a marca de "concluído" |

## 2. Economia — ✅ vem

| Dados | Situação | Observação |
|---|---|---|
| AP Coins, Rubis, XP, nível | ✅ | Saldo exato do momento da virada |
| Sequência de check-in, recorde, saves (`check_ins`, `user_streaks`, `streak_*`) | ✅ | Vêm o estado atual e os últimos 60 dias de check-in. **No dia da virada, ninguém perde a sequência** |
| Premium (plano e validade) | ✅ | Os dias que faltam continuam valendo |
| Compras de Rubis e extrato (`rubi_purchases`, `rubi_ledger`, `premium_rubi_activations`) | ✅ | Registro financeiro: guardar |
| Mercado Pago (`processed_mp_notifications`, `checkout_attempts`) | 🆕 | Vêm só as notificações recentes, para nunca creditar duas vezes |
| Recompensas de nível já pagas (`level_rewards`, `level_reward_claims`) | ✅ | Evita pagar de novo |
| Extrato de XP (`xp_ledger`) | 🆕 | Vem só a semana em andamento, por causa do ranking semanal |
| Baús, giros, bônus de volta, dia perfeito (`user_welcome_chests`, `user_lucky_spins`, `comeback_*`, `user_perfect_days`, `user_session_rewards`) | 🆕 | Vem só o que evita pagar duas vezes no mesmo dia |
| Configurações de valores (`system_config`, `reward_config`) | ✅ | Revisadas: as dos recursos que saem não vêm |

## 3. Figurinhas — ✅ vem

| Dados | Situação | Observação |
|---|---|---|
| Catálogo e álbuns (`sticker_catalog`, `sticker_albums`, `season_albums`, `weekly_featured_album`) | ✅ | Imagens copiadas para a Hostinger, sem perder qualidade |
| Coleção de cada um, fragmentos, álbuns completos (`user_stickers`, `user_album_completions`) | ✅ | |
| 1º pacote grátis (`user_first_free_pull`) | ✅ | |
| Histórico de pacotes (`gacha_pulls`) | 🆕 | Vem só a semana atual (usada pelas missões) |
| Trocas e pedidos de ajuda (`trade_session*`, `sticker_help_requests`) | 🆕 | Abertos são encerrados na virada; o histórico não vem |

## 4. Cosméticos e conquistas — ✅ vem

| Dados | Situação |
|---|---|
| Molduras, cores de nome, emblemas: catálogo e o que cada um tem e usa | ✅ |
| Conquistas (`achievements`, `user_achievements`) | ✅ |
| Emblema e moldura "Veterano dos Clãs" de quem fez a troca | ✅ (são itens do usuário, não do clã) |

## 5. Conteúdo do site — ✅ vem (é o que traz visitas do Google)

| Dados | Situação | Observação |
|---|---|---|
| Notícias e artigos (`posts`), categorias, tags, redirecionamentos | ✅ | **Mesmos endereços** (`/noticias/...`, `/artigos/...`), para não perder posição no Google |
| Imagens das matérias (`post-images`, `media_assets`) | ✅ | Copiadas para a Hostinger. Os endereços dentro do texto são trocados na importação |
| Autores de IA (`ai_news_authors`) | ✅ | |
| Quizzes gerados no painel admin (`quizzes`) e partidas (`quiz_plays`) | ✅ | |
| Comentários nas notícias (`post_comments`, curtidas) | ✅ | |
| Blog dos usuários (`blog_*`) | ✅ | Mesmos endereços |

## 6. Animes — ✅ vem

| Dados | Situação | Observação |
|---|---|---|
| Catálogo (`anime_catalog`, `anime_images`) | ✅ | As sinopses traduzidas custaram chamadas ao Gemini: guardar. O resto pode ser buscado de novo no AniList |
| Favoritos, seguindo, status, notas, resenhas (`anime_favorites`, `anime_follows`, `anime_user_status`, `anime_votes`, `anime_reviews`) | ✅ | |
| Avisos de episódio já enviados (`anime_notifications_sent`) | 🆕 | Só os recentes, para não avisar duas vezes |

## 7. Missões, ranking e indicações

| Dados | Situação | Observação |
|---|---|---|
| Catálogo de missões (`quest_catalog`) | ✅ | |
| Missões em andamento (`user_quest_slots`, `quest_progress`) | 🆕 | O sorteio recomeça no dia da virada; as épicas já resgatadas vêm, para não pagar de novo |
| Ranking: vencedores da semana e do mês (`ranking_week_winners`, `leaderboard_snapshots`) | 🆕 | Vêm só os vencedores (aparecem no perfil); o resto é recalculado |
| Indicações (`referral_codes`, `referrals`, `referrer_progress`) | ✅ | **Os links de convite já espalhados (`/convite/...`, `/w/...`) continuam funcionando** |

## 8. Mensagens, quarto otaku e Otaku TV — ✅ vem

| Recurso | Tabelas | Situação |
|---|---|---|
| Mensagens diretas (chat) | `chat_*` | ✅ Com todo o histórico: o volume é pequeno |
| Quarto otaku e pets | `room_*`, `user_pets`, `pet_*`, `otaku_rooms` | ✅ Itens, quarto e pet de cada um, como estão |
| Otaku TV | `otaku_tv_plays` | ✅ |

## 9. Não vem — ❌

| Recurso | Tabelas |
|---|---|
| Clãs (decisão do dono) | `clan_*`, `clans` |
| Fórum (decisão do dono) | `forum_*` |
| Comunidades (decisão do dono) | `community_*`, `communities`, `community_welcomes` |
| Stripe (decisão do dono) | `processed_stripe_events`, partes de `subscriptions` |
| Publicações antigas do Feed (decisão do dono; o recurso continua) | `feed_*`, `daily_prompt*` |
| Jogos: Fig Battle e Jogo da Memória (decisão do dono) | `card_battle_*`, `memory_game_*` |
| Versão em inglês `/en` (decisão do dono) | traduções e páginas `/en/*` |
| Eventos presenciais e globais (decisão do dono) | `events`, `user_event_*`, `global_event*`, `event_*` |
| Rádio (decisão do dono) | `radio_*` |
| Liga semanal (decisão do dono) | `user_league*` |
| Pedidos de matéria e de quiz feitos pelos usuários (decisão do dono) | `article_requests`, `quiz_requests` |
| Escritório 3D do admin | `office_*` |
| Métricas e telemetria antigas | `page_views`, `site_telemetry`, `metrics_*`, `friction_events`, `user_activity_days`, `nps_responses`, `title_tests` |
| Registros de envio e campanhas | `email_send_*`, `marketing_*`, `campaign*`, `whatsapp_sends`, `push_daily_counts`, `reengagement_pushes` |
| Histórico dos robôs | `ai_news_runs`, `ai_news_costs`, `ai_news_candidates`, `social_publications`, `instagram_post_queue` |
| Denúncias e bugs antigos | `content_reports`, `bug_reports` (os abertos são resolvidos antes) |
| Temporadas e campanhas antigas | `season_runs`, `season_recruitment_*`, `seasons`, `season_tags` |

Configurações dos robôs (fontes, horários, contas das redes) **vêm**: `ai_news_sources`, `ai_news_settings`,
`ai_news_schedule*`, `ai_news_blacklist`, `ai_news_priority_topics`, `social_accounts`, `instagram_settings`.

## 10. Para os usuários não sentirem a mudança

1. **Mesmos endereços.** Notícias, artigos, perfis, animes, figurinhas, quizzes e convites. O que saiu (Clãs, Fórum,
   Comunidades) leva para a página mais próxima com redirecionamento permanente.
2. **Mesma senha.** O único incômodo é entrar de novo uma vez, porque a sessão antiga não passa para o site novo.
3. **Nada some do inventário.** Saldo, figurinhas, molduras, emblemas, Premium e sequência ficam iguais. A sequência
   é protegida no dia da virada.
4. **Notificações e app instalado** continuam: mesmo domínio, mesmo Firebase e mesmo arquivo do service worker.
5. **Aviso antes:** uma semana antes, aviso no site e nas redes sobre o que muda e o que sai (Comunidades e Fórum).
6. **Ensaio completo** com cópia dos dados reais antes da virada, conferindo o saldo e a coleção de contas de
   teste, uma a uma.
