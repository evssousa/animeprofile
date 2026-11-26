# Plano (temporário): migração do animeprofile para a VPS

Status: ⏳ plano pronto em 2026-11-26, esperando as respostas do dono (fim do documento). Base: o criasite, que está no ar na
VPS desde 2026-11-26 ([migracao-vps.md](../../criasite/docs/migracao-vps.md), [deploy-vps.md](../../criasite/docs/deploy-vps.md)).
Fora do escopo: o `animeprofile-old` (Lovable) e o subdomínio `comunidade.` (continua no Lovable, não mexer).

## Objetivo
Levar `animeprofile.com.br` do Cloud Startup para a VPS (Coolify) sem perder banco, imagens, robô, visitas, AdSense e SEO,
com uma janela curta e um caminho de volta até o site antigo ser apagado.

## O que é igual ao criasite (não repetir: seguir o doc do criasite)
- **Parte A inteira já está feita** (Coolify em `painel.criasite.app`, `mariadb-sites` 11.8 com backup diário de todos os
  bancos, firewall, swap, SSH `~/.ssh/criasite_vps`, token em `_segredos\coolify-api-token.txt`, GitHub App).
- Dockerfile/`.dockerignore` (B2), variáveis por arquivo em `_segredos` (B3), banco e usuário (B4), dump pelo phpMyAdmin (B5),
  app no Coolify (B7), checklist do ensaio (B9), janela (Parte C), pós-virada (Parte D) e as **lições 1 a 13** (atenção à 4,
  5, 7, 8, 9 e sobretudo à **13**: rótulo `redirect-to-https` com `permanent=true` logo ao criar o app, senão todo http da VPS dá 503).
- IP real: o app lê o 1º valor do `x-forwarded-for` (`app/server/http.server.ts`, `app/visitas/server/coleta.server.ts`), igual
  ao criasite, onde o Traefik já descarta o valor forjado (B9.8 conferido). Não mexer nessas funções.

## O que muda no animeprofile
| Ponto | Animeprofile |
|---|---|
| Banco | Bem maior (posts ~970, `anime_catalog`, `anime_characters`, comentários, quiz, blog, figurinhas, robô, visitas). Última migration: **`015`**. A `016` (Artigos com IA) **não** entra antes da virada |
| Mídia | ~650 MB+, milhares de arquivos (importadas do antigo, `robo/`, `painel/`, `figurinhas/`). Hoje em `MEDIA_DIR` (padrão `~/animeprofile-media`). Na VPS: `/srv/sites/animeprofile/media` → `/data/media` |
| Cron | **Uma** chamada `*/5` a `/api/cron/tick` (os horários das 7 tarefas ficam no código, em horário de Brasília: `app/server/cron/jobs.server.ts`). Nada a converter para UTC |
| Variáveis | `VITE_SITE_URL` (build), `DB_HOST/PORT/NAME/USER/PASSWORD`, `SESSION_SECRET`, `CRON_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_USERNAME` (se existir), `GEMINI_API_KEY`, `SMTP_*`/`MAIL_FROM`/`MAIL_TO` (se existirem). **Não** cadastrar `SITE_NOINDEX`, `MEDIA_DIR`, `NODE_ENV`, `PORT` |
| Token novo | O `CRON_TOKEN` novo também vale para `scripts/exportar-conteudo-antigo.mjs` (`/api/importar`), `/api/robo/*` e o escritório (`/api/escritorio`): atualizar onde o escritório guarda o token |
| CDN | Na Hostinger há CDN (`s-maxage=60`). Na VPS **não há CDN**: o Traefik não guarda cache; quem segura a carga é o cache em memória do app. Os cabeçalhos ficam como estão (não atrapalham e servem se um dia entrar Cloudflare) |
| País das visitas | O passo 14 do painel de visitas contava com cabeçalho de país da CDN: na VPS não existe. Fica para depois |
| www | O `server-app.js` já faz 301 de `www` para o apex; o Coolify recebe os dois domínios e os rótulos `permanent=true` (lição 4) |
| AdSense | Nada muda no painel do AdSense (mesmo domínio). Conferir `/ads.txt` (vem de `public/ads.txt`) byte a byte |
| DNS a preservar | MX, SPF, DKIM, DMARC, TXT do Google, `autodiscover`, `autoconfig`, **`comunidade`** |

