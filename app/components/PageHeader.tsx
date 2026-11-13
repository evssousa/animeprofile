/**
 * Cabeçalho das páginas internas: continua a faixa escura do topo e termina com cantos arredondados,
 * como a capa cinematográfica da página inicial. `label` é o rótulo vermelho acima do título.
 */
export function PageHeader({ title, intro, label, children }: { title: string; intro?: string; label?: string; children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-b-[28px] bg-night text-night-ink shadow-[0_24px_50px_rgba(60,20,20,.16)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(620px_320px_at_85%_0%,rgba(194,53,43,.38),rgba(13,13,16,0)_70%)]"
      />
      <div className="relative mx-auto max-w-[1328px] px-4 pt-8 pb-12 sm:px-8 sm:pt-10 sm:pb-14 lg:px-14">
        {label && <p className="mb-3 text-[0.85rem] font-bold text-glow">{label}</p>}
        <h1 className="max-w-[22ch] text-[2.2rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance sm:text-[3.2rem]">{title}</h1>
        {intro && <p className="mt-4 max-w-[62ch] text-[1.05rem] leading-relaxed text-white/80 text-pretty sm:text-lg">{intro}</p>}
        {children}
      </div>
    </header>
  );
}
