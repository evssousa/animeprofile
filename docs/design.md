# Design

A identidade visual do site novo, escolhida pelo dono em 2026-11-13 depois de 4 rodadas de opções. O quadro com todas
as opções e a página inicial completa está em https://claude.ai/artifact/1hMjNhfbgpyySNhVXQoBg1 (privado, do dono).

## Ideia central: "Top 10 claro"

Uma evolução do site atual com cara de app de streaming de anime:

- **Topo:** faixa escura cinematográfica com o menu.
- **Cabeçalho das páginas:** continua a mesma faixa escura e termina com cantos arredondados.
- **Corpo:** página clara, com o papel levemente rosado do site atual.
- **Painéis escuros de destaque:** no meio da página clara, para as figurinhas e a Otaku TV.

A página inicial segue a divisão de seções do site atual (lista abaixo).

## Cores

Definidas em `app/app.css`, com tema claro e escuro. O tema escolhido fica salvo em `ap-theme`, a mesma chave do site
antigo.

| Nome | Claro | Escuro | Uso |
|---|---|---|---|
| `paper` | `#faf7f7` | `#121014` | Fundo da página |
| `surface` | `#ffffff` | `#1b171a` | Cartões, campos, rodapé |
| `sunken` | `#f4eded` | `#231e21` | Hover, cabeçalho de tabela |
| `ink` | `#1c1414` | `#f4eff0` | Texto |
| `ink-soft` | `#6e5f5f` | `#ab9d9f` | Texto secundário |
| `line` | `#efe6e6` | `#2f282b` | Bordas |
| `brand` | `#c2352b` | `#c2352b` | Botões e destaques (texto branco com contraste AA) |
| `brand-soft` | `#fbedec` | `#3a1b19` | Fundo de item ativo e de botões secundários |
| `link` | `#c2352b` | `#ff9a90` | Links |
| `night` | `#0d0d10` | `#0b0b0e` | Faixa escura do topo e dos cabeçalhos |
| `glow` | `#ff9a90` | `#ff9a90` | Rótulos vermelhos sobre fundo escuro |

## Tipografia

- **Sora** em tudo, de 400 a 800.
- **Títulos:** em 800, com espaçamento negativo entre letras.
- **Rótulo:** cada seção tem um rótulo vermelho curto acima do título ("Top 3 do mês", "Ao vivo"), como no site atual.
- **Texto longo** (`.prose-ap`): até 70 caracteres por linha, entrelinha 1,75.

## Estrutura

- **Computador:** topo com logo, menu na linha (Início, Notícias, Animes, Otaku TV, Quiz, Figurinhas, Comunidade),
  busca, tema, Entrar e Criar conta.
- **Celular:** o topo mostra só o logo, a busca, o tema e o Criar conta. O menu abre por cima da tela (`<dialog>`
  nativo), com os grupos completos: Descobrir, Comunidade, Recompensas e Coleção.
- **Páginas de texto:** índice lateral fixo. No celular, o índice vira uma caixa que abre e fecha.
- **Rodapé:** branco, com colunas de links.

## Página inicial (seções, na ordem do site atual)

1. Destaques em carrossel, na capa escura, com miniaturas e barra de progresso.
2. Top 3 do mês, em pódio, e Animes no ar hoje.
3. Top 10 da semana: números gigantes vazados atrás dos pôsteres.
4. Temporada atual.
5. Artigos: filtros por categoria, um artigo grande, quatro menores e "Mais lidos do mês".
6. Notícias.
7. Otaku TV, num painel escuro.
8. Quiz.
9. Coleção de figurinhas, num painel escuro, com o pacote desenhado e a lendária holográfica.
10. Blog da comunidade.
11. Últimos comentários e "No feed agora".
12. O diferencial ("Muito mais que notícias").
13. Em alta e os mais lidos do mês.
14. Chamada "Faça parte da comunidade".

## Acessibilidade (piso, não enfeite)

- Link "Pular para o conteúdo".
- Foco visível em azul (`#2b5bd7`), legível sobre o claro e o escuro.
- Contraste AA nos dois temas.
- Respeito a "reduzir movimento".
- Alvos de toque de pelo menos 44 px.
- Nenhuma rolagem horizontal em 390 px (conferido com print).

## Componentes

| Arquivo | O que é |
|---|---|
| `app/components/layout/Header.tsx` | Topo escuro, menu e menu do celular |
| `app/components/layout/Footer.tsx` | Rodapé |
| `app/components/layout/Logo.tsx` | Logo e nome |
| `app/components/layout/ThemeToggle.tsx` | Tema claro e escuro, sem piscar ao carregar |
| `app/components/PageHeader.tsx` | Cabeçalho escuro das páginas internas, com rótulo, título e introdução |
| `app/components/form.tsx` | Campos, botão, avisos e campo-isca contra robôs |

## Histórico

O primeiro layout do código ("página de mangá carimbada", com Dela Gothic One e M PLUS 2) foi reprovado pelo dono
em 2026-11-13 por estar diferente demais do site atual.