## Passos (🤖 Claude · 👤 dono · tamanho P/M/G)
**Preparação (o site atual não é afetado)**
1. 🤖 P **Levantamento** pelo MCP: nomes (só nomes) das variáveis do app; se `MEDIA_DIR` existe; o Cron Job do animeprofile na lista da conta (anotar o comando sem o token); zona DNS completa salva na seção "Volta" deste doc; procurar CAA. *Conferir:* tabela "Específico" preenchida.
2. 🤖 P **Código:** `Dockerfile` e `.dockerignore` copiados do criasite (trocar `VITE_SITE_URL` para `https://animeprofile.com.br`; no `.dockerignore` acrescentar `.import` e `tests`); só comentários em `server.js`, `server-app.js`, `server-paths.mjs`, `app/server/db.server.ts`, `app/server/http.server.ts` ("Hostinger" → genérico). `npm test` e `npm run build`, commit e push. *Conferir:* deploy da Hostinger "completed" e site igual.
3. 🤖+👤 P **Variáveis:** 🤖 gera `projetos\_segredos\animeprofile-vps.env` (DB_*, CRON_TOKEN, SESSION_SECRET, VITE_SITE_URL) sem imprimir; 👤 preenche ADMIN_EMAIL, ADMIN_PASSWORD_HASH (`npm run admin:hash`), GEMINI_API_KEY e as opcionais que o passo 1 achar. *Conferir:* arquivo sem linha vazia.
4. 🤖 P **Banco e usuário `animeprofile`** no `mariadb-sites` (B4 do criasite). *Conferir:* `SHOW GRANTS` só com `animeprofile.*`.
5. 👤 P **Dump do ensaio** pelo phpMyAdmin (B5.1), anotando a versão do servidor; com o banco grande, usar **compressão gzip**. Salvar em `projetos\_migracao\animeprofile-ensaio.sql.gz`.
6. 🤖 M **Importar** (`zcat … | docker exec -i …`), antes conferir `uca1400`/`DEFINER`/`USE`. *Conferir:* `schema_migrations` = 015; contar e anotar `posts`, `anime_catalog`, `anime_characters`, `post_comments`, `quizzes`, `blog_posts`, `sticker_catalog`, `cron_jobs`, `ai_news_candidates`, `visit_daily`, `visit_pages`.
7. 👤+🤖 M **Mídia do ensaio** (pergunta 1): 👤 liga o SSH no hPanel e adiciona a chave pública `criasite_vps.pub`; 🤖 copia tudo pelo PC: `ssh <hospedagem> "tar -czf - -C <MEDIA_DIR> ." | ssh root@189.24.17.85 "tar -xzf - -C /srv/sites/animeprofile/media"`, depois `chown -R 1000:1000`. Sem SSH: lista do dump (lição 6, padrão só `/media/` do próprio site) + `curl`. *Conferir:* nº de arquivos e `du -sh` iguais aos da origem (`find <MEDIA_DIR> -type f | wc -l`).
8. 🤖 M **App no Coolify** (B7 + lições 1 a 3): projeto e app `animeprofile`, Dockerfile, porta 3000, healthcheck `/robots.txt`, **1024 MB**, domínio só `https://animeprofile.189-24-17-85.sslip.io` com noindex, pasta de mídia, variáveis do arquivo, **sem tarefa agendada**. Logo em seguida, rótulos `permanent=true` (lição 13). *Conferir:* log `[migrate] banco atualizado` e `ouvindo na porta 3000`; `curl -sI http://criasite.app/x` e do respawnou → 301; `docker logs --since 2m coolify-proxy | grep ERR` vazio; tempo de build e pico de RAM anotados.
9. 🤖 M **Ensaio** (B9 adaptado) em `T=https://animeprofile.189-24-17-85.sslip.io`: 200 e conteúdo real em `/`, `/noticias`, `/artigos`, 2 matérias, `/animes`, 1 ficha, 1 personagem, calendário, `/otaku-tv`, `/quiz` e 1 quiz, `/blog`, `/figurinhas`, `/busca?q=one+piece`, `/login`; 404 certo; 3 redirects do `redirects.mjs` (ex. `/en`); `<loc>` de **cada** sitemap igual ao do site atual; `/rss.xml`; `/ads.txt`, `/sw.js`, `/manifest.webmanifest`, `/api/health` 200; 50 imagens sorteadas de `robo/`, `painel/`, `figurinhas/` e importadas com `immutable`; `/admin` (login, visitas, posts, ai-news) sem editar; robô só por `/api/robo/ensaio` (prévia, não publica) e `cron/run?nome=animes-anilist&wait=1` (AniList a partir do IP novo); TTFB da home e de uma matéria (5×) contra o site atual; redeploy sem 502; `docker stats` (app < 400 MB parado).
10. 🤖 P **Tarefa preparada (não criar):** `tick`, `*/5 * * * *`, `sh -c 'curl -fsS -m 50 -H "x-cron-token: $CRON_TOKEN" http://127.0.0.1:3000/api/cron/tick'`.

