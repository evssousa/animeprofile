import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import Posts from "~/routes/admin/posts";

const Tela = Posts as unknown as (p: { loaderData: unknown; actionData?: unknown }) => React.ReactElement;
async function render(el: React.ReactElement) {
  const handler = createStaticHandler([{ path: "/", Component: () => el }]);
  const ctx = await handler.query(new Request("https://animeprofile.com.br/"));
  if (ctx instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, ctx)} context={ctx} />).replace(/<!-- -->/g, "");
}
const filtros = { status: "todos", tipo: "", origem: "", autor: "", q: "", ordem: "recentes", pagina: 1 };
const linha = (o: object) => ({ id: "a", slug: "x", titulo: "Matéria X", status: "published", tipo: "news", url: "/noticias/x", capa: null, publicadoEm: "2026-11-18T14:20:00Z", vistas: 1234, origem: "robo", autor: "Lia", categoria: "Animes e Mangás", ...o });
const lista = (itens: object[], extra = {}) => ({ itens, total: itens.length, pagina: 1, paginas: 1, contagens: { todos: 3, published: 1, scheduled: 1, draft: 1 }, autores: [{ id: "1", nome: "Lia" }], ...extra });

describe("tela de Posts", () => {
  it("mostra abas com contagem, filtros, linhas com selo e metadados, e só rascunho tem caixa liberada", async () => {
    const h = await render(<Tela loaderData={{ erro: false, filtros, lista: lista([linha({}), linha({ id: "b", titulo: "Rascunho Y", status: "draft", slug: "y", url: "/noticias/y" })]) }} />);
    for (const t of ["Todos", "Publicados", "Agendados", "Rascunhos", "Buscar por título ou endereço", "Mais recentes", "Matéria X", "Publicado", "Rascunho", "Robô", "Lia", "1.234 vistas", "Mostrando 1–2 de 2"]) expect(h).toContain(t);
    expect(h.match(/type="checkbox"[^>]*disabled=""/g)).toHaveLength(1); // a publicada fica travada
    expect(h).toContain('href="/noticias/x"'); // atalho "ver no site" só nas publicadas
    expect(h).not.toContain('href="/noticias/y"');
  });

  it("vazio com filtro oferece limpar; erro de banco mostra o aviso padrão", async () => {
    const v = await render(<Tela loaderData={{ erro: false, filtros: { ...filtros, q: "zzz" }, lista: lista([], { total: 0 }) }} />);
    expect(v).toContain("Nenhum post aqui.");
    expect(v).toContain("Limpar filtros");
    const e = await render(<Tela loaderData={{ erro: true }} />);
    expect(e).toContain("Não deu para ler os posts agora");
  });
});
