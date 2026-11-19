// Editor de matéria do painel (/admin/posts/novo e /admin/posts/:id): título, texto (Tiptap), capa, categorias, tags, SEO,
// checklist para publicar, agendamento, versões e cópia local. O servidor confere tudo de novo ao salvar.
// Docs: docs/plano-telas-painel.md (tela 3).
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { data, Link, useBlocker, useFetcher, useNavigate } from "react-router";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Eye, Loader2, Lock, Plus, Save, Send, Trash2, Upload, Undo2 } from "lucide-react";
import type { Route } from "./+types/posts-editar";
import { Aviso, Botao, Cartao, Confirmar, Selo } from "~/components/admin/ui";
import { adminMeta } from "~/lib/admin-meta";
import { autoExcerpt, checagensSeo, checklistPublicar, contarMarcacoes, htmlToPlain, removerMarcacoes, slugify, wordCount, type SaveAction } from "~/lib/post-editor";
import { carregarPost, criarCategoria, criarTag, lerVersao, opcoesEditor, salvarPost, type ResultadoSalvar } from "~/server/admin/posts-edit.server";
import { requireAdmin } from "~/server/auth/viewer.server";

const EditorTexto = lazy(() => import("~/components/admin/EditorTexto").then((m) => ({ default: m.EditorTexto })));

export const meta = () => adminMeta("Editar post");

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const opcoes = await opcoesEditor();
  if (!params.id) return { post: null, versoes: [], opcoes };
  const r = await carregarPost(params.id);
  if (!r) throw data("Post não encontrado", { status: 404 });
  return { post: r.post, versoes: r.versoes, opcoes };
}

const ACOES: SaveAction[] = ["draft", "publish", "schedule", "keep", "unpublish"];

type Resp =
  | { intent: "salvar"; r: ResultadoSalvar }
  | { intent: "categoria"; categoria: Awaited<ReturnType<typeof criarCategoria>> }
  | { intent: "tag"; tag: Awaited<ReturnType<typeof criarTag>> }
  | { intent: "versao"; versao: NonNullable<Awaited<ReturnType<typeof lerVersao>>> }
  | { intent: "erro"; erro: string };

export async function action({ request }: Route.ActionArgs): Promise<Resp> {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    if (intent === "salvar") {
      const acao = String(form.get("acao")) as SaveAction;
      if (!ACOES.includes(acao)) return { intent: "erro", erro: "Ação desconhecida." };
      let dados: unknown;
      try {
        dados = JSON.parse(String(form.get("dados") ?? ""));
      } catch {
        return { intent: "erro", erro: "Dados inválidos." };
      }
      return { intent: "salvar", r: await salvarPost(dados, acao) };
    }
    if (intent === "criar-categoria") return { intent: "categoria", categoria: await criarCategoria(String(form.get("nome") ?? ""), form.get("tipo") === "article" ? "article" : "news") };
    if (intent === "criar-tag") return { intent: "tag", tag: await criarTag(String(form.get("nome") ?? "")) };
    if (intent === "versao") {
      const v = await lerVersao(String(form.get("post")), Number(form.get("versao")));
      return v ? { intent: "versao", versao: v } : { intent: "erro", erro: "Versão não encontrada." };
    }
    return { intent: "erro", erro: "Ação desconhecida." };
  } catch (e) {
    return { intent: "erro", erro: (e as Error).message || "Não deu para concluir. Tente de novo." };
  }
}

type Formulario = { titulo: string; slug: string; resumo: string; capa: string; tipo: "news" | "article"; html: string; categoriaIds: string[]; tagIds: string[]; palavraChave: string; autorId: string; publicadoEm: string; agendar: boolean };

