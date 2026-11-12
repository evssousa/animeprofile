import { Link } from "react-router";

/** Carimbo da marca + nome. `compact` mostra só o carimbo. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5 rounded-lg" aria-label="Anime Profile, página inicial">
      <img src="/logo-192.png" alt="" width={36} height={36} className="size-9 rounded-[10px] shadow-[0_1px_0_rgba(0,0,0,0.15)]" />
      {!compact && <span className="font-display text-[1.15rem] leading-none tracking-[-0.01em]">Anime Profile</span>}
    </Link>
  );
}
