// Faixa que rola para o lado no celular (cartões a 78% da largura, com encaixe) e vira grade a partir de `sm`, como as
// listas da home do site antigo. `className` traz as colunas da grade (ex.: "sm:grid-cols-2 lg:grid-cols-4").
export function MobileRow({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      className={`-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:gap-x-5 sm:gap-y-8 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {children}
    </div>
  );
}

/** Um item da faixa. `poster`: pôster de anime (mostra 2 e meio, convidando a arrastar). */
export function MobileRowItem({ children, poster = false }: { children: React.ReactNode; poster?: boolean }) {
  return <div className={`shrink-0 snap-start sm:w-auto ${poster ? "w-[38%]" : "w-[78%]"}`}>{children}</div>;
}
