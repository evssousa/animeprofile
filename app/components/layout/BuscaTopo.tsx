// Busca do topo com sugestões (animes, matérias e quizzes), buscas recentes, "Em alta", atalhos "/" e Ctrl+K.
// Sem JavaScript o formulário continua funcionando (Enter leva a /busca). No celular, o ícone abre um diálogo de tela cheia.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Form, Link, useLocation, useNavigate } from "react-router";
import { Clock, Puzzle, Search, Tv, X } from "lucide-react";
import { guardarBusca, lerBuscas, limparBuscas, removerBusca } from "~/lib/buscas-recentes";
import { timeAgo } from "~/lib/format";
import type { Sugestoes } from "~/server/topo.server";

type Estado = { fase: "vazio" } | { fase: "curto" } | { fase: "carregando" } | { fase: "ok"; dados: Sugestoes } | { fase: "erro" };

const cache = new Map<string, Sugestoes>();
const EVENTO_ABRIR = "ap-abrir-busca";

/** Pede as sugestões (espera 200 ms, cancela o pedido anterior, lembra por termo). */
function useSugestoes(q: string, ativo: boolean): Estado {
  const [estado, setEstado] = useState<Estado>({ fase: "vazio" });
  useEffect(() => {
    if (!ativo) return;
    const termo = q.trim().toLowerCase().slice(0, 60);
    if (termo.length === 1) return setEstado({ fase: "curto" });
    const guardado = cache.get(termo);
    if (guardado) return setEstado({ fase: "ok", dados: guardado });
    const ctl = new AbortController();
    if (termo.length >= 2) setEstado({ fase: "carregando" });
    const t = setTimeout(
      () => {
        fetch(`/api/sugestoes?q=${encodeURIComponent(termo)}`, { signal: ctl.signal })
          .then((r) => (r.ok ? (r.json() as Promise<Sugestoes>) : Promise.reject(new Error(String(r.status)))))
          .then((d) => {
            cache.set(termo, d);
            setEstado({ fase: "ok", dados: d });
          })
          .catch((e) => e?.name !== "AbortError" && setEstado({ fase: "erro" }));
      },
      termo.length >= 2 ? 200 : 0,
    );
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, ativo]);
  return estado;
}

type Opcao = { id: string; href: string; termo?: string; node: ReactNode };

const linha = "flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-sunken";
const rotulo = "px-3 pt-2.5 pb-1 text-[0.7rem] font-bold tracking-[0.14em] text-ink-soft uppercase";

