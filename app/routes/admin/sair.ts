// Sair do painel: só por POST (um link não deve deslogar ninguém).
import { redirect } from "react-router";
import type { Route } from "./+types/sair";
import { logout } from "~/server/admin/auth.server";
import { sameOrigin } from "~/server/http.server";

export function loader() {
  return redirect("/admin");
}

export async function action({ request }: Route.ActionArgs) {
  if (!sameOrigin(request)) return new Response("Origem inválida", { status: 403 });
  return redirect("/admin/login", { headers: { "Set-Cookie": await logout(request) } });
}
