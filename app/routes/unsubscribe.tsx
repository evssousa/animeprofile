// Descadastro de e-mail (/unsubscribe?token=...): o link está nos e-mails já enviados. Por obrigação legal o pedido é
// guardado; na importação das contas ele entra na lista de e-mails suprimidos.
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/unsubscribe";
import { Notice, SubmitButton } from "~/components/form";
import { PageHeader } from "~/components/PageHeader";
import { saveInbox } from "~/server/inbox.server";

const TOKEN_RE = /^[A-Za-z0-9._-]{8,200}$/;

export function loader({ request }: Route.LoaderArgs) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return { token: TOKEN_RE.test(token) ? token : "" };
}

export function meta() {
  return [{ title: "Cancelar e-mails | Anime Profile" }, { name: "robots", content: "noindex" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  if (!TOKEN_RE.test(token)) return { ok: false as const };
  const ok = await saveInbox("descadastro", request, { subject: "Pedido de descadastro", body: "Descadastro pelo link do e-mail.", extra: { token } });
  return { ok };
}

export default function Unsubscribe({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return (
    <>
      <PageHeader label="E-mails" title="Cancelar e-mails do Anime Profile" intro="Confirme para não receber mais e-mails do Anime Profile." />
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-8">
        {actionData?.ok ? (
          <Notice tone="ok">Pronto: você não vai receber mais e-mails do Anime Profile.</Notice>
        ) : !loaderData.token ? (
          <Notice tone="erro">Este link está incompleto. Abra de novo o link do e-mail ou escreva para contato@animeprofile.com.br.</Notice>
        ) : (
          <Form method="post" className="flex flex-col gap-4">
            {actionData && !actionData.ok && <Notice tone="erro">Não deu para registrar agora. Tente de novo daqui a pouco.</Notice>}
            <input type="hidden" name="token" value={loaderData.token} />
            <div>
              <SubmitButton busy={busy}>Cancelar e-mails</SubmitButton>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
