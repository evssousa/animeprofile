# Design

A identidade visual do site novo. A marca continua a mesma (o logo e o vermelho `#bb0000`); o que muda é o
acabamento, para ficar com personalidade própria, no nível do respawnou.

## Ideia central: página de mangá carimbada

O logo do Anime Profile é um quadrado vermelho, como o carimbo japonês (*hanko*). O site trata a página como papel de
mangá: tinta, papel, o vermelho do carimbo e a retícula (os pontinhos de sombra dos mangás).

**Ousadia num lugar só:** o cabeçalho de cada página tem o título grande em Dela Gothic, o carimbo vermelho ao lado e
a retícula se dissolvendo na diagonal. O resto do site fica quieto e organizado, para o conteúdo aparecer.

## Cores

Definidas em `app/app.css`, com tema claro e escuro. O tema escolhido fica salvo em `ap-theme`, a mesma chave do site
antigo, então quem já usava o tema escuro continua com ele.

| Nome | Claro | Escuro | Uso |
|---|---|---|---|
| `paper` | `#fbfbfc` | `#121117` | Fundo da página |
| `surface` | `#ffffff` | `#1b1a21` | Menu lateral, cartões, campos |
| `sunken` | `#f2f2f5` | `#17161c` | Item ativo, hover, cabeçalho de tabela |
| `ink` | `#1a1820` | `#f1f0f4` | Texto |
| `ink-soft` | `#57545f` | `#a7a4b0` | Texto secundário |
| `line` | `#e3e2e9` | `#2d2b35` | Bordas |
| `hanko` | `#bb0000` | `#e5413a` | A marca: botão principal, item ativo, marcadores |
| `ai` | `#23407a` | `#93b0ee` | Índigo japonês: links e foco |

Regra: o vermelho é da marca e das ações principais. Links de texto usam o índigo, para o vermelho não perder força.

## Tipografia

- **Títulos:** Dela Gothic One, uma gótica japonesa pesada, com cara de capa de mangá. Só em títulos (h1 e h2).
- **Texto:** M PLUS 2, de origem japonesa, legível em tamanho pequeno.
- **Texto longo** (`.prose-ap`): até 68 caracteres por linha, entrelinha 1,75.

## Estrutura

- **Computador:**
  - **Menu lateral fixo:** os grupos do site antigo (Descobrir, Comunidade, Recompensas, Coleção).
  - **Barra de topo:** busca, tema, Entrar e Criar conta.
- **Celular:**
  - **Barra de topo:** com o carimbo da marca.
  - **Menu:** abre por cima da tela (`<dialog>` nativo: o Esc fecha e o foco fica preso no menu).
- **Páginas de texto:** índice lateral fixo com as seções. No celular, o índice vira uma caixa que abre e fecha.
- **Formulários:** rótulo sempre visível, erro abaixo do campo e ligado a ele para leitores de tela, com um texto que
  diz como corrigir.

## Acessibilidade (piso, não enfeite)

- Link "Pular para o conteúdo".
- Foco visível em índigo.
- Contraste AA no tema claro e no escuro.
- Respeito a "reduzir movimento".
- Alvos de toque de pelo menos 40 px.
- Nenhuma rolagem horizontal em 390 px (conferido com print).

## Componentes

| Arquivo | O que é |
|---|---|
| `app/components/layout/Sidebar.tsx` | Menu lateral e grupos do menu (usados também no celular) |
| `app/components/layout/Header.tsx` | Barra de topo, busca e menu do celular |
| `app/components/layout/Footer.tsx` | Rodapé |
| `app/components/layout/ThemeToggle.tsx` | Tema claro e escuro, sem piscar ao carregar |
| `app/components/PageHeader.tsx` | Cabeçalho de página com a retícula |
| `app/components/form.tsx` | Campos, botão, avisos e campo-isca contra robôs |
