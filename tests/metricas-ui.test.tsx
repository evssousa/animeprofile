import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import Metricas from "~/routes/admin/metricas";
import { montarCartoes, type Retrato } from "~/server/admin/metricas.server";

const Tela = Metricas as unknown as (p: { loaderData: unknown; actionData?: unknown }) => React.ReactElement;
async function render(el: React.ReactElement) {
  const handler = createStaticHandler([{ path: "/", Component: () => el }]);
  const ctx = await handler.query(new Request("https://animeprofile.com.br/"));
  if (ctx instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, ctx)} context={ctx} />).replace(/<!-- -->/g, "");
}
const r = (o: Partial<Retrato> = {}): Retrato => ({ v: 1, visitantesDia: 100, paginasPorVisita: 2.5, buscaPct: 70, quizConclusaoPct: 40, procuraContas: 12, publicadas: { robo: 5, agenda: 1, painel: 0, old: 0 }, entradasPorOrigem: { busca: 70 }, ...o });
const semanas = Array.from({ length: 8 }, (_, i) => ({ semana: `2026-10-${String(5 + i).padStart(2, "0")}`, rotulo: `0${i + 1}/10`, total: i ? 100 : 0, valores: i ? { busca: 60, direto: 40 } : {} }));
const dados = (extra: Record<string, unknown> = {}) => ({
  hoje: "2026-11-19",
  cartoes: montarCartoes(r(), r({ visitantesDia: 50, buscaPct: 20 })),
  maisEntradas: [{ path: "/noticias/a", titulo: "Matéria A", entradas: 820 }],
  semanas,
  historico: [{ semana: "2026-11-09", dados: r() }],
  semBase: false,
  ...extra,
});

describe("tela de Métricas", () => {
  it("mostra os 5 cartões, as matérias com mais entradas, origens, histórico e o bloco das contas", async () => {
    const h = await render(<Tela loaderData={{ erro: false, hora: "14:32", dados: dados() }} />);
    for (const t of ["Visitantes por dia", "Páginas por visita", "Vindas da busca", "Conclusão do quiz", "Procura pelas contas", "Se piorar:", "Matérias que mais trouxeram entradas", "Matéria A", "De onde vêm, semana a semana", "Histórico semanal", "Contas: começa quando o cadastro abrir"]) expect(h).toContain(t);
    expect(h).toContain("50 pts"); // 70% contra 20%
  });

  it("não tem botão de gravar retrato nem decisões nem gráfico por origem de matéria", async () => {
    const h = await render(<Tela loaderData={{ erro: false, hora: "14:32", dados: dados() }} />);
    for (const t of ["Gravar retrato", "Decisões", "Registrar decisão", "Site antigo", "Rendimento do conteúdo"]) expect(h).not.toContain(t);
  });

  it("sem a migration 014, avisa no histórico; erro de banco mostra o aviso padrão", async () => {
    const h = await render(<Tela loaderData={{ erro: false, hora: "14:32", dados: dados({ historico: null }) }} />);
    expect(h).toContain("Falta rodar a migration 014 para guardar o histórico");
    const e = await render(<Tela loaderData={{ erro: true }} />);
    expect(e).toContain("Não deu para ler as métricas agora");
  });
});
