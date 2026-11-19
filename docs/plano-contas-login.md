# Plano: `/login` no formato do site antigo (fase 1: só o administrador)

Plano temporário, escrito em 2026-11-19 pelo planejador. **Escopo reduzido pelo dono no mesmo dia:** agora entra só o
login do **administrador**, sem criar conta nova nenhuma. As fases 2 e 3 (importar os usuários, login para todos,
Google, SMTP, Turnstile, cadastro aberto) ficam registradas no fim, resumidas e marcadas **"não agora"**.

## Objetivo

Trocar o "volta em breve" de `/login` por uma página de entrar com o formato da do site antigo, por onde **só o
administrador** entra (e-mail e senha das variáveis que já estão no hPanel). Logado, o admin vê no cabeçalho o avatar e
um menu com **Administração** (vai para `/admin`, o painel de visitas) e **Sair**. Tudo isso sem quebrar o cache de 60 s
da CDN das páginas públicas e sem nenhuma ação do dono.

## Contexto

- **Hoje:** `/login` cai em `routes/contas-em-breve.tsx` (lista `ACCOUNT_PENDING` em `app/routes.ts`). O admin entra
  por `/admin/login` (tela própria, sem o topo do site), que confere `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (scrypt) e
  grava o cookie assinado `__ap_admin` (`HttpOnly`, `SameSite=Strict`, `Path=/`, 7 dias, assinado com
  `SESSION_SECRET`). Código em `app/server/admin/auth.server.ts` e `app/server/admin/hash.ts`; testes em
  `tests/admin-auth.test.ts`. O contador de visitas ignora quem manda o cookie `__ap_admin`
  (`app/visitas/server/coleta.server.ts`, linha ~105, via `VISITAS.cookieAdmin`).
- **Cache:** `server-app.js` põe `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=120` em todo GET
  que não seja `/api`, `/admin` ou `/unsubscribe`. Ou seja: o HTML das páginas públicas é o mesmo para todo mundo e não
  pode depender de cookie.
- **Menu:** `app/lib/nav.ts` tem `LOGGED_IN = false` e o filtro `visibleNav()`; os itens com `auth: true` (Feed, Blog,
  Missões, Ranking, Figurinhas, Quarto Otaku) somem do menu lateral e do rodapé.
- **Por que muda:** o dono quer entrar pelo mesmo `/login` que todo mundo vai usar depois, como no site antigo (onde o
  admin era um usuário com o papel `admin` em `user_roles` e via "Administração" no menu do usuário).

## O que o site antigo fazia (referência do formato)

Código em `animeprofile-old/src/routes/login.tsx`, `cadastro.tsx`, `esqueci-senha.tsx`, `redefinir-senha.tsx`,
`components/AuthLayout.tsx`, `components/auth/AuthGateDialog.tsx`, `components/auth/AvatarWall.tsx`,
`components/auth/Turnstile.tsx`, `lib/username-login.functions.ts`, `lib/roles.functions.ts`, `components/TopBar.tsx`.

- **Moldura (`AuthLayout`):** tela cheia, conteúdo centralizado numa coluna de 440 px. De cima para baixo: logo
  quadrado de 80 px com brilho, "Anime **Profile**" (Profile em degradê), a linha "SUA COMUNIDADE OTAKU" em caixa alta
  espaçada, o título (`h1`) e o subtítulo, um cartão `rounded-3xl` com o formulário e, abaixo do cartão, uma linha de
  rodapé. Atrás de tudo, o **mural de avatares** (`AvatarWall`): fotos de usuários atravessando a tela, com um véu
  radial para o formulário ficar legível.
- **`/login`:** título "Entrar na conta", subtítulo "Continue sua jornada otaku de onde parou.".
  1. Botão "Continuar com Google" (borda, ícone G vermelho), com spinner enquanto abre o Google.
  2. Divisor "OU ENTRE COM E-MAIL OU USUÁRIO".
  3. Campo "E-mail ou usuário" (ícone de pessoa; aceita `voce@email.com` ou `@usuario`) e "Senha" (ícone de cadeado,
     olho para mostrar). Rótulos pequenos em caixa alta.
  4. Link "Esqueci minha senha" alinhado à direita.
  5. Botão "Entrar" em degradê, com spinner.
  6. Rodapé: "Ainda não tem conta? **Cadastre-se**".
  - Erros em *toast*: "E-mail ou senha incorretos", "Usuário ou senha incorretos", "Confirme seu e-mail antes de
    entrar", "Muitas tentativas. Espere 15 minutos ou entre com o e-mail." (8 erros em 15 min por usuário). Sucesso:
    *toast* "Bem-vindo de volta!".
  - Depois de entrar vai para `?redirect=` (só caminhos que começam com `/`) ou para `/`. Quem já está logado e abre
    `/login` é mandado para o destino.
  - Sem "lembrar de mim" (a sessão do Supabase durava até sair), sem Turnstile no login (só no cadastro), sem aceite
    dos Termos no login. `noindex,follow`.
- **`/cadastro`:** botão "Cadastrar com Google" em destaque (degradê), divisor "OU USE SEU E-MAIL", e-mail (sugere o
  `@usuario`), senha com barra de força, "Tenho um código de convite", Turnstile, botão "Criar conta" e a frase de
  aceite ("Ao continuar, você declara ter pelo menos N anos e aceita os Termos de Uso e a Política de Privacidade").
  Depois: tela "Confirme seu e-mail" com "Abrir Gmail/Outlook" e "Reenviar em 45 s".
- **`/esqueci-senha`** (e-mail → "Se houver uma conta para X, você receberá um link") e **`/redefinir-senha`** (nova
  senha + confirmar).
- **`AuthGateDialog`:** a mesma entrada (Google, e-mail e senha) num modal, para "entre para continuar" sem sair da
  página.
- **Papel admin:** tabela `user_roles (user_id, role)` com o enum `app_role` = `admin | moderator | user | author`. O
  servidor conferia com `user_roles.role = 'admin'`. No menu do usuário (`TopBar`), quem era admin ou moderador via,
  entre o resto dos itens e "Sair", um separador e **"Administração"** (ícone de engrenagem) levando a `/admin`.

## Decisões de design (fase 1)

| Ponto | Decisão | Por quê |
|---|---|---|
| Quem entra | Só o admin das variáveis `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` / `SESSION_SECRET` (já no hPanel) | Mais simples e seguro; zero ação do dono; nenhuma tabela nova |
| Tabela de usuários ou papéis | **Nenhuma agora.** Uma função `getViewer(request)` devolve o "visitante logado" com `papeis: ["admin"]`; `requireAdmin` passa a conferir o papel do `getViewer` | Deixa o caminho aberto: na fase 2 só a implementação de `getViewer` muda (sessão no banco + `user_roles`), sem mexer em quem chama |
| Cookie | Continua `__ap_admin` (assinado, `HttpOnly`, `Secure` em produção, **`SameSite=Strict`**, `Path=/`, 7 dias). Mais um cookie **`ap_logado=1`** (sem segredo, **não** `HttpOnly`, `SameSite=Lax`, mesmo prazo) só para o navegador saber que vale perguntar quem está logado | O contador de visitas já ignora `__ap_admin`; o marcador evita chamar `/api/eu` para todo visitante |
| Cache da CDN | O HTML público continua igual para todos e com `s-maxage=60`. O estado "logado" é lido **no navegador**, em `GET /api/eu` (`no-store`), **só se existir `ap_logado`** | Página pública nunca lê cookie no servidor, então o cache continua seguro |
| Piscar | Script no `<head>` (como o do tema) põe `data-logado` no `<html>` quando há `ap_logado`; o CSS esconde "Entrar" e mostra o lugar do avatar antes de pintar | Sem "Entrar" piscando para o admin e sem diferença de hidratação |
| `/login` | Página nova no formato do antigo, dentro da moldura do site (topo e menu lateral continuam) | O site novo sempre mostra a navegação; o formato do cartão é o do antigo |
| Botão do Google | **Visível e desativado**, com selo "Em breve" | Mantém o formato e avisa os 114 usuários do Google que esse caminho volta; esconder faria parecer que acabou |
| Campo de entrada | Só "E-mail" (sem `@usuario`) | O único que entra é o admin, por e-mail |
| "Esqueci minha senha" | **Escondido** | Sem SMTP; o admin troca a senha com `npm run admin:hash` e o hPanel |
| Turnstile | Não | O limite de tentativas que já existe basta para um login só |
| Aviso honesto | Caixa no topo do cartão: as contas da comunidade voltam em breve; por enquanto só a equipe entra | Quem tinha conta vai tentar a senha antiga; precisa entender por que não entra |
| `/cadastro`, `/esqueci-senha`, `/redefinir-senha` | Continuam em `ACCOUNT_PENDING`; `/cadastro` ganha o título "Cadastro volta em breve" | Nenhuma conta nova (pedido do dono) |
| `/admin/login` | Vira só um redirecionamento 302 para `/login?redirect=/admin` | Uma porta de entrada só |
| Sair | Rota nova `POST /sair` (apaga os dois cookies e volta para `/`); `/admin/sair` faz o mesmo | Sair pelo menu do site e pelo painel dá no mesmo |
| Destino depois de entrar | `?redirect=` (validado) ou, sem ele, `/admin` | Hoje o admin entra quase sempre para ver o painel |
| `LOGGED_IN` e itens `auth` | **Continuam escondidos também para o admin** (`LOGGED_IN = false`, só o comentário muda) | As páginas são "volta em breve" ou de leitura; mostrar depois da hidratação faria o menu lateral pular, e o admin não precisa delas agora. Passa a ser real na fase 2 |
| Menu do usuário | Avatar com a inicial, nome "Administrador", "Administração" e "Sair". Sem "Meu perfil" | Não existe perfil ainda; "Meu perfil" entra na fase 2 |

## Visual

### Direção

Calmo e direto, com o formato do antigo (marca no alto, título, cartão, rodapé) mas na identidade nova "Top 10 claro":
papel levemente rosado, vermelho da marca só no botão principal e nos destaques, Sora em tudo, nada de degradê nem
brilho pulsando. O olho vê primeiro o título "Entrar na conta", depois o aviso das contas e o formulário, por último o
rodapé. Evitar: o mural de avatares (volta na fase 2, quando houver usuários), ilustração, e qualquer texto que sugira
que o site acabou.

### Tokens (de `app/app.css`; não criar cores novas)

| Uso | Claro | Escuro |
|---|---|---|
| Fundo (`paper`) | `#faf7f7` | `#121014` |
| Cartão (`surface`) | `#ffffff` | `#1b171a` |
| Campo/hover (`sunken`) | `#f4eded` | `#231e21` |
| Borda (`line`) | `#efe6e6` | `#2f282b` |
| Texto (`ink`) | `#1c1414` | `#f4eff0` |
| Texto secundário (`ink-soft`) | `#6e5f5f` | `#ab9d9f` |
| Marca (`brand`) / texto sobre ela (`brand-ink`) | `#c2352b` / `#ffffff` | `#c2352b` / `#ffffff` |
| Fundo suave da marca (`brand-soft`) | `#fbedec` | `#3a1b19` |
| Link (`link`) | `#c2352b` | `#ff9a90` |
| Topo (`night` / `night-ink`) | `#0d0d10` / `#f4f4f6` | `#0b0b0e` / `#f4f4f6` |

