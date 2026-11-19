// Moldura do /admin: só entra quem tem a sessão do dono. Sem ela, o login. A barra lateral é filtrada aqui, no servidor.
import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { AdminShell } from "~/components/admin/AdminShell";
import { adminNavVisivel } from "~/lib/admin-nav";
import { requireAdmin } from "~/server/auth/viewer.server";

export async function loader({ request }: Route.LoaderArgs) {
  const v = await requireAdmin(request);
  return { nome: v.nome, inicial: v.inicial, papeis: v.papeis };
}

export const meta = () => [{ title: "Painel | Anime Profile" }, { name: "robots", content: "noindex, nofollow" }];

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { nome, inicial, papeis } = loaderData;
  return (
    <AdminShell grupos={adminNavVisivel(papeis)} conta={{ nome, inicial }}>
      <Outlet />
    </AdminShell>
  );
}
