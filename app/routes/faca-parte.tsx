import { Form, useNavigation } from "react-router";
import { Camera, Code2, Megaphone, Palette, PenSquare, Shield, type LucideIcon } from "lucide-react";
import type { Route } from "./+types/faca-parte";
import { Honeypot, Notice, SubmitButton, TextArea, TextField } from "~/components/form";
import { PageHeader } from "~/components/PageHeader";
import { seo } from "~/lib/seo";
import { SITE } from "~/lib/site";
import { field, saveMessage, validate, type FieldErrors } from "~/server/contact.server";

const ROLES: { id: string; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "redacao", label: "Redação", icon: PenSquare, desc: "Escrever notícias, análises, reviews e listas sobre anime, mangá, games e cultura otaku." },
  { id: "design", label: "Design e ilustração", icon: Palette, desc: "Criar capas, banners, figurinhas, artes de campanha e a identidade visual do site." },
  { id: "social", label: "Redes sociais", icon: Megaphone, desc: "Cuidar do Instagram, do X e do TikTok e conversar com a comunidade." },
  { id: "moderacao", label: "Moderação", icon: Shield, desc: "Manter o feed, o blog e os comentários saudáveis, revisar denúncias e aplicar as regras." },
  { id: "audiovisual", label: "Foto e vídeo", icon: Camera, desc: "Produzir vídeos, coberturas, entrevistas e conteúdo para YouTube e Shorts." },
  { id: "dev", label: "Desenvolvimento", icon: Code2, desc: "Colaborar com recursos novos, correções, gamificação e novas áreas do site." },
];

const LOOKING_FOR = [
  "Interesse de verdade por anime, mangá e cultura otaku.",
  "Compromisso com os prazos combinados e conversa pelo Discord.",
  "Respeito à diversidade da comunidade e aos padrões editoriais do site.",
  "16 anos ou mais. Menores de 18 precisam de autorização dos responsáveis e não lidam com dados de usuários.",
];

export function meta() {
  return seo({
    title: "Faça parte da equipe",
    description: "Quer trabalhar com anime, mangá e comunidade otaku? Candidate-se para a equipe do Anime Profile: redação, design, redes sociais, moderação, vídeo e desenvolvimento.",
    path: "/faca-parte",
  });
}

type ActionData = { sent: true } | { sent: false; errors: FieldErrors; values: Record<string, string>; message?: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const form = await request.formData();
  const values = {
    name: field(form, "name"),
    email: field(form, "email"),
    role: field(form, "role"),
    handle: field(form, "handle").slice(0, 150),
    portfolio: field(form, "portfolio").slice(0, 300),
    body: field(form, "body"),
  };
  if (field(form, "site")) return { sent: true };
  const role = ROLES.find((r) => r.id === values.role);
  const errors = validate({ name: values.name, email: values.email, subject: role?.label ?? "", body: values.body }, { minBody: 20 });
  if (errors.subject) errors.role = "Escolha uma área.";
  if (Object.keys(errors).length) return { sent: false, errors, values };
  const result = await saveMessage(
    "faca-parte",
    { name: values.name, email: values.email, subject: `Candidatura: ${role!.label}`, body: values.body, extra: { area: role!.label, redes: values.handle, portfolio: values.portfolio } },
    request,
  );
  if (result.ok) return { sent: true };
  return {
    sent: false,
    errors: {},
    values,
    message: result.reason === "limite" ? `Muitos envios na última hora. Tente mais tarde ou escreva para ${SITE.email}.` : `O formulário está fora do ar agora. Escreva para ${SITE.email}.`,
  };
}

export default function FacaParte({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const failed = actionData && !actionData.sent ? actionData : null;
  return (
    <>
      <PageHeader
        title="Faça parte da equipe"
        intro="O Anime Profile é feito por fãs, para fãs. Se você quer ajudar o site a crescer, escolha uma área e conte um pouco sobre você."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="max-w-[68ch] text-[1.05rem] text-ink-soft">
          A maior parte das vagas é voluntária, com benefícios dentro do site (AP Coins, cargos especiais e acesso antes de todo mundo às novidades) e a chance
          de participar da rotina editorial e do produto. Algumas funções podem passar a ser remuneradas conforme o projeto cresce.
        </p>

        {actionData?.sent ? (
          <div className="mt-10 max-w-2xl">
            <Notice tone="ok">
              <p className="font-semibold">Candidatura enviada.</p>
              <p className="mt-1 text-ink-soft">A equipe vai analisar e responder no e-mail que você informou.</p>
            </Notice>
          </div>
        ) : (
          <Form method="post" className="relative mt-10 flex flex-col gap-10" noValidate>
            <Honeypot />
            <fieldset>
              <legend className="font-display text-2xl">Escolha uma área</legend>
              {failed?.errors.role && <p className="mt-2 font-medium text-hanko">{failed.errors.role}</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ROLES.map(({ id, label, icon: Icon, desc }) => (
                  <label
                    key={id}
                    className="group relative flex cursor-pointer gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-ink-soft has-[:checked]:border-hanko has-[:checked]:shadow-[inset_0_0_0_1px_var(--hanko)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ai/50"
                  >
                    <input type="radio" name="role" value={id} defaultChecked={failed?.values.role === id} className="sr-only" />
                    <Icon className="mt-0.5 size-5 shrink-0 text-ink-soft group-has-[:checked]:text-hanko" aria-hidden />
                    <span>
                      <span className="block font-bold">{label}</span>
                      <span className="mt-1 block text-[0.92rem] leading-snug text-ink-soft">{desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex max-w-2xl flex-col gap-5">
                <h2 className="font-display text-2xl">Sobre você</h2>
                {failed?.message && <Notice tone="erro">{failed.message}</Notice>}
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField label="Nome" name="name" autoComplete="name" maxLength={100} defaultValue={failed?.values.name} error={failed?.errors.name} />
                  <TextField label="E-mail" name="email" type="email" autoComplete="email" maxLength={255} defaultValue={failed?.values.email} error={failed?.errors.email} />
                </div>
                <TextField label="Redes ou usuário no Anime Profile" name="handle" optional maxLength={150} defaultValue={failed?.values.handle} placeholder="@seu_usuario" />
                <TextField label="Portfólio ou links" name="portfolio" optional maxLength={300} defaultValue={failed?.values.portfolio} placeholder="Behance, ArtStation, blog, canal..." />
                <TextArea
                  label="Por que você quer fazer parte?"
                  name="body"
                  maxLength={4000}
                  rows={7}
                  defaultValue={failed?.values.body}
                  error={failed?.errors.body}
                  hint="Conte sua experiência, quantas horas por semana você tem e por que essa área te interessa."
                />
                <div className="flex flex-wrap items-center gap-4">
                  <SubmitButton busy={busy}>Enviar candidatura</SubmitButton>
                  <p className="text-[0.9rem] text-ink-soft">
                    Ao enviar, você concorda com os{" "}
                    <a href="/legal/termos" className="text-ai underline underline-offset-2">
                      Termos
                    </a>{" "}
                    e a{" "}
                    <a href="/legal/privacidade" className="text-ai underline underline-offset-2">
                      Política de Privacidade
                    </a>
                    .
                  </p>
                </div>
              </div>
              <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
                <h2 className="font-bold">O que a gente procura</h2>
                <ul className="mt-3 flex flex-col gap-2.5 text-[0.95rem] text-ink-soft">
                  {LOOKING_FOR.map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-hanko" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
