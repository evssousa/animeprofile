// Posts (/admin/posts): lista paginada no servidor, com abas de status, filtros na URL e exclusão de rascunhos.
// O editor (novo post, editar, publicar, agendar) é o próximo passo (docs/plano-telas-painel.md, tela 3).
import { useState } from "react";
import { Form, Link, useSubmit } from "react-router";
import { ExternalLink, Trash2, X } from "lucide-react";
import type { Route } from "./+types/posts";
import { Pagination } from "~/components/posts";
import { Abas, Aviso, Botao, Cabecalho, Cartao, Confirmar, Selo, Vazio } from "~/components/admin/ui";
import { adminMeta } from "~/lib/admin-meta";
import { excluirRascunhos, lerFiltros, listarPosts, type LinhaPost, type OrigemPost, type StatusLista } from "~/server/admin/posts.server";
import { requireAdmin } from "~/server/auth/viewer.server";

export const meta = () => adminMeta("Posts");

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const filtros = lerFiltros(new URL(request.url).searchParams);
  try {
    return { erro: false as const, filtros, lista: await listarPosts(filtros) };
  } catch (e) {
    console.error(`[posts] não consegui listar: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return { erro: true as const };
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (String(form.get("intent")) !== "excluir") return { erro: "Ação desconhecida." };
  try {
    const n = await excluirRascunhos(form.getAll("id").map(String));
    return n > 0 ? { ok: n === 1 ? "1 rascunho excluído." : `${n} rascunhos excluídos.` } : { erro: "Só rascunhos podem ser excluídos. Despublique a matéria antes." };
  } catch (e) {
    console.error(`[posts] exclusão falhou: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    return { erro: "Não deu para excluir agora. Tente de novo." };
  }
}

const ORIGEM_ROTULO: Record<OrigemPost, string> = { old: "Site antigo", robo: "Robô", agenda: "Agenda", painel: "Painel" };
const data = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const fmt = new Intl.NumberFormat("pt-BR");