**Virada (~1 h, janela da pergunta 3)**
11. 👤 P **Antes da janela:** nenhum post agendado para dentro dela (`/admin/posts`); nada de push com migration desde o passo 5.
12. 🤖 P Snapshot da VPS; avisar o dono para não editar no `/admin`; **apagar só o Cron Job do animeprofile** (lição 7); esperar a rodada do `robo-noticias` (minuto :20) terminar no `/api/cron/status`.
13. 👤 P **Dump final** igual ao passo 5 → `animeprofile-final.sql.gz`.
14. 🤖 M `DROP DATABASE` + `CREATE DATABASE` (lição 5), importar, contagens ≥ ensaio; mídia nova: `find <MEDIA_DIR> -type f -newermt '<data do ensaio>'` em tar pelo mesmo caminho; `docker restart`. *Conferir:* post mais novo do robô aparece em `$T`.
15. 🤖 P **DNS:** apagar `@` ALIAS e `www` CNAME, criar `A 189.24.17.85` nos dois (TTL 300, sem AAAA), nada mais na zona. *Conferir:* `dig` em 8.8.8.8, 1.1.1.1 e no NS da Hostinger.
16. 🤖 P Coolify: domínios `animeprofile.com.br`, `www.animeprofile.com.br` (+ temporário), redeploy, reaplicar os rótulos (`deploy-vps.md`, "Rótulos do proxy"). *Conferir:* certificado Let's Encrypt dos dois; teste da lição 13 nos 3 sites.
17. 🤖 M Checklist do passo 9 no domínio real + `http`→`https` e `www`→apex em 301; canonical e sitemaps com `https://animeprofile.com.br`; sem `X-Robots-Tag` no domínio real; MX igual. Criar a tarefa `tick` e conferir no `status` a 1ª execução.
18. 👤 P Abrir site e `/admin` no celular (4G) e no PC; Search Console: "Testar URL publicada" na home e ver os sitemaps "Sucesso" (não precisa reenviar).

**Depois**
19. 🤖 P **2 h / 24 h / 7 dias** (Parte D do criasite): próximo horário do robô publica com imagem em `/media/robo` servida da VPS; `publicar-agendados` e `limpeza` rodam; 1ª segunda: `agenda-semanal` (9h) e `metricas-semanal` (9h30); backup diário inclui `animeprofile`; `/admin/visitas` contando; aos 7 dias: TTL 3600, tirar o temporário, apagar dumps e `.env` da VPS, novo token no escritório/exportação, `deploy-vps.md` novo, `deploy-hostinger.md` vira histórico, `arquitetura.md` atualizado.
20. 👤 P Decidir quando apagar o site antigo na Hostinger (pergunta 5); 🤖 apaga e confere a zona e o e-mail (lição 10).

## Riscos e cuidados
- Robô publicando em dobro: cron da Hostinger apagado (12) antes da tarefa do Coolify (17); no ensaio, nenhuma tarefa.
- Visitas e posts entre o dump final e o DNS (minutos) ficam no banco antigo: aceitar; janela em hora de pouco tráfego.
- Sem CDN, picos de robôs batem direto no Node (1 vCPU): olhar `docker stats` nas primeiras 24 h.
- RAM: 3 sites + banco na mesma VPS; se a sobra cair abaixo de 500 MB, reduzir limites ou pensar no KVM 2 (Parte G do criasite).
- Segredos nunca no chat nem como Build Variable; dumps fora dos repositórios (têm hash de IP e dados de visitas).
- `npm run build` antes de cada push; migration nova (016) vai colada no chat e só depois da virada.

