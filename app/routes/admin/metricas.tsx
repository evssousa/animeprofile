// Métricas (/admin/retention): audiência e conteúdo com dado real e retrato semanal. As métricas de contas só
// começam a contar quando o cadastro abrir (docs/plano-telas-painel.md, tela 2).
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Camera, Lock, Newspaper } from "lucide-react";
import type { Route } from "./+types/metricas";
import "~/visitas/ui/visitas.css";
import { Aviso, Cabecalho, Cartao, Numero, Vazio } from "~/components/admin/ui";
import { adminMeta } from "~/lib/admin-meta";
import { resumoMetricas, type CartaoMetrica, type Retrato } from "~/server/admin/metricas.server";
import { requireAdmin } from "~/server/auth/viewer.server";

export const meta = () => adminMeta("Métricas");

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  try {
    return { erro: false as const, dados: await resumoMetricas(), hora: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()) };
  } catch (e) {
    console.error(`[metricas] não consegui ler: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return { erro: true as const };
  }
}

const fmt = new Intl.NumberFormat("pt-BR");
const fmt1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const valorDe = (c: CartaoMetrica) => (c.valor === null ? "—" : c.formato === "pct" ? `${c.valor}%` : c.formato === "dec" ? fmt1.format(c.valor) : fmt.format(c.valor));
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Variacao({ c }: { c: CartaoMetrica }) {
  if (c.delta === null) return <p className="mt-2 text-[0.8rem] text-ink-soft">sem base para comparar</p>;
  if (c.delta === 0) return <p className="mt-2 text-[0.8rem] text-ink-soft">igual à semana anterior</p>;
  const subiu = c.delta > 0;
  const Seta = subiu ? ArrowUp : ArrowDown;
  const n = c.unidadeDelta === "abs" ? fmt1.format(Math.abs(c.delta)) : fmt.format(Math.abs(c.delta));
  return (
    <p className={`mt-2 flex items-center gap-1 text-[0.8rem] font-bold ${subiu ? "text-ok" : "text-brand dark:text-glow"}`}>
      <Seta className="size-3.5" aria-hidden />
      {n}
      {c.unidadeDelta === "%" ? "%" : c.unidadeDelta === "pts" ? " pts" : ""}
      <span className="font-normal text-ink-soft"> vs. semana anterior</span>
    </p>
  );
}

const ORIGENS = [
  { id: "direto", rotulo: "Direto" },
  { id: "busca", rotulo: "Busca" },
  { id: "social", rotulo: "Social" },
  { id: "site", rotulo: "Sites" },
  { id: "campanha", rotulo: "Campanhas" },
];

export default function Metricas({ loaderData }: Route.ComponentProps) {
  if (loaderData.erro)
    return (
      <div>
        <Cabecalho titulo="Métricas" />
        <div className="mt-4">
          <Aviso tom="erro">
            Não deu para ler as métricas agora. <Link to="/admin/retention" reloadDocument className="font-bold underline">Tentar de novo</Link>
          </Aviso>
        </div>
      </div>
    );
  const { dados, hora } = loaderData;
  const retratos = dados.historico;
  return (
    <div className="flex flex-col gap-6">
      <Cabecalho
        titulo="Métricas"
        desc="Audiência e conteúdo, sem cookies. As métricas das contas começam a contar quando o cadastro abrir."
      />
      <p className="-mt-3 text-[0.8rem] text-ink-soft">Calculado às {hora} · últimos 7 dias fechados contra os 7 anteriores</p>
      {dados.semBase && <Aviso tom="info">Ainda não há visitas contadas nos últimos 14 dias para comparar. Os números aparecem conforme o contador acumula.</Aviso>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {dados.cartoes.map((c, i) => (
          <div key={c.id} className={i === 4 ? "col-span-2 sm:col-span-1" : ""}>
            <Numero rotulo={c.rotulo} valor={valorDe(c)} sub={c.sub} escuro={i === 0}>
              <Variacao c={c} />
              <p className={`mt-2 line-clamp-2 text-[0.75rem] ${i === 0 ? "text-night-ink/60" : "text-ink-soft"}`} title={`Se piorar: ${c.piorar}`}>
                Se piorar: {c.piorar}
              </p>
            </Numero>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Cartao titulo="Matérias que mais trouxeram entradas" icone={Newspaper} dica="Últimos 30 dias: quem chegou ao site por cada matéria." className="lg:col-span-7">
          {dados.maisEntradas.length === 0 ? (
            <Vazio titulo="Ainda sem dados" texto="Quando o contador acumular entradas, as matérias que mais trazem gente aparecem aqui." />
          ) : (
            <ol className="flex flex-col gap-2">
              {dados.maisEntradas.map((t, i) => (
                <li key={t.path} className="flex items-baseline gap-3 text-[0.9rem]">
                  <span className="w-4 text-ink-soft tabular-nums">{i + 1}</span>
                  <a href={t.path} target="_blank" rel="noreferrer" className="line-clamp-2 min-w-0 flex-1 hover:underline">
                    {t.titulo}
                  </a>
                  <b className="tabular-nums">{fmt.format(t.entradas)}</b>
                </li>
              ))}
            </ol>
          )}
        </Cartao>

        <Cartao titulo="De onde vêm, semana a semana" dica="Participação de cada origem nas entradas, 8 semanas (a última é a atual)." className="vp lg:col-span-5">
          <div className="flex h-40 items-end gap-2" role="img" aria-label="Barras de 100% por semana com a origem das entradas">
            {dados.semanas.map((s) => (
              <div key={s.semana} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5" title={s.total ? ORIGENS.map((o) => `${o.rotulo}: ${Math.round(((s.valores[o.id] ?? 0) / s.total) * 100)}%`).join(" · ") : "sem dados"}>
                {s.total === 0 ? (
                  <span className="h-full rounded bg-sunken" />
                ) : (
                  ORIGENS.map((o) => {
                    const v = s.valores[o.id] ?? 0;
                    return v > 0 ? <span key={o.id} className="block rounded-[3px]" style={{ height: `${(v / s.total) * 100}%`, background: `var(--vp-o-${o.id})` }} /> : null;
                  })
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2 text-[0.65rem] text-ink-soft">
            {dados.semanas.map((s) => (
              <span key={s.semana} className="min-w-0 flex-1 text-center tabular-nums">
                {s.rotulo}
              </span>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
            {ORIGENS.map((o) => (
              <li key={o.id} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: `var(--vp-o-${o.id})` }} aria-hidden /> {o.rotulo}
              </li>
            ))}
          </ul>
          <details className="mt-3 text-[0.8rem]">
            <summary className="cursor-pointer font-semibold text-ink-soft">Ver em tabela</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-left tabular-nums">
                <thead>
                  <tr className="text-ink-soft">
                    <th className="py-1 pr-2 font-semibold">Semana</th>
                    {ORIGENS.map((o) => (
                      <th key={o.id} className="py-1 pr-2 font-semibold">
                        {o.rotulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.semanas.map((s) => (
                    <tr key={s.semana} className="border-t border-line">
                      <td className="py-1 pr-2">{s.rotulo}</td>
                      {ORIGENS.map((o) => (
                        <td key={o.id} className="py-1 pr-2">
                          {s.total ? `${Math.round(((s.valores[o.id] ?? 0) / s.total) * 100)}%` : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Cartao>
      </div>

      <Cartao titulo="Histórico semanal" dica="Um retrato toda segunda, às 9h30 (Brasília), da semana que acabou." icone={Camera}>
        {retratos === null ? (
          <Aviso>Falta rodar a migration 014 para guardar o histórico.</Aviso>
        ) : retratos.length === 0 ? (
          <Vazio titulo="Ainda sem retratos" texto="O primeiro sai sozinho na segunda às 9h30, com os números da semana que acabou." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-[0.88rem] tabular-nums">
              <thead>
                <tr className="text-[0.75rem] text-ink-soft">
                  {["Semana", "Visitantes/dia", "Páginas/visita", "Busca", "Quiz", "Procura contas", "Publicadas", "Robô"].map((h, i) => (
                    <th key={h} className={`py-2 pr-3 font-semibold ${i === 0 ? "sticky left-0 bg-surface" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retratos.map((r, i) => (
                  <tr key={r.semana} className={`border-t border-line ${i === 0 ? "font-bold" : ""}`}>
                    <td className="sticky left-0 bg-surface py-2 pr-3">{ddmm(r.semana)}</td>
                    <td className="py-2 pr-3">{fmt.format(r.dados.visitantesDia)}</td>
                    <td className="py-2 pr-3">{r.dados.paginasPorVisita === null ? "—" : fmt1.format(r.dados.paginasPorVisita)}</td>
                    <td className="py-2 pr-3">{r.dados.buscaPct === null ? "—" : `${r.dados.buscaPct}%`}</td>
                    <td className="py-2 pr-3">{r.dados.quizConclusaoPct === null ? "—" : `${r.dados.quizConclusaoPct}%`}</td>
                    <td className="py-2 pr-3">{fmt.format(r.dados.procuraContas)}</td>
                    <td className="py-2 pr-3">{fmt.format(totalPub(r.dados))}</td>
                    <td className="py-2 pr-3">{fmt.format(r.dados.publicadas.robo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <section className="rounded-[14px] border border-dashed border-line p-4 text-ink-soft sm:p-5" aria-labelledby="contas-metricas">
        <h2 id="contas-metricas" className="flex items-center gap-2 text-[1rem] font-bold text-ink">
          <Lock className="size-4" aria-hidden /> Contas: começa quando o cadastro abrir
        </h2>
        <p className="mt-1 text-[0.9rem]">
          Ativação — · Volta na 2ª semana — · Ativos na semana — · NPS — · Pagam —
        </p>
        <details className="mt-2 text-[0.85rem]">
          <summary className="cursor-pointer font-semibold">O que a fase das contas precisa gravar</summary>
          <p className="mt-2">Cadastro iniciado, concluído e com erro; primeiro login; ação de valor (ler, comentar, abrir figurinha); check-in; resposta de NPS; compra. Com isso gravado desde o primeiro cadastro, o funil nasce com histórico.</p>
        </details>
      </section>
    </div>
  );
}

const totalPub = (r: Retrato) => r.publicadas.robo + r.publicadas.agenda + r.publicadas.painel + r.publicadas.old;
