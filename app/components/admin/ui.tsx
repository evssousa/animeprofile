// Kit visual do painel /admin (docs/plano-telas-painel.md, "Base visual"): o mesmo jeito do painel de Visitas em todas as telas.
// Cartões brancos com borda fina, vermelho só no que é ação ou ativo, números com tabular-nums. Entram aqui só os componentes
// que as telas feitas já usam; os demais (Abas, Interruptor, Confirmar...) entram junto com a primeira tela que precisar deles.
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";

export function Cabecalho({ titulo, desc, acoes }: { titulo: string; desc?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em]">{titulo}</h1>
        {desc && <p className="mt-1 max-w-3xl text-[0.9rem] text-ink-soft">{desc}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({ titulo, icone: Icone, dica, acao, className = "", children }: { titulo?: string; icone?: LucideIcon; dica?: ReactNode; acao?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-[14px] border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,20,.06)] sm:p-5 dark:shadow-none ${className}`}>
      {(titulo || acao) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo && (
              <h2 className="flex items-center gap-2 text-[1rem] font-bold">
                {Icone && (
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand dark:text-glow">
                    <Icone className="size-4" aria-hidden />
                  </span>
                )}
                {titulo}
              </h2>
            )}
            {dica && <p className="mt-0.5 text-[0.75rem] text-ink-soft">{dica}</p>}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

type Tom = "ok" | "aviso" | "info" | "erro" | "neutro";
const TONS: Record<Tom, string> = {
  ok: "bg-ok-soft text-ok",
  aviso: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  erro: "bg-brand-soft text-brand dark:text-glow",
  neutro: "bg-sunken text-ink-soft",
};

export function Selo({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.7rem] font-bold tracking-[0.06em] uppercase ${TONS[tom]}`}>{children}</span>;
}

/** Cartão de número. `escuro` = o número que mais importa da tela (no máximo um por tela). */
export function Numero({ rotulo, valor, sub, escuro, href, children }: { rotulo: string; valor: ReactNode; sub?: ReactNode; escuro?: boolean; href?: string; children?: ReactNode }) {
  const corpo = (
    <>
      <p className={`text-[0.7rem] font-bold tracking-[0.08em] uppercase ${escuro ? "text-glow" : "text-ink-soft"}`}>{rotulo}</p>
      <p className={`mt-1 font-extrabold tracking-[-0.02em] tabular-nums ${escuro ? "text-[2.75rem] leading-none" : "text-[2rem] leading-tight"}`}>{valor}</p>
      {sub && <p className={`mt-1 text-[0.8rem] ${escuro ? "text-night-ink/70" : "text-ink-soft"}`}>{sub}</p>}
      {children}
    </>
  );
  const base = `block rounded-[14px] p-4 ${escuro ? "bg-night text-night-ink" : "border border-line bg-surface shadow-[0_1px_2px_rgba(28,20,20,.06)] dark:shadow-none"}`;
  return href ? (
    <Link to={href} className={`${base} transition-colors hover:border-ink/20 motion-reduce:transition-none`}>
      {corpo}
    </Link>
  ) : (
    <div className={base}>{corpo}</div>
  );
}

export function Vazio({ icone: Icone, titulo, texto, acao }: { icone?: LucideIcon; titulo: string; texto?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      {Icone && <Icone className="size-7 text-ink-soft/50" aria-hidden />}
      <p className="mt-2 text-[0.95rem] font-bold">{titulo}</p>
      {texto && <p className="mt-0.5 max-w-sm text-[0.8rem] text-ink-soft">{texto}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

const BOTOES = {
  primario: "bg-brand text-brand-ink hover:bg-[#a92c23]",
  secundario: "border border-line bg-surface text-ink hover:bg-sunken",
  perigo: "border border-brand/40 text-brand hover:bg-brand-soft dark:text-glow",
  fantasma: "text-ink-soft hover:bg-sunken hover:text-ink",
} as const;

/** Botão (ou link, se vier `href`). `ocupado` troca o ícone por um círculo girando e trava o clique. */
export function Botao({ variante = "secundario", icone: Icone, ocupado, href, className = "", children, ...resto }: { variante?: keyof typeof BOTOES; icone?: LucideIcon; ocupado?: boolean; href?: string; className?: string; children: ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  const classes = `inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.9rem] font-bold whitespace-nowrap transition-colors disabled:opacity-50 sm:h-10 motion-reduce:transition-none ${BOTOES[variante]} ${className}`;
  const icone = ocupado ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : Icone ? <Icone className="size-4" aria-hidden /> : null;
  if (href)
    return (
      <Link to={href} className={classes}>
        {icone}
        {children}
      </Link>
    );
  return (
    <button {...resto} type={resto.type ?? "button"} disabled={ocupado || resto.disabled} aria-busy={ocupado || undefined} className={classes}>
      {icone}
      {children}
    </button>
  );
}

/** Aviso do painel. `aviso` = âmbar (precisa de atenção); `erro` e `ok` como no resto do site. */
export function Aviso({ tom = "aviso", children }: { tom?: "aviso" | "erro" | "ok" | "info"; children: ReactNode }) {
  const cls = { aviso: "border-warn/40 bg-warn-soft", erro: "border-brand/40 bg-brand-soft", ok: "border-ok/40 bg-ok-soft", info: "border-info/40 bg-info-soft" }[tom];
  const cor = { aviso: "text-warn", erro: "text-brand dark:text-glow", ok: "text-ok", info: "text-info" }[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-3 text-[0.9rem] ${cls}`}>
      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${cor}`} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Confirmação em diálogo nativo (no lugar do window.confirm). `Esc` e clique no fundo cancelam; o foco começa em "Cancelar". */
export function Confirmar({ aberto, titulo, texto, botao, tom = "perigo", onConfirmar, onCancelar }: { aberto: boolean; titulo: string; texto: ReactNode; botao: string; tom?: "perigo" | "primario"; onConfirmar: () => void; onCancelar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancelar();
      }}
      onClick={(e) => e.target === ref.current && onCancelar()}
      aria-labelledby="confirmar-titulo"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)] backdrop:bg-black/60"
    >
      <h2 id="confirmar-titulo" className="text-[1.1rem] font-extrabold">
        {titulo}
      </h2>
      <div className="mt-2 text-[0.9rem] text-ink-soft">{texto}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Botao autoFocus variante="secundario" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao variante={tom} onClick={onConfirmar}>
          {botao}
        </Botao>
      </div>
    </dialog>
  );
}

/** Abas com sublinhado (links). `n` é o contador ao lado do rótulo. */
export function Abas({ itens, ativo }: { itens: { id: string; rotulo: string; href: string; n?: number }[]; ativo: string }) {
  return (
    <nav aria-label="Abas" className="flex overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {itens.map((i) => (
        <Link
          key={i.id}
          to={i.href}
          aria-current={i.id === ativo ? "page" : undefined}
          className={`inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-[0.9rem] font-semibold whitespace-nowrap ${i.id === ativo ? "border-brand text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
        >
          {i.rotulo}
          {i.n !== undefined && <span className="ml-1.5 text-[0.75rem] font-normal tabular-nums opacity-70">{new Intl.NumberFormat("pt-BR").format(i.n)}</span>}
        </Link>
      ))}
    </nav>
  );
}