## Volta (rollback; vale enquanto o site antigo existir)
1. 🤖 DNS como antes: `@` ALIAS `animeprofile.com.br.cdn.hstgr.net`, `www` CNAME `www.animeprofile.com.br.cdn.hstgr.net.`, TTL 300 (conferir com a zona salva no passo 1); apagar os A.
2. 🤖 Pausar/apagar a tarefa `tick` do Coolify. 3. 👤 Recriar no hPanel o Cron Job `*/5` do `tick` (o token antigo continua no app antigo).
4. 🤖 Listar `posts` criados/editados na VPS depois do dump final e exportar só essas linhas para o banco antigo. 5. Anotar a causa em `decisoes.md`.

## Específico (preencher na execução)
- Variáveis na Hostinger (11): `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `ADMIN_EMAIL`, `GEMINI_API_KEY`, `VITE_SITE_URL`, `DB_HOST/PORT/NAME/USER/PASSWORD`, `CRON_TOKEN` (sem SMTP/MAIL, sem `MEDIA_DIR`: padrão `~/animeprofile-media`).
- Cron Job atual: uid `YRNxn4t7nm`, `*/5 * * * *`, `curl -s -m 50 -o /dev/null "https://animeprofile.com.br/api/cron/tick?token=<antigo>"`.
- Zona DNS salva (2026-11-26): `@` ALIAS `animeprofile.com.br.cdn.hstgr.net.` (TTL 300); `www` CNAME **`www.animeprofile.com.br.cdn.hstgr.net.`** (TTL 300); MX 5 mx1/10 mx2.hostinger.com; TXT `@` (2× google-site-verification, SPF); DKIM `hostingermail-a/b/c._domainkey`; `_dmarc`; `autodiscover`, `autoconfig`; `comunidade` A 185.158.133.1 + 2 AAAA; TXT `_lovable`, `_lovable.www`, `_lovable.comunidade`, `_lovable-email`. Sem CAA. `ftp.novo` apagado em 2026-11-26 (era o único registro do `novo.` que restava).
- Versão do MariaDB de origem: …
- Arquivos/tamanho da mídia: … · Build (tempo, pico de RAM): … · Contagens do ensaio e da final: …

## Perguntas em aberto (com recomendação)
1. **Mídia por SSH da hospedagem ou por HTTP?** → **SSH** (ligar no hPanel e colar a chave pública): copia tudo, inclusive arquivos sem referência no banco, e a virada só leva os novos.
2. **CDN na VPS?** → **Sem CDN por enquanto**; reavaliar Cloudflare grátis se a CPU passar de 70% ou o TTFB de 0,8 s (exige mudar os nameservers, inclusive do e-mail).
3. **Janela:** → terça a quinta, **23:25 de Brasília** (depois do robô das :20, fora dos horários de publicação e longe das tarefas de segunda), com o dono disponível ~1 h para o dump.
4. **Migration 016 antes ou depois?** → **Depois** da virada (já direto na VPS).
5. **Site antigo na Hostinger:** → manter **14 dias** parado como volta (o criasite foi apagado na hora; aqui há mais dados).
6. **Subdomínio `novo.` (ALIAS/`www.novo`/`ftp.novo` na zona):** → apagar os registros depois dos 7 dias.
7. **Quando:** → pelo menos **2 dias depois do respawnou** (a partir de 2026-11-28), olhando a RAM da VPS antes.

## Andamento

**2026-11-26 (Claude)**
- Respostas do dono: mídia como achar melhor, CDN só se valer a pena, virada já, 016 depois, apagar o site antigo logo após a
  transferência, apagar o `novo.` já, sem esperar. Decisões de execução: **um dump só** (o robô fica parado entre o dump e o
  DNS; sem ensaio separado) e **mídia por HTTP** a partir do dump (lição 6, sem precisar ligar SSH na hospedagem). Sem CDN.
- 1: levantamento (acima). `ftp.novo` apagado.
- 2: `Dockerfile`/`.dockerignore` e comentários (commit `198e085`), 292 testes ok, build ok.
- 3: `projetos\_segredosnimeprofile-vps.env` gerado (DB, `CRON_TOKEN`, `SESSION_SECRET` novos); faltam 3 linhas do dono.
- 4: banco e usuário `animeprofile` (grants só em `animeprofile.*`); pasta `/srv/sites/animeprofile/media`.
- 8: projeto `animeprofile` (uuid `tmztf7cm03hse0xiunvgiirl`), app **`5yepytlhxqhfz9wsi4beomjb`**, 1024 MB, temporário com
  noindex, pasta de mídia, rótulos 301 antes do 1º deploy. 1º deploy: healthy, 15 migrations no banco vazio, 85 MB de RAM;
  http dos outros 3 sites segue 301.