- **Fonte:** Sora (já carregada). Título 1.75rem (`sm:` 2rem), `font-extrabold`, `tracking-[-0.02em]`. Texto 1rem.
  Pequenos 0.8 a 0.9rem.
- **Raios:** cartão `rounded-3xl`; campos e botão do Google `rounded-xl`; botão principal `rounded-[9px]` (padrão do
  site); avatar `rounded-full`.
- **Sombras:** cartão `shadow-[0_20px_50px_-20px_rgba(28,20,20,.18)]` e no escuro
  `dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,.6)]`; botão principal `shadow-[0_8px_24px_rgba(194,53,43,.35)]` (o mesmo do
  "Contas em breve" do topo).
- **Fundo da área do login:** `paper` com um brilho suave da marca no alto:
  `bg-[radial-gradient(60%_45%_at_50%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent)]` (no escuro,
  `16%` em vez de `10%`).
- **Foco:** anel do `form.tsx` (`focus:ring-2 focus:ring-link/40`) nos campos; nos botões e links,
  `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link`.

### Wireframe do `/login` em 1440 px (claro; o escuro troca só os tokens)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOPO night 72px: [logo] Anime Profile        (  Buscar notícias, animes...  )   Entrar [Contas em breve] │
├──────────────┬───────────────────────────────────────────────────────────────────────────────┤
│ MENU LATERAL │                   (brilho vermelho suave no alto, sobre paper)                │
│ 256 px       │                              ┌────┐                                           │
│              │                              │logo│  72 px, rounded-2xl                       │
│              │                              └────┘                                           │
│              │                        Anime Profile   (Profile em brand)                    │
│              │                     SUA COMUNIDADE OTAKU (0.75rem, espaçado)                  │
│              │                                                                               │
│              │                          Entrar na conta   (h1 2rem)                          │
│              │                     Continue de onde parou.  (ink-soft)                       │
│              │            ┌───────────────────── 440 px ─────────────────────┐              │
│              │            │ ⓘ As contas da comunidade voltam em breve. Por    │ brand-soft  │
│              │            │   enquanto, só a equipe entra por aqui. Saiba mais│              │
│              │            │                                                   │              │
│              │            │ [ G  Continuar com Google        EM BREVE ]  (60%)│              │
│              │            │ ───────────  OU ENTRE COM E-MAIL  ───────────     │              │
│              │            │ E-mail                                            │              │
│              │            │ [✉  voce@email.com                          ]     │              │
│              │            │ Senha                                             │              │
│              │            │ [🔒 ••••••••                              👁 ]     │              │
│              │            │ [            Entrar (brand, 48 px)           ]    │              │
│              │            └───────────────────────────────────────────────────┘              │
│              │            Ainda não tem conta? O cadastro volta em breve. Saiba mais        │
│              │            Ao entrar, você aceita os Termos de Uso e a Privacidade (0.8rem)  │
├──────────────┴───────────────────────────────────────────────────────────────────────────────┤
│ RODAPÉ do site                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- A coluna fica centralizada na área ao lado do menu lateral, com `min-h-[calc(100dvh-72px)]` e `py-16`; o conteúdo
  é centralizado na vertical (`flex items-center justify-center`).

