# Plano (temporário): virada parcial do domínio em 4 dias

## Objetivo

Salvar todos os dados do site antigo antes de o Lovable Cloud ficar sem créditos e passar `animeprofile.com.br` para o site
novo (Hostinger) só com o que já existe: notícias, artigos, animes, personagens, Otaku TV, quiz, blog e figurinhas (só
leitura), páginas legais e contato. Login, moedas, chat, quarto, comentar e admin voltam depois, em fases curtas.

## Contexto

- **O prazo (decisão do dono, 2026-11-15):** o Lovable Cloud passou a cobrar créditos. O site antigo (Lovable +
  Supabase) **sai do ar no fim do dia 4**. Depois disso não há mais banco, imagens nem rollback.
- **O que muda no plano original:** a fase 6 previa virar tudo junto, com as contas. Agora a virada é parcial, e as
  contas são importadas depois, a partir de um backup completo guardado agora.
- **O que já existe no site novo** (`novo.animeprofile.com.br`): notícias, artigos, animes, personagens, Otaku TV,
  quiz, blog e figurinhas em leitura, sitemaps, RSS, redirecionamentos (`redirects.mjs`), contato (grava em
  `contact_messages`, sem envio de e-mail e sem painel para ler), `SITE_NOINDEX=1`.
- **O que quebra se nada for feito:**
  1. **Imagens:** as capas e as imagens dentro das matérias, do quiz e do blog ainda apontam para o Supabase Storage.
     Quando o Supabase sair, todas viram imagem quebrada.
  2. **"Em construção":** `app/routes/em-breve.tsx` manda para "o site atual" em `https://animeprofile.com.br`.
     Depois da virada, esse link aponta para a própria página.
  3. **Endereços sem página:** dezenas de endereços do site antigo não existem no novo (`/check-in`, `/loja`,
     `/perfil`, `/privacidade`, `/links`, `/ajuda/:id`, `/unsubscribe`, `/convite/:code`...) e dariam 404.
  4. **Robô de notícias:** o GitHub Actions do repositório antigo (`ai-news.yml`) é acordado pelo `pg_cron` do
     Supabase e grava pela API do site antigo (`SITE_URL: https://animeprofile.com.br`). Com o Supabase fora, ele para.
     Depois da virada, as chamadas cairiam no site novo. **Durante a lacuna não sai notícia nova.**
  5. **Mercado Pago:** quem comprar Rubis perto da virada gera uma notificação que vai bater no site novo, onde hoje
     não há rota.
  6. **App instalado (PWA):** o site antigo registra `/sw.js` (rede primeiro, sem cache de páginas: não prende
     ninguém no site velho) e usa `/offline.html`, `/icons/icon-192.png` e `/manifest.webmanifest`. Também publica
     `/ads.txt` (AdSense) e `/llms.txt`. Nada disso existe no site novo.

## Legenda

- **Tamanho:** P (até 1 h), M (meio dia), G (um dia ou mais).
- **Quem:** **[Claude]** faz sozinho; **[Dono]** só o dono faz (Lovable, DNS, hPanel, GitHub, Search Console,
  redes); **[Dono+Claude]** o dono faz a parte com acesso e o Claude confere.
- **Prioridade:** **ESSENCIAL** (sem isso não vira), **DEVERIA** (cortável se o tempo apertar), **DEPOIS** (fora
  dos 4 dias).

## Arquivos afetados

- Novos: `scripts/baixar-storage.mjs`, `scripts/conferir-backup.mjs`, `scripts/conferir-enderecos.mjs`,
  `app/routes/contas-em-breve.tsx` (ou nova variante de `em-breve.tsx`), `app/routes/unsubscribe.tsx`,
  `app/routes/api.mp-webhook.ts`, `app/components/layout/AvisoContas.tsx`, `app/content/paginas/site-novo.md`,
  `public/sw.js`, `public/offline.html`, `public/icons/icon-192.png` (e os ícones que o manifest citar),
  `public/manifest.webmanifest`, `public/ads.txt`, `public/llms.txt`.
- Alterados: `scripts/exportar-conteudo-antigo.mjs` (cópia das imagens e troca dos endereços),
  `app/server/content/media-import.server.ts` (aceitar subpastas dos buckets, se hoje não aceitar),
  `app/server/content/import-old.server.ts` (só se a troca de endereços precisar ser no servidor), `app/routes.ts`,
  `redirects.mjs`, `tests/content.test.ts`, `app/routes/em-breve.tsx`, `app/components/post-extras.tsx`
  (caixa de comentários), `app/routes/home.tsx` (chamada de cadastro), `app/components/layout/Header.tsx`,
  `app/root.tsx` (faixa de aviso), `app/server/contact.server.ts` (se o envio por SMTP entrar).
- Docs: `docs/deploy-hostinger.md` (procedimento real de DNS, preenchido no dia 2), `docs/enderecos.md`,
  `docs/README.md`, `docs/decisoes.md`.
