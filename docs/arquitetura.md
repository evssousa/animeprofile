# Arquitetura

Como o Anime Profile novo é construído. Segue o modelo do respawnou: o que deu certo lá vale aqui, e as diferenças
vêm do fato de o Anime Profile ser uma rede social com contas, economia e coleção.

## Stack

| Parte | Escolha | Por quê |
|---|---|---|
| Páginas e servidor | React 19 + React Router 8 em modo framework, com SSR | Igual ao respawnou. O `loader` busca os dados no servidor e a `action` grava, então a regra de negócio fica toda no servidor |
| Servidor HTTP | Express 5 (`server.js` → `server-app.js`) | Igual ao respawnou, com as mesmas armadilhas da Hostinger já resolvidas |
| Estilo | Tailwind CSS 4, ícones `lucide-react` | O site antigo já usa Tailwind: o visual pode ser portado sem reescrever |
| Componentes acessíveis | Radix, só onde precisa (diálogo, menu, popover, abas) | O antigo carrega 27 pacotes Radix; aqui entra só o usado |
| Editor de texto (blog e admin) | TipTap | Mesmo editor do antigo: os textos importados abrem sem conversão |
| Banco | MySQL/MariaDB da Hostinger via `mysql2` | Sem serviço pago à parte |
| Imagens | `sharp` (WebP, tamanhos) | Igual ao respawnou |
| Linguagem | TypeScript estrito, Node 22+ | |
| Testes | Vitest; banco descartável com `mysql-memory-server` | A economia e a coleção precisam de teste com banco de verdade |

Fica de fora o que o site antigo trazia e não é mais usado: Supabase, TanStack, Cloudflare, three.js (escritório
3D), Stripe, React Query e o pacote de tradução.

## Pastas

```
server.js                 entrada (define NODE_ENV e carrega server-app.js)
server-app.js             Express: migrations, arquivos estáticos, /media, SSR
app/
  root.tsx                layout, cabeçalho, rodapé, página de erro
  routes.ts               mapa de rotas (os endereços do site antigo estão em enderecos.md)
  routes/                 páginas; api/ (cron, webhook, upload, polling); admin/
  components/             visual, por área (layout, perfil, figurinhas, loja, chat...)
  lib/                    código que roda nos dois lados: formatos, SEO, configuração, tipos
  server/                 só no servidor (*.server.ts), um módulo por área:
    db.server.ts          pool MySQL, transação, helpers (json, iso, uuid)
    auth/                 senha, sessão, Google, recuperação, Turnstile
    economy/              carteira (AP Coins, Rubis, XP, nível), extrato, Premium
    stickers/             catálogo, pacotes, coleção, fragmentos, álbuns, trocas
    quests/ ranking/ referrals/ achievements/ cosmetics/
    posts/ blog/ quiz/ anime/ feed/ chat/ room/ otakutv/
    notifications/ push/ mail/ media/ payments/
    robot/                notícias por IA (Gemini)
    social/               imagens e postagem no Instagram
    cron/                 agenda e tarefas
db/migrations/            SQL versionado (NNN_nome.sql), aplicado ao iniciar o app
scripts/                  migrate, seed de desenvolvimento, importação do site antigo
tests/
docs/
```

**Regra do endereço:** nenhum `loader` lê `new URL(request.url).pathname` direto. Todos usam `routePath(request)`, de
`app/lib/route-path.ts`. Na navegação por clique, o React Router pede `<endereço>.data`, e sem isso a página dava
"não encontrada" só ao clicar (bug de 2026-11-14, o mesmo do respawnou em 2026-11-12).

**Regra:** as rotas não falam com o banco. Elas chamam o módulo da área em `app/server/`, que valida, confere a
permissão e grava.

## O que substitui cada peça do Supabase

| No site antigo | No novo |
|---|---|
| **Supabase Auth** | Contas do próprio site (`app/server/auth/`) |
| **RLS** (614 regras) | Checagem no servidor: toda leitura e escrita passa por um módulo que recebe o usuário da sessão. O navegador nunca fala com o banco |
| **Funções plpgsql** (813) | Funções TypeScript em `app/server/<área>/`, cada operação de dinheiro ou coleção numa transação |
| **Triggers** | Chamadas explícitas no módulo (ex.: ganhar XP → conferir nível → pagar recompensa) |
| **pg_cron** (12 rotinas + 24 ganchos) | Cron da Hostinger chamando `/api/cron/tick` (ver abaixo) |
| **Realtime** (chat e notificações) | Consulta periódica (*polling*) e push do Firebase |
| **Storage** (buckets) | Disco da Hostinger, fora da pasta do app, servido em `/media` |
| **E-mail do Lovable** | SMTP da Hostinger (`nodemailer`) |
| **Login com Google do Lovable** | OAuth do Google com cliente próprio (gratuito) |
| **Gateway do Lovable** (Klipy) | Chave própria do Klipy |
| **GitHub Actions** (notícias por IA, Instagram) | Tarefas do cron no próprio servidor |