### Wireframe do `/login` em 375 px

```
┌─────────────────────────────────────┐
│ TOPO 60px: [logo]      🔍 ☾ [Em breve] │
├─────────────────────────────────────┤
│            ┌────┐ 64 px              │
│            └────┘                    │
│          Anime Profile               │
│       SUA COMUNIDADE OTAKU           │
│        Entrar na conta (1.75rem)     │
│      Continue de onde parou.         │
│ ┌─────────────────────────────────┐ │  px-4 na página
│ │ ⓘ As contas da comunidade ...   │ │  cartão p-6
│ │ [ G Continuar com Google EM BREVE]│ │
│ │ ── OU ENTRE COM E-MAIL ──        │ │
│ │ E-mail  [✉ ...................]  │ │
│ │ Senha   [🔒 ..............  👁]  │ │
│ │ [          Entrar           ]    │ │
│ └─────────────────────────────────┘ │
│ Ainda não tem conta? O cadastro     │
│ volta em breve. Saiba mais          │
│ Termos ... (0.8rem)                 │
├─────────────────────────────────────┤
│ BARRA INFERIOR 64 px (5 itens)       │
└─────────────────────────────────────┘
```

- Em 375 px: `py-10`, logo 64 px, cartão `p-6` (de `sm` em diante `p-8`), nada lado a lado; o selo "Em breve" do
  Google não pode quebrar a linha (texto do botão `truncate`, selo `shrink-0`).

### Componentes e estados do `/login`

1. **Marca:** `Link` para `/` com `<img src="/logo-192.png">` 64 px (`sm:` 72 px), `rounded-2xl`,
   `ring-2 ring-brand/20`, sombra `shadow-[0_12px_32px_rgba(194,53,43,.25)]`; abaixo "Anime Profile" em 1.6rem
   `font-extrabold` com "Profile" em `text-brand dark:text-glow`; linha "Sua comunidade otaku" `uppercase
   text-[0.72rem] tracking-[0.2em] text-ink-soft font-semibold`. Hover: o logo sobe 2 px (`transition-transform
   hover:-translate-y-0.5`, desligado com `motion-reduce`).
