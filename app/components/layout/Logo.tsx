import { Link } from "react-router";

/** Logo + nome. Fica sobre fundo escuro (topo) ou claro (rodapé): a cor do texto vem de quem usa. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Anime Profile, página inicial">
      <img src="/logo-192.png" alt="" width={38} height={38} className="size-[38px] rounded-[10px]" />
      {!compact && <span className="hidden text-[1.2rem] leading-none font-extrabold tracking-[-0.02em] min-[420px]:inline">Anime Profile</span>}
    </Link>
  );
}
