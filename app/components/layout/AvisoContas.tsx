// Faixa fixa no topo de todas as páginas enquanto as contas não voltam. Sem botão de fechar (não exige cookie e não
// pisca no SSR); sai do código quando as contas voltarem.
import { Link } from "react-router";

export function AvisoContas() {
  return (
    <div className="bg-brand-soft text-ink">
      <p className="mx-auto flex min-h-10 max-w-[1328px] flex-wrap items-center justify-center gap-x-2 px-4 py-2 text-center text-[0.85rem] sm:text-[0.9rem] sm:px-8 lg:px-14">
        <span className="sm:hidden">Login e AP Coins voltam em breve.</span>
        <span className="hidden sm:inline">Site novo no ar. Login, AP Coins e comentários voltam em breve, e o que é seu está guardado.</span>
        <Link to="/site-novo" className="font-semibold text-link underline">
          Saiba mais
        </Link>
      </p>
    </div>
  );
}