2. **Título e subtítulo:** `h1` "Entrar na conta"; subtítulo "Continue de onde parou." (`text-ink-soft`, `max-w-[300px]`).
3. **Aviso das contas** (sempre visível): `div` `rounded-xl border border-brand/20 bg-brand-soft px-4 py-3
   text-[0.9rem]`, ícone `Info` (lucide) 18 px `text-brand dark:text-glow` à esquerda; texto: "As contas da
   comunidade voltam em breve. Por enquanto, só a equipe entra por aqui. O que é seu está guardado." + link
   "Saiba mais" (`text-link font-semibold underline`) para `/site-novo`. `role="note"`.
4. **Botão do Google (desativado):** `button type="button" disabled aria-disabled="true"`, `h-12 w-full rounded-xl
   border border-line bg-surface opacity-60 cursor-not-allowed`, conteúdo centralizado com `gap-3`: o G colorido do
   antigo (svg 18 px, `#EA4335`), "Continuar com Google" (`font-semibold`), selo "Em breve" (`rounded-full bg-sunken
   px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-ink-soft`). `title="Volta junto com as contas"`.
   Sem hover.
5. **Divisor:** `my-6 flex items-center gap-3`, duas linhas `h-px flex-1 bg-line`, texto "Ou entre com e-mail"
   `text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-soft`.
6. **Formulário** (`<Form method="post" replace>` do React Router, `noValidate` não; usar `required` nativo):
   - **Erro:** `Notice tone="erro"` no topo do formulário, com o texto devolvido pela `action` (lista abaixo). O foco
     vai para o aviso (`tabIndex={-1}` + `ref.focus()` quando `actionData.error` muda).
   - **E-mail:** `TextField` com o novo `icon={Mail}`, `type="email"`, `autoComplete="username"`,
     `placeholder="voce@email.com"`, `maxLength={255}`, `name="email"`, `defaultValue` = o e-mail enviado (a `action`
     devolve o e-mail digitado para não precisar redigitar; nunca devolver a senha).
   - **Senha:** novo `PasswordField` (ícone `Lock`, botão de olho `Eye`/`EyeOff` 18 px à direita, `aria-label`
     "Mostrar senha"/"Esconder senha", `aria-pressed`), `autoComplete="current-password"`, `name="senha"`,
     `maxLength={200}`.
   - **`Honeypot`** do `form.tsx`.
   - **Botão:** `SubmitButton` com as novas props `className="w-full h-12 shadow-[0_8px_24px_rgba(194,53,43,.35)]"`
     e `busyLabel="Entrando..."`. Enviando: ícone `Loader2` 18 px girando (`animate-spin`, parado com
     `motion-reduce`) antes do texto, botão desabilitado.
   - **Mensagens** (todas em `Notice tone="erro"`):
     - credencial errada: "E-mail ou senha incorretos.";
     - bloqueado: "Muitas tentativas. Espere 15 minutos e tente de novo." (com ícone `Clock` 18 px);
     - origem inválida: "Pedido recusado. Recarregue a página e tente de novo.";
     - sem configuração no servidor: "O login está indisponível agora. Tente mais tarde." (os nomes das variáveis que
       faltam vão só para o `console.error` do servidor, nunca para a página pública).
7. **Rodapé:** "Ainda não tem conta? O cadastro volta em breve." + link "Saiba mais" (`/site-novo`), `text-center
   text-[0.95rem] text-ink-soft`. Abaixo, `text-[0.8rem] text-ink-soft`: "Ao entrar, você aceita os
   [Termos de Uso](/legal/termos) e a [Política de Privacidade](/legal/privacidade)." (links `text-link underline`).
8. **Carregando a página:** nada especial (é SSR). **Vazio:** não se aplica.

### Cabeçalho e menu do usuário (admin logado)

O HTML do topo sai igual para todo mundo (cache). O que muda vem do CSS (`data-logado`) e de `/api/eu`.

- **Variante nova do Tailwind** em `app/app.css`: `@custom-variant logado (&:where([data-logado], [data-logado] *));`.
- **Visitante (sem `data-logado`):** exatamente como hoje ("Entrar" + "Contas em breve"; no celular "Em breve"; na
  gaveta, "Entrar").
- **Logado (`data-logado`):** os dois botões ganham `logado:hidden`; aparece o `UserMenu` (que tem `hidden logado:flex`).
  - **Gatilho, ≥ 1024 px:** botão `flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-white/10`, avatar de
    36 px (`rounded-full bg-brand text-brand-ink font-extrabold text-[0.95rem] ring-2 ring-white/15`, com a inicial
    "A"), nome "Administrador" (`text-[0.9rem] font-semibold`, `max-w-[10rem] truncate`) e `ChevronDown` 16 px
    `text-white/70` (gira 180° aberto, `transition-transform`).
  - **Gatilho, < 1024 px:** só o avatar de 36 px (área de toque de 44 px: `size-11 grid place-items-center`).
  - **Carregando** (`data-logado` presente, `/api/eu` ainda sem resposta): círculo de 36 px `bg-white/15
    animate-pulse` no lugar do avatar, sem nome; o botão fica desabilitado.
  - **Menu aberto:** painel `absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-line bg-surface
    p-1.5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]`, entrada com `opacity` e `translate-y-1 → 0` em 120 ms
    (`motion-reduce:transition-none`). Conteúdo:
    1. Cabeçalho (`px-3 py-2.5 flex items-center gap-3`): avatar 40 px + "Administrador" (`font-bold`) e, embaixo,
       "Equipe Anime Profile" (`text-[0.8rem] text-ink-soft`). Sem e-mail na tela.
    2. Separador `my-1 h-px bg-line`.
    3. Só para quem tem o papel `admin`: item **"Administração"**, ícone `LayoutDashboard` 18 px, `Link` para `/admin`.
    4. Separador.
    5. Item **"Sair"**, ícone `LogOut` 18 px, `text-brand dark:text-glow`, `<Form method="post" action="/sair">` com
       `button type="submit"`.
    - Itens: `flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold hover:bg-sunken
      focus-visible:bg-sunken`.
  - **Acessibilidade:** gatilho com `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; painel `role="menu"`,
    itens `role="menuitem"`. Abrir põe o foco no primeiro item; `Esc` fecha e devolve o foco ao gatilho; clique fora
    fecha; trocar de página fecha (`useEffect` no `pathname`). Setas ↑/↓ movem entre os itens.
  - **Erro em `/api/eu`** (rede ou 5xx): tira `data-logado` só nesta visita (volta "Entrar"), sem apagar o cookie.
    **Resposta `logado: false`** (sessão vencida ou `SESSION_SECRET` trocado): apaga o `ap_logado` e tira
    `data-logado`.
- **Gaveta do menu (celular e 1024–1279 px):** no lugar do link "Entrar" (que ganha `logado:hidden`), um bloco
  `hidden logado:block mx-3 rounded-2xl border border-line p-2`: linha com avatar 40 px + "Administrador" e
  "Equipe Anime Profile"; "Administração" (só admin) e "Sair" com o mesmo estilo de item do menu acima. No estado
  carregando, a linha do avatar mostra o círculo pulsando e os itens não aparecem.
- **Barra inferior:** não muda.

Wireframe do topo, admin logado, 1440 px (o painel aberto):

```
 [logo] Anime Profile      (  Buscar notícias, animes...  )     ( (A) Administrador ˅ )
                                                                ┌──────────────────────────┐
                                                                │ (A) Administrador         │
                                                                │     Equipe Anime Profile  │
                                                                │ ──────────────────────── │
                                                                │ ▦  Administração          │
                                                                │ ──────────────────────── │
                                                                │ ⎋  Sair        (vermelho) │
                                                                └──────────────────────────┘