## Contas e login

- **Senha:**
  - **Contas importadas:** o Supabase guarda as senhas com bcrypt (`$2a$`), e o site novo confere esse formato
    (`bcryptjs`, sem dependência nativa).
  - **Senhas novas:** usam `scrypt`, que já vem no Node.
  - **Troca automática:** no primeiro login de uma conta importada, a senha é refeita em `scrypt`.
  - **Resultado:** ninguém precisa trocar de senha.
- **Google:**
  - **Fluxo:** OAuth com PKCE feito pelo servidor, com um cliente OAuth do Google Cloud em nome do dono.
  - **Reconhecimento da conta:** pelo `sub` do Google, que vem da tabela de identidades do Supabase. Na falta dele,
    pelo e-mail confirmado.
- **Sessão:**
  - **Cookie:** `ap_session` (`HttpOnly`, `Secure`, `SameSite=Lax`), com 60 dias de validade renovados a cada uso.
  - **No banco:** fica só o hash SHA-256 do token. Sair encerra a sessão; trocar a senha encerra todas.
- **Proteções:**
  - Turnstile no cadastro, no login e no "esqueci a senha".
  - Limite de tentativas por IP e por e-mail.
  - Conferência do `Origin` em todo POST.
- **Papéis:** os papéis `admin`, `author` e `moderator` vêm da tabela `user_roles`. O painel `/admin` confere o
  papel no `loader` e na `action` de cada rota.

## Economia e coleção (onde não pode haver erro)

- **Moedas:** todo valor é inteiro (AP Coins, Rubis e XP).
- **Uma porta só:** toda mudança de saldo passa por `economy.credit()` e `economy.debit()`, dentro de uma
  transação. Cada chamada:
  1. trava a linha da carteira (`SELECT ... FOR UPDATE`);
  2. confere o saldo;
  3. grava o novo saldo;
  4. registra a movimentação no extrato.
- **Sem pagamento duplicado:** toda movimentação tem uma chave única (ex.: `checkin:2026-11-20:<user>`,
  `mp:<payment_id>`). Repetir a chamada não paga duas vezes. Isso substitui as travas que o antigo fazia no banco.
- **Mesmo cuidado em tudo que dá ou tira algo:** abrir pacote de figurinhas, resgatar missão, comprar na loja e
  ativar o Premium seguem o mesmo padrão: transação, trava e chave única.
- **Testes:** cada regra de dinheiro tem teste com banco de verdade, incluindo duas chamadas ao mesmo tempo.

## Tempo real sem conexão permanente

O plano Business não aceita WebSocket, e a CDN da Hostinger corta respostas longas. Por isso:

- **Notificações e mensagens não lidas:** consulta leve a cada 60 s, só com a aba visível, e na volta à aba.
- **Conversa aberta no chat:** consulta a cada 3 s, pedindo só o que chegou depois da última mensagem. Com a aba
  escondida, o intervalo vai subindo até 30 s.
- **Fora do site:** o push do Firebase avisa, como hoje.

Com o volume atual (22 usuários ativos no mês), isso é um custo desprezível para o servidor.

## Tarefas agendadas

- **Uma entrada só no cron da Hostinger:** a cada 5 minutos, `curl` em `/api/cron/tick?token=...`.
- **Agenda no banco:** a tabela `cron_jobs` guarda o horário de cada tarefa. O `tick` roda só as que estão na hora,
  com uma trava que impede a mesma tarefa de rodar duas vezes ao mesmo tempo, e registra cada execução em
  `cron_runs`.
- **Tarefas longas:** a geração de notícias e a postagem no Instagram respondem `202` na hora e continuam em
  segundo plano, porque a CDN corta respostas acima de ~55 s. É a lição nº 9 do respawnou.
- **No painel admin:** dá para ver a agenda, as execuções e rodar qualquer tarefa na hora.

Tarefas previstas, vindas do site antigo, sem as dos recursos que saem:

