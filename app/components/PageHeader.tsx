/**
 * Cabeçalho das páginas: o único lugar com a retícula de mangá. Título grande em Dela Gothic,
 * carimbo vermelho ao lado e a textura se dissolvendo na diagonal.
 */
export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-line">
      <div className="screentone" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-16 sm:pb-12">
        <div className="flex items-start gap-4">
          <span className="mt-2 hidden size-4 shrink-0 rotate-6 rounded-[3px] bg-hanko sm:block" aria-hidden />
          <div className="min-w-0">
            <h1 className="font-display text-[2.1rem] leading-[1.1] tracking-[-0.015em] text-balance sm:text-5xl">{title}</h1>
            {intro && <p className="mt-4 max-w-[60ch] text-lg text-ink-soft text-pretty">{intro}</p>}
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}
