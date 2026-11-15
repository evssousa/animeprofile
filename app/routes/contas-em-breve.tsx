// Endereços que dependem de conta (login, perfil, ranking, feed...) enquanto as contas não voltam.
// Responde 200 com noindex: ninguém cai num beco, e o Google não indexa uma página vazia.
import { Form, Link, useNavigation } from "react-router";
import { Coins, Flame, Sparkles } from "lucide-react";
import type { Route } from "./+types/contas-em-breve";
import { Honeypot, Notice, SubmitButton, TextField } from "~/components/form";
import { PageHeader } from "~/components/PageHeader";
import { NAV } from "~/lib/nav";
import { routePath } from "~/lib/route-path";
import { field, saveMessage, type FieldErrors } from "~/server/contact.server";

export function loader({ request }: Route.LoaderArgs) {
  const path = routePath(request);
  const label = NAV.flatMap((g) => g.items).find((i) => i.to === path)?.label ?? null;
  const invite = /^\/(convite|w)\//.test(path);
  return { label, invite };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  return [{ title: `${d?.label ? `${d.label} volta em breve` : "Contas voltam em breve"} | Anime Profile` }, { name: "robots", content: "noindex" }];
}

type ActionData = { sent: true } | { sent: false; errors: FieldErrors; email: string; message?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const form = await request.formData();
  if (field(form, "site")) return { sent: true }; // robô: finge que deu certo
  const email = field(form, "email");
  if (!EMAIL_RE.test(email) || email.length > 255) return { sent: false, errors: { email: "Confira o e-mail: ele precisa ter o formato nome@exemplo.com." }, email };
  const result = await saveMessage("avisar-contas", { name: "Aviso de contas", email, subject: "Me avise quando as contas voltarem", body: "Pedido de aviso do formulário de contas em breve." }, request);
  if (result.ok) return { sent: true };
  return {
    sent: false,
    errors: {},
    email,
    message: result.reason === "limite" ? "Você já pediu o aviso. Pode deixar com a gente." : "Não deu para guardar o e-mail agora. Tente de novo daqui a pouco.",
  };
}

const KEPT = [
  { icon: Coins, title: "AP Coins e Rubis", text: "Seu saldo foi copiado e volta exatamente como estava." },
  { icon: Sparkles, title: "Figurinhas e coleção", text: "Álbuns, figurinhas e fragmentos estão guardados." },
  { icon: Flame, title: "Perfil e sequência", text: "Ninguém perde a sequência de check-in por causa da mudança." },
];
const LINKS = [
  { to: "/noticias", label: "Notícias" },
  { to: "/animes", label: "Animes" },
  { to: "/quiz", label: "Quiz" },
  { to: "/figurinhas", label: "Figurinhas" },
];

export default function ContasEmBreve({ loaderData, actionData }: Route.ComponentProps) {
  const { label, invite } = loaderData;
  const busy = useNavigation().state === "submitting";
  const failed = actionData && !actionData.sent ? actionData : null;
  return (
    <>
      <PageHeader
        label="Contas"
        title={label ? `${label} volta em breve` : "Login e contas voltam em breve"}
        intro="O Anime Profile mudou de casa. Notícias, animes, quiz, blog e figurinhas já estão aqui. Entrar, comentar, AP Coins, Rubis e o resto que depende da sua conta voltam nas próximas semanas."
      />
      <div className="mx-auto flex max-w-[1328px] flex-col gap-12 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        {invite && <Notice tone="ok">O seu convite continua valendo: guarde este link e abra de novo quando as contas voltarem.</Notice>}

        <section aria-labelledby="guardado">
          <h2 id="guardado" className="text-[1.5rem] font-extrabold tracking-[-0.02em]">
            O que é seu está guardado
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {KEPT.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-line bg-surface p-5">
                <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-1 text-[0.95rem] text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="avise" className="max-w-xl">
          <h2 id="avise" className="text-[1.5rem] font-extrabold tracking-[-0.02em]">
            Me avise quando voltar
          </h2>
          {actionData?.sent ? (
            <div className="mt-4">
              <Notice tone="ok">Pronto. Avisaremos quando as contas voltarem.</Notice>
            </div>
          ) : (
            <Form method="post" className="relative mt-4 flex flex-col gap-4" noValidate>
              {failed?.message && <Notice tone="erro">{failed.message}</Notice>}
              <Honeypot />
              <TextField label="E-mail" name="email" type="email" autoComplete="email" maxLength={255} defaultValue={failed?.email} error={failed?.errors.email} />
              <div>
                <SubmitButton busy={busy}>Me avise</SubmitButton>
              </div>
              <p className="text-[0.85rem] text-ink-soft">Só usamos este e-mail para avisar da volta das contas.</p>
            </Form>
          )}
        </section>

        <section aria-labelledby="enquanto">
          <h2 id="enquanto" className="text-[1.5rem] font-extrabold tracking-[-0.02em]">
            Enquanto isso
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {LINKS.map((l, i) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-[9px] px-5 py-3 font-semibold ${i === 0 ? "bg-brand font-bold text-brand-ink hover:brightness-110" : "border border-line bg-surface hover:bg-sunken"}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
