// Endereços do menu que ainda não foram construídos no site novo (só no endereço de teste).
// Cada página sai da lista em app/routes.ts quando fica pronta.
import { Link } from "react-router";
import type { Route } from "./+types/em-breve";
import { PageHeader } from "~/components/PageHeader";
import { NAV } from "~/lib/nav";

export function loader({ request }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname;
  const item = NAV.flatMap((g) => g.items).find((i) => i.to === path);
  return { path, label: item?.label ?? null };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.label ?? "Em construção"} | Anime Profile` }, { name: "robots", content: "noindex" }];
}

export default function EmBreve({ loaderData }: Route.ComponentProps) {
  const { path, label } = loaderData;
  return (
    <>
      <PageHeader
        title={label ?? "Em construção"}
        intro="Esta parte ainda está sendo construída na versão nova do site. Enquanto isso, ela continua funcionando no site atual."
      />
      <div className="mx-auto flex max-w-6xl flex-wrap gap-3 px-4 py-10 sm:px-6">
        <a href={`https://animeprofile.com.br${path}`} className="rounded-full bg-hanko px-5 py-3 font-semibold text-hanko-ink hover:brightness-110">
          Abrir no site atual
        </a>
        <Link to="/" className="rounded-full border border-line px-5 py-3 font-semibold hover:bg-sunken">
          Voltar para o início
        </Link>
      </div>
    </>
  );
}
