// Login do painel (/admin/login): e-mail e senha do dono, definidos no hPanel. Sem o topo do site.
import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { Notice, SubmitButton, TextField } from "~/components/form";
import { Logo } from "~/components/layout/Logo";
import { adminConfig, isAdmin, login } from "~/server/admin/auth.server";
import { sameOrigin } from "~/server/http.server";

export const meta = () => [{ title: "Entrar no painel | Anime Profile" }, { name: "robots", content: "noindex, nofollow" }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAdmin(request)) throw redirect("/admin");
  const cfg = adminConfig();
  return { ready: cfg.ready, problems: cfg.problems };
}

export async function action({ request }: Route.ActionArgs) {
  if (!sameOrigin(request)) return { error: "Pedido recusado." };
  const form = await request.formData();
  const result = await login(request, String(form.get("email") ?? ""), String(form.get("senha") ?? ""));
  if (!result.ok) return { error: result.error };
  return redirect("/admin", { headers: { "Set-Cookie": result.cookie } });
}

export default function AdminLogin({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return (
    <div className="min-h-dvh bg-paper px-4 py-10 text-ink">
      <div className="mx-auto max-w-sm">
        <div className="flex h-16 items-center justify-center rounded-2xl bg-night text-night-ink">
          <Logo />
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-[1.25rem] font-extrabold">Painel do Anime Profile</h1>
          {loaderData.ready ? (
            <Form method="post" className="mt-5 flex flex-col gap-4" noValidate>
              {actionData?.error && <Notice tone="erro">{actionData.error}</Notice>}
              <TextField label="E-mail" name="email" type="email" autoComplete="username" maxLength={255} />
              <TextField label="Senha" name="senha" type="password" autoComplete="current-password" maxLength={200} />
              <SubmitButton busy={busy}>Entrar</SubmitButton>
            </Form>
          ) : (
            <div className="mt-4 text-[0.95rem]">
              <p className="font-semibold">Painel ainda não configurado.</p>
              <ul className="mt-2 list-disc pl-5 text-ink-soft">
                {loaderData.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-3 text-ink-soft">Depois de salvar no hPanel, o app reinicia; recarregue esta página.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
