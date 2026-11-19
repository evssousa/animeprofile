// Notícias IA (/admin/ai-news): operação do robô de notícias pelo painel. Uma página com submenu (?aba=): Visão geral, Aprovação,
// Candidatos, Histórico, Fontes, Tópicos e bloqueios, Horários e limites, Autores IA e Configurações. O painel chama as funções do
// servidor direto: o CRON_TOKEN nunca chega ao navegador. Docs: docs/plano-telas-painel.md, tela 4.
import { useEffect, useState } from "react";
import { data, Link, useFetcher, useRevalidator } from "react-router";
import { Bot, CheckCircle2, ExternalLink, Eye, FlaskConical, Pencil, Play, Plus, Power, RefreshCw, Trash2, Zap } from "lucide-react";
import type { Route } from "./+types/ai-news";
import { Pagination } from "~/components/posts";
import { Abas, Aviso, Botao, Cabecalho, Cartao, Confirmar, Selo, Vazio } from "~/components/admin/ui";
import { adminMeta } from "~/lib/admin-meta";
import { STATUS_CANDIDATO, type StatusCandidato } from "~/lib/robo-painel";
import { requireAdmin } from "~/server/auth/viewer.server";
import {
  alternarTermo, apagarTermo, contadoresMenu, descartarCandidato, descartarRascunho, ensaiarEndereco, guiaEditorial, iniciarRodada, ligarFonte, listarAutoresIA, listarCandidatos, listarFontes, listarHorarios,
  listarRascunhos, listarRodadas, listarTermos, publicarRascunho, salvarAutorIA, salvarConfig, salvarFonte, salvarGuia, salvarHorarios, salvarTermo, testarFonte, visaoGeral,
} from "~/server/robot/painel.server";
import { getConfig } from "~/server/robot/config.server";
import { ALLOWED_GEMINI_MODELS } from "~/server/robot/constants";

export const meta = () => adminMeta("Notícias IA");

