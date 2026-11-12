# Deploy na Hostinger

Status: ⏳ o app ainda não existe. Este é o plano; vira registro do que foi feito quando o primeiro deploy sair.

## Conta

- **Plano:** Business, o mesmo do respawnou. O número do pedido e o usuário ficam fora do repositório, que é público:
  consultar com `hosting_websites_list` pelo MCP.
- **Ocupação:** o plano já tem dois apps Node.js (respawnou e criasite) e dois WordPress. O Anime Profile será o
  terceiro app Node.js, de um limite de 5.
- **Banco:** cada banco MySQL do plano aceita até 3 GB. O do Anime Profile deve ficar perto de 100 MB, sem a
  telemetria antiga.
- **Arquivos:** as imagens (cerca de 650 MB) cabem com folga no disco do plano.

## Como vai ficar

| Item | Valor |
|---|---|
| Endereço de teste | `novo.animeprofile.com.br`, fora do Google (`noindex` e `robots.txt` bloqueando tudo) |
| Endereço final | `animeprofile.com.br`, ligado só na virada (fase 6) |
| Deploy | GitHub `evssousa/animeprofile`, branch `main`, **auto-deploy a cada push** |
| Build | Node 24, `npm install` + `npm run build`, app type `express` |
| Entrada | `server.js` (define NODE_ENV) → `server-app.js` (Express + migrations) |
| Banco | MySQL próprio (`u..._animeprofile`) em `127.0.0.1:3306` |
| Variáveis | Lista em [arquitetura.md](arquitetura.md). Os segredos são cadastrados pelo dono no hPanel |
| Imagens | `~/animeprofile-media`, servidas em `/media` |
| Cron | Uma entrada: a cada 5 min, `curl` em `/api/cron/tick?token=...` |
| E-mail | Caixa `contato@animeprofile.com.br` (já existe), usada por SMTP como remetente "Anime Profile" |
| SSL | Let's Encrypt (Hostinger); `www` → domínio sem `www` pelo `server-app.js` |

## Lições do respawnou que valem aqui

1. **App do GitHub:** o app da Hostinger já está instalado na conta pessoal `evssousa`.
2. **`NODE_ENV`:** nunca vai nas variáveis do painel. As ferramentas de build ficam em `dependencies`.
3. **Sem `await` no nível do módulo** na entrada: o LiteSpeed carrega com `require()`.
4. **`NODE_ENV` antes de qualquer import:** por isso a entrada é separada do app.
5. **O banco só aceita conexão local:** as migrations rodam no app, e a inspeção é pelo phpMyAdmin.
6. **O LiteSpeed pode subir mais de um processo:**
   - as migrations são idempotentes;
   - o cron usa trava no banco;
   - nada de estado importante em memória.
7. **Variáveis pelo MCP substituem a lista inteira:** mudanças de variáveis são feitas no hPanel pelo dono.
8. **Logs:** `hosting_nodejs_runtime-logs` mostra o app, e `hosting_get-deployment` mostra o build.
9. **A CDN corta respostas acima de ~55 s:** tarefas longas respondem 202 e continuam em segundo plano.

## Cuidado com o domínio na virada

- **Por que:** o DNS do animeprofile.com.br está na Hostinger e hoje aponta para o Lovable. Criar no hPanel um site
  com o domínio principal pode reescrever os registros `A` e `AAAA` na hora e tirar o site antigo do ar antes do
  tempo.
- **Até a virada:** só o subdomínio `novo.` é criado. O domínio principal é ligado na virada, seguindo o checklist
  da fase 6:
  1. baixar o TTL;
  2. pausar as gravações no site antigo;
  3. fazer a importação final;
  4. apontar o DNS;
  5. conferir.

## O que o dono precisa fazer (na fase 2)

- **Google Cloud:** criar o cliente OAuth do login com Google. É gratuito, e o passo a passo vem na hora.
- **Chaves novas:** gerar novas chaves do Mercado Pago, do Gemini, do Turnstile, do Firebase, do Firecrawl e do
  Klipy, e cadastrá-las nas variáveis do app.
