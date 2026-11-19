// Moldura do /admin: só entra quem tem a sessão do dono. Sem ela, o login.
import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { AdminShell } from "~/components/admin/AdminShell";
import { requireAdmin } from "~/server/admin/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

export const meta = () => [{ title: "Painel | Anime Profile" }, { name: "robots", content: "noindex, nofollow" }];

export default function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