const ABAS = [
  { id: "geral", rotulo: "Visão geral", grupo: "Visão geral", desc: "Quanto o robô publicou hoje, o modo e as últimas rodadas." },
  { id: "aprovacao", rotulo: "Aprovação", grupo: "Robô", desc: "Rascunhos do robô esperando você revisar, publicar ou descartar." },
  { id: "candidatos", rotulo: "Candidatos", grupo: "Robô", desc: "Notícias que o robô encontrou nas fontes nos últimos 3 dias." },
  { id: "historico", rotulo: "Histórico", grupo: "Robô", desc: "As rodadas dos últimos 60 dias, com o relatório de cada uma." },
  { id: "fontes", rotulo: "Fontes", grupo: "Origem", desc: "De onde o robô lê as notícias (RSS dos sites)." },
  { id: "topicos", rotulo: "Tópicos e bloqueios", grupo: "Origem", desc: "O que o robô prefere (tópicos, com peso) e o que ele ignora (bloqueios)." },
  { id: "horarios", rotulo: "Horários e limites", grupo: "Origem", desc: "Quando o robô roda, quantas matérias por horário e o teto do dia." },
  { id: "autores", rotulo: "Autores IA", grupo: "Autores", desc: "Os autores de IA: categoria, especialidade e se publicam sozinhos." },
  { id: "config", rotulo: "Configurações", grupo: "Sistema", desc: "Modelo do Gemini, imagens no texto, limites de chamadas e o guia editorial." },
] as const;
type AbaId = (typeof ABAS)[number]["id"];

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const pedida = url.searchParams.get("aba");
  const aba: AbaId = ABAS.some((a) => a.id === pedida) ? (pedida as AbaId) : "geral";
  const pagina = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  try {
    const menu = await contadoresMenu();
    const base = { erro: false as const, aba, menu };
    if (aba === "geral") return { ...base, geral: await visaoGeral() };
    if (aba === "aprovacao") return { ...base, rascunhos: await listarRascunhos() };
    if (aba === "candidatos") {
      const st = url.searchParams.get("status");
      const status: StatusCandidato = (STATUS_CANDIDATO as readonly string[]).includes(st ?? "") ? (st as StatusCandidato) : "pending";
      return { ...base, candidatos: { status, ...(await listarCandidatos(status, pagina)) } };
    }
    if (aba === "historico") return { ...base, historico: await listarRodadas(pagina) };
    if (aba === "fontes") return { ...base, fontes: await listarFontes() };
    if (aba === "topicos") return { ...base, termos: await listarTermos() };
    if (aba === "horarios") {
      const cfg = await getConfig();
      return { ...base, horarios: { grade: await listarHorarios(), limiteDia: cfg.limiteDia, foraDeAnimePct: cfg.foraDeAnimePct } };
    }
    if (aba === "autores") return { ...base, autores: await listarAutoresIA() };
    return { ...base, config: { cfg: await getConfig(), guia: await guiaEditorial(), chave: Boolean(process.env.GEMINI_API_KEY), modelos: [...ALLOWED_GEMINI_MODELS] } };
  } catch (e) {
    console.error(`[ai-news] não consegui ler a aba ${aba}: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return { erro: true as const, aba, menu: { rascunhos: 0, fontesFalhando: 0 } };
  }
}

type Resp = { ok: boolean; msg: string; extra?: unknown };
const ok = (msg: string, extra?: unknown): Resp => ({ ok: true, msg, extra });
const falha = (msg: string): Resp => ({ ok: false, msg });

export async function action({ request }: Route.ActionArgs): Promise<Resp> {
  await requireAdmin(request);
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  const texto = (k: string) => String(f.get(k) ?? "");
  try {
    switch (intent) {
      case "modo": {
        const r = await salvarConfig({ modo: texto("valor") });
        return r.ok ? ok(`Modo: ${r.config.modo}.`) : falha(r.erro);
      }
      case "rodada":
      case "ensaio": {
        const r = await iniciarRodada(intent === "ensaio" ? "ensaio" : "rodada");
        return r.ok ? ok("Começou. O resultado aparece em Últimas rodadas em 1 a 3 minutos.") : falha(r.erro);
      }
      case "ensaiar-url": {
        const r = await ensaiarEndereco(texto("url"));
        return r.ok ? ok("Ensaio começou. Veja o resultado em Candidatos (Ensaio) em 1 a 3 minutos.") : falha(r.erro);
      }
      case "descartar-candidato":
        return (await descartarCandidato(Number(f.get("id")))) ? ok("Candidato descartado.") : falha("Só dá para descartar o que ainda está na fila.");
      case "publicar-rascunho": {
        const r = await publicarRascunho(texto("id"));
        return r.ok ? ok("Publicado!") : falha(r.erro);
      }
      case "descartar-rascunho":
        return (await descartarRascunho(texto("id"))) ? ok("Rascunho descartado.") : falha("Não deu para descartar esse rascunho.");
      case "salvar-fonte": {
        const r = await salvarFonte({ id: texto("id") || null, nome: texto("nome"), site: texto("site"), rss: texto("rss"), prioridade: texto("prioridade") });
        return r.ok ? ok("Fonte salva.") : falha(r.erro);
      }
      case "ligar-fonte":
        await ligarFonte(texto("id"), f.get("ativa") === "1");
        return ok(f.get("ativa") === "1" ? "Fonte ligada." : "Fonte desligada.");
      case "testar-fonte": {
        const r = await testarFonte(texto("id"));
        return r.ok ? ok(r.itens > 0 ? `Funcionou: ${r.itens} itens no feed (${r.status}). Primeiro: “${r.primeiros[0] ?? ""}”.` : `O feed respondeu (${r.status}), mas sem itens.`) : falha(r.erro);
      }
      case "salvar-termo": {
        const r = await salvarTermo({ tipo: texto("tipo"), termo: texto("termo"), peso: texto("peso") || undefined });
        return r.ok ? ok("Termo salvo.") : falha(r.erro);
      }
      case "apagar-termo":
        await apagarTermo(Number(f.get("id")));
        return ok("Termo apagado.");
      case "alternar-termo":
        await alternarTermo(Number(f.get("id")), f.get("ativo") === "1");
        return ok("Pronto.");
      case "salvar-horarios": {
        const grade = Array.from({ length: 24 }, (_, h) => Number(f.get(`h${h}`) ?? 0));
        const r = await salvarHorarios(grade);
        if (!r.ok) return falha(r.erro);
        const lim = await salvarConfig({ limiteDia: texto("limiteDia"), foraDeAnimePct: texto("foraDeAnimePct") });
        return lim.ok ? ok(`Horários salvos: ${r.total} matéria${r.total === 1 ? "" : "s"} por dia pelos horários.`) : falha(lim.erro);
      }
      case "salvar-autor": {
        const r = await salvarAutorIA({ id: texto("id"), categoria: texto("categoria"), especialidade: texto("especialidade"), publicaSozinho: f.get("publicaSozinho") === "1", ativo: f.get("ativo") === "1" });
        return r.ok ? ok("Autor salvo.") : falha(r.erro);
      }
      case "salvar-config": {
        const r = await salvarConfig({ modelo: texto("modelo"), imagensCorpo: texto("imagensCorpo"), chamadasDiaPorModelo: texto("chamadasDiaPorModelo") });
        return r.ok ? ok("Configurações salvas.") : falha(r.erro);
      }
      case "salvar-guia": {
        const r = await salvarGuia(texto("guia"));
        return r.ok ? ok("Guia editorial salvo.") : falha(r.erro);
      }
    }
    return falha("Ação desconhecida.");
  } catch (e) {
    console.error(`[ai-news] ação ${intent} falhou: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return falha("Não deu para concluir agora. Tente de novo.");
  }
}

// ───────────── utilidades de tela ─────────────

const hora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const quando = (iso: string | null) => (iso ? hora.format(new Date(iso)) : "—");
const campo = "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.9rem] focus:outline-none";
const rot = "block text-[0.8rem] font-semibold";

