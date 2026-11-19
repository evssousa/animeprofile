// Peças de formulário com o visual do site. Rótulo sempre visível, erro abaixo do campo e ligado a
// ele por aria-describedby.
import { useId, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, type LucideIcon } from "lucide-react";

const control =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[1rem] placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-link/40 aria-[invalid=true]:border-brand";

type BaseProps = { label: string; name: string; error?: string; hint?: string; optional?: boolean };

function Wrapper({ id, label, error, hint, optional, children }: BaseProps & { id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-soft">(opcional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.9rem] text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.9rem] font-medium text-brand">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({ defaultValue, type = "text", icon: Icon, ...props }: BaseProps & { defaultValue?: string; type?: string; autoComplete?: string; maxLength?: number; placeholder?: string; icon?: LucideIcon }) {
  const id = useId();
  const { label, name, error, hint, optional, ...rest } = props;
  return (
    <Wrapper id={id} label={label} name={name} error={error} hint={hint} optional={optional}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />}
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={!optional}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${control} border-line ${Icon ? "pl-10" : ""}`}
          {...rest}
        />
      </div>
    </Wrapper>
  );
}

/** Campo de senha: cadeado à esquerda e olho para mostrar ou esconder à direita. */
export function PasswordField(props: BaseProps & { autoComplete?: string; maxLength?: number; placeholder?: string }) {
  const id = useId();
  const [visivel, setVisivel] = useState(false);
  const { label, name, error, hint, optional, ...rest } = props;
  return (
    <Wrapper id={id} label={label} name={name} error={error} hint={hint} optional={optional}>
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          id={id}
          name={name}
          type={visivel ? "text" : "password"}
          required={!optional}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${control} border-line pr-12 pl-10`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-soft hover:bg-sunken hover:text-ink"
        >
          {visivel ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      </div>
    </Wrapper>
  );
}

export function TextArea({ defaultValue, rows = 6, ...props }: BaseProps & { defaultValue?: string; rows?: number; maxLength?: number; placeholder?: string }) {
  const id = useId();
  const { label, name, error, hint, optional, ...rest } = props;
  return (
    <Wrapper id={id} label={label} name={name} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} border-line resize-y`}
        {...rest}
      />
    </Wrapper>
  );
}

export function Select({ options, defaultValue, ...props }: BaseProps & { options: { value: string; label: string }[]; defaultValue?: string }) {
  const id = useId();
  const { label, name, error, hint, optional } = props;
  return (
    <Wrapper id={id} label={label} name={name} error={error} hint={hint} optional={optional}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} border-line`}
      >
        <option value="" disabled>
          Escolha uma opção
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

/** Campo-isca: invisível para pessoas, preenchido por robôs. */
export function Honeypot() {
  return (
    <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
      <label>
        Site
        <input type="text" name="site" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function SubmitButton({ busy, children, className = "", busyLabel = "Enviando..." }: { busy: boolean; children: React.ReactNode; className?: string; busyLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`inline-flex items-center justify-center gap-2 rounded-[9px] bg-brand px-6 py-3 font-bold text-brand-ink hover:brightness-110 disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      {busy && <Loader2 className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden />}
      {busy ? busyLabel : children}
    </button>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "erro" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 ${tone === "ok" ? "border-link/40 bg-link/10" : "border-brand/40 bg-brand/10"}`}
    >
      {children}
    </div>
  );
}
