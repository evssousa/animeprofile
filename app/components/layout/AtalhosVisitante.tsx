// Itens do topo para quem NÃO está logado (só no computador): o atalho do calendário de episódios (a partir de 1280 px) e assuntos em alta
// (tags do site, com dado real): 1 a partir de 1400 px, 2 a partir de 1700 e 3 a partir de 1900, para a busca nunca ficar espremida. Somem quando a pessoa está logada (o topo dela tem Check-in, Mensagens, Notificações e a economia).
import { Link } from "react-router";
import { CalendarDays, Hash } from "lucide-react";
import { useAgora } from "~/lib/use-agora";

const chip = "h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[0.82rem] font-semibold whitespace-nowrap text-white/80 hover:bg-white/[0.12] hover:text-white";

const APARECE_EM = ["hidden min-[1400px]:inline-flex", "hidden min-[1700px]:inline-flex", "hidden min-[1900px]:inline-flex"];

export function AtalhosVisitante() {
  const a = useAgora();
  const tags = a.fase === "ok" ? a.dados.emAlta.slice(0, 3) : [];
  return (
    <div className="hidden items-center gap-1.5 xl:flex logado:hidden!">
      {tags.map((t, i) => (
        <Link key={t.slug} to={`/tag/${t.slug}`} className={`${chip} ${APARECE_EM[i]} max-w-[9rem] truncate`} title={`Em alta: ${t.nome}`}>
          <Hash className="size-3.5 shrink-0 text-glow" aria-hidden />
          <span className="truncate">{t.nome}</span>
        </Link>
      ))}
      <Link to="/animes/calendario" className={`${chip} inline-flex`} title="Episódios da semana">
        <CalendarDays className="size-4 text-glow" aria-hidden />
        Calendário
      </Link>
    </div>
  );
}
