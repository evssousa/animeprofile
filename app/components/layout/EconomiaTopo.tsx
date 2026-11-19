// Chips da economia no topo de quem está logado (só no computador, como no site antigo): sequência de check-in, AP Coins e Rubis.
// No celular o topo fica só com Check-in, Mensagens e Notificações. Os números vêm de /api/eu.
import { Link } from "react-router";
import { Coins, Flame, Gem } from "lucide-react";
import { useViewer } from "./UserMenu";

const nf = new Intl.NumberFormat("pt-BR");
const chip = "inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[0.8rem] font-bold whitespace-nowrap tabular-nums hover:bg-white/[0.12]";

export function EconomiaTopo() {
  const v = useViewer();
  const e = v.fase === "pronto" ? v.economia : undefined;
  if (!e) return null;
  return (
    <div className="hidden items-center gap-1.5 xl:logado:flex!" aria-label="Seus números">
      <Link to="/check-in" className={`${chip} text-white/85`} title={`Sequência de check-in: ${nf.format(e.sequencia)} ${e.sequencia === 1 ? "dia" : "dias"}`} aria-label={`Sequência de check-in: ${nf.format(e.sequencia)} dias`}>
        <Flame className="size-4 text-orange-400" aria-hidden />
        {nf.format(e.sequencia)}
      </Link>
      <Link to="/loja" className={`${chip} text-amber-300`} title={`${nf.format(e.apCoins)} AP Coins`} aria-label={`${nf.format(e.apCoins)} AP Coins`}>
        <Coins className="size-4" aria-hidden />
        {nf.format(e.apCoins)}
      </Link>
      <Link to="/loja" className={`${chip} text-glow`} title={`${nf.format(e.rubis)} Rubis`} aria-label={`${nf.format(e.rubis)} Rubis`}>
        <Gem className="size-4" aria-hidden />
        {nf.format(e.rubis)}
      </Link>
    </div>
  );
}
