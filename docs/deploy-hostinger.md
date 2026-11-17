# Deploy na Hostinger

Status: ✅ endereço de teste no ar desde 2026-11-12 em https://novo.animeprofile.com.br (fora do Google). O domínio
principal continua no site antigo até a virada.

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
| Banco | MySQL 8 (`<usuário>_animeprofile`, ligado ao site `novo.`) em `127.0.0.1:3306`. Colunas JSON chegam como objeto |
| Variáveis | Lista em [arquitetura.md](arquitetura.md). Os segredos são cadastrados pelo dono no hPanel |
| Imagens | `~/animeprofile-media`, servidas em `/media` |
| Cron | Uma entrada na conta: `*/5 * * * *`, `curl -s -m 50 -o /dev/null "https://novo.animeprofile.com.br/api/cron/tick?token=..."`. Na virada, o endereço muda para o domínio principal |
| E-mail | Caixa `contato@animeprofile.com.br` (já existe), usada por SMTP como remetente "Anime Profile" |
| SSL | Let's Encrypt (Hostinger); `www` → domínio sem `www` pelo `server-app.js` |

## Variáveis cadastradas

`VITE_SITE_URL`, `SITE_NOINDEX=1`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `CRON_TOKEN`. Nada do Supabase fica no servidor: a importação do conteúdo é enviada do computador do desenvolvedor (ver `decisoes.md`). A senha do
banco e o token do cron foram gerados pelo Claude e cadastrados pelo MCP em 2026-11-12. Não estão no repositório.

- **Agora:** dá para trocar a lista inteira pelo MCP, porque todas as variáveis são conhecidas.
- **Depois que o dono cadastrar as chaves dele no hPanel:** a substituição pelo MCP apagaria essas chaves, que não
  estão com o Claude. A partir daí, variável nova só entra pelo hPanel (lição 7 abaixo).

## O que a criação do site mudou no DNS

A Hostinger acrescentou só `novo` (ALIAS para a CDN), `www.novo` (CNAME) e `ftp.novo` (A). Os registros do domínio
principal (`@`, `www`, MX e TXT) ficaram iguais, conferidos antes e depois.

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
  4. trocar `VITE_SITE_URL` para `https://animeprofile.com.br`, tirar `SITE_NOINDEX` e refazer o build (o canonical,
     os sitemaps e o RSS usam esse endereço);
  5. apontar o DNS;
  6. conferir e enviar `/sitemap.xml` ao Google Search Console.

### Virada executada em 2026-11-17 (00h30) pelo Caminho A

- Alias `animeprofile.com.br` adicionado ao app do `novo.`; a Hostinger trocou o `@` (A e AAAA do Lovable) por ALIAS `animeprofile.com.br.cdn.hstgr.net` na hora. Os AAAA do `www` ficaram no Lovable, então foram removidos e o `www` virou CNAME `animeprofile.com.br.` (TTL 300). MX, SPF, DKIM e DMARC intactos; `comunidade.` continua no Lovable. O `novo.` segue respondendo (mesmo app).

### Procedimento registrado em 2026-11-16 (dia 2, só leitura pelo MCP)

- **Estado:** `novo.animeprofile.com.br` é o único site Node.js; `hosting_websites_list-domains` mostra 0 domínios
  parked e 0 subdomínios. A zona DNS está na Hostinger (`dns_records_list`): `@` e `www` com A `185.158.133.1` e AAAA
  `2a07:8240::1` e `::2` (Lovable, TTL 300 s); `novo` é ALIAS para `novo.animeprofile.com.br.cdn.hstgr.net`.
- **Caminho A (preferido):** `hosting_websites_add-domain` com `domain: novo.animeprofile.com.br`, `type: parked`,
  `name: animeprofile.com.br` (mesmo app, mesmo banco, mesmas variáveis). A ferramenta exige que o domínio seja da conta
  (é). Depois, na hora H, trocar no DNS os registros do `@` (A e os dois AAAA do Lovable) por um `ALIAS` para
  `animeprofile.com.br.cdn.hstgr.net` (padrão do `novo`), e o `www` por CNAME/ALIAS equivalente. Conferir o certificado
  e que o Express recebe o `Host` correto.
- **O que NÃO foi testado:** adicionar o alias agora. A Hostinger pode reescrever o `@` na hora e derrubar o site antigo
  antes da virada (ver o aviso acima). Só testar com a aprovação do dono, de preferência na hora H.
- **Caminho B (se o A falhar):** `hosting_deploy` de um segundo site `animeprofile.com.br`, ligado ao mesmo repositório,
  com as variáveis recadastradas pelo dono.
- **Pasta de mídia:** `MEDIA_DIR` é uma variável do app; confirmar na hora H que o alias usa o mesmo diretório
  (o app é o mesmo, então deve usar).
- **Subdomínio `novo.`:** continua respondendo. Depois da virada o ideal é um 301 para o domínio principal
  (a fazer no `server-app.js`), porque `SITE_NOINDEX` é do app inteiro.
- **Rollback (até o fim do dia 4):** repor `@` e `www`: A `185.158.133.1` e AAAA `2a07:8240::1` e `2a07:8240::2`, TTL 300 s.
  Não mexer em MX, TXT, DKIM, `autodiscover`, `autoconfig` nem `_dmarc`.

## Contas e chaves externas

O dono gera as chaves e as guarda fora do repositório e fora do chat. **Decidido em 2026-11-12: fica para o fim**,
antes do ensaio da virada. Até lá, o desenvolvimento usa chaves de teste (Turnstile e Mercado Pago têm chaves
oficiais de teste) e o login por e-mail e senha. O login com Google é testado quando o cliente OAuth estiver pronto:
se o cliente usado hoje for do próprio dono, basta acrescentar os endereços de retorno do site novo.

**Regra da troca:** as chaves e os apps do site antigo **não são apagados nem renovados** até a virada. O site
antigo continua no ar usando-os. Depois de 30 dias com o site novo estável, as chaves antigas são revogadas.

| Serviço | O que é criado | Status |
|---|---|---|
| Google Cloud (login) | Cliente OAuth "Aplicativo da Web" no projeto do Firebase. Retorno em `/auth/google/callback` nos endereços final, de teste e local (`http://localhost:5173`) | 💤 no fim |
| Mercado Pago | **Aplicação nova** no painel de desenvolvedores (não renovar as credenciais da antiga) | 💤 no fim |
| Gemini | Chave nova no AI Studio, num projeto sem cobrança (plano gratuito) | 💤 no fim |
| Turnstile | Widget novo para `animeprofile.com.br` e `novo.animeprofile.com.br` | 💤 no fim |
| Firebase | **Mesmo projeto** (as notificações dos celulares continuam). Só uma chave nova da conta de serviço; o par de chaves Web Push continua o mesmo | 💤 no fim |
| Klipy | Conta própria de parceiro e chave (antes vinha pelo gateway do Lovable) | 💤 no fim |
| Firecrawl | Adiado: na fase 5 avaliamos se o robô precisa dele (o respawnou funciona sem) | 💤 |