```

Em 375 px: `[logo]   🔍 ☾ (A)`; tocar no (A) abre o mesmo painel, alinhado à direita, `w-[min(16rem,calc(100vw-2rem))]`.

## Arquivos afetados

- **Novos:**
  - `app/server/auth/viewer.server.ts`: `getViewer(request)` e o tipo `Viewer`.
  - `app/routes/login.tsx`: a página.
  - `app/routes/sair.ts`: `POST /sair`.
  - `app/routes/api.eu.ts`: `GET /api/eu`.
  - `app/components/layout/UserMenu.tsx`: gatilho, painel e o bloco da gaveta (`UserMenu` e `UserMenuDrawer`).
  - `app/lib/session-hint.ts`: nome do cookie marcador e o `sessionHintBootstrap` (script do `<head>`).
  - `tests/login-admin.test.ts`.
- **Alterados:**
  - `app/server/admin/auth.server.ts`: `requireAdmin` sai daqui (vai para `viewer.server.ts`); `login`/`logout`
    devolvem também o cookie marcador.
  - `app/routes/admin/layout.tsx`: importa `requireAdmin` de `~/server/auth/viewer.server`.
  - `app/routes/admin/login.tsx`: vira só `loader` com redirecionamento.
  - `app/routes/admin/sair.ts`: apaga os dois cookies e volta para `/`.
  - `app/routes.ts`: tira `login` de `ACCOUNT_PENDING`; adiciona `login`, `sair` e `api/eu`.
  - `app/routes/contas-em-breve.tsx`: título próprio para `/cadastro`.
  - `app/components/form.tsx`: `icon` no `TextField`, `PasswordField`, `className` e `busyLabel` no `SubmitButton`.
  - `app/components/layout/Header.tsx`: `logado:hidden` nos botões de visitante, `UserMenu` e `UserMenuDrawer`.
  - `app/root.tsx`: o script `sessionHintBootstrap` no `<head>`.
  - `app/app.css`: variante `logado`.
  - `app/lib/nav.ts`: só o comentário de `LOGGED_IN`.
  - `server-app.js`: `/login` e `/sair` sem cache e com `noindex`.
  - `app/content/paginas/site-novo.md`: o link "[Login e contas](/login)" passa a apontar para `/cadastro` (que segue
    "volta em breve"), para não mandar o leitor a um formulário em que ele não entra.
  - `tests/admin-auth.test.ts`: ajustar o destino do redirecionamento e os cookies.
  - `docs/README.md`, `docs/decisoes.md`, `docs/arquitetura.md` (seção "Contas e login": nota da fase 1),
    `docs/plano-painel-visitas.md` (o login do painel agora é `/login`).

## Passos (fase 1) — todos do Claude; nenhum depende do dono

1. **[P] `getViewer`.** Criar `app/server/auth/viewer.server.ts`:
   ```ts
   export type Papel = "admin" | "moderator" | "author";
   export type Viewer = { id: string; nome: string; inicial: string; papeis: Papel[] };
   export async function getViewer(request: Request): Promise<Viewer | null>
   ```
   Implementação da fase 1: se `isAdmin(request)` (de `auth.server.ts`), devolve
   `{ id: "admin", nome: "Administrador", inicial: "A", papeis: ["admin"] }`; senão `null`. Comentário no topo: "Na
   fase 2 esta função passa a ler a sessão do banco e `user_roles`; quem chama não muda." Também exportar
   `hasRole(v, papel)`.
   *Verificar:* `npm run typecheck`.
2. **[P] `requireAdmin` pelo papel.** Mover `requireAdmin` de `auth.server.ts` para `viewer.server.ts` (que importa
   `isAdmin`, `adminConfig` e `sameOrigin`; `auth.server.ts` **não** importa nada de `viewer.server.ts`, para não haver
   import circular). Nova regra: `getViewer`; sem viewer ou sem o papel `admin` (ou sem configuração) →
   `throw redirect("/login?redirect=/admin")`. Mantém a conferência de origem nos POST e o retorno (o e-mail de
   `adminConfig()`). Atualizar quem importa `requireAdmin`: `app/routes/admin/layout.tsx` e `tests/admin-auth.test.ts`
   (só esses dois hoje; conferir com `grep -r requireAdmin app tests`).
   *Verificar:* `npm test -- admin-auth` (ajustar o teste do destino para `/login?redirect=/admin`).
3. **[P] Cookie marcador.** `app/lib/session-hint.ts` (roda nos dois lados, sem import de servidor):
   - `export const SESSION_HINT = "ap_logado";`
   - `export const sessionHintBootstrap` = `(function(){try{if(/(?:^|; )ap_logado=1/.test(document.cookie))document.documentElement.dataset.logado="1"}catch(e){}})();`
   - `export function clearSessionHint()` (navegador): `document.cookie = "ap_logado=; Max-Age=0; Path=/; SameSite=Lax"`
     e `delete document.documentElement.dataset.logado`.
   - No servidor (`auth.server.ts`): `hintCookie(on: boolean)` monta `ap_logado=1; Path=/; Max-Age=604800;
     SameSite=Lax` (+ `; Secure` em produção) ou `ap_logado=; Path=/; Max-Age=0; SameSite=Lax`. `login()` passa a
     devolver `cookies: string[]` (sessão + marcador) e `logout()` também (os dois apagados). Nas rotas, usar
     `new Headers()` com `append("Set-Cookie", c)` para cada um (nunca juntar com vírgula).
   *Verificar:* teste do passo 11.
4. **[P] Rotas sem cache.** Em `server-app.js`:
   - o `app.use(["/admin", "/api"], ...)` passa a `["/admin", "/api", "/login", "/sair"]`;
   - a regex do cache público passa a `/^\/(api|admin|unsubscribe|login|sair)\b/`.
   (`/login.data`, pedido ao clicar, também casa.) *Verificar:* passo 13, `curl -I`.
5. **[P] `form.tsx`.**
   - `TextField` ganha `icon?: LucideIcon`: o `input` fica num `div relative`, o ícone (18 px, `text-ink-soft`,
     `pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2`) e o `input` ganha `pl-10`. Sem `icon`, nada muda.
   - `PasswordField` novo (mesmo `Wrapper`, ícone `Lock`, `input` com `pr-12`, botão de olho `absolute right-1.5
     size-9 rounded-lg text-ink-soft hover:text-ink hover:bg-sunken`, estado em `useState`).
   - `SubmitButton` ganha `className?` (somado às classes atuais, `inline-flex items-center justify-center gap-2`) e
     `busyLabel?` (padrão "Enviando..."); quando `busy`, mostra `Loader2` girando antes do texto.
   *Verificar:* `/contato` e o painel continuam iguais (as props são opcionais).
6. **[M] Página `app/routes/login.tsx`** (seção "Componentes e estados"):
   - `meta`: "Entrar | Anime Profile", `robots` `noindex, follow`.
   - `loader`: `const v = await getViewer(request)`; se houver, `throw redirect(destino)`. `destino` = `?redirect=` se
     começar com `/` e não com `//` nem `/\`, senão `/admin`. Usar `new URL(request.url).searchParams` só para a busca
     (o caminho, se precisar, por `routePath(request)`).
   - `action`: `sameOrigin` → senão erro "Pedido recusado..."; Honeypot preenchido → registra falha (`registerFail`) e
     devolve a mensagem de credencial errada; chama `login(request, email, senha)`; erro → `{ error, email }`; certo →
     `redirect(destino, { headers })` com os dois `Set-Cookie`.
   - Sem config: `login()` já devolve "Painel não configurado."; trocar o texto exibido para o da seção de mensagens
     e fazer `console.error("[login] configuração incompleta:", cfg.problems.join("; "))`.
   *Verificar:* passos 12 e 13.
