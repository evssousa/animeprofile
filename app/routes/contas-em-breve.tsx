// Endereços que dependem de conta (login, perfil, ranking, feed...) enquanto as contas não voltam.
// Responde 200 com noindex: ninguém cai num beco, e o Google não indexa uma página vazia.
// Sem formulário de aviso (decisão do dono, 2026-11-17): a pessoa só precisa voltar mais tarde.
import { Link } from "react-router";
import { Coins, Flame, Sparkles } from "lucide-react";
import type { Route } from "./+types/contas-em-breve";
import { Notice } from "~/components/form";
import { PageHeader } from "~/components/PageHeader";
import { NAV, USER_MENU } from "~/lib/nav";
import { routePath } from "~/lib/route-path";

export function loader({ request }: Route.LoaderArgs) {
  const path = routePath(request);
  const label = path === "/cadastro" ? "Cadastro" : ([...NAV.flatMap((g) => g.items), ...USER_MENU.flat()].find((i) => i.to === path)?.label ?? null);
  const invite = /^\/(convite|w)\//.test(path);
  return { label, invite };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  return [{ title: `${d?.label ? `${d.label} volta em breve` : "Contas voltam em breve"} | Anime Profile` }, { name: "robots", content: "noindex" }];
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

export default function ContasEmBreve({ loaderData }: Route.ComponentProps) {
  const { label, invite } = loaderData;
  return (
    <>
      <PageHeader
        label="Contas"
        title={label ? `${label} volta em breve` : "Login e contas voltam em breve"}
        intro="O Anime Profile mudou de casa. Notícias, animes, quiz, blog e figurinhas já estão aqui. Entrar, comentar, AP Coins, Rubis e o resto que depende da sua conta voltam em breve: dá uma passada por aqui mais tarde."
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