/** ISO (UTC) para o campo datetime-local, no horário do navegador. */
function paraCampo(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const campo = "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 text-[0.9rem] focus:outline-none";
const rotulo = "text-[0.7rem] font-bold tracking-[0.08em] text-ink-soft uppercase";
const hora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const SALVA_POR: Record<string, string> = { painel: "você", robo: "robô", agenda: "agenda", antigo: "site antigo" };

export default function EditarPost({ loaderData }: Route.ComponentProps) {
  const { post, versoes, opcoes } = loaderData;
  const navigate = useNavigate();
  const salvar = useFetcher<typeof action>();
  const taxo = useFetcher<typeof action>();
  const ver = useFetcher<typeof action>();

  const inicial: Formulario = useMemo(
    () => ({
      titulo: post?.titulo ?? "",
      slug: post?.slug ?? "",
      resumo: post?.resumo ?? "",
      capa: post?.capa ?? "",
      tipo: post?.tipo ?? "news",
      html: post?.html ?? "",
      categoriaIds: post?.categoriaIds ?? [],
      tagIds: post?.tagIds ?? [],
      palavraChave: post?.palavraChave ?? "",
      autorId: post?.autorId ?? "",
      publicadoEm: paraCampo(post?.publicadoEm ?? null),
      agendar: post?.status === "scheduled",
    }),
    [post],
  );
  const [f, setF] = useState<Formulario>(inicial);
  const [status, setStatus] = useState<"draft" | "scheduled" | "published">(post?.status ?? "draft");
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(post?.atualizadoEm ?? null);
  const [jaPublicado, setJaPublicado] = useState(post?.jaPublicado ?? false);
  const salvo = useRef(JSON.stringify(inicial));
  const [salvoAs, setSalvoAs] = useState<Date | null>(null);
  const [erro, setErro] = useState<{ texto: string; faltando?: string[]; conflito?: boolean } | null>(null);
  const [slugMexido, setSlugMexido] = useState(!!post);
  const [categorias, setCategorias] = useState(opcoes.categorias);
  const [tags, setTags] = useState(opcoes.tags);
  const [buscaTag, setBuscaTag] = useState("");
  const [novaCat, setNovaCat] = useState("");
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [restaurar, setRestaurar] = useState<number | null>(null);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const checklistRef = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLTextAreaElement>(null);

  const dirty = JSON.stringify(f) !== salvo.current;
  const plain = useMemo(() => htmlToPlain(f.html), [f.html]);
  const marcacoes = useMemo(() => contarMarcacoes(f.html), [f.html]);
  const checklist = checklistPublicar({ title: f.titulo, html: f.html, featuredImage: f.capa, categoryCount: f.categoriaIds.length });
  const seo = checagensSeo({ title: f.titulo, html: f.html, excerpt: f.resumo || autoExcerpt(plain), focusKeyword: f.palavraChave });
  const ocupado = salvar.state !== "idle";
  const tituloVazio = f.titulo.trim().length === 0;

  // O título cresce com o texto.
  useEffect(() => {
    const t = titulo.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  }, [f.titulo]);

  // Endereço automático enquanto ninguém mexeu nele.
  useEffect(() => {
    if (!slugMexido && f.titulo) setF((x) => ({ ...x, slug: slugify(x.titulo) }));
  }, [f.titulo, slugMexido]);

  // Aviso do navegador ao fechar/recarregar com alterações; e do React Router ao trocar de página.
  useEffect(() => {
    if (!dirty) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [dirty]);
  const bloqueio = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname && !salvar.data);

  // Cópia local: se a aba fechar ou a internet cair, dá para recuperar.
  const chaveCopia = `ap-post-${post?.id ?? "novo"}`;
  const [copia, setCopia] = useState<{ f: Formulario; em: number } | null>(null);
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(chaveCopia);
      if (!bruto) return;
      const c = JSON.parse(bruto) as { f?: Formulario; em?: number };
      if (c?.f && typeof c.em === "number" && JSON.stringify(c.f) !== salvo.current) setCopia({ f: c.f, em: c.em });
      else localStorage.removeItem(chaveCopia);
    } catch {
      /* sem armazenamento local */
    }
  }, [chaveCopia]);
  useEffect(() => {
    if (!dirty || copia) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(chaveCopia, JSON.stringify({ f, em: Date.now() }));
      } catch {
        /* cheio ou bloqueado */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [f, dirty, copia, chaveCopia]);
  const largarCopia = () => {
    try {
      localStorage.removeItem(chaveCopia);
    } catch {
      /* ignora */
    }
    setCopia(null);
  };

  function entrada(acao: SaveAction) {
    const quando = acao === "schedule" || (f.agendar && acao !== "publish") || status === "published" ? new Date(f.publicadoEm).toISOString() : null;
    return {
      id: post?.id ?? null,
      titulo: f.titulo,
      slug: f.slug,
      resumo: f.resumo,
      capa: f.capa,
      tipo: f.tipo,
      html: f.html,
      categoriaIds: f.categoriaIds,
      tagIds: f.tagIds,
      publicadoEm: Number.isFinite(new Date(f.publicadoEm).getTime()) ? quando : null,
      palavraChave: f.palavraChave,
      autorId: f.autorId || null,
      atualizadoEm,
    };
  }
  function enviar(acao: SaveAction) {
    if (ocupado) return;
    setErro(null);
    salvar.submit({ intent: "salvar", acao, dados: JSON.stringify(entrada(acao)) }, { method: "post" });
  }

  // Resposta do servidor ao salvar.
  const respSalvar = salvar.data;
  const aplicada = useRef<unknown>(null);
  useEffect(() => {
    if (!respSalvar || aplicada.current === respSalvar) return;
    aplicada.current = respSalvar;
    if (respSalvar.intent === "erro") return setErro({ texto: respSalvar.erro });
    if (respSalvar.intent !== "salvar") return;
    const r = respSalvar.r;
    if (!r.ok) {
      setErro({ texto: r.erro, faltando: r.faltando, conflito: r.conflito });
      if (r.faltando) checklistRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const novo: Formulario = { ...f, slug: r.slug, publicadoEm: r.publicadoEm ? paraCampo(r.publicadoEm) : f.publicadoEm, agendar: r.status === "scheduled" };
    salvo.current = JSON.stringify(novo);
    setF(novo);
    setStatus(r.status);
    setAtualizadoEm(r.atualizadoEm);
    setJaPublicado((j) => j || r.publicadoEm !== null);
    setSalvoAs(new Date());
    largarCopia();
    if (!post) navigate(`/admin/posts/${r.id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respSalvar]);

  // Ctrl/⌘+S salva sem mudar o status.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        enviar(status === "draft" ? "draft" : "keep");
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  // Categoria e tag criadas, versão restaurada.
  const respTaxo = taxo.data;
  useEffect(() => {
    if (!respTaxo) return;
    if (respTaxo.intent === "categoria") {
      const c = respTaxo.categoria;
      setCategorias((l) => (l.some((x) => x.id === c.id) ? l : [...l, { id: c.id, nome: c.nome, tipo: c.tipo, slug: c.slug }]));
      setF((x) => (x.categoriaIds.includes(c.id) ? x : { ...x, categoriaIds: [...x.categoriaIds, c.id] }));
      setNovaCat("");
    } else if (respTaxo.intent === "tag") {
      const t = respTaxo.tag;
      setTags((l) => (l.some((x) => x.id === t.id) ? l : [...l, { id: t.id, nome: t.nome, usos: 0 }]));
      setF((x) => (x.tagIds.includes(t.id) ? x : { ...x, tagIds: [...x.tagIds, t.id] }));
      setBuscaTag("");
    } else if (respTaxo.intent === "erro") setErroImagem(respTaxo.erro);
  }, [respTaxo]);
  const respVer = ver.data;
  useEffect(() => {
    if (respVer?.intent === "versao") setF((x) => ({ ...x, titulo: respVer.versao.titulo, resumo: respVer.versao.resumo, html: respVer.versao.html, capa: respVer.versao.capa }));
  }, [respVer]);

  async function enviarImagem(arquivo: File): Promise<string | null> {
    setErroImagem(null);
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    try {
      const r = await fetch("/admin/posts/imagem", { method: "POST", body: fd, credentials: "same-origin" });
      const j = (await r.json()) as { url?: string; erro?: string };
      if (!r.ok || !j.url) {
        setErroImagem(j.erro ?? "Não deu para enviar a imagem.");
        return null;
      }
      return j.url;
    } catch {
      setErroImagem("Sem conexão. Tente de novo.");
      return null;
    }
  }

  const tipoCat = f.tipo;
  const catsVisiveis = categorias.filter((c) => (c.tipo === tipoCat || c.tipo === "both") && c.slug !== "artigos" || f.categoriaIds.includes(c.id));
  const tagsFiltradas = useMemo(() => {
    const q = buscaTag.trim().toLowerCase();
    return q ? tags.filter((t) => t.nome.toLowerCase().includes(q) && !f.tagIds.includes(t.id)).slice(0, 8) : [];
  }, [buscaTag, tags, f.tagIds]);
  const tagsEscolhidas = f.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is (typeof tags)[number] => !!t);
  const travarSlug = jaPublicado;
  // Quem assina hoje sempre aparece na lista, mesmo que não seja mais "autor" (para não perder a assinatura ao salvar).
  const autoresOpcoes = post?.autorId && !opcoes.autores.some((a) => a.id === post.autorId) ? [...opcoes.autores, { id: post.autorId, nome: post.autor ?? "Autor", ia: false }] : opcoes.autores;

  return (
    <div className="pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/admin/posts" className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Posts
        </Link>
        <p className="text-[0.8rem] text-ink-soft">{post ? (f.tipo === "article" ? "Editar artigo" : "Editar notícia") : f.tipo === "article" ? "Novo artigo" : "Nova notícia"} · Ctrl+S salva</p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ───────── coluna do texto ───────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <textarea ref={titulo} rows={1} value={f.titulo} onChange={(e) => setF((x) => ({ ...x, titulo: e.target.value }))} placeholder="Título da matéria" aria-label="Título" maxLength={300} className="w-full resize-none bg-transparent text-[1.9rem] leading-tight font-extrabold tracking-[-0.02em] placeholder:text-ink-soft/50 focus:outline-none" />
          <div className="flex flex-wrap items-center gap-2 text-[0.82rem] text-ink-soft">
            <span>{f.tipo === "article" ? "/artigos/" : "/noticias/"}</span>
            {travarSlug ? (
              <span className="inline-flex items-center gap-1 font-semibold text-ink" title="O endereço não muda depois de publicado (não há redirecionamento de matérias)">
                <Lock className="size-3.5" aria-hidden /> {f.slug}
              </span>
            ) : (
              <input value={f.slug} onChange={(e) => (setSlugMexido(true), setF((x) => ({ ...x, slug: slugify(e.target.value) })))} aria-label="Endereço da matéria" className="min-w-[10rem] flex-1 rounded-md border border-line bg-surface px-2 py-1 text-ink" />
            )}
            {post && status === "published" && (
              <a href={post.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-link hover:underline">
                Ver no site <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>

          {copia && (
            <Aviso>
              <p>
                Há uma versão não salva de {hora.format(new Date(copia.em))} guardada neste navegador.{" "}
                <button type="button" className="font-bold underline" onClick={() => (setF(copia.f), setCopia(null))}>Recuperar</button>{" "}·{" "}
                <button type="button" className="font-bold underline" onClick={largarCopia}>Descartar</button>
              </p>
            </Aviso>
          )}
          {marcacoes > 0 && (
            <Aviso>
              <p>
                {marcacoes === 1 ? "1 marcação ✍️ ainda sem resposta" : `${marcacoes} marcações ✍️ ainda sem resposta`}: o servidor não deixa publicar com elas.{" "}
                <button type="button" className="font-bold underline" onClick={() => setF((x) => ({ ...x, html: removerMarcacoes(x.html) }))}>Limpar marcações</button>
              </p>
            </Aviso>
          )}
          {erro && (
            <Aviso tom="erro">
              <p>{erro.texto}</p>
              {erro.conflito && <button type="button" className="mt-1 font-bold underline" onClick={() => window.location.reload()}>Recarregar a página</button>}
            </Aviso>
          )}
          {erroImagem && <Aviso tom="erro">{erroImagem}</Aviso>}

          <Suspense fallback={<div className="h-[480px] animate-pulse rounded-xl border border-line bg-surface motion-reduce:animate-none" aria-busy="true" />}>
            <EditorTexto value={f.html} onChange={(html) => setF((x) => ({ ...x, html }))} onEnviarImagem={enviarImagem} />
          </Suspense>
          <p className="text-[0.8rem] text-ink-soft tabular-nums">{wordCount(plain)} palavras · {Math.max(1, Math.round(wordCount(plain) / 200))} min de leitura</p>

          <label className="block">
            <span className={rotulo}>Resumo</span>
            <textarea rows={3} value={f.resumo} onChange={(e) => setF((x) => ({ ...x, resumo: e.target.value }))} maxLength={600} placeholder="Vazio = começo do texto" className={`${campo} py-2`} />
            <span className="text-[0.75rem] text-ink-soft tabular-nums">{f.resumo.length}/600</span>
          </label>
        </div>

        {/* ───────── lateral ───────── */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Cartao titulo="Publicação" acao={<Selo tom={status === "published" ? "ok" : status === "scheduled" ? "aviso" : "neutro"}>{status === "published" ? "Publicado" : status === "scheduled" ? "Agendado" : "Rascunho"}</Selo>}>
            <div className="flex flex-col gap-3">
              <label className="block text-[0.8rem] font-semibold">
                Assinado por
                <select value={f.autorId} onChange={(e) => setF((x) => ({ ...x, autorId: e.target.value }))} className={`${campo} h-10`}>
                  <option value="">Sem assinatura</option>
                  {autoresOpcoes.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}{a.ia ? " (IA)" : ""}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="text-[0.8rem] font-semibold">Tipo</span>
                <div className="mt-1 flex gap-1" role="group" aria-label="Tipo">
                  {(["news", "article"] as const).map((t) => (
                    <button key={t} type="button" disabled={status !== "draft" || jaPublicado} onClick={() => setF((x) => ({ ...x, tipo: t, categoriaIds: [] }))} aria-pressed={f.tipo === t} className={`h-9 flex-1 rounded-full border text-[0.85rem] font-semibold disabled:opacity-60 ${f.tipo === t ? "border-brand bg-brand-soft text-brand dark:text-glow" : "border-line hover:bg-sunken"}`}>
                      {t === "news" ? "Notícia" : "Artigo"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-[0.8rem] font-semibold">
                {f.agendar || status === "scheduled" ? "Publicar em" : "Data de publicação"}
                <input type="datetime-local" value={f.publicadoEm} onChange={(e) => setF((x) => ({ ...x, publicadoEm: e.target.value }))} className={`${campo} h-10`} />
              </label>
              {status !== "published" && (
                <label className="flex items-center gap-2 text-[0.85rem]">
                  <input type="checkbox" checked={f.agendar} onChange={(e) => setF((x) => ({ ...x, agendar: e.target.checked }))} className="size-4 accent-[var(--brand)]" /> Agendar para depois
                </label>
              )}
            </div>
          </Cartao>

          <div ref={checklistRef}>
            <Cartao titulo="Para publicar">
              <ul className="flex flex-col gap-1.5 text-[0.85rem]">
                {checklist.map((c) => {
                  const faltou = erro?.faltando?.includes(c.label) && !c.ok;
                  return (
                    <li key={c.id} className={`flex items-start gap-2 ${c.ok ? "text-ink-soft" : faltou ? "font-semibold text-warn" : ""}`}>
                      {c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}
                      {c.label}
                    </li>
                  );
                })}
              </ul>
            </Cartao>
          </div>

          <Cartao titulo="Capa">
            {f.capa ? <img src={f.capa} alt="Capa da matéria" className="aspect-video w-full rounded-lg object-cover" /> : <div className="grid aspect-video w-full place-items-center rounded-lg border-2 border-dashed border-line text-[0.8rem] text-ink-soft">Sem capa</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-[0.85rem] font-semibold hover:bg-sunken">
                {enviandoCapa ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} {enviandoCapa ? "Enviando…" : f.capa ? "Trocar" : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const a = e.target.files?.[0];
                    e.target.value = "";
                    if (!a) return;
                    setEnviandoCapa(true);
                    const url = await enviarImagem(a);
                    setEnviandoCapa(false);
                    if (url) setF((x) => ({ ...x, capa: url }));
                  }}
                />
              </label>
              {f.capa && <Botao variante="fantasma" onClick={() => setF((x) => ({ ...x, capa: "" }))}>Tirar</Botao>}
            </div>
            <label className="mt-3 block text-[0.75rem] font-semibold text-ink-soft">
              ou cole o endereço da imagem
              <input value={f.capa} onChange={(e) => setF((x) => ({ ...x, capa: e.target.value }))} placeholder="https://…" maxLength={600} className={`${campo} h-9`} />
            </label>
          </Cartao>

          <Cartao titulo="Categorias">
            <div className="flex flex-wrap gap-1.5">
              {catsVisiveis.map((c) => {
                const on = f.categoriaIds.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => setF((x) => ({ ...x, categoriaIds: on ? x.categoriaIds.filter((i) => i !== c.id) : [...x.categoriaIds, c.id] }))} className={`h-8 rounded-full border px-3 text-[0.8rem] font-semibold ${on ? "border-brand bg-brand-soft text-brand dark:text-glow" : "border-line hover:bg-sunken"}`}>
                    {c.nome}
                  </button>
                );
              })}
              {catsVisiveis.length === 0 && <p className="text-[0.8rem] text-ink-soft">Nenhuma categoria para este tipo ainda.</p>}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (novaCat.trim().length >= 2) taxo.submit({ intent: "criar-categoria", nome: novaCat, tipo: f.tipo }, { method: "post" });
              }}
            >
              <input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nova categoria" aria-label="Nova categoria" maxLength={120} className={`${campo} mt-0 h-9 flex-1`} />
              <Botao type="submit" variante="secundario" icone={Plus} aria-label="Criar categoria" className="!h-9 !px-3">Criar</Botao>
            </form>
          </Cartao>

          <Cartao titulo="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tagsEscolhidas.map((t) => (
                <button key={t.id} type="button" onClick={() => setF((x) => ({ ...x, tagIds: x.tagIds.filter((i) => i !== t.id) }))} aria-label={`Tirar a tag ${t.nome}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-brand-soft px-3 text-[0.8rem] font-semibold text-brand dark:text-glow">
                  #{t.nome} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
            <form
              className="mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (buscaTag.trim().length >= 2) taxo.submit({ intent: "criar-tag", nome: buscaTag }, { method: "post" });
              }}
            >
              <input value={buscaTag} onChange={(e) => setBuscaTag(e.target.value)} placeholder="Buscar ou criar tag (Enter)" aria-label="Buscar ou criar tag" maxLength={80} className={`${campo} mt-0 h-9`} />
            </form>
            {tagsFiltradas.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {tagsFiltradas.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => (setF((x) => ({ ...x, tagIds: [...x.tagIds, t.id] })), setBuscaTag(""))} className="h-8 rounded-full border border-line px-3 text-[0.8rem] hover:bg-sunken">
                      #{t.nome} <span className="text-ink-soft tabular-nums">{t.usos}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="SEO">
            <label className="block text-[0.8rem] font-semibold">
              Palavra-chave
              <input value={f.palavraChave} onChange={(e) => setF((x) => ({ ...x, palavraChave: e.target.value }))} maxLength={200} className={`${campo} h-9`} />
            </label>
            <ul className="mt-3 flex flex-col gap-1 text-[0.8rem]">
              {seo.map((c) => (
                <li key={c.id} className={`flex items-center gap-2 ${c.ok ? "text-ink-soft" : ""}`}>
                  {c.ok ? <Check className="size-3.5 text-ok" aria-hidden /> : <AlertTriangle className="size-3.5 text-warn" aria-hidden />} {c.label}
                </li>
              ))}
            </ul>
          </Cartao>

          {post && (
            <Cartao titulo="Versões" dica="As 20 últimas, de antes de cada gravação.">
              {versoes.length === 0 ? (
                <p className="text-[0.8rem] text-ink-soft">Ainda sem versões anteriores.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {versoes.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-[0.8rem]">
                      <span className="min-w-0">
                        <span className="tabular-nums">{hora.format(new Date(v.criadaEm))}</span> · {SALVA_POR[v.salvaPor] ?? v.salvaPor}
                        <span className="block truncate text-ink-soft">{v.titulo}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <a href={`/admin/posts/${post.id}/previa?versao=${v.id}`} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sunken" aria-label="Ver esta versão" title="Ver"><Eye className="size-4" aria-hidden /></a>
                        <button type="button" onClick={() => setRestaurar(v.id)} className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-sunken" aria-label="Restaurar esta versão" title="Restaurar"><Undo2 className="size-4" aria-hidden /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          )}

          {post && status === "draft" && (
            <Botao variante="perigo" icone={Trash2} onClick={() => setConfirmarExcluir(true)}>
              Excluir rascunho
            </Botao>
          )}
        </aside>
      </div>

      {/* ───────── barra de ações ───────── */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:left-[72px] xl:left-64 xl:mini:left-[72px]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-[0.82rem] text-ink-soft" aria-live="polite">
            {dirty ? (
              <>
                <span className="size-2 rounded-full bg-warn" aria-hidden /> <span className="hidden sm:inline">Alterações não salvas</span>
              </>
            ) : salvoAs ? (
              <span className="text-ok">Salvo às {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(salvoAs)}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {post && (
              <Botao href={`/admin/posts/${post.id}/previa`} variante="fantasma" icone={Eye} aria-label="Prévia" className="max-sm:!px-3">
                <span className="hidden sm:inline">Prévia</span>
              </Botao>
            )}
            {status === "draft" && (
              <>
                <Botao variante="secundario" icone={Save} ocupado={ocupado} disabled={tituloVazio} onClick={() => enviar("draft")}>Salvar rascunho</Botao>
                {f.agendar ? <Botao variante="primario" icone={Send} ocupado={ocupado} disabled={tituloVazio} onClick={() => enviar("schedule")}>Agendar</Botao> : <Botao variante="primario" icone={Send} ocupado={ocupado} disabled={tituloVazio} onClick={() => enviar("publish")}>Publicar</Botao>}
              </>
            )}
            {status === "scheduled" && (
              <>
                <Botao variante="fantasma" ocupado={ocupado} onClick={() => enviar("draft")}>Cancelar agendamento</Botao>
                <Botao variante="secundario" icone={Save} ocupado={ocupado} onClick={() => enviar(f.agendar ? "schedule" : "keep")}>Salvar</Botao>
                <Botao variante="primario" icone={Send} ocupado={ocupado} onClick={() => enviar("publish")}>Publicar agora</Botao>
              </>
            )}
            {status === "published" && (
              <>
                <Botao variante="fantasma" ocupado={ocupado} onClick={() => enviar("unpublish")}>Despublicar</Botao>
                <Botao variante="primario" icone={Save} ocupado={ocupado} disabled={!dirty} onClick={() => enviar("keep")}>Salvar alterações</Botao>
              </>
            )}
          </div>
        </div>
      </div>

      <Confirmar aberto={bloqueio.state === "blocked"} titulo="Sair sem salvar?" texto="Há alterações que ainda não foram salvas. Uma cópia fica guardada neste navegador por um tempo." botao="Sair" onCancelar={() => bloqueio.reset?.()} onConfirmar={() => bloqueio.proceed?.()} />
      <Confirmar aberto={restaurar !== null} titulo="Restaurar esta versão?" texto="O texto, o título, o resumo e a capa dessa versão entram no editor. Nada é salvo até você salvar." botao="Restaurar" tom="primario" onCancelar={() => setRestaurar(null)} onConfirmar={() => (post && restaurar !== null && ver.submit({ intent: "versao", post: post.id, versao: String(restaurar) }, { method: "post" }), setRestaurar(null))} />
      <Confirmar
        aberto={confirmarExcluir}
        titulo="Excluir este rascunho?"
        texto="O rascunho some de vez, com as versões dele."
        botao="Excluir"
        onCancelar={() => setConfirmarExcluir(false)}
        onConfirmar={() => {
          setConfirmarExcluir(false);
          salvo.current = JSON.stringify(f); // sem aviso de "não salvo" ao sair
          const fd = new FormData();
          fd.set("intent", "excluir");
          fd.append("id", post!.id);
          void fetch("/admin/posts", { method: "POST", body: fd, credentials: "same-origin" }).then(() => navigate("/admin/posts"));
        }}
      />
    </div>
  );
}
