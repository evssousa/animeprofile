import { Form, useNavigation } from "react-router";
import { Mail } from "lucide-react";
import type { Route } from "./+types/contato";
import { Honeypot, Notice, Select, SubmitButton, TextArea, TextField } from "~/components/form";
import { PageHeader } from "~/components/PageHeader";
import { seo } from "~/lib/seo";
import { SITE } from "~/lib/site";
import { field, saveMessage, validate, type FieldErrors } from "~/server/contact.server";

const SUBJECTS = [
  { value: "duvida", label: "Dúvida ou sugestão" },
  { value: "suporte", label: "Problema com conta, AP Coins, figurinhas ou pagamento" },
  { value: "correcao", label: "Correção em uma matéria" },
  { value: "parceria", label: "Parceria ou imprensa" },
  { value: "outro", label: "Outro assunto" },
];

export function meta() {
  return seo({
    title: "Contato",
    description: "Fale com a equipe do Anime Profile: dúvidas, suporte, correções, parcerias e imprensa.",
    path: "/contato",
  });
}

type ActionData = { sent: true } | { sent: false; errors: FieldErrors; values: Record<string, string>; message?: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const form = await request.formData();
  const values = { name: field(form, "name"), email: field(form, "email"), subject: field(form, "subject"), body: field(form, "body") };
  if (field(form, "site")) return { sent: true }; // robô: finge que deu certo
  const subject = SUBJECTS.find((s) => s.value === values.subject);
  const errors = validate({ ...values, subject: subject?.label ?? "" });
  if (Object.keys(errors).length) return { sent: false, errors, values };
  const result = await saveMessage("contato", { ...values, subject: subject!.label }, request);
  if (result.ok) return { sent: true };
  return {
    sent: false,
    errors: {},
    values,
    message:
      result.reason === "limite"
        ? `Você enviou várias mensagens na última hora. Espere um pouco ou escreva para ${SITE.email}.`
        : `O formulário está fora do ar agora. Escreva direto para ${SITE.email}.`,
  };
}

export default function Contato({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const failed = actionData && !actionData.sent ? actionData : null;
  return (
    <>
      <PageHeader
        title="Contato"
        intro="Dúvidas, problemas na conta, correções, parcerias ou imprensa: a equipe lê todas as mensagens e responde pelo e-mail que você informar."
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="form-title" className="max-w-2xl">
          <h2 id="form-title" className="font-display text-2xl">
            Mande uma mensagem
          </h2>
          {actionData?.sent ? (
            <div className="mt-6">
              <Notice tone="ok">
                <p className="font-semibold">Mensagem enviada.</p>
                <p className="mt-1 text-ink-soft">A resposta chega no e-mail que você informou. Confira também a caixa de spam.</p>
              </Notice>
            </div>
          ) : (
            <Form method="post" className="relative mt-6 flex flex-col gap-5" noValidate>
              {failed?.message && <Notice tone="erro">{failed.message}</Notice>}
              <Honeypot />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Nome" name="name" autoComplete="name" maxLength={100} defaultValue={failed?.values.name} error={failed?.errors.name} />
                <TextField label="E-mail" name="email" type="email" autoComplete="email" maxLength={255} defaultValue={failed?.values.email} error={failed?.errors.email} />
              </div>
              <Select label="Assunto" name="subject" options={SUBJECTS} defaultValue={failed?.values.subject} error={failed?.errors.subject} />
              <TextArea
                label="Mensagem"
                name="body"
                maxLength={4000}
                rows={7}
                defaultValue={failed?.values.body}
                error={failed?.errors.body}
                hint="Se for sobre uma matéria ou um perfil, cole o link. Se for sobre sua conta, informe o @ do seu perfil."
              />
              <div className="flex flex-wrap items-center gap-4">
                <SubmitButton busy={busy}>Enviar mensagem</SubmitButton>
                <p className="text-[0.9rem] text-ink-soft">
                  Ao enviar, você concorda com a{" "}
                  <a href="/legal/privacidade" className="text-ai underline underline-offset-2">
                    Política de Privacidade
                  </a>
                  .
                </p>
              </div>
            </Form>
          )}
        </section>
        <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
          <Mail className="size-6 text-hanko" aria-hidden />
          <h2 className="mt-3 font-bold">Prefere e-mail?</h2>
          <p className="mt-1 text-[0.95rem] text-ink-soft">Escreva para o mesmo endereço, sobre qualquer assunto.</p>
          <a href={`mailto:${SITE.email}`} className="mt-3 inline-block font-semibold break-all text-ai underline underline-offset-2">
            {SITE.email}
          </a>
          <p className="mt-5 text-[0.95rem] text-ink-soft">
            Para exportar seus dados ou excluir a conta, use a área de Privacidade do seu perfil, que resolve na hora.
          </p>
        </aside>
      </div>
    </>
  );
}