/** Monta a lista (na ordem em que aparece), para o teclado percorrer. */
function montar(estado: Estado, q: string, recentes: string[], emAlta: Sugestoes["emAlta"]): { secoes: { titulo: string; opcoes: Opcao[] }[]; fixas: Opcao[]; aviso: string | null } {
  const termo = q.trim();
  const buscar = (t: string): Opcao => ({ id: `rec-${t}`, href: `/busca?q=${encodeURIComponent(t)}`, termo: t, node: <><Clock className="size-4 shrink-0 text-ink-soft" aria-hidden /><span className="min-w-0 flex-1 truncate">{t}</span></> });
  if (estado.fase === "vazio" || (estado.fase === "ok" && termo.length < 2)) {
    const secoes: { titulo: string; opcoes: Opcao[] }[] = [];
    if (recentes.length) secoes.push({ titulo: "Buscas recentes", opcoes: recentes.map(buscar) });
    const tags = estado.fase === "ok" ? estado.dados.emAlta : emAlta;
    if (tags.length) secoes.push({ titulo: "Em alta", opcoes: tags.map((t) => ({ id: `tag-${t.slug}`, href: `/tag/${t.slug}`, node: <span className="font-semibold">{t.nome}</span> })) });
    return { secoes, fixas: [], aviso: null };
  }
  if (estado.fase === "curto") return { secoes: [], fixas: [], aviso: "Digite pelo menos 2 letras." };
  if (estado.fase === "carregando") return { secoes: [], fixas: [], aviso: null };
  const fixas: Opcao[] = [
    { id: "ver-materias", href: `/busca?q=${encodeURIComponent(termo)}`, termo, node: <><Search className="size-4 shrink-0" aria-hidden /><span className="min-w-0 truncate font-semibold text-link">Ver todas as matérias com “{termo}”</span></> },
    { id: "ver-animes", href: `/animes?q=${encodeURIComponent(termo)}`, termo, node: <><Tv className="size-4 shrink-0" aria-hidden /><span className="min-w-0 truncate font-semibold text-link">Ver animes com “{termo}”</span></> },
  ];
  if (estado.fase === "erro") return { secoes: [], fixas: [], aviso: "Não deu para carregar as sugestões. Aperte Enter para buscar." };
  const d = estado.dados;
  const secoes: { titulo: string; opcoes: Opcao[] }[] = [];
  if (d.animes.length)
    secoes.push({
      titulo: "Animes",
      opcoes: d.animes.map((a) => ({
        id: `anime-${a.id}`,
        href: a.url,
        termo,
        node: (
          <>
            {a.capa ? <img src={a.capa} alt="" width={32} height={44} loading="lazy" className="h-11 w-8 shrink-0 rounded-md object-cover" /> : <span className="h-11 w-8 shrink-0 rounded-md bg-sunken" />}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 text-[0.9rem] font-semibold">{a.titulo}</span>
              {a.info && <span className="block text-[0.78rem] text-ink-soft">{a.info}</span>}
            </span>
          </>
        ),
      })),
    });
  if (d.posts.length)
    secoes.push({
      titulo: "Notícias e artigos",
      opcoes: d.posts.map((p) => ({
        id: `post-${p.url}`,
        href: p.url,
        termo,
        node: (
          <>
            {p.imagem ? <img src={p.imagem} alt="" width={64} height={40} loading="lazy" className="h-10 w-16 shrink-0 rounded-md object-cover" /> : <span className="h-10 w-16 shrink-0 rounded-md bg-sunken" />}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[0.9rem] leading-snug font-semibold">{p.titulo}</span>
              <span className="block text-[0.78rem] text-ink-soft">
                {p.tipo === "article" ? "Artigo" : "Notícia"}
                {p.publicadoEm ? ` · ${timeAgo(p.publicadoEm)}` : ""}
              </span>
            </span>
          </>
        ),
      })),
    });
  if (d.quizzes.length)
    secoes.push({
      titulo: "Quizzes",
      opcoes: d.quizzes.map((z) => ({
        id: `quiz-${z.url}`,
        href: z.url,
        termo,
        node: (
          <>
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sunken">
              <Puzzle className="size-[18px]" aria-hidden />
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[0.9rem] font-semibold">{z.titulo}</span>
          </>
        ),
      })),
    });
  return { secoes, fixas, aviso: !secoes.length ? `Nada encontrado para “${termo}”.` : null };
}

