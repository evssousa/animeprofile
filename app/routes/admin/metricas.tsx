// Métricas (/admin/retention): audiência e conteúdo com dado real, retrato semanal e decisões. As métricas de contas só
// começam a contar quando o cadastro abrir (docs/plano-telas-painel.md, tela 2).
import { Form, Link, useNavigation } from "react-router";
import { ArrowDown, ArrowUp, Camera, ClipboardList, Lock, PlusCircle, Sprout } from "lucide-react";
import { z } from "zod";
import type { Route } from "./+types/metricas";
import "~/visitas/ui/visitas.css";
import { Aviso, Botao, Cabecalho, Cartao, Numero, Selo, Vazio } from "~/components/admin/ui";
import { adminMeta } from "~/lib/admin-meta";
import { gravarRetrato, marcarRevista, registrarDecisao, resumoMetricas, ultimaSemanaCompleta, type CartaoMetrica, type Retrato } from "~/server/admin/metricas.server";
import { requireAdmin } from "~/server/auth/viewer.server";
import { diaBrasilia } from "~/visitas/core/dia";

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

const texto = (max: number) => z.string().trim().max(max);
const Decisao = z.object({
  problema: texto(300).min(3, "Conte qual é o problema (com o número)."),
  decisao: texto(2000).min(3, "Diga o que vamos fazer."),
  motivo: texto(2000).optional(),
  quem: texto(120).optional(),
  revisarEm: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  discordancia: texto(2000).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    if (intent === "gravar-retrato") {
      const semana = ultimaSemanaCompleta(diaBrasilia());
      await gravarRetrato(semana);
      return { ok: `Retrato da semana de ${semana.slice(8, 10)}/${semana.slice(5, 7)} gravado.` };
    }
    if (intent === "nova-decisao") {
      const r = Decisao.safeParse(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
      if (!r.success) return { erro: r.error.issues[0]?.message ?? "Confira os campos." };
      await registrarDecisao(r.data, diaBrasilia());
      return { ok: "Decisão registrada." };
    }
    if (intent === "decisao-revista") {
      const id = Number(form.get("id"));
      if (!Number.isInteger(id) || id <= 0) return { erro: "Decisão inválida." };
      await marcarRevista(id);
      return { ok: "Marcada como revista." };
    }
    return { erro: "Ação desconhecida." };
  } catch (e) {
    console.error(`[metricas] ação ${intent} falhou: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return { erro: "Não deu para salvar agora. Se a migration 014 não rodou, rode-a antes." };
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
const ROTULO_ORIGEM: Record<string, string> = { robo: "Robô", agenda: "Agenda", painel: "Você", old: "Site antigo" };

export default function Metricas({ loaderData, actionData }: Route.ComponentProps) {
  const ocupado = useNavigation().state === "submitting";
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
  const maxMedia = Math.max(1, ...dados.rendimento.porOrigem.map((o) => o.mediaVistas));
  const retratos = dados.historico;
  const decs = dados.decisoes;
  return (
    <div className="flex flex-col gap-6">
      <Cabecalho
        titulo="Métricas"
        desc="Audiência e conteúdo, sem cookies. As métricas das contas começam a contar quando o cadastro abrir."
        acoes={
          <Form method="post">
            <input type="hidden" name="intent" value="gravar-retrato" />
            <Botao type="submit" variante="primario" icone={Camera} ocupado={ocupado}>
              Gravar retrato da semana
            </Botao>
          </Form>
        }
      />
      <p className="-mt-3 text-[0.8rem] text-ink-soft">Calculado às {hora} · últimos 7 dias fechados contra os 7 anteriores</p>
      {actionData && "ok" in actionData && <Aviso tom="ok">{actionData.ok}</Aviso>}
      {actionData && "erro" in actionData && <Aviso tom="erro">{actionData.erro}</Aviso>}
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
        <Cartao titulo="Rendimento do conteúdo" icone={Sprout} dica="Vistas por matéria nos 7 primeiros dias (matérias dos últimos 60 dias)." className="lg:col-span-7">
          {dados.rendimento.porOrigem.length === 0 ? (
            <Vazio titulo="Ainda sem matérias com 7 dias de vida" texto="Quando houver matérias publicadas há mais de uma semana, o rendimento por origem aparece aqui." />
          ) : (
            <ul className="flex flex-col gap-3">
              {dados.rendimento.porOrigem.map((o) => (
                <li key={o.origem} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-[0.9rem]">
                  <span className="font-semibold">{ROTULO_ORIGEM[o.origem]}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
                    <span className={`block h-full rounded-full ${o.origem === "painel" ? "bg-info" : "bg-brand"}`} style={{ width: `${Math.max(2, (o.mediaVistas / maxMedia) * 100)}%` }} />
                  </span>
                  <span className="tabular-nums">
                    <b>{fmt.format(o.mediaVistas)}</b> <span className="text-[0.75rem] text-ink-soft">({fmt.format(o.materias)} matérias)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {dados.rendimento.topEntradas.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-[0.7rem] font-bold tracking-[0.08em] text-ink-soft uppercase">Mais entradas em 30 dias</h3>
              <ol className="mt-2 flex flex-col gap-1.5">
                {dados.rendimento.topEntradas.map((t, i) => (
                  <li key={t.path} className="flex items-baseline gap-2 text-[0.88rem]">
                    <span className="w-4 text-ink-soft tabular-nums">{i + 1}</span>
                    <a href={t.path} target="_blank" rel="noreferrer" className="line-clamp-1 min-w-0 flex-1 hover:underline">
                      {t.titulo}
                    </a>
                    <b className="tabular-nums">{fmt.format(t.entradas)}</b>
                  </li>
                ))}
              </ol>
            </div>
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
          <Vazio titulo="Ainda sem retratos" texto="O primeiro sai na segunda às 9h30. Se quiser, grave agora o da última semana fechada." />
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

      <Cartao titulo="Decisões" icone={ClipboardList} dica="O que decidimos olhando estes números, e quando rever.">
        {decs === null ? (
          <Aviso>Falta rodar a migration 014 para registrar decisões.</Aviso>
        ) : (
          <>
            <details className="group rounded-xl border border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[0.9rem] font-bold">
                <PlusCircle className="size-4 text-brand dark:text-glow" aria-hidden /> Registrar decisão
              </summary>
              <Form method="post" className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
                <input type="hidden" name="intent" value="nova-decisao" />
                <Campo nome="problema" rotulo="Problema (com o número)" obrigatorio className="sm:col-span-2" />
                <Campo nome="decisao" rotulo="O que vamos fazer" obrigatorio longo className="sm:col-span-2" />
                <Campo nome="motivo" rotulo="Motivo (e o que perdemos)" longo />
                <Campo nome="discordancia" rotulo="Discordâncias" longo />
                <Campo nome="quem" rotulo="Quem faz" />
                <Campo nome="revisarEm" rotulo="Revisar em" tipo="date" />
                <div className="sm:col-span-2">
                  <Botao type="submit" variante="primario" ocupado={ocupado} className="w-full sm:w-auto">
                    Salvar decisão
                  </Botao>
                  <p className="mt-1.5 text-[0.75rem] text-ink-soft">Guarda junto os números dos últimos 7 dias.</p>
                </div>
              </Form>
            </details>
            {decs.length === 0 ? (
              <Vazio titulo="Nenhuma decisão registrada" />
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {decs.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold">{d.problema}</p>
                      <p className="mt-0.5 text-[0.9rem]">{d.decisao}</p>
                      <p className="mt-1 text-[0.75rem] text-ink-soft">
                        {d.quem ? `${d.quem} · ` : ""}registrada em {ddmm(d.criadaEm)}
                        {d.revisarEm ? ` · revisar em ${ddmm(d.revisarEm)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {d.status === "revista" ? <Selo tom="ok">revista</Selo> : d.vencida && <Selo tom="aviso">revisar</Selo>}
                      {d.status === "aberta" && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="decisao-revista" />
                          <input type="hidden" name="id" value={d.id} />
                          <Botao type="submit" variante="fantasma" ocupado={ocupado} className="h-9 sm:h-9">
                            Marcar como revista
                          </Botao>
                        </Form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
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

function Campo({ nome, rotulo, obrigatorio, longo, tipo = "text", className = "" }: { nome: string; rotulo: string; obrigatorio?: boolean; longo?: boolean; tipo?: string; className?: string }) {
  const base = "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.9rem] placeholder:text-ink-soft focus:outline-none";
  return (
    <label className={`block text-[0.8rem] font-semibold ${className}`}>
      {rotulo}
      {longo ? <textarea name={nome} required={obrigatorio} rows={2} maxLength={2000} className={`${base} py-2`} /> : <input name={nome} type={tipo} required={obrigatorio} maxLength={300} className={`${base} h-10`} />}
    </label>
  );
}