7. **[P] Rotas.** Em `app/routes.ts`: tirar `"login"` de `ACCOUNT_PENDING`; adicionar `route("login",
   "routes/login.tsx")`, `route("sair", "routes/sair.ts")` e `route("api/eu", "routes/api.eu.ts")` (perto de
   `api/health`). `app/routes/admin/login.tsx` vira só `export function loader() { return redirect("/login?redirect=/admin"); }`
   (sem componente). *Verificar:* `npm run typecheck` (os tipos de `+types` são gerados).
8. **[P] Sair.** `app/routes/sair.ts`: `loader` → `redirect("/")`; `action` → `sameOrigin` (senão 403) e
   `redirect("/", { headers })` com os cookies de `logout()`. `app/routes/admin/sair.ts` faz o mesmo (destino `/`).
9. **[P] `/api/eu`.** `app/routes/api.eu.ts`, só `loader`: `const v = await getViewer(request)`;
   `Response.json(v ? { logado: true, nome: v.nome, inicial: v.inicial, papeis: v.papeis } : { logado: false },
   { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } })`. Nada de e-mail na resposta.
10. **[M] Cabeçalho.**
    - `app/app.css`: a variante `logado` (logo abaixo de `mini`).
    - `app/root.tsx`: `<script dangerouslySetInnerHTML={{ __html: sessionHintBootstrap }} />` logo depois do
      `sidebarBootstrap`.
    - `app/components/layout/UserMenu.tsx`: hook `useViewer()` (no `useEffect`, só se `document.documentElement.dataset.logado`;
      `fetch("/api/eu", { credentials: "same-origin" })`; estados `carregando | pronto | erro`; regras de erro e
      `logado:false` da seção acima). `UserMenu` (gatilho + painel) e `UserMenuDrawer` (bloco da gaveta, recebe
      `onNavigate`). "Administração" só aparece se `papeis.includes("admin")`.
    - `Header.tsx`: `logado:hidden` no link "Entrar" e no botão "Contas em breve" (e no "Entrar" da gaveta);
      `<UserMenu />` logo depois deles; `<UserMenuDrawer onNavigate={close} />` logo depois do "Entrar" da gaveta.
    - Ao sair (submit do formulário do "Sair"), chamar `clearSessionHint()` no `onSubmit` para o topo trocar na hora.
    *Verificar:* passo 13 (sem erro de hidratação no console).