- **Fora do repositório (nunca no git):** a pasta de backup `C:\Users\evsli\animeprofile-backup\` (ver passo 0).

---

## Parte 1 — Resgate de dados (passo 0 do dia 1, antes de tudo)

O repositório é **público**. Dump, hashes de senha, e-mails, CSVs e chaves **nunca** entram no repositório, nem em
`.import/` (que fica dentro da pasta do repositório e serve só para o retrato público do conteúdo). Os scripts recebem
o caminho da pasta de backup como argumento e não imprimem dados pessoais (só contagens).

### 0.1 Onde guardar — [Dono] P — ESSENCIAL

1. Criar `C:\Users\evsli\animeprofile-backup\2026-11-15-dump1\` (fora do OneDrive e fora do repositório).
2. Tudo do passo 0.2 entra nessa pasta, **sem mexer nos arquivos originais** (nada de abrir e salvar CSV no Excel:
   ele estraga UTF-8, zeros à esquerda e datas).
3. Ao final, compactar a pasta com 7-Zip, formato `.7z`, **AES-256 com "criptografar nomes dos arquivos"**, senha
   forte guardada no gerenciador de senhas (não no chat, não nos docs).
4. Duas cópias do `.7z`: uma no disco local e uma na nuvem (OneDrive ou Google Drive). Só o `.7z` cifrado vai para a
   nuvem. Opcional: uma terceira num pen drive.
5. A pasta aberta pode ficar no PC para os scripts de conferência; ela é apagada quando a importação das contas for
   concluída e conferida.

**Por quê:** são dados pessoais de 171 pessoas (e-mail, hash de senha, aniversário, mensagens), cobertos pela LGPD.

### 0.2 O que exportar do Lovable Cloud — [Dono] M — ESSENCIAL

Faça na ordem. Se alguma etapa falhar (permissão negada, limite de linhas), anote e siga para a próxima; o Claude
propõe o contorno.

1. **Banco completo, como o Lovable oferecer.**
   - Se houver "Export database" / string de conexão: baixar o dump completo. Se der para escolher, `pg_dump`
     em formato custom (`-Fc`) **e** em SQL puro, com os schemas `public`, `auth` e `storage`.
   - Se for só por tabela no painel: exportar **todas** as tabelas do schema `public` em CSV (UTF-8) ou JSON.
   - Guardar o arquivo exatamente como veio, em `banco/`.
2. **Contas (schema `auth`), em separado, no editor SQL do Lovable Cloud.** Salvar o resultado em JSON (ou CSV) em
   `auth/`:
   ```sql
   select id, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at,
          last_sign_in_at, banned_until, deleted_at, is_anonymous, raw_app_meta_data, raw_user_meta_data
   from auth.users order by created_at;
   select id, user_id, provider, provider_id, identity_data, email, created_at, last_sign_in_at
   from auth.identities order by created_at;
   ```
   - `encrypted_password` é o hash bcrypt (`$2a$...`): é ele que deixa todo mundo entrar depois com a senha de hoje.
   - `auth.identities` liga as contas do Google (`provider = 'google'`, `provider_id` = `sub` do Google).
   - **Não precisa:** `auth.sessions`, `auth.refresh_tokens`, `auth.audit_log_entries` (as sessões não passam para
     o site novo).
   - **Se o editor negar acesso a `auth`:** pedir ao suporte do Lovable (ou ao agente do Lovable, num pedido único)
     a exportação de `auth.users` **com** `encrypted_password` e de `auth.identities`. Plano B, se nada der: guardar
     ao menos `id` e `email` de todos (pela tabela `profiles`, se tiver e-mail, ou pelo painel de usuários). Com isso
     as contas voltam via "esqueci a senha" (pior, mas ninguém perde saldo nem coleção).
3. **Lista dos arquivos (storage), no editor SQL.** Salvar em `storage/lista-objetos.csv` e
   `storage/buckets.csv`:
   ```sql
   select bucket_id, name, metadata->>'size' as size, metadata->>'mimetype' as mimetype, created_at
   from storage.objects order by bucket_id, name;
   select id, name, public from storage.buckets;
   ```
   Os arquivos em si o **Claude baixa** (passo 0.3) a partir dessa lista. Os buckets privados (provável:
   `bug-reports`, talvez `profile-media`) precisam de download pelo painel do Lovable Cloud; `bug-reports` pode ficar
   para trás (não vem, ver inventário). O arquivo `database_export_23_08_26` não precisa ser baixado.
4. **Contagens para conferir o backup**, salvas em `conferencia/contagens.csv`:
   ```sql
   select table_name,
     (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint as linhas
   from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
   order by 1;
   ```
   E em `conferencia/totais.csv` (ajuste os nomes das colunas se a consulta der erro e anote o nome certo):
   ```sql
   select (select count(*) from auth.users) as usuarios,
          (select count(encrypted_password) from auth.users) as com_senha,
          (select sum(ap_coins) from profiles) as ap_coins,
          (select sum(rubis) from profiles) as rubis,
          (select count(*) from user_stickers) as figurinhas_dos_usuarios;
   select bucket_id, count(*) as arquivos, sum((metadata->>'size')::bigint) as bytes
   from storage.objects group by bucket_id order by 1;
   ```
5. **Segredos e configurações:** em `segredos/nomes.txt`, só os **nomes** dos segredos do Lovable Cloud (Mercado
   Pago, Firebase, Resend, Instagram/Meta, Klipy, Firecrawl...) e dos secrets do GitHub do `animeprofile-old`. Os
   valores que der para ver vão para o gerenciador de senhas, não para a pasta. Quase todos serão recriados (regra de
   [deploy-hostinger.md](deploy-hostinger.md): chaves novas); o que importa é saber o que existia.
6. **Código do site antigo:** no PC, `git pull` no `animeprofile-old` para garantir que a cópia local tem tudo do
   GitHub (inclui `supabase/migrations`, que documentam o esquema, e as funções). Não é dado pessoal; fica onde está.
7. **Fotos de tela** em `conferencia/`: a zona DNS atual do `animeprofile.com.br` no hPanel (todos os registros, com
   valores) e a tela de domínio do projeto no Lovable. São a base do rollback.

### 0.3 Baixar as imagens dos buckets — [Claude] M — ESSENCIAL

- **Script novo `scripts/baixar-storage.mjs`.**
  - **Uso:** `node scripts/baixar-storage.mjs <lista-objetos.csv> <pasta de destino> <.env do site antigo>`.
  - **Leitura do `.env`:** usa só `VITE_SUPABASE_URL`, do mesmo jeito que `exportar-conteudo-antigo.mjs`, e não
    imprime valores.
  - **Download:** cada objeto de bucket público vem de `${BASE}/storage/v1/object/public/<bucket>/<name>` e é salvo em
    `<destino>/<bucket>/<name>`. São 4 downloads por vez, com 3 tentativas e espera crescente.
  - **Retomada:** o script pula o arquivo que já existe com o mesmo tamanho, então pode ser rodado de novo.
  - **Relatório:** grava `<destino>/relatorio.json` com o total por bucket (arquivos, bytes, falhas e os nomes que
    falharam). Nada pessoal vai para o terminal além de contagens.
- **Destino:** `C:\Users\evsli\animeprofile-backup\2026-11-15-dump1\storage\arquivos\`.
- **Verificar:** o total por bucket do `relatorio.json` bate com `conferencia/totais.csv` (diferença zero nos buckets
  públicos). São cerca de 6.400 arquivos e 650 MB.
- **Risco:** os arquivos de `render/image` têm outro endereço, mas o objeto original é o mesmo, e é o original que
  se baixa.

### 0.4 Conferir o backup — [Claude] P — ESSENCIAL

- **Script novo `scripts/conferir-backup.mjs <pasta do dump>`.**
  - **O que lê:** os arquivos exportados do banco e as contagens.
  - **O que imprime** (só números):
    - tabelas e linhas, comparadas com `contagens.csv`;
    - usuários e quantos têm hash começando com `$2`;
    - identidades Google;
    - soma de AP Coins e Rubis;
    - linhas de `user_stickers`.
  - **Resultado:** se faltar tabela do inventário, ou se alguma contagem não bater, a última linha diz "BACKUP
    INCOMPLETO" e lista o que falta.
- **Tabelas que não podem faltar** (inventário §1 a §8): `profiles`, `user_roles`, `user_follows`, `user_blocks`,
  `user_sanctions`, `user_consents`, `suppressed_emails`, `email_unsubscribe_tokens`, `notification_prefs`,
  `push_preferences`, `user_push_tokens`, `check_ins`, `user_streaks`, `rubi_purchases`, `rubi_ledger`,
  `premium_rubi_activations`, `processed_mp_notifications`, `level_rewards`, `level_reward_claims`, `xp_ledger`,
  `system_config`, `reward_config`, `sticker_catalog`, `sticker_albums`, `user_stickers`, `user_album_completions`,
  `user_first_free_pull`, conquistas e cosméticos (`achievements`, `user_achievements`, molduras, cores, emblemas),
  `anime_favorites`, `anime_follows`, `anime_user_status`, `anime_votes`, `anime_reviews`, `quest_catalog`,
  `referral_codes`, `referrals`, `referrer_progress`, `ranking_week_winners`, `chat_*`, `room_*`, `user_pets`,
  `pet_*`, `otaku_rooms`, `otaku_tv_plays`, `quizzes`, `quiz_plays`, `blog_*`, `posts`, `post_comments`,
  `ai_news_*` (configuração), `social_accounts`, `instagram_settings`, além de `auth.users` e `auth.identities`.
- **Verificar:** o dono vê a saída e responde "backup ok". Só então o `.7z` é fechado e copiado (0.1, itens 3 e 4).

### 0.5 Dump final — [Dono] M (dia 4) — ESSENCIAL

- **O que é:** repetir 0.2 inteiro numa pasta nova, `...\2026-11-18-dump-final\`, **depois da virada** (dia 4 de
  manhã), quando ninguém mais grava no site antigo.
- **Por que conta:** é desse dump que saem os saldos, a coleção e as senhas importados na fase das contas. O dump 1 é
  a garantia, caso algo dê errado.
- **Imagens novas:** o Claude roda de novo o 0.3 (só baixa o que faltar) e o 0.4.
- **Antes de desligar o projeto no Lovable:** o dono não apaga o projeto. Só deixa os créditos acabarem. Apagar o
  projeto (LGPD) fica para 30 dias depois da importação das contas.

### 0.6 Importação futura no MySQL (registro, sem executar agora)

- **Como:** na fase das contas, `scripts/import/` lê a pasta do dump final, que é passada como argumento, e grava
  uma área por vez, com as regras do [inventario.md](inventario.md) e de [banco-de-dados.md](banco-de-dados.md)
  (seção "Importação do site antigo").
- **Se o dump for `pg_dump -Fc`:** o Claude sobe um PostgreSQL local descartável, restaura o dump e exporta em JSON
  por tabela. Os CSV/JSON do painel servem do mesmo jeito.
- **Regras já decididas para a lacuna:**
  - **Sequências de check-in:** voltam como estavam no dump final, e os dias sem contas não quebram a sequência
    (inventário §2: "ninguém perde a sequência").
  - **Premium:** ver a pergunta 4.

---

## Parte 2 — O que o site novo precisa antes da virada

### 2.1 Imagens no `/media` e troca dos endereços — [Claude] G — ESSENCIAL

- **O quê:** copiar para a Hostinger toda imagem que o conteúdo publicado usa e trocar os endereços no retrato antes
  de enviá-lo. Isso cobre:
  - matérias: `featured_image` e `<img src>` no `content`;
  - autores de IA: `avatar_url`;
  - perfis dos autores e comentaristas: `profiles.avatar_url`;
  - quizzes: capa e imagens das perguntas e opções;
  - blog: `cover_url` e as imagens dentro do Markdown/HTML.
- **Como (`scripts/exportar-conteudo-antigo.mjs`, opção nova `--midia <pasta de arquivos do backup>`):**
  1. **Coletar os endereços:** depois de montar o retrato, juntar todo endereço que contenha `/storage/v1/object/`
     ou `/storage/v1/render/image/`. Os dois formatos levam ao mesmo objeto: `<bucket>/<caminho>`, sem a query
     (`?width=...&quality=...`).
  2. **Endereço novo:** `/media/<bucket>/<caminho>`, sempre o mesmo para o mesmo objeto. Assim, rodar de novo não
     duplica nada, e a importação das contas reaproveita os mesmos endereços para as fotos de perfil.
  3. **Origem do arquivo:**
     - primeiro a pasta do backup (0.3), sem rede;
     - se não estiver lá, baixar do Supabase;
     - sempre o original, sem recompressão (mesma regra das figurinhas).
  4. **Envio:**
     - antes de enviar, `HEAD ${target}/media/<bucket>/<caminho>`; com 200, pula;
     - o envio usa o endpoint que já existe para as figurinhas (`/api/importar/midia`, `CRON_TOKEN`,
       `x-media-name`), com 4 envios por vez;
     - conferir em `app/server/content/media-import.server.ts` se o nome aceita subpastas e os caracteres dos
       caminhos do Supabase. Se não aceitar, ampliar a validação sem abrir `..` nem caminho absoluto, e acrescentar
       um teste.
  5. **Trocar os endereços:** no retrato, cada endereço antigo é substituído pelo novo (absoluto não, sempre
     `/media/...`), antes de enviar. Se o arquivo falhou, o endereço antigo fica, e o script avisa. No fim, imprime
     "Mídia: N enviados, M já existiam, F falhas" e a lista das falhas.
- **Espaço:** cerca de 650 MB num plano Business com dezenas de GB livres. Conferir com o MCP o uso do disco antes
  do primeiro envio.
- **Ordem do envio:** primeiro as capas das matérias (aparecem em todas as listas e na home), depois as imagens do
  texto, depois quiz, blog e avatares.
- **Verificar:**
  - na pasta `~/animeprofile-media/post-images/` (pelo MCP), a quantidade de arquivos é a mesma do relatório;
  - no phpMyAdmin, a consulta abaixo devolve 0 em todas as colunas (as falhas conhecidas são listadas e aceitas pelo
    dono):
    ```sql
    SELECT
      (SELECT COUNT(*) FROM posts WHERE featured_image LIKE '%supabase.co%' OR content LIKE '%supabase.co%') AS posts,
      (SELECT COUNT(*) FROM blog_posts WHERE cover_url LIKE '%supabase.co%' OR content_html LIKE '%supabase.co%') AS blog,
      (SELECT COUNT(*) FROM quizzes WHERE CAST(data AS CHAR) LIKE '%supabase.co%') AS quiz;
    ```
    Os nomes das colunas devem ser conferidos nas migrations 003, 009 e 010.
  - `scripts/conferir-enderecos.mjs` (2.6) não encontra "supabase.co" no HTML de nenhuma página.
- **Riscos:**
  - **Envio grande:** com a CDN cortando acima de ~55 s, cada arquivo vai num pedido separado, nunca em lote.
  - **Imagens do texto (`srcset`):** a troca no HTML precisa cobrir `src`, `srcset` e `href` de links para a imagem.
  - **Arquivo grande:** um GIF de vários MB pode passar do limite do endpoint de mídia. Conferir o limite e
    registrar as falhas.

### 2.2 Páginas das contas, honestas e fora do Google — [Claude] M — ESSENCIAL

#### Direção visual

- **Clima:** um aviso calmo e confiante, sem cara de erro. O olho vê primeiro o título ("Login e contas voltam em
  breve"), depois os três cartões com "o que está guardado" e, por último, "enquanto isso" com links.
- **Evitar:** ilustração de obra, cones, a palavra "erro" e qualquer link para o site antigo.

#### Tokens

Os tokens são os de [design.md](design.md):

| Uso | Claro | Escuro |
|---|---|---|
| Fundo da página (`paper`) | `#faf7f7` | `#121014` |
| Cartões (`surface`) | `#ffffff` | `#1b171a` |
| Bordas (`line`) | `#efe6e6` | `#2f282b` |
| Texto (`ink`) | `#1c1414` | `#f4eff0` |
| Texto secundário (`ink-soft`) | `#6e5f5f` | `#ab9d9f` |
| Fundo dos ícones (`brand-soft`) | `#fbedec` | `#3a1b19` |

- **Destaques:** `brand` `#c2352b` (`text-brand` nos ícones).
- **Foco:** azul `#2b5bd7` (o padrão do site).
- **Fonte:** Sora, como no resto do site.
- **Raio:** `rounded-[9px]` nos botões, como hoje.

#### Estrutura da página `app/routes/contas-em-breve.tsx`

1. **Cabeçalho:** `PageHeader` (`~/components/PageHeader`).
   - Rótulo "Contas".
   - Título "Login e contas voltam em breve".
   - Introdução: "O Anime Profile mudou de casa. Notícias, animes, quiz, blog e figurinhas já estão aqui. Entrar,
     comentar, AP Coins, Rubis e o resto que depende da sua conta voltam nas próximas semanas."
   - Quando o endereço é de um item do menu (`/feed`, `/ranking`, `/quarto`...), o título vira
     "<rótulo do NAV> volta em breve", e a introdução é a mesma.
2. **"O que é seu está guardado":** grade com 3 cartões.
   - **Grade:** 1 coluna no celular e 3 a partir de `sm`; `gap-4`.
   - **Cada cartão:** `rounded-2xl border border-line bg-surface p-5`. Ícone `lucide-react` de 20 px dentro de um
     círculo de 40 px `bg-brand-soft text-brand`, título `font-bold` e uma linha em `text-ink-soft text-[0.95rem]`.
   - **Os três cartões:**
     - `Coins`: "AP Coins e Rubis", "Seu saldo foi copiado e volta exatamente como estava.";
     - `Sparkles`: "Figurinhas e coleção", "Álbuns, figurinhas e fragmentos estão guardados.";
     - `Flame`: "Perfil e sequência", "Ninguém perde a sequência de check-in por causa da mudança.".
   - **Estados:** são estáticos, sem hover (não são clicáveis).
3. **"Me avise quando voltar"** (só se a pergunta 3 for "sim"): bloco `max-w-xl`.
   - **Campos:** um campo de e-mail (`TextField` de `~/components/form`), `Honeypot` e um `SubmitButton`
     "Me avise".
   - **Gravação:** em `contact_messages`, com `kind = 'avisar-contas'` (a coluna é `VARCHAR(20)` sem CHECK: não
     precisa de migration). Ampliar o tipo `ContactKind` em `contact.server.ts` e reaproveitar o `saveMessage` (limite
     por IP e hash do IP).
   - **Estados:**
     - normal: um parágrafo abaixo, "Só usamos este e-mail para avisar da volta das contas.";
     - foco: anel azul padrão;
     - enviando: o botão vira "Enviando..." e fica desabilitado;
     - sucesso: `Notice` verde, "Pronto. Avisaremos quando as contas voltarem.";
     - erro de validação: a mensagem aparece abaixo do campo;
     - limite atingido: `Notice`, "Você já pediu o aviso. Pode deixar com a gente.".
4. **"Enquanto isso":** uma linha de links-botão com borda (`rounded-[9px] border border-line bg-surface px-5 py-3
   font-semibold hover:bg-sunken`): Notícias, Animes, Quiz, Figurinhas. O primeiro é sólido (`bg-brand
   text-brand-ink`).

#### Comportamento e endereços

- **Resposta:** status 200 com `<meta name="robots" content="noindex">` (como o `em-breve.tsx` faz hoje).
- **Endereços que usam esta página** (lista `ACCOUNT_PENDING` em `app/routes.ts`): `login`, `cadastro`,
  `esqueci-senha`, `redefinir-senha`, `configuracoes`, `perfil`, `notificacoes`, `salvos`, `u/:username`,
  `check-in`, `missoes`, `conquistas`, `ranking`, `loja`, `premium`, `rubi`, `pagamentos`, `convidar`,
  `indicacoes`, `convite/:code`, `w/:code`, `feed`, `feed/post/:id`, `mensagens`, `explorar`, `quarto`,
  `animes/favoritos`, `animes/seguindo`, `blog/editor`, `blog/dashboard` e `admin/*` (uma rota `admin/*`).
- **O que muda nas rotas:**
  - os itens que estão hoje em `PENDING` passam para essa lista;
  - `em-breve.tsx` deixa de existir ou deixa de ter o botão "Abrir no site atual";
  - **nenhum link para `https://animeprofile.com.br` como "site antigo" pode sobrar** (`grep -r "site atual" app`
    tem de dar vazio).
- **`/convite/:code` e `/w/:code`:** mostram uma frase extra, "O seu convite continua valendo: guarde este link e
  abra de novo quando as contas voltarem.".

#### Pontos de entrada

- **`Header.tsx`:**
  - "Entrar" continua levando a `/login`;
  - "Criar conta" passa a "Contas em breve", com o mesmo estilo, e leva a `/login`;
  - no menu do celular, o mesmo.
- **`post-extras.tsx` (comentários):**
  - o botão "Entrar para comentar" sai;
  - no lugar entra uma linha `text-ink-soft`: "Comentar volta junto com as contas. Os comentários abaixo vieram do
    site anterior.", com link "Saiba mais" para `/site-novo`;
  - o blog segue igual.
- **`home.tsx` (bloco com `/cadastro` e `/login`, linha ~223):** o texto e os botões viram "Contas voltam em breve"
  (link `/site-novo`) e "Jogar um quiz" (`/quiz`).

#### Faixa de aviso (`app/components/layout/AvisoContas.tsx`)

- **Onde fica:** em `root.tsx`, logo abaixo do cabeçalho, em todas as páginas.
- **Aparência:** altura mínima de 40 px, fundo `brand-soft`, texto `ink` em `text-[0.9rem]`, centralizado.
  - **Celular:** quebra em 2 linhas.
  - **Telas largas:** o conteúdo fica num contêiner `max-w-[1328px]`.
- **Texto:** "Site novo no ar. Login, AP Coins e comentários voltam em breve, e o que é seu está guardado.", seguido
  de "Saiba mais", um link sublinhado (`text-link`) para `/site-novo`.
- **Fechar:** não tem botão. Sai do código quando as contas voltarem, para não exigir cookie e não piscar no SSR.

#### Página `/site-novo`

- **Formato:** Markdown em `app/content/paginas/site-novo.md`, mais um item em `TEXT_PAGES`.
- **Conteúdo:**
  - o que mudou;
  - o que já funciona;
  - o que volta e em que ordem (contas, perfil e comentários; depois moedas e figurinhas; depois chat e quarto);
  - "seus dados estão guardados e protegidos";
  - o contato.
- **Indexação:** pode ficar indexável.

#### Critério de pronto

- **Larguras:** conferir em 375 px e em 1440 px, nos temas claro e escuro.
- **`/login`:** mostra cabeçalho, 3 cartões em coluna (375) ou em linha (1440) e os links de "Enquanto isso".
- **`/ranking`:** mostra "Ranking volta em breve".
- **Faixa:** aparece em todas as páginas, sem cobrir o cabeçalho fixo (se o cabeçalho for `sticky`, a faixa fica
  fora dele, rolando com a página).
- **Teclado:** o Tab passa pelos links com o anel azul visível.
- **Indexação:** `curl -s https://novo.animeprofile.com.br/perfil | grep -i noindex` devolve a meta.

### 2.3 Endereços que dariam 404 — [Claude] P — ESSENCIAL

Em `redirects.mjs`, com teste em `tests/content.test.ts`:

| Endereço | Vai para | Código |
|---|---|---|
| `/privacidade` | `/legal/privacidade` | 301 |
| `/ajuda`, `/ajuda/:id` | `/contato` | 302 (a central de ajuda volta com as contas) |
| `/reportar-bug` | `/contato` | 302 |
| `/links` | `/` | 302 (página de links da bio: refazer depois; ver "Depois") |

A lista final sai do `conferir-enderecos.mjs` (2.6): todo endereço do sitemap antigo e das páginas mais acessadas
precisa dar 200, 301 ou 302. Qualquer outro caso vira uma linha nesta tabela ou em `ACCOUNT_PENDING`, e o
[enderecos.md](enderecos.md) é atualizado.

### 2.4 Arquivos públicos do site antigo — [Claude] P — ESSENCIAL

- **Arquivos:** copiar de `../animeprofile-old/public/` para `public/`: `sw.js`, `offline.html`, os ícones que
  `sw.js` e `manifest.webmanifest` citam (`/icons/...`), `manifest.webmanifest`, `ads.txt` e `llms.txt`.
- **Antes de copiar:**
  - ler cada arquivo e remover o que citar Supabase, Lovable ou endpoints que saíram;
  - a configuração pública do Firebase (chaves Web) pode ficar, porque é pública por natureza;
  - no `llms.txt`, revisar os endereços.
- **Por quê:**
  - **Celulares e PCs com o app instalado:** continuam pedindo `/sw.js`. Se o arquivo existir, o push dos celulares
    continua possível quando o Firebase for ligado no site novo.
  - **`ads.txt`:** o AdSense continua reconhecendo o domínio.
- **Verificar:** `curl -I` em `/sw.js`, `/ads.txt` e `/manifest.webmanifest` no `novo.` devolve 200. Testar uma vez
  no Chrome (DevTools > Application) para ver o service worker registrar sem erro.

### 2.5 Mercado Pago e descadastro de e-mail — [Claude] P — ESSENCIAL

- **`app/routes/api.mp-webhook.ts`**, nas rotas `/api/public/payments/webhook` e
  `/api/public/payments/mercado-pago` (nos dois métodos que o Mercado Pago usa):
  - grava o pedido inteiro (query, cabeçalhos `x-signature` e `x-request-id`, corpo) em `contact_messages` com
    `kind = 'mp-webhook'`, ou numa tabela própria, se o executor preferir (aí é migration nova, colada no chat);
  - responde 200 **só depois de gravar** e 500 se não conseguir, para o Mercado Pago tentar de novo;
  - não credita nada: as notificações são processadas na fase da economia.
- **`app/routes/unsubscribe.tsx`:**
  - lê o token ou o e-mail da query e grava em `contact_messages`, com `kind = 'descadastro'`;
  - mostra "Pronto: você não vai receber mais e-mails do Anime Profile.";
  - `noindex`.
  - **Por quê:** obrigação legal. O pedido entra em `suppressed_emails` na importação.
- **Verificar:** um `curl -X POST` com corpo de teste no `novo.` cria a linha e devolve 200 (conferir no phpMyAdmin
  e apagar a linha de teste).

### 2.6 Conferência de endereços — [Claude] M — ESSENCIAL

- **No dia 1, o Claude baixa:**
  - os sitemaps públicos do site antigo (`/sitemap.xml` e os sitemaps que ele lista), salvos em
    `.import/sitemaps-antigos/` (dado público, pode ficar ali);
  - a exportação "Páginas" do Search Console, que o dono baixa (últimos 3 meses, ordenada por cliques), salva em
    `.import/gsc-paginas.csv`.
- **Script novo `scripts/conferir-enderecos.mjs <base>`.**
  - **O que faz:** junta os endereços dos dois, troca o domínio pela `<base>` e pede cada endereço, sem seguir
    redirecionamento, 8 por vez.
  - **Resultado:** uma tabela com status e destino. **Falha** se aparecer:
    - status 404 ou 5xx (o 503 do AniList é aceito para fichas de anime, com aviso);
    - um 301 para um destino que dá 404;
    - "supabase.co" ou "lovable" no HTML;
    - canonical diferente de `<VITE_SITE_URL><caminho>`.
- **Verificar:** rodar contra `https://novo.animeprofile.com.br` no dia 2 até dar zero falhas. Rodar contra
  `https://animeprofile.com.br` depois da virada.

### 2.7 Contato chegando no e-mail — [Claude] M + [Dono] P — DEVERIA

- **Hoje:** as mensagens só ficam no banco, e ninguém as lê.
- **Mudança no código:** `contact.server.ts` passa a enviar uma cópia para `contato@animeprofile.com.br` por SMTP
  (`nodemailer`, variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`), com `Reply-To` no
  e-mail de quem escreveu.
  - **Sem as variáveis:** só grava, como hoje.
  - **Se o envio falhar:** grava mesmo assim e registra o erro no log.
- **[Dono]:** cadastrar as variáveis SMTP no hPanel (senha da caixa `contato@`).
- **Se cortar:** o dono lê as mensagens pelo phpMyAdmin, com
  `SELECT created_at, kind, name, email, subject, body FROM contact_messages ORDER BY id DESC LIMIT 50;`.

### 2.8 Desempenho sob tráfego real — [Claude] P — DEVERIA

- **Teste de carga:** `npx autocannon -c 20 -d 30` na home, numa matéria e em `/animes` do `novo.`. A meta é p95
  abaixo de 1 s, sem erros.
- **Se falhar:** conferir se as páginas públicas mandam `Cache-Control: public, max-age=0, s-maxage=60` (sem
  sessão, a CDN pode guardar) e se o cache de 60 s em memória previsto em [arquitetura.md](arquitetura.md) existe.
  Se não existir, implementar só para home e matéria.
- **Robôs no AniList:** a cota de buscas por minuto (`remote-guard.server.ts`) já protege. Com o Googlebot de verdade,
  algumas fichas darão 503 temporário, o que é esperado.

### 2.9 Monitoramento — [Dono] P + [Claude] P — DEVERIA

- **[Dono]:** conta grátis no UptimeRobot, com 2 monitores a cada 5 min (`https://animeprofile.com.br/api/health`
  e uma matéria) e alerta por e-mail. Criar já com o domínio final; até a virada, o alerta pode ser ignorado.
- **[Claude]:** nos dias 3 e 4, ler `hosting_nodejs_runtime-logs` pelo MCP de manhã e à noite, procurando erros 5xx
  e falhas de migration ou do cron.

### O que pode esperar (DEPOIS)

- **Robô de notícias e Instagram:** a lacuna de notícias novas é aceita. Ver a parte 4 e a pergunta 2.
- **AdSense, Analytics e banner de cookies:** só o `ads.txt` agora. Ver a pergunta 5.
- **Página `/links`:** página de links para a bio do Instagram.
- **E-mail aos 171 usuários** avisando da mudança: depende do SMTP e dos e-mails do dump.
- **Mídia kit, chaves externas** (Google OAuth, Turnstile, Firebase, Klipy, Gemini, Mercado Pago novo) e tudo o que
  depende de conta.

---

## Parte 3 — A virada (dia 3 de manhã, com o dia 4 de margem)

### 3.1 Preparação do DNS — [Dono] P (dia 1) + [Claude] M (dia 2)

1. **[Dono], dia 1:** no hPanel > DNS do `animeprofile.com.br`, baixar o TTL dos registros `@` (A/AAAA) e `www` para
   300 s. Tirar foto da zona (0.2, item 7). **Não mexer** em MX, TXT (SPF/DKIM do e-mail `contato@`) nem nos TXT de
   verificação do Lovable e do Google.
2. **[Dono], dia 1:** no Search Console, conferir se a propriedade do `animeprofile.com.br` é do tipo **Domínio**
   (verificada por TXT no DNS). Se for só "Prefixo do URL" verificada por arquivo ou meta no Lovable, criar já a
   propriedade Domínio pelo TXT, para não perder o acesso depois da virada.
3. **[Claude], dia 2:** descobrir pelo MCP da Hostinger (só leitura: `search` pelas operações de websites, domínios
   e DNS) qual é o caminho certo para ligar o domínio principal ao app Node.js. Registrar o passo a passo exato em
   [deploy-hostinger.md](deploy-hostinger.md) ("Cuidado com o domínio na virada"). Os candidatos:
   - **A (preferido):** trocar o domínio do site `novo.animeprofile.com.br` para `animeprofile.com.br` no hPanel
     (mesmo app, mesmo banco, mesmas variáveis).
   - **B:** criar um site Node.js novo com o domínio principal (4º app de 5), ligado ao mesmo repositório e ao
     mesmo banco, com as variáveis recadastradas.
   - **Para os dois:** confirmar onde fica `~/animeprofile-media` (se é da conta ou do site). Se for do site,
     a pasta de mídia precisa ser movida ou apontada com `MEDIA_DIR`. Confirmar também o que acontece com o
     subdomínio `novo.`.
   - **Registrar:** quais registros DNS a Hostinger vai reescrever.
4. **Rollback (registrar junto):** voltar os registros `@` e `www` para os valores da foto do dia 1. Com TTL de
   300 s, o site antigo volta em 5 a 30 min. **Só funciona até o fim do dia 4.** O domínio continua cadastrado no
   Lovable até lá (o dono não remove nada).

### 3.2 Ensaio — [Claude] M (dia 2, a partir das 15h)

1. Exportar o conteúdo completo para o `novo.`, com mídia (é a atualização já combinada para 16/11 depois das 15h):
   `CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs ../animeprofile-old/.env https://novo.animeprofile.com.br --midia C:\Users\evsli\animeprofile-backup\2026-11-15-dump1\storage\arquivos`.
2. Rodar `scripts/conferir-enderecos.mjs https://novo.animeprofile.com.br` até zero falhas.
3. Rodar a consulta "supabase.co" do 2.1 no phpMyAdmin (o dono roda; o Claude passa a consulta).
4. Conferir no navegador, em 375 px e 1440 px:
   - a home;
   - 3 matérias antigas (com imagens no texto);
   - `/quiz/<slug>`;
   - um post do blog;
   - `/figurinhas`;
   - `/login`;
   - `/ranking`;
   - `/contato` (enviar uma mensagem de teste).
5. `npm run build` e `npm test` sem erro. Commit e push.
6. **Ir ou não ir (fim do dia 2):**
   - **Vai** se o backup estiver "ok" (0.4), não houver falhas na conferência de endereços e as imagens estiverem no
     `/media`.
   - **Senão,** a virada passa para o dia 3 à tarde ou o dia 4 de manhã, no máximo. Depois disso não há margem de
     rollback.

### 3.3 Hora H (dia 3, de manhã; recomendado começar às 7h)

| Quando | Quem | O quê |
|---|---|---|
| H-60 | Dono | No GitHub do `animeprofile-old` > Actions: **desativar** os workflows "AI News Worker" e "Social Post (Instagram)". Assim nada novo é publicado no site antigo depois da última exportação |
| H-45 | Claude | Última exportação de conteúdo com `--midia` (o mesmo comando do ensaio, que só envia o que mudou). Conferir a contagem de matérias, comparada com a do ensaio |
| H-30 | Dono | No hPanel > variáveis do app: `VITE_SITE_URL=https://animeprofile.com.br` e **apagar** `SITE_NOINDEX`. Refazer o deploy (o build usa `VITE_SITE_URL`). Se o caminho for o B, cadastrar as variáveis no site novo |
| H-10 | Claude | Pelo MCP, o build terminou (`hosting_get-deployment`). No `novo.`, o canonical já aponta para `https://animeprofile.com.br/...` e o `robots.txt` já libera (é esperado e inofensivo por 10 minutos) |
| H | Dono | Ligar o domínio principal ao app, pelo procedimento registrado no dia 2 (3.1, item 3) |
| H+5 a H+30 | Dono+Claude | Esperar o DNS (`nslookup animeprofile.com.br 8.8.8.8` mostra o IP da Hostinger) e o certificado SSL (`curl -I https://animeprofile.com.br` sem erro de certificado; `https://www.animeprofile.com.br` dá 301 para o domínio sem www) |
| H+30 | Dono | No cron da Hostinger, trocar o endereço para `https://animeprofile.com.br/api/cron/tick?token=...` |
| H+30 a H+90 | Claude | Conferência pós-virada (3.4) |
| H+90 | Dono | Search Console: enviar `https://animeprofile.com.br/sitemap.xml` e inspecionar 2 matérias ("Solicitar indexação"). Avisar os usuários (3.5) |

- **Janela:** o começo da manhã tem pouco tráfego e deixa o dia inteiro para corrigir. A virada de madrugada deixaria
  o problema para quem está dormindo.
- **Limite do rollback:** se até as 22h do dia 3 houver algo grave sem correção (site fora, 5xx em massa, imagens
  quebradas), o dono volta o DNS (3.1, item 4), e a virada é refeita no dia 4 de manhã.

### 3.4 Conferência pós-virada — [Claude] M

1. `node scripts/conferir-enderecos.mjs https://animeprofile.com.br` dá zero falhas.
2. `curl -s https://animeprofile.com.br/robots.txt` mostra `Allow: /` e `Sitemap: https://animeprofile.com.br/sitemap.xml`.
3. `curl -sI https://animeprofile.com.br/` não tem `X-Robots-Tag: noindex`.
4. Canonical de 3 matérias, de `/animes/<id>` e de `/quiz/<slug>` igual a `https://animeprofile.com.br/<caminho>`.
5. `/sitemap.xml` e os sitemaps filhos usam só `https://animeprofile.com.br`. `/rss.xml` também.
6. `/sw.js`, `/ads.txt` e `/manifest.webmanifest` dão 200; `/api/health` dá 200.
7. Os registros MX e TXT continuam iguais aos da foto do dia 1 (o e-mail `contato@` precisa continuar chegando:
   o dono manda um e-mail de teste).
8. O cron rodou: depois de 10 minutos, `cron_runs` tem execução nova (o dono confere no phpMyAdmin).
9. Logs do app pelo MCP sem 5xx em sequência.
10. Atualizar [deploy-hostinger.md](deploy-hostinger.md) (endereço final, status), [enderecos.md](enderecos.md) e
    `docs/README.md`.

### 3.5 O que avisar aos usuários — [Dono], com textos do Claude

- **Antes (dia 2, à noite), nas redes:** "Amanhã o Anime Profile muda de casa. Notícias, animes, quiz e figurinhas
  continuam; o login fica fora por algumas semanas. Seus AP Coins, Rubis, figurinhas e sequência estão guardados."
- **Depois (dia 3), nas redes:** o mesmo texto, com o link para `/site-novo`.
- **No site:** a faixa e a página `/site-novo` (2.2).
- **E-mail aos usuários:** depois, com o SMTP ligado (DEPOIS).
- **Textos:** o Claude escreve no dia 2, e o dono publica.

---

## Parte 4 — Depois da virada (fases curtas, em ordem)

Cada fase tem plano próprio em `docs/` antes de começar (pelo planejador, se o chat estiver em Sonnet).

| Fase | O quê | Tamanho | Do dono |
|---|---|---|---|
| A | **Robô de notícias** no cron do site novo (Gemini grátis, chave nova): buscar, escrever e publicar direto no MySQL, sem API externa, sem GitHub Actions. Mesmo guia editorial do site antigo, com o limite diário. Matéria nova entra no sitemap de notícias e no RSS na hora | G | Chave nova do Gemini no hPanel |
| B | **Contas:** importar `auth.users`, `auth.identities`, `profiles` e `user_roles` do dump final; login com as senhas de hoje (bcrypt → scrypt no primeiro login), sessão, "esqueci a senha" (SMTP), Turnstile, depois Google OAuth. Novo aceite dos Termos. Os e-mails de "me avise" recebem o aviso | G | Turnstile, cliente OAuth do Google, SMTP |
| C | **Perfil público** `/u/:username` e **comentar** nas matérias e no blog (com moderação básica). A faixa de aviso muda de texto | M | — |
| D | **Economia:** carteira com os saldos do dump final, check-in com a sequência protegida, Premium (ver pergunta 4), Rubis e Mercado Pago (aplicação nova; processar as notificações guardadas no 2.5) | G | Aplicação nova do Mercado Pago |
| E | **Figurinhas** (coleção, pacotes, fragmentos), missões, ranking, conquistas, indicações (`/convite`) | G | — |
| F | Chat (com o histórico), quarto otaku e pets, feed, editor do blog, painel admin, Instagram, push (Firebase), AdSense + banner de cookies, `/links`, mídia kit | G | Firebase, Klipy, Meta |

- **Fim da lacuna:** quando a fase B ficar pronta, a faixa e a página das contas mudam; quando a fase E ficar pronta,
  saem.
- **Apagar os dados antigos:** 30 dias depois da fase E estável, apagar o projeto do Lovable Cloud e o backup aberto
  no PC (o `.7z` cifrado fica guardado por 6 meses).

---

## Cronograma por dia

| Dia | Dono | Claude |
|---|---|---|
| **1 (dom 15/11)** | **Passo 0:** exportar tudo (0.2, itens 1 a 7) e criar a pasta (0.1). TTL 300 s e foto da zona DNS (3.1, item 1). Conferir o tipo da propriedade no Search Console (3.1, item 2). Baixar a exportação "Páginas" do Search Console | Baixar os buckets (0.3) assim que chegar a `lista-objetos.csv`; conferir o backup (0.4). Baixar os sitemaps antigos. Começar 2.2, 2.3, 2.4 e 2.5 |
| **2 (seg 16/11)** | Responder "backup ok" e fechar o `.7z` em 2 cópias. Variáveis SMTP no hPanel (se 2.7 entrar). UptimeRobot (2.9). Rodar a consulta "supabase.co" no ensaio. À noite, aviso nas redes. Decidir "vai ou não vai" | Terminar 2.2 a 2.5. Fazer 2.1 (mídia) e 2.6 (conferência). Procedimento de DNS pelo MCP (3.1, item 3). Ensaio (3.2). Se der tempo, 2.7 e 2.8. Textos dos avisos |
| **3 (ter 17/11)** | Hora H a partir das 7h (3.3): desativar os workflows antigos, trocar as variáveis e refazer o deploy, ligar o domínio, cron, Search Console, avisos. Rollback até as 22h, se preciso | Última exportação, conferência pós-virada (3.4), correções do dia, logs de manhã e à noite. Atualizar os docs |
| **4 (qua 18/11)** | **Dump final** (0.5), de manhã, igual ao passo 0. Não remover nada do Lovable. Fim do dia: o site antigo sai do ar | Baixar os arquivos que faltam (0.3) e conferir o dump final (0.4). Exportação de conteúdo final, se algo mudou. Revisar logs, Search Console (cobertura) e UptimeRobot |

**Se o tempo apertar, cortar nesta ordem:** 2.8, depois 2.7 (o contato fica no phpMyAdmin), depois o bloco "Me
avise" do 2.2. Nunca cortar: 0.x, 2.1, 2.2 (sem o "Me avise"), 2.3, 2.4, 2.5, 2.6 e o ensaio.

## Riscos e cuidados

- **Ordem que não pode inverter:** backup (0) → imagens no `/media` (2.1) → virada (3) → dump final (0.5). Sem o
  backup de imagens, o dia 4 apaga 650 MB que não existem em outro lugar.
- **Repositório público:** nada de CSV, dump, `.env`, token ou foto da zona DNS no git. Antes de cada commit,
  `git status` não pode mostrar arquivo fora de `app/`, `scripts/`, `public/`, `tests/`, `db/`, `docs/` e da raiz já
  conhecida.
- **`CRON_TOKEN`:** apareceu no chat em 2026-11-15. Trocar no hPanel depois da virada (o dono troca e atualiza o
  cron).
- **`VITE_SITE_URL`:** é de build. Trocar a variável sem refazer o deploy deixa canonical, sitemap e RSS com o `novo.`.
- **`SITE_NOINDEX` esquecido:** o site fica fora do Google sem nenhum erro aparente. Esse é o item 3 da conferência.
- **E-mail:** os registros MX e SPF do `contato@` não podem mudar na troca de domínio. Conferir antes e depois.
- **Regras do código (já conhecidas):**
  - toda rota nova usa `routePath(request)`, nunca `new URL(request.url).pathname` (bug do `.data` ao clicar);
  - `npm run build` antes de cada push;
  - commit e push ao terminar cada passo.
- **Migration nova** (só se o 2.5 ganhar uma tabela própria): numerar depois da última existente e colar o SQL no
  chat.
- **AniList:** o Googlebot vai rastrear as fichas. A cota devolve 503 com `Retry-After`, nunca 404. Não aumentar a
  cota no dia da virada.
- **Robô antigo:** se os workflows não forem desativados, o `ai-news.yml` pode rodar manualmente e chamar
  `https://animeprofile.com.br/api/public/ai-news/worker/*` no site novo. A resposta é 404/410, inofensiva, mas suja
  os logs.
- **Mercado Pago:** compras feitas no site antigo depois do dump final não entram no saldo automaticamente. As
  notificações guardadas no 2.5 e o painel do Mercado Pago permitem conferir à mão na fase D.

## Como verificar (resumo)

- `node scripts/conferir-backup.mjs <pasta>` termina com "BACKUP OK" (dumps 1 e final).
- `storage/arquivos/relatorio.json` bate com `conferencia/totais.csv`.
- A consulta "supabase.co" do 2.1 dá 0 no MySQL.
- `node scripts/conferir-enderecos.mjs <base>` dá zero falhas no `novo.` (dia 2) e no domínio final (dia 3).
- `npm run build` e `npm test` passam.
- Checklist 3.4 completo, com resultado anotado em `docs/README.md`.

## Perguntas em aberto (para o dono)

1. **Horário da virada:** dia 3 (ter 17/11) a partir das 7h? **Recomendação: sim.** O tráfego é baixo, há o dia
   inteiro para corrigir e o dia 4 fica de margem com rollback possível.
2. **Robô de notícias antes das contas** (fase A antes da B)? **Recomendação: sim.** Notícia nova é o que traz o
   Google e o Google Notícias. A lacuna estimada é de 4 a 7 dias sem notícias, contra 2 a 3 semanas se esperar as
   contas.
3. **"Me avise quando as contas voltarem"** (guardar e-mails voluntários)? **Recomendação: sim.** É barato, usa a
   tabela do contato e dá uma lista para avisar na fase B. Se for "não", o bloco sai da página.
4. **Premium e a lacuna:** estender a validade de quem é Premium pelos dias sem contas, contados do dump final até a
   volta da fase D? **Recomendação: sim** (é justo, e são poucas pessoas). A sequência de check-in já é protegida
   pela decisão do inventário.
5. **AdSense e Analytics durante a lacuna:** ficar só com o `ads.txt`, sem anúncios nem Analytics até o banner de
   cookies? **Recomendação: sim.** Ligar anúncios sem o banner contraria a decisão de 2026-11-12. Durante a lacuna,
   os números vêm do Search Console.

---

## Descobertas do dia 1 (2026-11-15, pelo MCP da Hostinger, só leitura)

- **Zona DNS do `animeprofile.com.br` está na Hostinger** (dá para o Claude alterar pelo MCP, com a aprovação do dono).
  Hoje o `@` aponta para o Lovable: **A `185.158.133.1`** e **AAAA `2a07:8240::1` e `::2`**; o `www` tem A e AAAA iguais.
  Há também `comunidade` (A e AAAA do Lovable) e TXT `_lovable*` (verificação do Lovable, não mexer até o fim).
  O `novo` é um **ALIAS** para `novo.animeprofile.com.br.cdn.hstgr.net` (é assim que a Hostinger liga o app).
- **Não mexer** em MX (`mx1`/`mx2.hostinger.com`), TXT do `@` (Google e SPF), DKIM `hostingermail-*`, `autodiscover`,
  `autoconfig`, `_dmarc`.
- **O site Node.js é o `novo.animeprofile.com.br`** (usuário da hospedagem e pasta `public_html` no plano Business, tipo
  `nodejs`). Para servir o domínio principal, o caminho mais curto é `hosting_websites_add-domain` com
  `type: parked` e `name: animeprofile.com.br` (domínio alias do mesmo app); depois ajustar o DNS do `@` (e do `www`,
  que o Express já redireciona para o `@`) para o que a Hostinger indicar (ALIAS para a CDN, como o `novo`), removendo os
  A/AAAA do Lovable. **Rollback:** repor `A 185.158.133.1` e os dois AAAA (anotados acima), TTL 300.
- **Ainda a testar no dia 2:** se o alias aceita o certificado e se o Node recebe o `Host` correto; se não, plano B é criar
  um segundo site `animeprofile.com.br` ligado ao mesmo repositório (`hosting_deploy`).
- **`SITE_NOINDEX` é do app inteiro:** ao apagar a variável, o `novo.` também fica indexável. O canonical já aponta para
  `VITE_SITE_URL`, mas o ideal é o `novo.` redirecionar (301) para o domínio principal depois da virada (a fazer no
  `server-app.js`).
- **Backup validado em 2026-11-15:** `animeprofile_261115.backup` (PostgreSQL, zstd, 377 tabelas com dados): 171 usuários
  (64 com hash bcrypt, 114 identidades do Google), 2.235 `user_stickers`, 956 `posts`, 338 `chat_messages`; nenhuma tabela
  obrigatória do 0.4 falta. `storage.objects`: 6.734 arquivos, 672 MB, listados em `storage-objetos.tsv`.
- **Conferência de endereços** (`scripts/conferir-enderecos.mjs`) contra o `novo.`: 1.898 endereços do sitemap antigo;
  achou `/en/articles/<slug>` (32) e `/animes/ranking` (404); ambos já têm redirecionamento. Rodar de novo no dia 2.
- **TTL baixado em 2026-11-15 (autorizado pelo dono):** `@` e `www` (A e AAAA) em 300 s. Os valores continuam os do Lovable
  (`A 185.158.133.1`, `AAAA 2a07:8240::1` e `::2`); só o TTL dos dois AAAA mudou (era 14400). MX, TXT, DKIM e `comunidade`
  intactos. O site antigo seguiu respondendo 200 depois da mudança.
