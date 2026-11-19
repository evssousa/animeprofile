// Telas do painel que ainda não foram feitas (rota coringa de /admin/*). Mostra o nome e a função do item, no formato do antigo.
// Endereços que não são do menu dão 404.
import { data, useLocation } from "react-router";
import { Hammer } from "lucide-react";
import type { Route } from "./+types/em-construcao";
import { adminItem } from "~/lib/admin-nav";

export function loader({ request }: Route.LoaderArgs) {
  if (!adminItem(new URL(request.url).pathname)) throw data("Não encontrado", { status: 404 });
  return null;
}

export default function EmConstrucao() {
  const item = adminItem(useLocation().pathname);
  if (!item) return null;
  const Icon = item.icon;
  return (
    <div>
      <h1 className="text-[1.75rem] font-extrabold tracking-[-0.02em]">{item.label}</h1>
      <p className="mt-1 text-ink-soft">{item.desc}</p>
      <div className="mt-6 flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand dark:text-glow">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="flex items-center gap-2 font-bold">
            <Hammer className="size-4 text-ink-soft" aria-hidden /> Esta tela ainda está sendo construída
          </p>
          <p className="mt-1 text-[0.92rem] text-ink-soft">
            As telas do painel estão sendo refeitas uma por uma, começando pelas que as contas dos usuários exigem. Esta chega na sua vez.
          </p>
        </div>
      </div>
    </div>
  );
}