function aviso(r: Resp | undefined) {
  return r ? <Aviso tom={r.ok ? "ok" : "erro"}>{r.msg}</Aviso> : null;
}

/** Atualiza a página sozinha a cada 15 s enquanto houver uma rodada em andamento (no máximo 10 min). */
function useAtualizarSe(ativo: boolean) {
  const rev = useRevalidator();
  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    const t = setInterval(() => {
      if (Date.now() - inicio > 10 * 60_000) return clearInterval(t);
      if (document.visibilityState === "visible") rev.revalidate();
    }, 15_000);
    return () => clearInterval(t);
  }, [ativo]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ───────────── página ─────────────

export default function NoticiasIA({ loaderData: d }: Route.ComponentProps) {
  const atual = ABAS.find((a) => a.id === d.aba)!;
  const grupos = [...new Set(ABAS.map((a) => a.grupo))];
  // No celular as seções são pílulas que rolam de lado: a ativa sempre aparece.
  useEffect(() => {
    document.querySelector<HTMLElement>('nav[aria-label="Seções do robô"] [aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [d.aba]);
  const contador = (id: string) => (id === "aprovacao" && d.menu.rascunhos > 0 ? ` (${d.menu.rascunhos})` : id === "fontes" && d.menu.fontesFalhando > 0 ? ` ⚠` : "");
  return (
    <div className="flex flex-col gap-5">
      <Cabecalho titulo="Notícias IA" desc={atual.desc} />
      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Seções do robô" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:sticky lg:top-20 lg:flex-col lg:gap-4 lg:self-start lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {grupos.map((g) => (
            <div key={g} className="flex shrink-0 gap-2 lg:flex-col lg:gap-0.5">
              <p className="hidden px-3 pb-1 text-[0.7rem] font-bold tracking-[0.14em] text-ink-soft uppercase lg:block">{g}</p>
              {ABAS.filter((a) => a.grupo === g).map((a) => (
                <Link
                  key={a.id}
                  to={a.id === "geral" ? "/admin/ai-news" : `/admin/ai-news?aba=${a.id}`}
                  aria-current={a.id === d.aba ? "page" : undefined}
                  className={`inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[0.88rem] font-semibold whitespace-nowrap lg:h-10 lg:rounded-xl lg:border-transparent lg:px-3 ${a.id === d.aba ? "border-brand bg-brand-soft text-brand dark:text-glow" : "border-line hover:bg-sunken"}`}
                >
                  {a.rotulo}
                  {contador(a.id)}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          {d.erro ? (
            <Aviso tom="erro">
              Não deu para ler esta aba agora. <Link to="/admin/ai-news" reloadDocument className="font-bold underline">Tentar de novo</Link>
            </Aviso>
          ) : d.aba === "geral" && "geral" in d ? (
            <Geral g={d.geral} />
          ) : d.aba === "aprovacao" && "rascunhos" in d ? (
            <Aprovacao itens={d.rascunhos} />
          ) : d.aba === "candidatos" && "candidatos" in d ? (
            <Candidatos c={d.candidatos} />
          ) : d.aba === "historico" && "historico" in d ? (
            <Historico h={d.historico} />
          ) : d.aba === "fontes" && "fontes" in d ? (
            <Fontes itens={d.fontes} />
          ) : d.aba === "topicos" && "termos" in d ? (
            <Topicos itens={d.termos} />
          ) : d.aba === "horarios" && "horarios" in d ? (
            <Horarios h={d.horarios} />
          ) : d.aba === "autores" && "autores" in d ? (
            <Autores a={d.autores} />
          ) : d.aba === "config" && "config" in d ? (
            <Configuracoes c={d.config} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ───────────── Visão geral ─────────────

const MODOS = [
  { id: "desligado", rotulo: "Desligado" },
  { id: "ensaio", rotulo: "Ensaio" },
  { id: "rascunho", rotulo: "Rascunho" },
  { id: "publicar", rotulo: "Publicar" },
] as const;

function Geral({ g }: { g: NonNullable<Extract<Awaited<ReturnType<typeof loader>>, { geral: unknown }>["geral"]> }) {
  const modo = useFetcher<Resp>();
  const rodar = useFetcher<Resp>();
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const iniciou = rodar.data?.ok === true;
  useAtualizarSe(g.rodando || iniciou);
  const pct = Math.min(100, Math.round((g.hoje / Math.max(1, g.teto)) * 100));
  const proximo = g.horarios.find((h) => h.hora > g.horaAgora)?.hora;
  const trocar = (valor: string) => (valor === "publicar" ? setConfirmarPublicar(true) : modo.submit({ intent: "modo", valor }, { method: "post" }));
  return (
    <div className="flex flex-col gap-4">
      {aviso(modo.data)}
      {aviso(rodar.data)}
      {!g.chave && <Aviso>Falta a chave do Gemini no servidor (GEMINI_API_KEY). Sem ela o robô não gera matérias.</Aviso>}
      <section className="rounded-[14px] bg-night p-5 text-night-ink">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Modo do robô">
          {MODOS.map((m) => (
            <button key={m.id} type="button" aria-pressed={g.modo === m.id} onClick={() => g.modo !== m.id && trocar(m.id)} className={`h-11 rounded-full px-4 text-[0.9rem] font-bold sm:h-10 ${g.modo === m.id ? "bg-brand text-brand-ink" : "bg-white/10 hover:bg-white/15"}`}>
              {m.rotulo}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-[0.8rem] text-night-ink/70">
            {g.chave ? <><CheckCircle2 className="size-4 text-ok" aria-hidden /> chave do Gemini ok</> : "sem chave do Gemini"}
          </span>
        </div>
        <p className="mt-4 text-[0.8rem] font-bold tracking-[0.08em] text-glow uppercase">Hoje</p>
        <p className="text-[2.2rem] leading-tight font-extrabold tabular-nums">{g.hoje} <span className="text-[1rem] font-semibold text-night-ink/70">de {g.teto} publicadas</span></p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={g.teto} aria-valuenow={g.hoje} aria-label="Matérias de hoje">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[0.82rem] text-night-ink/70">{proximo !== undefined ? `Próxima rodada: ${String(proximo).padStart(2, "0")}h` : "Sem mais rodadas hoje."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Botao variante="secundario" icone={FlaskConical} ocupado={rodar.state !== "idle"} disabled={g.rodando || iniciou} onClick={() => rodar.submit({ intent: "ensaio" }, { method: "post" })} className="!border-white/20 !bg-white/10 !text-night-ink hover:!bg-white/15">
            Ensaio agora
          </Botao>
          <Botao variante="primario" icone={Play} ocupado={rodar.state !== "idle"} disabled={g.rodando || iniciou} onClick={() => rodar.submit({ intent: "rodada" }, { method: "post" })}>
            Rodada agora
          </Botao>
          {(g.rodando || iniciou) && <span className="self-center text-[0.82rem] text-night-ink/70">Rodada em andamento…</span>}
        </div>
      </section>

      <Cartao titulo="Horários de hoje" dica="● já passou · ○ ainda vai rodar (horário de Brasília)">
        <ul className="flex flex-wrap gap-2">
          {g.horarios.map((h) => (
            <li key={h.hora} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.85rem] font-semibold tabular-nums ${h.hora <= g.horaAgora ? "border-line text-ink-soft" : "border-brand/40 text-ink"}`}>
              <span aria-hidden>{h.hora <= g.horaAgora ? "●" : "○"}</span>
              {String(h.hora).padStart(2, "0")}h{h.posts > 1 ? ` ×${h.posts}` : ""}
            </li>
          ))}
        </ul>
      </Cartao>

      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo="Gemini (24 h)" dica="Chamadas por modelo contra o limite por dia.">
          {g.gemini.length === 0 ? (
            <Vazio titulo="Nenhuma chamada nas últimas 24 h" />
          ) : (
            <ul className="flex flex-col gap-3">
              {g.gemini.map((m) => (
                <li key={m.modelo}>
                  <p className="flex justify-between text-[0.85rem]"><span className="font-semibold">{m.modelo}</span><span className="tabular-nums">{m.chamadas}/{m.limite}{m.erros > 0 && <span className="text-brand"> · {m.erros} com erro</span>}</span></p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (m.chamadas / m.limite) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Por que descartou (24 h)">
          {g.motivos.length === 0 ? (
            <Vazio titulo="Nada descartado nas últimas 24 h" />
          ) : (
            <ul className="flex flex-col gap-2 text-[0.85rem]">
              {g.motivos.map((m) => (
                <li key={m.motivo} className="flex items-start justify-between gap-3"><span className="min-w-0">{m.motivo}</span><b className="tabular-nums">{m.n}</b></li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Últimas rodadas">
        <ListaRodadas itens={g.rodadas} />
      </Cartao>

      <Confirmar aberto={confirmarPublicar} titulo="Publicar sozinho?" texto={`O robô vai publicar sozinho até o teto de ${g.teto} por dia.`} botao="Publicar" tom="primario" onCancelar={() => setConfirmarPublicar(false)} onConfirmar={() => (setConfirmarPublicar(false), modo.submit({ intent: "modo", valor: "publicar" }, { method: "post" }))} />
    </div>
  );
}

type RodadaT = { id: number; inicio: string; fim: string | null; status: string; modo: string; limite: number; geradas: number; descartadas: number; falhas: number; relatorio: unknown };

function ListaRodadas({ itens }: { itens: RodadaT[] }) {
  if (itens.length === 0) return <Vazio titulo="Nenhuma rodada ainda" />;
  const tom = (s: string) => (s === "finished" ? "ok" : s === "running" ? "info" : "erro");
  const rotulo = (s: string) => ({ finished: "ok", running: "rodando", expired: "expirou", error: "erro" })[s] ?? s;
  return (
    <ul className="divide-y divide-line">
      {itens.map((r) => (
        <li key={r.id}>
          <details className="group">
            <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[0.85rem]">
              <span className="tabular-nums">{quando(r.inicio)}</span>
              <Selo tom={tom(r.status)}>{rotulo(r.status)}</Selo>
              <span>{r.modo}</span>
              <span className="text-ink-soft">limite {r.limite} · {r.geradas} geradas · {r.descartadas} descartadas · {r.falhas} falhas</span>
            </summary>
            <pre className="mb-3 max-h-72 overflow-auto rounded-lg bg-sunken p-3 text-[0.75rem] whitespace-pre-wrap">{r.relatorio ? JSON.stringify(r.relatorio, null, 2) : "Sem relatório."}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}

// ───────────── Aprovação ─────────────

function Aprovacao({ itens }: { itens: { id: string; titulo: string; capa: string | null; autor: string | null; categoria: string | null; palavras: number; criadoEm: string }[] }) {
  const f = useFetcher<Resp>();
  const [descartar, setDescartar] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {aviso(f.data)}
      <Cartao className="!p-0">
        {itens.length === 0 ? (
          <Vazio icone={Bot} titulo="Nenhum rascunho esperando." texto="No modo Publicar o robô só deixa rascunho para autores que não publicam sozinhos." />
        ) : (
          <ul className="divide-y divide-line">
            {itens.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                {r.capa ? <img src={r.capa} alt="" width={96} height={54} loading="lazy" className="hidden aspect-video w-24 shrink-0 rounded-md object-cover sm:block" /> : <span className="hidden aspect-video w-24 shrink-0 rounded-md bg-sunken sm:block" />}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[0.92rem] font-semibold">{r.titulo}</p>
                  <p className="mt-1 text-[0.75rem] text-ink-soft">{[r.autor, r.categoria, `~${r.palavras} palavras`, quando(r.criadoEm)].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Botao href={`/admin/posts/${r.id}`} variante="secundario" icone={Pencil}>Revisar</Botao>
                  <Botao variante="primario" icone={Zap} ocupado={f.state !== "idle"} onClick={() => f.submit({ intent: "publicar-rascunho", id: r.id }, { method: "post" })}>Publicar agora</Botao>
                  <Botao variante="perigo" icone={Trash2} aria-label="Descartar" onClick={() => setDescartar(r.id)} className="max-sm:!px-3">
                    <span className="hidden sm:inline">Descartar</span>
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Confirmar aberto={descartar !== null} titulo="Descartar este rascunho?" texto="O rascunho é apagado e a notícia da fonte fica marcada como descartada." botao="Descartar" onCancelar={() => setDescartar(null)} onConfirmar={() => (descartar && f.submit({ intent: "descartar-rascunho", id: descartar }, { method: "post" }), setDescartar(null))} />
    </div>
  );
}

// ───────────── Candidatos ─────────────

const ROT_STATUS: Record<StatusCandidato, string> = { pending: "Na fila", selected: "Escolhidos", rehearsal: "Ensaio", draft: "Rascunho", published: "Publicados", discarded: "Descartados", failed: "Falhas" };

function Candidatos({ c }: { c: { status: StatusCandidato; itens: { id: number; titulo: string; url: string; fonte: string | null; nota: number; status: string; motivo: string | null; criadoEm: string; temPrevia: boolean }[]; total: number; pagina: number; paginas: number; contagens: Record<StatusCandidato, number> } }) {
  const f = useFetcher<Resp>();
  const [url, setUrl] = useState("");
  return (
    <div className="flex flex-col gap-4">
      {aviso(f.data)}
      <Abas ativo={c.status} itens={STATUS_CANDIDATO.map((s) => ({ id: s, rotulo: ROT_STATUS[s], href: `/admin/ai-news?aba=candidatos&status=${s}`, n: c.contagens[s] }))} />
      <form className="flex flex-wrap gap-2" onSubmit={(e) => (e.preventDefault(), url.trim() && f.submit({ intent: "ensaiar-url", url: url.trim() }, { method: "post" }))}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ensaiar um endereço (https://...)" aria-label="Endereço para ensaiar" maxLength={600} className={`${campo} mt-0 h-10 min-w-[14rem] flex-1`} />
        <Botao type="submit" variante="secundario" icone={FlaskConical}>Ensaiar</Botao>
      </form>
      <Cartao className="!p-0">
        {c.itens.length === 0 ? (
          <Vazio titulo="Nenhum candidato aqui." />
        ) : (
          <ul className="divide-y divide-line">
            {c.itens.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="w-9 shrink-0 text-right text-[0.85rem] font-bold tabular-nums">{r.nota}</span>
                <div className="min-w-0 flex-1">
                  <a href={r.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-[0.9rem] font-semibold hover:underline">{r.titulo} <ExternalLink className="inline size-3" aria-hidden /></a>
                  <p className="mt-0.5 text-[0.75rem] text-ink-soft">{[r.fonte, quando(r.criadoEm), r.motivo].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.temPrevia && <Botao href={`/admin/ai-news/previa/${r.id}`} variante="secundario" icone={Eye}>Prévia</Botao>}
                  {r.status === "pending" && <Botao variante="fantasma" icone={Trash2} onClick={() => f.submit({ intent: "descartar-candidato", id: String(r.id) }, { method: "post" })}>Descartar</Botao>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Pagination page={c.pagina} pages={c.paginas} basePath="/admin/ai-news" query={{ aba: "candidatos", status: c.status }} />
    </div>
  );
}

// ───────────── Histórico ─────────────

function Historico({ h }: { h: { itens: RodadaT[]; total: number; pagina: number; paginas: number } }) {
  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo={`Rodadas (${h.total})`} dica="Últimos 60 dias.">
        <ListaRodadas itens={h.itens} />
      </Cartao>
      <Pagination page={h.pagina} pages={h.paginas} basePath="/admin/ai-news" query={{ aba: "historico" }} />
    </div>
  );
}

// ───────────── Fontes ─────────────

type FonteT = { id: string; nome: string; site: string; rss: string | null; prioridade: number; ativa: boolean; ultimoStatus: string | null; ultimaBusca: string | null; falhasSeguidas: number };

function Fontes({ itens }: { itens: FonteT[] }) {
  const f = useFetcher<Resp>();
  const [editando, setEditando] = useState<FonteT | "nova" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {aviso(f.data)}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.9rem] font-semibold">{itens.length} fontes</p>
        <Botao variante="primario" icone={Plus} onClick={() => setEditando("nova")}>Nova fonte</Botao>
      </div>
      <Cartao className="!p-0">
        {itens.length === 0 ? (
          <Vazio titulo="Nenhuma fonte cadastrada." />
        ) : (
          <ul className="divide-y divide-line">
            {itens.map((s) => (
              <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.ativa ? "" : "opacity-60"}`}>
                <span className={`size-2.5 shrink-0 rounded-full ${!s.ativa ? "bg-ink-soft/40" : s.falhasSeguidas >= 3 ? "bg-warn" : "bg-ok"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.92rem] font-semibold">{s.nome}</p>
                  <p className="truncate text-[0.75rem] text-ink-soft">{[new URL(s.site).hostname, s.ultimoStatus ? `RSS ${s.ultimoStatus}` : "ainda não buscada", `prioridade ${s.prioridade}`, s.ultimaBusca ? `buscada ${quando(s.ultimaBusca)}` : null, s.falhasSeguidas >= 3 ? `falhou ${s.falhasSeguidas} vezes seguidas` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Botao variante="secundario" icone={RefreshCw} ocupado={f.state !== "idle" && f.formData?.get("id") === s.id} onClick={() => f.submit({ intent: "testar-fonte", id: s.id }, { method: "post" })}>Testar</Botao>
                  <Botao variante="fantasma" aria-label="Editar" icone={Pencil} onClick={() => setEditando(s)} className="!px-3" />
                  <Botao variante="fantasma" aria-label={s.ativa ? "Desligar" : "Ligar"} icone={Power} onClick={() => f.submit({ intent: "ligar-fonte", id: s.id, ativa: s.ativa ? "0" : "1" }, { method: "post" })} className="!px-3" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {editando && <FonteDialogo fonte={editando === "nova" ? null : editando} onFechar={() => setEditando(null)} f={f} />}
    </div>
  );
}

function FonteDialogo({ fonte, onFechar, f }: { fonte: FonteT | null; onFechar: () => void; f: ReturnType<typeof useFetcher<Resp>> }) {
  const [prio, setPrio] = useState(fonte?.prioridade ?? 5);
  useEffect(() => {
    if (f.data?.ok && f.state === "idle" && f.data.msg === "Fonte salva.") onFechar();
  }, [f.data, f.state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="dialog" aria-modal="true" aria-label={fonte ? "Editar fonte" : "Nova fonte"} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <f.Form method="post" className="w-[min(30rem,100%)] rounded-2xl border border-line bg-surface p-5 text-ink">
        <h2 className="text-[1.1rem] font-extrabold">{fonte ? "Editar fonte" : "Nova fonte"}</h2>
        <input type="hidden" name="intent" value="salvar-fonte" />
        <input type="hidden" name="id" value={fonte?.id ?? ""} />
        <div className="mt-3 flex flex-col gap-3">
          <label className={rot}>Nome<input name="nome" defaultValue={fonte?.nome} required maxLength={120} className={`${campo} h-10`} /></label>
          <label className={rot}>Endereço do site<input name="site" type="url" defaultValue={fonte?.site} required maxLength={600} placeholder="https://" className={`${campo} h-10`} /></label>
          <label className={rot}>RSS (opcional)<input name="rss" type="url" defaultValue={fonte?.rss ?? ""} maxLength={600} placeholder="vazio = o robô procura sozinho" className={`${campo} h-10`} /></label>
          <label className={rot}>Prioridade: {prio}<input name="prioridade" type="range" min={1} max={10} value={prio} onChange={(e) => setPrio(Number(e.target.value))} className="mt-1 w-full accent-[var(--brand)]" /></label>
        </div>
        {f.data && !f.data.ok && <div className="mt-3"><Aviso tom="erro">{f.data.msg}</Aviso></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" ocupado={f.state !== "idle"}>Salvar</Botao>
        </div>
      </f.Form>
    </div>
  );
}

// ───────────── Tópicos e bloqueios ─────────────

function Topicos({ itens }: { itens: { id: number; tipo: "topic" | "block"; termo: string; peso: number; ativo: boolean }[] }) {
  const f = useFetcher<Resp>();
  const bloco = (tipo: "topic" | "block", titulo: string, desc: string) => {
    const lista = itens.filter((t) => t.tipo === tipo);
    return (
      <Cartao titulo={`${titulo} (${lista.length})`} dica={desc}>
        <f.Form method="post" className="mb-3 flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="salvar-termo" />
          <input type="hidden" name="tipo" value={tipo} />
          <input name="termo" placeholder={tipo === "topic" ? "Novo tópico" : "Novo bloqueio"} aria-label="Termo" required minLength={2} maxLength={160} className={`${campo} mt-0 h-10 min-w-[10rem] flex-1`} />
          {tipo === "topic" && <input name="peso" type="number" min={1} max={100} defaultValue={10} aria-label="Peso (1 a 100)" className={`${campo} mt-0 h-10 w-20`} />}
          <Botao type="submit" variante="secundario" icone={Plus}>Adicionar</Botao>
        </f.Form>
        {lista.length === 0 ? (
          <Vazio titulo="Nada por aqui" />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {lista.map((t) => (
              <li key={t.id} className={`inline-flex items-center gap-1 rounded-full border border-line py-1 pr-1 pl-3 text-[0.82rem] ${t.ativo ? "" : "opacity-50"}`}>
                {t.termo}{tipo === "topic" && <b className="tabular-nums text-ink-soft"> {t.peso}</b>}
                <button type="button" onClick={() => f.submit({ intent: "alternar-termo", id: String(t.id), ativo: t.ativo ? "0" : "1" }, { method: "post" })} aria-label={t.ativo ? `Desligar ${t.termo}` : `Ligar ${t.termo}`} title={t.ativo ? "Desligar" : "Ligar"} className="grid size-6 place-items-center rounded-full text-ink-soft hover:bg-sunken"><Power className="size-3.5" aria-hidden /></button>
                <button type="button" onClick={() => f.submit({ intent: "apagar-termo", id: String(t.id) }, { method: "post" })} aria-label={`Apagar ${t.termo}`} title="Apagar" className="grid size-6 place-items-center rounded-full text-ink-soft hover:bg-sunken"><Trash2 className="size-3.5" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      {aviso(f.data)}
      {bloco("topic", "Tópicos", "O robô dá nota maior a notícias com esses termos (peso de 1 a 100).")}
      {bloco("block", "Bloqueios", "Notícias com esses termos nunca entram.")}
    </div>
  );
}

// ───────────── Horários e limites ─────────────

function Horarios({ h }: { h: { grade: { hora: number; posts: number }[]; limiteDia: number; foraDeAnimePct: number } }) {
  const f = useFetcher<Resp>();
  const [grade, setGrade] = useState(h.grade.map((x) => x.posts));
  const total = grade.reduce((a, b) => a + b, 0);
  return (
    <f.Form method="post" className="flex flex-col gap-4">
      <input type="hidden" name="intent" value="salvar-horarios" />
      {aviso(f.data)}
      <Cartao titulo="Quando o robô roda" dica="Quantas matérias por horário (de 0 a 3). Horário de Brasília.">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {grade.map((n, hora) => (
            <div key={hora} className={`flex flex-col items-center rounded-xl border border-line p-2 ${n === 0 ? "bg-sunken/40 text-ink-soft" : ""}`}>
              <span className="text-[0.8rem] font-bold tabular-nums">{String(hora).padStart(2, "0")}h</span>
              <input type="hidden" name={`h${hora}`} value={n} />
              <div className="mt-1 flex items-center gap-1">
                <button type="button" aria-label={`Menos uma às ${hora}h`} onClick={() => setGrade((g) => g.map((x, i) => (i === hora ? Math.max(0, x - 1) : x)))} className="grid size-7 place-items-center rounded-full hover:bg-sunken">−</button>
                <span className="w-4 text-center font-bold tabular-nums">{n}</span>
                <button type="button" aria-label={`Mais uma às ${hora}h`} onClick={() => setGrade((g) => g.map((x, i) => (i === hora ? Math.min(3, x + 1) : x)))} className="grid size-7 place-items-center rounded-full hover:bg-sunken">+</button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.82rem] text-ink-soft">{total} por dia pelos horários.</p>
      </Cartao>
      <Cartao titulo="Limites">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={rot}>Teto do dia (1 a 15)<input name="limiteDia" type="number" min={1} max={15} defaultValue={h.limiteDia} className={`${campo} h-10`} /></label>
          <label className={rot}>Matérias fora de anime, no máximo (%)<input name="foraDeAnimePct" type="number" min={0} max={100} defaultValue={h.foraDeAnimePct} className={`${campo} h-10`} /></label>
        </div>
      </Cartao>
      <div><Botao type="submit" variante="primario" ocupado={f.state !== "idle"}>Salvar horários e limites</Botao></div>
    </f.Form>
  );
}

// ───────────── Autores IA ─────────────

function Autores({ a }: { a: { autores: { id: string; nome: string; slug: string; categoria: string; especialidade: string | null; publicaSozinho: boolean; ativo: boolean }[]; categorias: string[] } }) {
  const f = useFetcher<Resp>();
  return (
    <div className="flex flex-col gap-4">
      {aviso(f.data)}
      <p className="text-[0.82rem] text-ink-soft">O nome e o endereço do autor não mudam aqui (mudar quebraria a página <code>/autores/…</code>).</p>
      {a.autores.length === 0 && <Vazio titulo="Nenhum autor de IA." />}
      {a.autores.map((x) => (
        <f.Form key={x.id} method="post" className="rounded-[14px] border border-line bg-surface p-4">
          <input type="hidden" name="intent" value="salvar-autor" />
          <input type="hidden" name="id" value={x.id} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{x.nome} <span className="text-[0.8rem] font-normal text-ink-soft">/autores/{x.slug}</span></p>
            <Botao type="submit" variante="secundario" ocupado={f.state !== "idle" && f.formData?.get("id") === x.id}>Salvar</Botao>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={rot}>Categoria
              <select name="categoria" defaultValue={x.categoria} className={`${campo} h-10`}>
                {[...new Set([x.categoria, ...a.categorias])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <div className="flex flex-col justify-end gap-2 text-[0.88rem]">
              <label className="flex items-center gap-2"><input type="checkbox" name="publicaSozinho" value="1" defaultChecked={x.publicaSozinho} className="size-4 accent-[var(--brand)]" /> Publica sozinho</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="ativo" value="1" defaultChecked={x.ativo} className="size-4 accent-[var(--brand)]" /> Ativo</label>
            </div>
            <label className={`${rot} sm:col-span-2`}>Especialidade (para o robô escolher o autor)
              <textarea name="especialidade" defaultValue={x.especialidade ?? ""} rows={3} maxLength={4000} className={`${campo} py-2`} />
            </label>
          </div>
        </f.Form>
      ))}
    </div>
  );
}

// ───────────── Configurações ─────────────

function Configuracoes({ c }: { c: { cfg: { modelo: string; imagensCorpo: number; chamadasDiaPorModelo: number }; guia: string; chave: boolean; modelos: string[] } }) {
  const a = useFetcher<Resp>();
  const b = useFetcher<Resp>();
  const [guia, setGuia] = useState(c.guia);
  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo="Gemini" dica="A chave fica só no servidor; aqui aparece apenas se está configurada.">
        <p className="mb-3 flex items-center gap-2 text-[0.88rem]">{c.chave ? <><CheckCircle2 className="size-4 text-ok" aria-hidden /> Chave configurada</> : <Selo tom="aviso">falta a chave (GEMINI_API_KEY)</Selo>}</p>
        {aviso(a.data)}
        <a.Form method="post" className="mt-2 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="intent" value="salvar-config" />
          <label className={rot}>Modelo<select name="modelo" defaultValue={c.cfg.modelo} className={`${campo} h-10`}>{c.modelos.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className={rot}>Imagens no texto (1 a 10)<input name="imagensCorpo" type="number" min={1} max={10} defaultValue={c.cfg.imagensCorpo} className={`${campo} h-10`} /></label>
          <label className={rot}>Chamadas por dia, por modelo<input name="chamadasDiaPorModelo" type="number" min={1} max={1000} defaultValue={c.cfg.chamadasDiaPorModelo} className={`${campo} h-10`} /></label>
          <div className="sm:col-span-3"><Botao type="submit" variante="primario" ocupado={a.state !== "idle"}>Salvar configurações</Botao></div>
        </a.Form>
      </Cartao>
      <Cartao titulo="Guia editorial" dica="O texto que orienta o robô ao escrever. Fica no banco (o repositório é público).">
        {aviso(b.data)}
        <b.Form method="post" className="mt-2">
          <input type="hidden" name="intent" value="salvar-guia" />
          <textarea name="guia" value={guia} onChange={(e) => setGuia(e.target.value)} rows={18} spellCheck={false} aria-label="Guia editorial" className="w-full rounded-[10px] border border-line bg-surface p-3 font-mono text-[0.8rem] leading-relaxed focus:outline-none" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[0.75rem] text-ink-soft tabular-nums">{guia.length.toLocaleString("pt-BR")} caracteres</span>
            <Botao type="submit" variante="primario" ocupado={b.state !== "idle"} disabled={guia === c.guia}>Salvar guia</Botao>
          </div>
        </b.Form>
      </Cartao>
    </div>
  );
}
