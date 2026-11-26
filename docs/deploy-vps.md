# Deploy na VPS (Coolify)

Status: ✅ no ar na VPS desde **2026-11-26** (virada às 19:18–19:30 UTC, 16:18–16:30 de Brasília). Antes: Hostinger Cloud
Startup ([deploy-hostinger.md](deploy-hostinger.md), agora histórico). Plano e andamento: [plano-vps.md](plano-vps.md).
A VPS é a mesma do criasite, do respawnou e do vibecoin (base em `criasite/docs/deploy-vps.md`).

| Item | Valor |
|---|---|
| Servidor | VPS Hostinger KVM 1 (1 vCPU, 4 GB, 50 GB, swap 4 GB), Ubuntu 24.04, IPv4 `189.24.17.85` (sem AAAA) |
| Painel | Coolify 4 em `https://painel.criasite.app`. Acesso de emergência: SSH root só por chave (`~/.ssh/criasite_vps`) |
| App | projeto `animeprofile` (uuid `tmztf7cm03hse0xiunvgiirl`) → app `animeprofile` (uuid **`5yepytlhxqhfz9wsi4beomjb`**), build pelo `Dockerfile` da raiz, porta 3000, healthcheck `/robots.txt`, limite 1024 MB |
| Deploy | **auto-deploy a cada push** na `main` (GitHub App `coolify-sites-evssousa`) |
| Domínios | `https://animeprofile.com.br` (principal), `https://www.animeprofile.com.br` (301 para o principal), `https://animeprofile.189-24-17-85.sslip.io` (ensaio, com noindex; tirar depois de 7 dias) |
| SSL | Let's Encrypt pelo Traefik do Coolify, renovação automática |
| CDN | **nenhuma** (o Traefik não guarda cache; segura a carga o cache em memória do app). Reavaliar Cloudflare grátis se a CPU passar de 70% ou o TTFB de 0,8 s (exige trocar os nameservers, inclusive do e-mail) |
| Banco | MariaDB 11.8 compartilhado `mariadb-sites` (container `djg6eojhrivnayhax7ohoszd`, projeto `bancos`), banco e usuário `animeprofile`; `DB_HOST` = nome interno do serviço; sem porta pública. Migrations rodam a cada início do app |
| Imagens | `/srv/sites/animeprofile/media` no servidor → `/data/media` no container (`MEDIA_DIR` no Dockerfile). 3.307 arquivos, 301 MB na virada |
| Variáveis | cadastradas no app do Coolify (só `VITE_SITE_URL` como build). Cópia local do dono em `projetos\_segredos\animeprofile-vps.env`. `CRON_TOKEN` novo (também no `sites.json` do escritório) |
| Tarefa | Scheduled Task `tick`, `*/5 * * * *`: `sh -c 'curl -fsS -m 50 -H "x-cron-token: $CRON_TOKEN" http://127.0.0.1:3000/api/cron/tick'`. Os horários das tarefas ficam no código (`app/server/cron/jobs.server.ts`, horário de Brasília) |
| Backup | banco: todos os bancos do `mariadb-sites`, diário `30 6 * * *` UTC, 14 cópias locais |
| E-mail | MX da Hostinger (pedido "Free Business Email" separado, válido até 2027-11-14); a virada não mexeu no MX |

## Rótulos do proxy (atenção)

Os redirecionamentos do Coolify saem como 302 e o middleware `redirect-to-https` é compartilhado por todos os apps da VPS.
O app usa **rótulos próprios** (gerenciamento automático desligado) com `permanent=true` no `to-non-www` e no
`redirect-to-https`. Se um app declarar o middleware sem `permanent=true`, **todo http da VPS dá 503**. Para trocar
domínio: ligar "Readonly labels", salvar o domínio, deixar o Coolify gerar os rótulos, aplicar de novo as duas linhas
`permanent=true`, desligar o automático e fazer deploy. Conferir `curl -s -o /dev/null -w '%{http_code}' http://criasite.app/x` → 301.

## Comandos úteis (SSH)

- Logs do app: `docker logs --since 1h $(docker ps -qf name=5yepytlhxqhfz9wsi4beomjb)`
- Status do robô: `docker exec <container> sh -c 'curl -s -H "x-cron-token: $CRON_TOKEN" http://127.0.0.1:3000/api/cron/status'`
- Rodar uma tarefa: `.../api/cron/run?nome=<tarefa>&wait=1`
- SQL: `docker exec -it djg6eojhrivnayhax7ohoszd sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" animeprofile'`
- Variável nova só entra no container com **deploy** (o `docker restart` não basta).
