# Inventário: o que vem do site antigo

Levantado em 2026-11-12 no código do site antigo: 319 tabelas no banco e 138 páginas. Cada item tem uma situação:

- **✅ vem:** recurso e dados vêm para o site novo.
- **🆕 vem sem o histórico:** o recurso continua, mas os dados antigos ficam para trás.
- **❌ não vem:** nem recurso nem dados.
- **❓ decidir:** sugestão minha, esperando a decisão do dono.

Os números de cada tabela (linhas e tamanho) entram aqui quando o dono rodar a consulta do fim do documento.

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
| Quizzes (`quizzes`) | ✅ | Partidas (`quiz_plays`): ❓ só as contagens |
| Comentários nas notícias (`post_comments`, curtidas) | ❓ | Sugestão: vêm (são poucos e dão vida às matérias) |
| Blog dos usuários (`blog_*`) | ❓ | Tem páginas no Google e é dos usuários. Sugestão: vem |
| Versão em inglês (`/en`) | ❓ | Dobra o trabalho de cada tela. Sugestão: entra depois, se o tráfego de `/en` justificar |

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

## 8. Recursos sem decisão ainda — ❓

| Recurso | Tabelas | Sugestão |
|---|---|---|
| Mensagens diretas (chat) | `chat_*` | Vem o recurso. Do histórico, as conversas dos últimos 90 dias: perder tudo seria sentido |
| Quarto otaku e pets | `room_*` (~35 tabelas), `user_pets`, `pet_*`, `otaku_rooms` | Os usuários gastaram moedas nele. Se continuar, vêm os itens e o quarto de cada um; se sair, devolver o valor gasto, como foi com os clãs |
| Jogos: Fig Battle e Jogo da Memória | `card_battle_*`, `memory_game_*` | Vêm o deck, o andar alcançado e o ranking da Torre; o histórico de partidas não |
| Eventos (presenciais e globais) | `events`, `user_event_*`, `global_event*`, `event_*` | Depende de estar em uso |
| Rádio e Otaku TV | `radio_*`, `otaku_tv_plays` | Depende de estar em uso |
| Liga semanal | `user_league*` | Depende de estar em uso |
| Pedidos de matéria e de quiz | `article_requests`, `quiz_requests` | Sugestão: não vem |

## 9. Não vem — ❌

| Recurso | Tabelas |
|---|---|
| Clãs (decisão do dono) | `clan_*`, `clans` |
| Fórum (decisão do dono) | `forum_*` |
| Comunidades (decisão do dono) | `community_*`, `communities`, `community_welcomes` |
| Stripe (decisão do dono) | `processed_stripe_events`, partes de `subscriptions` |
| Publicações antigas do Feed (decisão do dono; o recurso continua) | `feed_*`, `daily_prompt*` |
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

## Consulta para o dono rodar no SQL do Lovable

Mostra quantas linhas tem cada tabela e quanto ocupam os arquivos. Ajuda a decidir os itens ❓ e a planejar a
importação.

```sql
SELECT relname AS tabela, n_live_tup AS linhas, pg_size_pretty(pg_total_relation_size(relid)) AS tamanho
FROM pg_stat_user_tables WHERE schemaname = 'public' AND n_live_tup > 0
ORDER BY n_live_tup DESC;

SELECT bucket_id, count(*) AS arquivos, pg_size_pretty(sum(COALESCE((metadata->>'size')::bigint, 0))) AS tamanho
FROM storage.objects GROUP BY bucket_id ORDER BY 1;

SELECT count(*) AS usuarios,
       count(*) FILTER (WHERE last_sign_in_at > now() - interval '30 days') AS ativos_30_dias
FROM auth.users;
```