| Tarefa | Quando |
|---|---|
| Notícias por IA (buscar, escrever e publicar) | de hora em hora, com o limite do dia |
| Postagem no Instagram | a cada 15 min, se houver publicação na fila |
| Fechar o ranking da semana e pagar os prêmios | segunda-feira |
| Prêmios do ranking do mês e fechar o mês das indicações | dia 1 |
| Registro diário do ranking | diário |
| Quarto otaku (energia, planta e pets) | de hora em hora |
| Avisos: sequência acabando, Premium vencendo, primeiros passos, volta de quem sumiu | diário |
| Resumo semanal e agenda de animes da semana | semanal |
| Envio da fila de push | a cada 5 min |
| Avisos de episódio novo dos animes seguidos | de hora em hora |
| Limpeza (extrato de XP antigo, sessões vencidas, retenção da LGPD) | diário |
| Lembrete de pagamento não concluído | de hora em hora |

## Arquivos enviados e imagens

- **Onde ficam:** em `~/animeprofile-media`, fora da pasta do app, porque cada deploy cria uma pasta nova. São
  servidos em `/media` com cache longo, e o nome de um arquivo nunca é reaproveitado.
- **Envio pelo usuário:** a foto ou capa é convertida para WebP no servidor, com limite de tamanho. O GIF animado é
  mantido como está.
- **Imagens das matérias:** os 609 MB do site antigo são copiados na importação, e os endereços dentro do texto são
  trocados.
- **Molduras, emblemas e figurinhas do catálogo:** ficam em `public/` quando são fixos e em `/media` quando o admin
  envia.

## Imagens para as redes sociais

- **No site antigo:** desenhadas com um navegador (Chromium) no GitHub Actions.
- **No novo:**
  - **Como:** com `satori` (layout em JSX → SVG) e `sharp` (SVG → PNG/JPEG).
  - **Vantagem:** roda no próprio servidor, sem navegador, então dá para gerar as imagens no cron da Hostinger.
  - **Fontes e emojis:** embutidos no projeto.

## Conteúdo

- **Notícias e artigos:**
  - **Formato:** o conteúdo continua em HTML, como no antigo (`posts.content.html`), e é limpo ao salvar.
  - **Por quê:** a importação não converte nada, e o editor TipTap trabalha em HTML.
- **Endereços:** são os mesmos do site antigo. O mapa completo, com os redirecionamentos do que saiu, está em
  [enderecos.md](enderecos.md).
- **Português, sem `/en`:** as páginas `/en/...` levam para a versão em português com redirecionamento permanente.

## Cache e velocidade

- **Páginas públicas (home, matérias, perfis):** cache curto em memória no servidor, de 60 s, para quem não está
  logado.
- **Quem está logado:** recebe `Cache-Control: private, no-store`. A CDN da Hostinger nunca guarda páginas com
  sessão.
- **Arquivos com hash no nome e `/media`:** cache de 1 ano.
- **Meta de tamanho:** a página inicial não pode carregar biblioteca pesada (editor, gráficos, chat). Esses pedaços
  são carregados só nas telas que usam.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `VITE_SITE_URL` | Endereço canônico (build) |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | MySQL (`127.0.0.1` na Hostinger) |
| `SESSION_SECRET` | Assinatura de cookies e tokens |
| `CRON_TOKEN` | Protege `/api/cron/*` |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | Login com Google |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `MAIL_FROM` | E-mails do site |
| `TURNSTILE_SITE_KEY` `TURNSTILE_SECRET_KEY` | Proteção contra robôs |
| `MERCADO_PAGO_ACCESS_TOKEN` `MERCADO_PAGO_WEBHOOK_SECRET` | Compra de Rubis e Premium |
| `FIREBASE_SERVICE_ACCOUNT_JSON` + `VITE_FIREBASE_*` | Push |
| `GEMINI_API_KEY` | Notícias por IA e traduções |
| `KLIPY_API_KEY` | GIFs |
| `FIRECRAWL_API_KEY` | Leitura de fontes do robô, se continuar necessário (decidido na fase 5) |
| `INSTAGRAM_*` | Postagem nas redes (detalhado na fase 5) |
| `MEDIA_DIR` | Opcional: pasta das imagens (padrão `~/animeprofile-media`) |

Modelo em `.env.example`. O `.env` real nunca vai para o Git. **Todas as chaves são novas:** as do site antigo
estão no histórico de um repositório e não são reaproveitadas.
