// Login (/login), no formato do site antigo. Fase 1 das contas (2026-11-19): só o administrador entra; sem cadastro.
// Contas de todos, "esqueci a senha" e o Google voltam nas próximas fases (docs/plano-contas-login.md).
import { useEffect, useRef } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Clock, Info, Mail } from "lucide-react";
import type { Route } from "./+types/login";
import { Honeypot, Notice, PasswordField, SubmitButton, TextField } from "~/components/form";
import { safeRedirect } from "~/lib/safe-redirect";
import { login, registerFail } from "~/server/admin/auth.server";
import { getViewer } from "~/server/auth/viewer.server";
import { clientIp, sameOrigin } from "~/server/http.server";

export const meta = () => [{ title: "Entrar | Anime Profile" }, { name: "robots", content: "noindex, follow" }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await getViewer(request)) throw redirect(safeRedirect(new URL(request.url).searchParams.get("redirect")));
  return null;
}

type Erro = "credenciais" | "bloqueado" | "origem" | "config";
const MENSAGENS: Record<Erro, string> = {
  credenciais: "E-mail ou senha incorretos.",
  bloqueado: "Muitas tentativas. Espere 15 minutos e tente de novo.",
  origem: "Pedido recusado. Recarregue a página e tente de novo.",
  config: "O login está indisponível agora. Tente mais tarde.",
};

export async function action({ request }: Route.ActionArgs) {
  if (!sameOrigin(request)) return data({ erro: "origem" as Erro, email: "" }, { status: 403 });
  const form = await request.formData();
  const email = String(form.get("email") ?? "").slice(0, 255);
  // campo-isca preenchido: é robô; conta como tentativa errada e responde como se a senha estivesse errada
  if (String(form.get("site") ?? "")) {
    registerFail(clientIp(request) || "local");
    return data({ erro: "credenciais" as Erro, email }, { status: 401 });
  }
  const result = await login(request, email, String(form.get("senha") ?? "").slice(0, 200));
  if (!result.ok) return data({ erro: result.error as Erro, email }, { status: result.error === "bloqueado" ? 429 : result.error === "config" ? 503 : 401 });
  const headers = new Headers();
  for (const c of result.cookies) headers.append("Set-Cookie", c);
  return redirect(safeRedirect(new URL(request.url).searchParams.get("redirect")), { headers });
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Login({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const erro = actionData?.erro as Erro | undefined;
  const avisoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erro) avisoRef.current?.focus();
  }, [erro, actionData]);
  return (
    <div className="flex min-h-[calc(100dvh-72px)] items-center justify-center bg-[radial-gradient(60%_45%_at_50%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent)] px-4 py-10 sm:py-16 dark:bg-[radial-gradient(60%_45%_at_50%_0%,color-mix(in_oklab,var(--brand)_16%,transparent),transparent)]">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="rounded-2xl" aria-label="Anime Profile, página inicial">
            <img
              src="/logo-192.png"
              alt=""
              width={72}
              height={72}
              className="size-16 rounded-2xl shadow-[0_12px_32px_rgba(194,53,43,.25)] ring-2 ring-brand/20 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none sm:size-[72px]"
            />
          </Link>
          <p className="mt-3 text-[1.6rem] leading-tight font-extrabold tracking-[-0.02em]">
            Anime <span className="text-brand dark:text-glow">Profile</span>
          </p>
          <p className="mt-1 text-[0.72rem] font-semibold tracking-[0.2em] text-ink-soft uppercase">Sua comunidade otaku</p>
          <h1 className="mt-6 text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-[2rem]">Entrar na conta</h1>
          <p className="mt-1.5 max-w-[300px] text-ink-soft">Continue de onde parou.</p>
        </div>

        <div className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-[0_20px_50px_-20px_rgba(28,20,20,.18)] sm:p-8 dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,.6)]">
          <div role="note" className="flex gap-3 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-[0.9rem]">
            <Info className="mt-0.5 size-[18px] shrink-0 text-brand dark:text-glow" aria-hidden />
            <p>
              As contas da comunidade voltam em breve. Por enquanto, só a equipe entra por aqui. O que é seu está guardado.{" "}
              <Link to="/site-novo" className="font-semibold text-link underline">
                Saiba mais
              </Link>
            </p>
          </div>

          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Volta junto com as contas"
            className="mt-6 flex h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-line bg-surface opacity-60"
          >
            <GoogleG />
            <span className="truncate font-semibold">Continuar com Google</span>
            <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-ink-soft uppercase">Em breve</span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[0.7rem] font-bold tracking-[0.18em] text-ink-soft uppercase">Ou entre com e-mail</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Form method="post" replace className="relative flex flex-col gap-4">
            {erro && (
              <div ref={avisoRef} tabIndex={-1} className="outline-none">
                <Notice tone="erro">
                  <span className="flex items-start gap-2">
                    {erro === "bloqueado" && <Clock className="mt-0.5 size-[18px] shrink-0" aria-hidden />}
                    {MENSAGENS[erro]}
                  </span>
                </Notice>
              </div>
            )}
            <Honeypot />
            <TextField label="E-mail" name="email" type="email" icon={Mail} autoComplete="username" placeholder="voce@email.com" maxLength={255} defaultValue={actionData?.email} />
            <PasswordField label="Senha" name="senha" autoComplete="current-password" maxLength={200} />
            <SubmitButton busy={busy} busyLabel="Entrando..." className="h-12 w-full shadow-[0_8px_24px_rgba(194,53,43,.35)]">
              Entrar
            </SubmitButton>
          </Form>
        </div>

        <p className="mt-6 text-center text-[0.95rem] text-ink-soft">
          Ainda não tem conta? O cadastro volta em breve.{" "}
          <Link to="/site-novo" className="font-semibold text-link underline">
            Saiba mais
          </Link>
        </p>
        <p className="mt-3 text-center text-[0.8rem] text-ink-soft">
          Ao entrar, você aceita os{" "}
          <Link to="/legal/termos" className="text-link underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link to="/legal/privacidade" className="text-link underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
