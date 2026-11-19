import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { NavGroups } from "~/components/layout/SideNav";
import { sessionHintBootstrap } from "~/lib/session-hint";

async function html() {
  const handler = createStaticHandler([{ path: "/", Component: () => <NavGroups variant="rail" /> }]);
  const context = await handler.query(new Request("https://animeprofile.com.br/"));
  if (context instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} />);
}

describe("menu lateral no servidor (HTML público, igual para todos)", () => {
  it("itens de logado saem escondidos e sem link", async () => {
    const h = await html();
    for (const rota of ["feed", "missoes", "ranking", "quarto", "blog", "figurinhas", "admin"]) expect(h).not.toContain(`href="/${rota}"`);
    for (const rotulo of ["Feed", "Missões", "Ranking", "Quarto Otaku", "Blog", "Figurinhas", "Administração", "Equipe"]) expect(h).toContain(rotulo);
    expect(h).toContain("hidden logado:block");
    expect(h).toContain("hidden equipe:block");
    expect(h).not.toContain("em breve");
    for (const rota of ["", "noticias", "animes", "otaku-tv", "quiz"]) expect(h).toContain(`href="/${rota}"`);
  });

  it("o script do <head> lê os papéis do marcador", () => {
    expect(sessionHintBootstrap).toContain("ap_logado=([a-z0-9.]+)");
    expect(sessionHintBootstrap).toContain("d.papeis");
  });
});

describe("ações do topo logado", () => {
  it("na ordem do antigo: Check-in, Mensagens, Notificações; nada no HTML público", async () => {
    const { HEADER_ACOES } = await import("~/lib/nav");
    const { AcoesLogado } = await import("~/components/layout/AcoesLogado");
    expect(HEADER_ACOES.map((a) => a.id)).toEqual(["checkin", "mensagens", "notificacoes"]);
    const handler = createStaticHandler([{ path: "/", Component: () => <AcoesLogado /> }]);
    const context = await handler.query(new Request("https://animeprofile.com.br/"));
    if (context instanceof Response) throw new Error("redirecionou");
    const h = renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} />);
    expect(h).not.toContain("/check-in");
    expect(h).not.toContain("Notificações");
  });
});
