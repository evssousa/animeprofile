import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { SITE } from "./lib/site";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#bb0000" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen antialiased">
        {children}
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
  let details = notFound ? "A página que você procura não existe ou foi removida." : "Algo deu errado do nosso lado. Tente de novo em instantes.";
  let stack: string | undefined;
  if (!notFound && import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <title>{`${notFound ? "Página não encontrada" : "Erro"} | ${SITE.name}`}</title>
      <p className="text-sm font-semibold text-brand">{notFound ? "Erro 404" : "Erro"}</p>
      <h1 className="mt-3 text-4xl font-extrabold">{notFound ? "Página não encontrada" : "Algo deu errado"}</h1>
      <p className="mt-4 text-muted">{details}</p>
      <Link to="/" className="mt-8 inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white">
        Voltar para o início
      </Link>
      {stack && <pre className="mt-8 overflow-x-auto rounded-xl bg-card p-4 text-xs">{stack}</pre>}
    </main>
  );
}