11. **[P] `nav.ts` e "volta em breve".**
    - `nav.ts`: `LOGGED_IN` continua `false`; o comentário passa a "Fase 1 das contas (2026-11-19): só o admin entra e
      os itens `auth` seguem escondidos também para ele. Na fase 2, `visibleNav` recebe o estado de `useViewer()`."
    - `contas-em-breve.tsx`: quando `path === "/cadastro"`, título "Cadastro volta em breve" e `meta` com o mesmo.
    - `site-novo.md`: o link de "Login e contas" vai para `/cadastro`.
12. **[M] Testes `tests/login-admin.test.ts`** (padrão do `admin-auth.test.ts`, com as variáveis falsas do teste):
    - `getViewer` sem cookie → `null`; com o cookie de um `login()` certo → `papeis` contém `admin`;
    - `requireAdmin` sem sessão → redireciona para `/login?redirect=/admin`;
    - `login()` certo devolve 2 cookies: o de sessão (`HttpOnly`, `SameSite=Strict`) e o `ap_logado=1` (sem `HttpOnly`,
      `SameSite=Lax`); `logout()` devolve os dois com `Max-Age=0` (ou `Expires` no passado);
    - validação do destino: `/admin` ok, `/noticias?x=1` ok, `//mal.com`, `/\mal.com`, `https://mal.com` e vazio →
      `/admin` (exportar a função `safeRedirect` de `app/lib/` para testar);
    - `/api/eu` (chamando o `loader`) sem cookie → `{ logado: false }` e `Cache-Control: no-store`; com cookie →
      `logado: true` e sem nenhum campo `email`.
    *Verificar:* `npm test`.
13. **[P] Conferência local e build.** `npm run build`, `npm test`, `npm run typecheck`; subir local e conferir a
    lista de "Como verificar". Commit e push.
14. **[P] Conferência em produção** (depois do deploy): lista "Em produção" abaixo.
15. **[P] Docs.** README (status, próximos passos), `arquitetura.md` ("Contas e login": fase 1 com a sessão do admin por
    variáveis; `ap_logado`; `/api/eu`), `plano-painel-visitas.md` (login agora em `/login`), `decisoes.md` se algo mudar.

## Riscos e cuidados

- **Cache:** se o `/login` ficar com `s-maxage=60`, a CDN pode guardar a página com uma mensagem de erro de outra pessoa
  (a `action` responde no POST, que não é cacheado, mas o `loader` com redirecionamento do admin poderia ser). Por isso o
  passo 4 vem antes de ligar a página. Nenhuma página pública pode chamar `getViewer` no `loader`.
- **Limite global de 30 erros em 15 min:** agora o formulário é público e ex-usuários vão tentar a senha antiga. Se 30
  tentativas erradas acontecerem em 15 min, o próprio admin fica bloqueado nesse tempo. Com o tráfego atual é
  improvável, e o aviso no cartão ajuda. Se acontecer, esperar 15 min ou reiniciar o app no hPanel (o contador é em
  memória). Fica como pergunta 2.
- **Sessão sem revogação:** o cookie assinado vale 7 dias e não há lista de sessões no servidor; sair apaga o cookie do
  navegador, mas uma cópia roubada vale até vencer. Para derrubar todas: trocar `SESSION_SECRET` no hPanel. Na fase 2 a
  sessão vai para o banco (hash SHA-256 do token, como em `arquitetura.md`).
- **`SameSite=Strict`:** quem chega de outro site (Google, rede social) não manda o `__ap_admin` na primeira página, mas
  o `fetch` a `/api/eu` é do próprio site e manda. Por isso o menu funciona mesmo assim. Não trocar para `Lax` na fase 1.
- **Contador de visitas:** continua ignorando quem tem `__ap_admin` (não renomear o cookie).
- **Hidratação:** o `UserMenu` precisa renderizar no servidor o mesmo HTML para todos (gatilho em estado
  "carregando", escondido pelo CSS); o resultado do `/api/eu` só entra depois do `useEffect`.
- **Import circular:** `viewer.server.ts` depende de `auth.server.ts`, nunca o contrário (passo 2).
- **Regras de sempre:** loaders usam `routePath(request)` para o caminho; `npm run build` antes do push; commit e push
  ao terminar; **nenhuma migration** nesta fase; nada de e-mail, hash ou segredo no git (o `.env` não sobe).
- **Rollback:** reverter o commit. Os cookies antigos continuam válidos (mesmo nome e segredo); `/admin/login` volta.

## Como verificar

**Local (`npm run dev`, com `ADMIN_*` e `SESSION_SECRET` de teste no `.env`):**
1. `/login` em 1440 e 375 px, claro e escuro: igual aos wireframes; Google desativado com "Em breve"; sem "Esqueci
   minha senha"; o aviso das contas no topo do cartão.
2. Senha errada → "E-mail ou senha incorretos." e o e-mail continua no campo; 5 erros seguidos → "Muitas tentativas...".
3. Login certo → cai em `/admin`; `/login?redirect=/noticias` → cai em `/noticias`; `/login?redirect=//google.com` → `/admin`.
4. Logado, abrir `/login` → vai direto para `/admin`.
5. Em `/` logado: o topo mostra o avatar "A" (e "Administrador" a partir de 1024 px), **sem piscar "Entrar"** ao
   recarregar; o menu abre com "Administração" e "Sair"; `Esc` fecha; Tab percorre os itens. Na gaveta (375 px, botão
   "Menu"), o bloco do admin no lugar de "Entrar".
