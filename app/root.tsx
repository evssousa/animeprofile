import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Footer } from "./components/layout/Footer";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { themeBootstrap } from "./components/layout/ThemeToggle";
import { PageHeader } from "./components/PageHeader";
import { SITE } from "./lib/site";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=M+PLUS+2:wght@400;500;600;700;800&display=swap" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#bb0000" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-hanko focus:px-4 focus:py-2 focus:text-hanko-ink"
        >
          Pular para o conteúdo
        </a>
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main id="conteudo" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
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
      <PageHeader title={notFound ? "Página não encontrada" : "Algo deu errado"} intro={details} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-block rounded-full bg-hanko px-5 py-3 font-semibold text-hanko-ink hover:brightness-110">
          Voltar para o início
        </Link>
        {stack && <pre className="mt-8 overflow-x-auto rounded-xl bg-sunken p-4 text-xs">{stack}</pre>}
      </div>
    </>
  );
}
