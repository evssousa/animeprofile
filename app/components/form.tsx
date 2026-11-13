// Peças de formulário com o visual do site. Rótulo sempre visível, erro abaixo do campo e ligado a
// ele por aria-describedby.
import { useId } from "react";

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

export function TextField({ defaultValue, type = "text", ...props }: BaseProps & { defaultValue?: string; type?: string; autoComplete?: string; maxLength?: number; placeholder?: string }) {
  const id = useId();
  const { label, name, error, hint, optional, ...rest } = props;
  return (
    <Wrapper id={id} label={label} name={name} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} border-line`}
        {...rest}
      />
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

export function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-[9px] bg-brand px-6 py-3 font-bold text-brand-ink hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? "Enviando..." : children}
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