/** O conteúdo do painel (campo do computador e diálogo do celular usam o mesmo). */
function Painel({ q, estado, recentes, ativa, onEscolher, onRemover, onLimpar, ids }: { q: string; estado: Estado; recentes: string[]; ativa: number; onEscolher: (o: Opcao) => void; onRemover: (t: string) => void; onLimpar: () => void; ids: string }) {
  const [emAlta, setEmAlta] = useState<Sugestoes["emAlta"]>([]);
  const lista = montar(estado, q, recentes, emAlta);
  useEffect(() => {
    // "Em alta" com o campo vazio: pede uma vez (o servidor guarda por 5 min)
    if (q.trim() === "" && emAlta.length === 0) {
      fetch("/api/sugestoes?q=")
        .then((r) => (r.ok ? (r.json() as Promise<Sugestoes>) : null))
        .then((d) => d && setEmAlta(d.emAlta))
        .catch(() => {});
    }
  }, [q, emAlta.length]);
  const todas = [...lista.secoes.flatMap((s) => s.opcoes), ...lista.fixas];
  let n = -1;
  const item = (o: Opcao) => {
    n += 1;
    const i = n;
    return (
      <Link
        key={o.id}
        to={o.href}
        id={`${ids}-${i}`}
        role="option"
        aria-selected={i === ativa}
        onClick={() => onEscolher(o)}
        className={`${linha} relative ${i === ativa ? "bg-brand-soft before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-brand" : ""}`}
      >
        {o.node}
        {o.id.startsWith("rec-") && (
          <button
            type="button"
            aria-label={`Remover “${o.termo}” das buscas recentes`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemover(o.termo!);
            }}
            className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-line"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </Link>
    );
  };
  if (estado.fase === "carregando")
    return (
      <div aria-busy="true" className="flex flex-col gap-1.5 p-1.5">
        {[0, 1, 2].map((k) => (
          <span key={k} className="h-12 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />
        ))}
      </div>
    );
  const vazio = todas.length === 0 && !lista.aviso;
  if (vazio) return null;
  return (
    <>
      {lista.aviso && <p className="px-3 py-5 text-center text-[0.88rem] text-ink-soft">{lista.aviso}</p>}
      {lista.secoes.map((s) => (
        <div key={s.titulo}>
          <p className={rotulo}>{s.titulo}</p>
          {s.titulo === "Em alta" ? <div className="flex flex-wrap gap-2 px-3 pb-2">{s.opcoes.map((o) => item(o))}</div> : s.opcoes.map((o) => item(o))}
          {s.titulo === "Buscas recentes" && (
            <button type="button" onClick={onLimpar} className="px-3 pb-2 text-[0.78rem] text-ink-soft underline hover:text-ink">
              Limpar recentes
            </button>
          )}
        </div>
      ))}
      {lista.fixas.length > 0 && <div className="mt-1 border-t border-line pt-1">{lista.fixas.map((o) => item(o))}</div>}
    </>
  );
}

/** Estado e teclado compartilhados pelo campo e pelo diálogo. */
function useBusca(onIr: () => void) {
  const [q, setQ] = useState("");
  const [recentes, setRecentes] = useState<string[]>([]);
  const [ativa, setAtiva] = useState(-1);
  const navigate = useNavigate();
  useEffect(() => setRecentes(lerBuscas()), []);
  const ir = (href: string, termo?: string) => {
    if (termo) setRecentes(guardarBusca(termo));
    onIr();
    navigate(href);
  };
  return { q, setQ, recentes, setRecentes, ativa, setAtiva, ir };
}

/** Campo do computador (a partir de 1024 px). */
export function BuscaTopo() {
  const ids = useId();
  const raiz = useRef<HTMLFormElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const b = useBusca(() => setAberto(false));
  const estado = useSugestoes(b.q, aberto);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = !!alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName));
      const atalho = (e.key === "/" && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k");
      if (!atalho) return;
      e.preventDefault();
      if (window.innerWidth >= 1024) {
        campo.current?.focus();
        campo.current?.select();
        setAberto(true);
      } else window.dispatchEvent(new Event(EVENTO_ABRIR));
    };
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fora);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fora);
    };
  }, []);

  const opcoes = () => [...(painel.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  function aoTeclar(e: React.KeyboardEvent) {
    const lista = opcoes();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!aberto) return setAberto(true);
      e.preventDefault();
      const prox = (b.ativa + (e.key === "ArrowDown" ? 1 : -1) + lista.length) % Math.max(1, lista.length);
      b.setAtiva(lista.length ? prox : -1);
      lista[prox]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && b.ativa >= 0 && lista[b.ativa]) {
      e.preventDefault();
      lista[b.ativa].click();
    } else if (e.key === "Escape") {
      if (aberto) setAberto(false);
      else b.setQ("");
    } else if (e.key === "Tab") setAberto(false);
  }

  return (
    <Form
      ref={raiz}
      method="get"
      action="/busca"
      role="search"
      onSubmit={() => {
        if (b.q.trim().length >= 2) b.ir(`/busca?q=${encodeURIComponent(b.q.trim())}`, b.q);
      }}
      className="relative mx-auto hidden w-[min(22rem,26vw)] min-w-[13rem] lg:block xl:w-[min(28rem,30vw)]"
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/60" aria-hidden />
      <input
        ref={campo}
        type="search"
        name="q"
        value={b.q}
        onChange={(e) => {
          b.setQ(e.target.value);
          b.setAtiva(-1);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={`${ids}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={b.ativa >= 0 ? `${ids}-${b.ativa}` : undefined}
        autoComplete="off"
        placeholder="Buscar notícias, animes, quizzes..."
        aria-label="Buscar no site"
        maxLength={60}
        className="h-10 w-full rounded-full border border-white/10 bg-white/10 pr-12 pl-10 text-white placeholder:text-white/50 focus:border-white/25 focus:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {b.q ? (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            b.setQ("");
            campo.current?.focus();
          }}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-white/15 px-1.5 text-[0.7rem] font-semibold text-white/50 [@media(pointer:coarse)]:hidden">/</kbd>
      )}
      {aberto && (
        <div
          ref={painel}
          id={`${ids}-lista`}
          role="listbox"
          aria-label="Sugestões de busca"
          className="absolute top-[calc(100%+8px)] left-0 z-40 max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)] motion-safe:animate-[ap-pop_120ms_ease-out]"
        >
          <Painel q={b.q} estado={estado} recentes={b.recentes} ativa={b.ativa} ids={ids} onEscolher={(o) => b.ir(o.href, o.termo)} onRemover={(t) => b.setRecentes(removerBusca(t))} onLimpar={() => b.setRecentes(limparBuscas())} />
        </div>
      )}
    </Form>
  );
}

/** Ícone de busca (abaixo de 1024 px): sem JS leva a /busca; com JS abre o diálogo de tela cheia. */
export function BuscaCelular() {
  const ids = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const gatilho = useRef<HTMLAnchorElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const fechar = () => dlg.current?.close();
  const b = useBusca(fechar);
  const estado = useSugestoes(b.q, aberto);

  const abrir = () => {
    b.setRecentes(lerBuscas());
    dlg.current?.showModal();
    setAberto(true);
    setTimeout(() => campo.current?.focus(), 0);
  };
  useEffect(() => {
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  });
  useEffect(() => fechar(), [pathname]);

  const opcoes = () => [...(painel.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  function aoTeclar(e: React.KeyboardEvent) {
    const lista = opcoes();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const prox = (b.ativa + (e.key === "ArrowDown" ? 1 : -1) + lista.length) % Math.max(1, lista.length);
      b.setAtiva(lista.length ? prox : -1);
      lista[prox]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && b.ativa >= 0 && lista[b.ativa]) {
      e.preventDefault();
      lista[b.ativa].click();
    }
  }

  return (
    <>
      <Link
        ref={gatilho}
        to="/busca"
        aria-label="Buscar"
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          abrir();
        }}
        className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 lg:hidden"
      >
        <Search className="size-[19px]" aria-hidden />
      </Link>
      <dialog
        ref={dlg}
        aria-label="Buscar no site"
        onClose={() => {
          setAberto(false);
          gatilho.current?.focus();
        }}
        onClick={(e) => e.target === dlg.current && fechar()}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-surface text-ink backdrop:bg-black/60 sm:mx-auto sm:mt-16 sm:h-auto sm:max-h-[80vh] sm:w-[min(36rem,calc(100vw-2rem))] sm:overflow-hidden sm:rounded-2xl"
      >
        <Form
          method="get"
          action="/busca"
          role="search"
          onSubmit={() => b.q.trim().length >= 2 && b.ir(`/busca?q=${encodeURIComponent(b.q.trim())}`, b.q)}
          className="flex h-[60px] items-center gap-2 bg-night px-3 text-night-ink"
        >
          <span className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/60" aria-hidden />
            <input
              ref={campo}
              type="search"
              name="q"
              value={b.q}
              onChange={(e) => {
                b.setQ(e.target.value);
                b.setAtiva(-1);
              }}
              onKeyDown={aoTeclar}
              role="combobox"
              aria-expanded
              aria-controls={`${ids}-lista`}
              aria-autocomplete="list"
              aria-activedescendant={b.ativa >= 0 ? `${ids}-${b.ativa}` : undefined}
              autoComplete="off"
              placeholder="Buscar notícias, animes, quizzes..."
              aria-label="Buscar no site"
              maxLength={60}
              className="h-11 w-full rounded-full border border-white/10 bg-white/10 pr-4 pl-10 text-white placeholder:text-white/50 focus:border-white/25 focus:bg-white/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </span>
          <button type="button" onClick={fechar} className="px-2 font-semibold text-white/80 hover:text-white">
            Cancelar
          </button>
        </Form>
        <div ref={painel} id={`${ids}-lista`} role="listbox" aria-label="Sugestões de busca" className="max-h-[calc(100dvh-60px)] overflow-y-auto overscroll-contain p-1.5 sm:max-h-[calc(80vh-60px)]">
          {aberto && <Painel q={b.q} estado={estado} recentes={b.recentes} ativa={b.ativa} ids={ids} onEscolher={(o) => b.ir(o.href, o.termo)} onRemover={(t) => b.setRecentes(removerBusca(t))} onLimpar={() => b.setRecentes(limparBuscas())} />}
        </div>
      </dialog>
    </>
  );
}
