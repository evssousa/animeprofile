import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Footer } from "./components/layout/Footer";
import { AvisoContas } from "./components/layout/AvisoContas";
import { BottomNav } from "./components/layout/BottomNav";
import { Header } from "./components/layout/Header";
import { SideNav, sidebarBootstrap } from "./components/layout/SideNav";
import { themeBootstrap } from "./components/layout/ThemeToggle";
import { PageHeader } from "./components/PageHeader";
import { SITE } from "./lib/site";
import { VisitBeacon } from "./visitas/client/VisitBeacon";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  {
    rel: "alternate",
    type: "application/rss+xml",
    title: "Anime Profile: notícias e artigos",
    href: "/rss.xml",
  },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // O painel (/admin) tem a própria moldura: sem topo, menu, aviso, rodapé nem barra de baixo do site.
  const inAdmin = /^\/admin(\/|$)/.test(useLocation().pathname);
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0d0d10" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarBootstrap }} />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        {inAdmin ? (
          children
        ) : (
          <>
            <a
              href="#conteudo"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
            >
              Pular para o conteúdo
            </a>
            <Header />
            <div className="flex flex-1">
              <SideNav />
              <div className="flex min-w-0 flex-1 flex-col overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
                <AvisoContas />
                <main id="conteudo" className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
            </div>
            <BottomNav />
          </>
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <Outlet />
      <VisitBeacon />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  let details = notFound
    ? "Este endereço não existe ou foi removido. Confira se digitou certo, ou volte para o início."
    : "O servidor não conseguiu montar esta página. Tente de novo em alguns instantes.";
  let stack: string | undefined;
  if (!notFound && import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <>
      <title>{`${notFound ? "Página não encontrada" : "Erro"} | ${SITE.name}`}</title>
      <PageHeader
        label={notFound ? "Erro 404" : "Erro"}
        title={notFound ? "Página não encontrada" : "Algo deu errado"}
        intro={details}
      />
      <div className="mx-auto max-w-[1328px] px-4 py-10 sm:px-8 lg:px-14">
        <Link
          to="/"
          className="inline-block rounded-[9px] bg-brand px-5 py-3 font-bold text-brand-ink hover:brightness-110"
        >
          Voltar para o início
        </Link>
        {stack && (
          <pre className="mt-8 overflow-x-auto rounded-xl bg-sunken p-4 text-xs">
            {stack}
          </pre>
        )}
      </div>
    </>
  );
}
