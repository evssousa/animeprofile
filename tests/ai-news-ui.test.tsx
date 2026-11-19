import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import NoticiasIA from "~/routes/admin/ai-news";

const Tela = NoticiasIA as unknown as (p: { loaderData: unknown }) => React.ReactElement;
async function render(d: unknown) {
  const handler = createStaticHandler([{ path: "/", Component: () => <Tela loaderData={d} /> }]);
  const ctx = await handler.query(new Request("https://animeprofile.com.br/"));
  if (ctx instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, ctx)} context={ctx} />).replace(/<!-- -->/g, "");
}
const menu = { rascunhos: 3, fontesFalhando: 1 };
const rodada = { id: 1, inicio: "2026-11-19T17:20:00Z", fim: null, status: "finished", modo: "publicar", limite: 1, geradas: 1, descartadas: 0, falhas: 0, relatorio: { ok: true } };
const geral = { modo: "publicar", config: {}, chave: true, hoje: 4, teto: 10, horaAgora: 13, horarios: [{ hora: 12, posts: 1 }, { hora: 16, posts: 2 }], gemini: [{ modelo: "gemini-3-flash-preview", chamadas: 13, erros: 1, limite: 40 }], modelos: [], rodadas: [rodada], motivos: [{ motivo: "Fora do tema", n: 2 }], rodando: false };

describe("tela Notícias IA", () => {
  it("submenu com contadores e a visão geral (modo, hoje x/teto, próximo horário, Gemini, motivos, rodadas)", async () => {
    const h = await render({ erro: false, aba: "geral", menu, geral });
    for (const t of ["Notícias IA", "Visão geral", "Aprovação (3)", "Candidatos", "Histórico", "Fontes ⚠", "Tópicos e bloqueios", "Horários e limites", "Autores IA", "Configurações", "Desligado", "Ensaio", "Rascunho", "Publicar", "4", "de 10 publicadas", "Próxima rodada: 16h", "Ensaio agora", "Rodada agora", "13/40", "Fora do tema", "Últimas rodadas", "1 geradas"]) expect(h).toContain(t);
    expect(h).not.toContain("GEMINI_API_KEY");
  });

  it("sem chave do Gemini avisa", async () => {
    const h = await render({ erro: false, aba: "geral", menu, geral: { ...geral, chave: false } });
    expect(h).toContain("Falta a chave do Gemini");
  });

  it("aprovação, candidatos, histórico, fontes, tópicos, horários, autores e configurações montam sem quebrar", async () => {
    const casos: [string, Record<string, unknown>, string[]][] = [
      ["aprovacao", { rascunhos: [{ id: "a", titulo: "Rascunho X", capa: null, autor: "Lia", categoria: "Games", palavras: 400, criadoEm: "2026-11-19T10:00:00Z" }] }, ["Rascunho X", "Revisar", "Publicar agora", "Descartar"]],
      ["aprovacao", { rascunhos: [] }, ["Nenhum rascunho esperando."]],
      ["candidatos", { candidatos: { status: "pending", itens: [{ id: 5, titulo: "Notícia Y", url: "https://a.example/y", fonte: "Fonte A", nota: 80, status: "pending", motivo: null, criadoEm: "2026-11-19T10:00:00Z", temPrevia: false }], total: 1, pagina: 1, paginas: 1, contagens: { pending: 1, selected: 0, rehearsal: 2, draft: 0, published: 0, discarded: 0, failed: 0 } } }, ["Na fila", "Ensaio", "Notícia Y", "Descartar", "Ensaiar"]],
      ["historico", { historico: { itens: [rodada], total: 1, pagina: 1, paginas: 1 } }, ["Rodadas (1)", "publicar"]],
      ["fontes", { fontes: [{ id: "f1", nome: "Crunchyroll News", site: "https://crunchyroll.com", rss: null, prioridade: 9, ativa: true, ultimoStatus: "ok", ultimaBusca: "2026-11-19T10:00:00Z", falhasSeguidas: 0 }] }, ["Crunchyroll News", "crunchyroll.com", "prioridade 9", "Testar", "Nova fonte"]],
      ["topicos", { termos: [{ id: 1, tipo: "topic", termo: "one piece", peso: 55, ativo: true }, { id: 2, tipo: "block", termo: "fofoca", peso: 0, ativo: false }] }, ["Tópicos (1)", "Bloqueios (1)", "one piece", "fofoca"]],
      ["horarios", { horarios: { grade: Array.from({ length: 24 }, (_, hora) => ({ hora, posts: hora === 9 ? 2 : 0 })), limiteDia: 10, foraDeAnimePct: 33 } }, ["Quando o robô roda", "09h", "2 por dia pelos horários.", "Teto do dia"]],
      ["autores", { autores: { autores: [{ id: "x1", nome: "Lia", slug: "lia", categoria: "Games", especialidade: "jogos", publicaSozinho: true, ativo: true }], categorias: ["Animes e Mangás", "Games"] } }, ["Lia", "/autores/lia", "Publica sozinho", "Especialidade"]],
      ["config", { config: { cfg: { modelo: "gemini-3-flash-preview", imagensCorpo: 3, chamadasDiaPorModelo: 40 }, guia: "Regra 1", chave: true, modelos: ["gemini-3-flash-preview", "gemini-2.5-flash"] } }, ["Chave configurada", "Modelo", "Guia editorial", "7 caracteres", "Salvar guia"]],
    ];
    for (const [aba, extra, textos] of casos) {
      const h = await render({ erro: false, aba, menu, ...extra });
      for (const t of textos) expect(h, `${aba}: ${t}`).toContain(t);
    }
  });

  it("erro de banco mostra o aviso padrão e nunca mostra valor de variável de ambiente", async () => {
    process.env.GEMINI_API_KEY = "segredo-nao-pode-aparecer";
    const h = await render({ erro: true, aba: "config", menu });
    expect(h).toContain("Não deu para ler esta aba agora");
    const c = await render({ erro: false, aba: "config", menu, config: { cfg: { modelo: "gemini-3-flash-preview", imagensCorpo: 3, chamadasDiaPorModelo: 40 }, guia: "", chave: true, modelos: [] } });
    expect(c).not.toContain("segredo-nao-pode-aparecer");
    delete process.env.GEMINI_API_KEY;
  });
});