6. "Sair" → volta para `/`, topo com "Entrar" de novo, `/admin` → `/login?redirect=/admin`.
7. `/admin/login` → `/login?redirect=/admin`. `/cadastro` → "Cadastro volta em breve". `/esqueci-senha` → "volta em breve".
8. Menu lateral e rodapé sem Feed, Blog, Missões, Ranking, Figurinhas e Quarto Otaku (também logado).
9. Console do navegador sem erro de hidratação; `npm run build`, `npm test` e `npm run typecheck` passam.

**Em produção (depois do deploy):**
- `curl -sI https://animeprofile.com.br/` → `cache-control: public, max-age=0, s-maxage=60...` e **sem** `set-cookie`.
- `curl -sI https://animeprofile.com.br/login` → `cache-control: no-store` e `x-robots-tag: noindex, nofollow`.
- `curl -s https://animeprofile.com.br/api/eu` → `{"logado":false}` com `no-store`.
- Entrar com o login do dono pelo `/login`, ver "Administração", abrir o painel de visitas e sair.
- No painel, conferir no dia seguinte que as visitas do admin continuam sem contar.

## Perguntas em aberto (para o dono)

Nenhuma bloqueia a fase 1; se não houver resposta, o Claude segue com a recomendada.

1. **Botão do Google:** visível e desativado com "Em breve" (recomendado) ou escondido?
2. **Limite global de tentativas** (30 erros em 15 min, de qualquer IP): manter (recomendado, com o risco acima) ou
   subir para 60 agora que o formulário é público?
3. **Itens `auth` do menu para o admin logado:** continuar escondidos (recomendado) ou mostrar para o admin conferir
   como vai ficar? (Mostrar exige ler o estado no navegador e o menu lateral "pula" depois de carregar.)

---

## Fases futuras (NÃO AGORA)

Só registro, para não perder as decisões já tomadas em [arquitetura.md](arquitetura.md),
[plano-virada-parcial.md](plano-virada-parcial.md) (fase B) e [inventario.md](inventario.md). Cada uma terá plano
próprio antes de começar. Não executar.

### Fase 2 — Contas de todo mundo (não agora)

- **Banco:** migration nova com `users` (id do Supabase mantido, e-mail único em minúsculas, `password_hash` que aceita
  `$2a$`/`$2b$` do bcrypt e `scrypt:`), `user_identities` (`provider`, `provider_id` = `sub` do Google, único por
  provedor), `user_roles` (`user_id`, `role` em `admin|moderator|author`), `sessions` (hash SHA-256 do token,
  `expires_at`, `last_seen_at`), `password_resets` (hash do token, 30 min, uso único), `login_attempts` (por IP e por
  e-mail, substitui o contador em memória) e o aceite dos Termos (`terms_version`, `terms_accepted_at`).
- **Importação do dump final** por `scripts/import/`, em etapas conferidas por contagem e soma: 171 usuários (64 com
  hash bcrypt, 114 identidades do Google), `profiles`, `user_roles`, e depois cada área com seus dados (AP Coins e
  Rubis por soma total, `user_stickers` por contagem, sequência de check-in como estava). O primeiro admin vem do
  `user_roles` do dump e, se faltar, de um comando do servidor pelo e-mail do dono (nunca por tela pública). Nada pessoal
  no terminal nem no git.
- **Login para todos:** e-mail ou `@usuario` + senha; senha bcrypt conferida com `bcryptjs` e regravada em `scrypt` no
  primeiro login. Sessão no banco com o cookie `ap_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, 60 dias renovados);
  o `/admin` passa a exigir o papel `admin` pela mesma sessão (só `getViewer` muda). As variáveis `ADMIN_*` ficam como
  acesso de emergência por 30 dias e depois saem.
- **"Esqueci a senha"** e **"Redefinir"** por SMTP (token aleatório, guardado só o hash, 30 min, uso único; resposta
  igual exista ou não a conta). **Turnstile** no cadastro e no "esqueci a senha". **Cadastro aberto** com o novo aceite
  dos Termos; quem vem do site antigo aceita os Termos novos no primeiro login. O "me avise" (se houver lista) recebe o
  aviso.
- **Menu do usuário completo:** avatar real, "Meu perfil", "Administração" (admin/moderador), "Sair"; `visibleNav`
  passa a usar o estado do `useViewer()`; volta o mural de avatares no `/login`.
- **Do dono:** SMTP no hPanel (`SMTP_*`, `MAIL_FROM`), chaves do Turnstile, rodar a migration (o SQL vem no chat) e
  aprovar o texto dos Termos e da Privacidade.

### Fase 3 — Entrar com o Google (não agora)

- OAuth com PKCE pelo servidor e cliente próprio no Google Cloud (endereço de retorno
  `https://animeprofile.com.br/api/auth/google/callback`).
- **Reconhecer a conta:** primeiro pelo `sub` do Google (das 114 identidades importadas); se não houver, pelo e-mail
  **confirmado pelo Google** igual ao de uma conta existente (liga a identidade a ela); se não houver nenhum, cria
  conta (quando o cadastro estiver aberto).
- **Quem tem Google e senha:** a mesma conta entra pelos dois caminhos. **Quem só tem Google:** entra pelo Google; se
  quiser senha, usa "esqueci a senha" e cria uma.
- **Do dono:** criar o cliente OAuth e colocar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no hPanel.
