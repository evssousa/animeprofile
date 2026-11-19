// O login do painel agora é o /login do site (uma porta de entrada só).
import { redirect } from "react-router";

export function loader() {
  return redirect("/login?redirect=/admin");
}
