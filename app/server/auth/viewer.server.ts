// Quem está logado. Fase 1 das contas (2026-11-19): só existe o administrador das variáveis de ambiente.
// Na fase 2 esta função passa a ler a sessão do banco e `user_roles`; quem chama (`requireAdmin`, `/api/eu`) não muda.
import { redirect } from "react-router";
import { isAdmin } from "../admin/auth.server";
import { sameOrigin } from "../http.server";

export type Papel = "admin" | "moderator" | "author";
export type Viewer = { id: string; nome: string; inicial: string; papeis: Papel[] };

export async function getViewer(request: Request): Promise<Viewer | null> {
  if (await isAdmin(request)) return { id: "admin", nome: "Administrador", inicial: "A", papeis: ["admin"] };
  return null;
}

export const hasRole = (v: Viewer | null | undefined, papel: Papel) => !!v?.papeis.includes(papel);

/** Exige o papel admin; sem ele, manda para o login. Em ações (POST), confere também a origem. */
export async function requireAdmin(request: Request): Promise<Viewer> {
  const viewer = await getViewer(request);
  if (!hasRole(viewer, "admin")) throw redirect("/login?redirect=/admin");
  if (request.method !== "GET" && !sameOrigin(request)) throw new Response("Origem inválida", { status: 403 });
  return viewer!;
}