function Linha({ p, marcado, onMarcar }: { p: LinhaPost; marcado: boolean; onMarcar: (v: boolean) => void }) {
  const rascunho = p.status === "draft";
  return (
    <li className="flex items-start gap-3 px-3 py-3 hover:bg-sunken/60">
      <input
        type="checkbox"
        checked={marcado}
        disabled={!rascunho}
        onChange={(e) => onMarcar(e.target.checked)}
        aria-label={rascunho ? `Selecionar “${p.titulo}”` : "Só rascunhos podem ser selecionados"}
        title={rascunho ? undefined : "Só rascunhos podem ser excluídos"}
        className="mt-1 size-4 shrink-0 accent-[var(--brand)] disabled:opacity-30"
      />
      {p.capa ? <img src={p.capa} alt="" width={96} height={54} loading="lazy" className="hidden aspect-video w-24 shrink-0 rounded-md object-cover sm:block" /> : <span className="hidden aspect-video w-24 shrink-0 rounded-md bg-sunken sm:block" />}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.92rem] leading-snug font-semibold">{p.titulo}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-soft">
          <Selo tom={p.status === "published" ? "ok" : p.status === "scheduled" ? "aviso" : "neutro"}>{p.status === "published" ? "Publicado" : p.status === "scheduled" ? "Agendado" : "Rascunho"}</Selo>
          <span>{p.tipo === "article" ? "Artigo" : "Notícia"}</span>
          {p.categoria && <span>· {p.categoria}</span>}
          <span>· {ORIGEM_ROTULO[p.origem]}</span>
          {p.autor && <span>· {p.autor}</span>}
          {p.publicadoEm && <span className="tabular-nums">· {data.format(new Date(p.publicadoEm))}</span>}
          <span className="tabular-nums">· {fmt.format(p.vistas)} vistas</span>
        </p>
      </div>
      {p.status === "published" && (
        <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Abrir “${p.titulo}” no site`} title="Ver no site" className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sunken hover:text-ink">
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
    </li>
  );
}

export default function Posts({ loaderData, actionData }: Route.ComponentProps) {
  const submit = useSubmit();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  if (loaderData.erro)
    return (
      <div>
        <Cabecalho titulo="Posts" />
        <div className="mt-4">
          <Aviso tom="erro">
            Não deu para ler os posts agora. <Link to="/admin/posts" reloadDocument className="font-bold underline">Tentar de novo</Link>
          </Aviso>
        </div>
      </div>
    );
  const { filtros: f, lista } = loaderData;
  const q = (extra: Record<string, string>) => {
    const sp = new URLSearchParams();
    const base: Record<string, string> = { status: f.status === "todos" ? "" : f.status, tipo: f.tipo, origem: f.origem, autor: f.autor, q: f.q, ordem: f.ordem === "recentes" ? "" : f.ordem, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/admin/posts?${s}` : "/admin/posts";
  };
  const abas: { id: StatusLista; rotulo: string }[] = [
    { id: "todos", rotulo: "Todos" },
    { id: "published", rotulo: "Publicados" },
    { id: "scheduled", rotulo: "Agendados" },
    { id: "draft", rotulo: "Rascunhos" },
  ];
  const filtrando = !!(f.tipo || f.origem || f.autor || f.q);
  const idsVisiveis = new Set(lista.itens.map((p) => p.id));
  const sel = marcados.filter((id) => idsVisiveis.has(id));
  const select = "h-10 rounded-[10px] border border-line bg-surface px-3 text-[0.88rem] focus:outline-none";
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo="Posts" desc="Notícias e artigos do site: ver o que está no ar, o que está agendado e os rascunhos." />
      {actionData && "ok" in actionData && <Aviso tom="ok">{actionData.ok}</Aviso>}
      {actionData && "erro" in actionData && <Aviso tom="erro">{actionData.erro}</Aviso>}
      <Abas ativo={f.status} itens={abas.map((a) => ({ id: a.id, rotulo: a.rotulo, href: q({ status: a.id === "todos" ? "" : a.id }), n: lista.contagens[a.id] }))} />

      <Form method="get" className="flex flex-wrap items-center gap-2" onChange={(e) => (e.target as HTMLElement).tagName === "SELECT" && submit(e.currentTarget)}>
        {f.status !== "todos" && <input type="hidden" name="status" value={f.status} />}
        <input type="search" name="q" defaultValue={f.q} placeholder="Buscar por título ou endereço" aria-label="Buscar por título ou endereço" maxLength={100} className={`${select} min-w-[12rem] flex-1 sm:max-w-sm`} />
        <select name="tipo" defaultValue={f.tipo} aria-label="Tipo" className={select}>
          <option value="">Notícias e artigos</option>
          <option value="news">Notícias</option>
          <option value="article">Artigos</option>
        </select>
        <select name="origem" defaultValue={f.origem} aria-label="Origem" className={select}>
          <option value="">Todas as origens</option>
          {(Object.keys(ORIGEM_ROTULO) as OrigemPost[]).map((o) => (
            <option key={o} value={o}>
              {ORIGEM_ROTULO[o]}
            </option>
          ))}
        </select>
        <select name="autor" defaultValue={f.autor} aria-label="Autor" className={`${select} max-w-[11rem]`}>
          <option value="">Todos os autores</option>
          {lista.autores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <select name="ordem" defaultValue={f.ordem} aria-label="Ordem" className={select}>
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigas</option>
          <option value="vistas">Mais vistas</option>
        </select>
        <Botao type="submit" variante="secundario">
          Filtrar
        </Botao>
        {filtrando && (
          <Botao href={q({ tipo: "", origem: "", autor: "", q: "" })} variante="fantasma" icone={X}>
            Limpar
          </Botao>
        )}
      </Form>

      <Cartao className="!p-0">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-[0.85rem] text-ink-soft">
          {sel.length > 0 ? (
            <>
              <span className="font-semibold text-ink">{sel.length === 1 ? "1 rascunho selecionado" : `${sel.length} rascunhos selecionados`}</span>
              <span className="flex gap-2">
                <Botao variante="fantasma" onClick={() => setMarcados([])}>
                  Cancelar
                </Botao>
                <Botao variante="perigo" icone={Trash2} onClick={() => setConfirmar(true)}>
                  Excluir
                </Botao>
              </span>
            </>
          ) : (
            <span className="tabular-nums">{lista.total === 0 ? "Nenhum post" : `Mostrando ${(lista.pagina - 1) * 25 + 1}–${Math.min(lista.total, lista.pagina * 25)} de ${fmt.format(lista.total)}`}</span>
          )}
        </div>
        {lista.itens.length === 0 ? (
          <Vazio titulo="Nenhum post aqui." texto={filtrando ? "Nenhum post combina com os filtros." : undefined} acao={filtrando ? <Botao href={q({ tipo: "", origem: "", autor: "", q: "" })}>Limpar filtros</Botao> : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {lista.itens.map((p) => (
              <Linha key={p.id} p={p} marcado={sel.includes(p.id)} onMarcar={(v) => setMarcados((m) => (v ? [...new Set([...m, p.id])] : m.filter((x) => x !== p.id)))} />
            ))}
          </ul>
        )}
      </Cartao>
      <Pagination page={lista.pagina} pages={lista.paginas} basePath="/admin/posts" query={Object.fromEntries(new URL(q({}), "http://x").searchParams)} />

      <Confirmar
        aberto={confirmar}
        titulo={sel.length === 1 ? "Excluir este rascunho?" : `Excluir ${sel.length} rascunhos?`}
        texto="O rascunho some de vez, com as versões dele. Matérias publicadas nunca são excluídas por aqui."
        botao="Excluir"
        onCancelar={() => setConfirmar(false)}
        onConfirmar={() => {
          const fd = new FormData();
          fd.set("intent", "excluir");
          for (const id of sel) fd.append("id", id);
          setConfirmar(false);
          setMarcados([]);
          submit(fd, { method: "post" });
        }}
      />
    </div>
  );
}
