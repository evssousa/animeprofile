// Papéis de quem está logado (roda no servidor e no navegador). Hoje só existe o administrador; moderador e autor vêm com as contas.
export type Papel = "admin" | "moderator" | "author";

/** Quem entra na área de equipe (menu "Administração"). */
export const EQUIPE: Papel[] = ["admin", "moderator"];

/** Sem `papeisDoItem`, qualquer pessoa logada vê; com, precisa ter algum deles. O admin vê tudo. */
export function podeVer(papeisDoItem: Papel[] | undefined, papeis: readonly string[]): boolean {
  if (!papeisDoItem) return true;
  if (papeis.includes("admin")) return true;
  return papeisDoItem.some((p) => papeis.includes(p));
}
