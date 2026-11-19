import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import LoginPage from "~/routes/login";
import { UserMenu, UserMenuDrawer } from "~/components/layout/UserMenu";

// O componente da rota espera props geradas pelo roteador; no teste só importa `actionData`.
const Login = LoginPage as unknown as (p: { actionData?: unknown }) => React.ReactElement;

async function render(element: React.ReactElement) {
  const handler = createStaticHandler([{ path: "/login", Component: () => element }]);
  const context = await handler.query(new Request("https://animeprofile.com.br/login"));
  if (context instanceof Response) throw new Error("redirecionou");
  return renderToString(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} />).replace(/<!-- -->/g, "");
}

describe("página /login", () => {
  it("mostra o formato do antigo: título, aviso das contas, Google desativado, e-mail, senha com olho e rodapé", async () => {
    const html = await render(<Login actionData={undefined} />);
    expect(html).toContain("Entrar na conta");
    expect(html).toContain("Continue de onde parou.");
    expect(html).toContain("As contas da comunidade voltam em breve");
    expect(html).toContain("Continuar com Google");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
    expect(html).toContain("Em breve");
    expect(html).toContain('name="usuario"');
    expect(html).toContain("E-mail ou usuário");
    expect(html).toContain('name="senha"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Mostrar senha");
    expect(html).toContain("Ainda não tem conta? O cadastro volta em breve.");
    expect(html).toContain("Termos de Uso");
    expect(html).not.toContain("Esqueci minha senha"); // sem SMTP agora
    expect(html).not.toContain("Cadastre-se");
  });

  it("mostra o erro devolvido pela ação e devolve o e-mail digitado, nunca a senha", async () => {
    const html = await render(<Login actionData={{ erro: "credenciais", email: "alguem@exemplo.com" }} />);
    expect(html).toContain("E-mail ou senha incorretos.");
    expect(html).toContain('value="alguem@exemplo.com"');
    const bloqueado = await render(<Login actionData={{ erro: "bloqueado", email: "" }} />);
    expect(bloqueado).toContain("Muitas tentativas. Espere 15 minutos e tente de novo.");
  });
});

describe("menu do usuário no servidor", () => {
  it("nasce escondido e sem dados (o estado vem do navegador, só com o cookie marcador)", async () => {
    const html = await render(
      <>
        <UserMenu />
        <UserMenuDrawer onNavigate={() => {}} />
      </>,
    );
    expect(html).toContain("logado:flex!");
    expect(html).toContain("logado:block!");
    expect(html).not.toContain("Administração"); // só aparece depois de /api/eu confirmar o papel admin
    expect(html).not.toContain("@");
  });
});
