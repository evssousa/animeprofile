// /blog/criadores → /blog (302, temporário: o ranking de criadores depende da economia, AP e Rubis ganhos).
import { redirect } from "react-router";

export function loader() {
  return redirect("/blog", 302);
}
