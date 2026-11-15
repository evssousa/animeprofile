// Contato sem formulário (como nos outros sites): cada canal abre o e-mail com o assunto pronto. Sem formulário não há
// o que o spam preencher, e a triagem na caixa de entrada fica pelo assunto.
import { Mail } from "lucide-react";
import { PageHeader } from "~/components/PageHeader";
import { seo } from "~/lib/seo";
import { SITE } from "~/lib/site";

export function meta() {
  return seo({
    title: "Contato",
    description: "Fale com a equipe do Anime Profile por e-mail: dúvidas, suporte, correções, parcerias, imprensa e privacidade.",
    path: "/contato",
  });
}

const CHANNELS = [
  { title: "Dúvida ou sugestão", subject: "Dúvida ou sugestão", text: "Uma ideia para o site, uma pauta ou uma pergunta sobre como algo funciona." },
  { title: "Suporte", subject: "Suporte", text: "Problema com conta, AP Coins, figurinhas ou pagamento. Informe o @ do seu perfil." },
  { title: "Correção em uma matéria", subject: "Correção", text: "Mande o link da matéria, o trecho com o erro e a informação correta (com fonte, se tiver)." },
  { title: "Parceria e imprensa", subject: "Parceria ou imprensa", text: "Lançamentos, press kits, convites para eventos, patrocínios e publicidade." },
  { title: "Privacidade", subject: "Privacidade (LGPD)", text: "Pedidos sobre seus dados pessoais, de acordo com a LGPD." },
  { title: "Outro assunto", subject: "Contato", text: "Elogio, crítica ou qualquer coisa que não caiba nos outros canais." },
];

const mailto = (subject: string) => `mailto:${SITE.email}?subject=${encodeURIComponent(`[${SITE.name}] ${subject}`)}`;

export default function Contato() {
  return (
    <>
      <PageHeader
        label="Fale com a gente"
        title="Contato"
        intro="Escolha o canal e o e-mail já sai com o assunto certo. A equipe lê todas as mensagens e tenta responder em até 3 dias úteis."
      />
      <div className="mx-auto flex max-w-[1328px] flex-col gap-8 px-4 py-10 sm:px-8 sm:py-12 lg:px-14">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CHANNELS.map((c) => (
            <li key={c.title} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-[1.15rem] font-extrabold">{c.title}</h2>
              <p className="flex-1 text-[0.95rem] text-ink-soft">{c.text}</p>
              <a href={mailto(c.subject)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-5 font-bold text-brand-ink hover:brightness-110">
                <Mail className="size-4" aria-hidden />
                Enviar e-mail
              </a>
            </li>
          ))}
        </ul>
        <p className="text-ink-soft">
          Ou escreva direto para{" "}
          <a href={`mailto:${SITE.email}`} className="font-semibold break-all text-link underline underline-offset-2">
            {SITE.email}
          </a>
          . Mensagens de divulgação em massa podem ficar sem resposta. Ao escrever, você concorda com a{" "}
          <a href="/legal/privacidade" className="text-link underline underline-offset-2">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </>
  );
}
