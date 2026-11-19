// Faixa da equipe no topo (só admin/moderador, a partir de 1280 px): o robô de notícias de hoje e as visitas de hoje, ambos levam ao painel.
// Os números vêm de /api/eu (só com sessão válida); quem forja o cookie marcador não recebe `painel`, então a faixa não aparece.
import { Link } from "react-router";
import { Bot, Eye } from "lucide-react";
import { useViewer } from "./UserMenu";

/** Quando a tela Visitas mudar para /admin/visitas, é só trocar aqui. */
const DESTINO_VISITAS = "/admin";
const DESTINO_ROBO = "/admin";

const pilula = "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 text-[0.8rem] font-semibold text-white/80 tabular-nums hover:bg-white/[0.12] hover:text-white";
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const cheio = new Intl.NumberFormat("pt-BR");

export function PainelEquipeTopo() {
  const v = useViewer();
  const p = v.fase === "pronto" ? v.painel : undefined;
  if (!p) return null;
  const modo = p.robo.modo;
  const texto = modo === "publicar" ? `${p.robo.hoje}/${p.robo.teto}` : modo === "desligado" ? "desligado" : modo;
  const bolinha = modo === "publicar" ? "bg-glow" : modo === "desligado" ? "bg-white/30" : "bg-white/60";
  const rotuloRobo = modo === "publicar" ? `Robô de notícias: ${p.robo.hoje} de ${p.robo.teto} publicadas hoje, modo publicar` : `Robô de notícias: modo ${modo}`;
  return (
    <div className="hidden items-center gap-1.5 xl:equipe:flex!">
      <Link to={DESTINO_ROBO} className={pilula} aria-label={rotuloRobo} title={rotuloRobo}>
        <span className={`size-1.5 rounded-full ${bolinha}`} aria-hidden />
        <Bot className="size-[15px]" aria-hidden />
        {texto}
      </Link>
      <Link to={DESTINO_VISITAS} className={pilula} aria-label={`${cheio.format(p.visitasHoje)} visitantes hoje`} title={`${cheio.format(p.visitasHoje)} visitantes hoje`}>
        <Eye className="size-[15px]" aria-hidden />
        {compacto.format(p.visitasHoje)} hoje
      </Link>
    </div>
  );
}
