import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { Painel, type DadosPainel } from "~/visitas/ui/Painel";

async function render(d: DadosPainel) {
  const handler = createStaticHandler([{ path: "/admin", Component: () => <Painel d={d} /> }]);
  const context = await handler.query(new Request("https://animeprofile.com.br/admin"));
  if (context instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} />).replace(/<!-- -->/g, "");
}

const HOJE = "2026-11-19";
const dias = (n: number) => Array.from({ length: n }, (_, i) => ({ dia: `2026-10-${String(21 + i).padStart(2, "0")}`.replace("2026-10-3", "2026-11-0"), pageviews: 100 + i * 5, visitantes: 40 + i, entradas: 20 }));
const vazio: DadosPainel = {
  hoje: HOJE, hora: "14:32", desde: null, agora: 0, periodo: "7d", filtro: "tudo", mais: false,
  cartoes: { hoje: { pageviews: 0, visitantes: 0, mediaVisitantes: null, variacao: null }, ontem: { pageviews: 0, visitantes: 0, mediaVisitantes: null, variacao: null }, d7: { pageviews: 0, visitantes: 0, mediaVisitantes: 0, variacao: null }, d30: { pageviews: 0, visitantes: 0, mediaVisitantes: 0, variacao: null }, total: { pageviews: 0, desde: null } },
  serie: [], paginas: { itens: [], total: 0 }, dims: {}, resumo: { robos: 0, paginas: 0, entradas: 0, paginasPorVisita: null },
};

describe("tela do painel de visitas", () => {
  it("sem nenhum dado: mostra a mensagem de espera e as listas vazias", async () => {
    const html = await render(vazio);
    expect(html).toContain("As visitas aparecem aqui alguns segundos depois");
    expect(html).toContain("Nenhuma visita neste período.");
    expect(html).toContain("Agora: 0");
  });

  it("com dados: cartões, gráfico com resumo acessível, tabela, origens e filtros", async () => {
    const serie = dias(30);
    const html = await render({
      ...vazio, desde: "2026-10-01", agora: 3,
      cartoes: { hoje: { pageviews: 1234, visitantes: 500, mediaVisitantes: null, variacao: null }, ontem: { pageviews: 900, visitantes: 400, mediaVisitantes: null, variacao: 12 }, d7: { pageviews: 6000, visitantes: 2800, mediaVisitantes: 400, variacao: -8 }, d30: { pageviews: 25000, visitantes: 9000, mediaVisitantes: 300, variacao: null }, total: { pageviews: 120000, desde: "2026-10-01" } },
      serie,
      paginas: { itens: [{ path: "/noticias/x", titulo: "Uma matéria", tipo: "materia", rotulo: "Matéria", views: 80, pct: 40 }, { path: "/animes/9", titulo: null, tipo: "anime", rotulo: "Anime", views: 5, pct: 0.4 }], total: 200 },
      dims: { origem: [{ valor: "busca", n: 8 }, { valor: "direto", n: 2 }], ref_busca: [{ valor: "google.com", n: 8 }], aparelho: [{ valor: "celular", n: 7 }, { valor: "computador", n: 3 }], navegador: [{ valor: "Chrome", n: 9 }], sistema: [{ valor: "Android", n: 6 }] },
      resumo: { robos: 12, paginas: 800, entradas: 210, paginasPorVisita: 3.8 },
    });
    expect(html).toContain("1.234");
    expect(html).toContain("▲");
    expect(html).toContain("▼");
    expect(html).toContain("Páginas vistas nos últimos 30 dias");
    expect(html).toContain("Ver os números em tabela");
    expect(html).toContain("Uma matéria");
    expect(html).toContain("(sem título)");
    expect(html).toContain("google.com");
    expect(html).toContain("Navegação dentro do site: 590 páginas");
    expect(html).toContain("Agora: 3");
    expect(html).toContain("Robôs ignorados no período: 12");
  });
});
