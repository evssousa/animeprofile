// Sair: só por POST (um link não deve deslogar ninguém). Apaga o cookie de sessão e o marcador e volta para o início.
import { redirect } from "react-router";
import type { Route } from "./+types/sair";
import { logout } from "~/server/admin/auth.server";
import { sameOrigin } from "~/server/http.server";

export function loader() {
  return redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  if (!sameOrigin(request)) return new Response("Origem inválida", { status: 403 });
  const headers = new Headers();
  for (const c of await logout(request)) headers.append("Set-Cookie", c);
  return redirect("/", { headers });
}
