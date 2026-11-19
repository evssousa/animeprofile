// Menu do usuário logado (por enquanto, só o administrador). O HTML do topo sai igual para todos (cache da CDN): estes
// blocos nascem escondidos e o CSS (`data-logado`, posto pelo script do <head> quando há o cookie marcador) os mostra.
// Quem está logado vem de GET /api/eu, perguntado só quando há o marcador.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Form, Link, useLocation } from "react-router";
import { ChevronDown, LogOut } from "lucide-react";
import { USER_MENU } from "~/lib/nav";
import { podeVer } from "~/lib/papeis";
import { clearSessionHint, setPapeisAttr } from "~/lib/session-hint";

type Estado = { fase: "carregando" } | { fase: "pronto"; nome: string; inicial: string; papeis: string[] } | { fase: "erro" };

// Uma consulta só para o topo e a gaveta.
let estado: Estado = { fase: "carregando" };
let iniciou = false;
const ouvintes = new Set<() => void>();
const publicar = (e: Estado) => {
  estado = e;
  ouvintes.forEach((f) => f());
};
const CARREGANDO: Estado = { fase: "carregando" };

function consultar() {
  if (iniciou || typeof document === "undefined" || !document.documentElement.dataset.logado) return;
  iniciou = true;
  fetch("/api/eu", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { logado: boolean; nome?: string; inicial?: string; papeis?: string[] }) => {
      if (j.logado) {
        setPapeisAttr(j.papeis ?? []); // confirma os papéis no <html> (o menu lateral acompanha)
        publicar({ fase: "pronto", nome: j.nome ?? "Conta", inicial: j.inicial ?? "?", papeis: j.papeis ?? [] });
      } else {
        clearSessionHint(); // sessão vencida: volta ao "Entrar"
        publicar({ fase: "erro" });
      }
    })
    .catch(() => {
      delete document.documentElement.dataset.logado; // erro de rede: "Entrar" só nesta visita, sem apagar o cookie
      publicar({ fase: "erro" });
    });
}

function useViewer(): Estado {
  useEffect(consultar, []);
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado,
    () => CARREGANDO,
  );
}

const item = "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none";

function Avatar({ inicial, tamanho }: { inicial: string; tamanho: "g" | "p" }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand font-extrabold text-brand-ink ${tamanho === "g" ? "size-10 text-[1.05rem]" : "size-9 text-[0.95rem] ring-2 ring-white/15"}`} aria-hidden>
      {inicial}
    </span>
  );
}

function Itens({ papeis, onNavigate, refPrimeiro }: { papeis: string[]; onNavigate?: () => void; refPrimeiro?: React.Ref<HTMLAnchorElement> }) {
  const blocos = USER_MENU.map((b) => b.filter((i) => podeVer(i.papeis, papeis))).filter((b) => b.length > 0);
  return (
    <>
      <div className="my-1 h-px bg-line" />
      {blocos.map((bloco, bi) => (
        <div key={bi}>
          {bloco.map(({ label, to, icon: Icon }, i) => (
            <Link key={label} to={to} role="menuitem" onClick={onNavigate} className={item} ref={bi === 0 && i === 0 ? refPrimeiro : undefined}>
              <Icon className="size-[18px] shrink-0 text-ink-soft" aria-hidden /> <span className="min-w-0 flex-1 truncate">{label}</span>
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
        </div>
      ))}
      <Form method="post" action="/sair" onSubmit={() => clearSessionHint()}>
        <button type="submit" role="menuitem" className={`${item} text-brand dark:text-glow`}>
          <LogOut className="size-[18px]" aria-hidden /> Sair
        </button>
      </Form>
    </>
  );
}

/** Topo: avatar (e nome, a partir de 1024 px) que abre o painel com "Administração" e "Sair". */
export function UserMenu() {
  const v = useViewer();
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const primeiro = useRef<HTMLAnchorElement>(null);

  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.focus();
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        gatilho.current?.focus();
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const itens = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const i = itens.indexOf(document.activeElement as HTMLElement);
        const alvo = e.key === "Home" ? 0 : e.key === "End" ? itens.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length;
        itens[alvo]?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative hidden logado:flex!">
      {v.fase === "pronto" ? (
        <>
          <button
            ref={gatilho}
            type="button"
            aria-haspopup="menu"
            aria-expanded={aberto}
            aria-controls="menu-usuario"
            aria-label="Menu da conta"
            onClick={() => setAberto((a) => !a)}
            className="flex size-11 items-center gap-2.5 rounded-full hover:bg-white/10 lg:h-11 lg:w-auto lg:py-1 lg:pr-3 lg:pl-1"
          >
            <span className="mx-auto lg:mx-0">
              <Avatar inicial={v.inicial} tamanho="p" />
            </span>
            <span className="hidden max-w-[10rem] truncate text-[0.9rem] font-semibold lg:inline">{v.nome}</span>
            <ChevronDown className={`hidden size-4 text-white/70 transition-transform motion-reduce:transition-none lg:block ${aberto ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {aberto && (
            <div id="menu-usuario" role="menu" className="absolute top-[calc(100%+8px)] right-0 z-40 max-h-[calc(100dvh-90px)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar inicial={v.inicial} tamanho="g" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{v.nome}</p>
                  <p className="text-[0.8rem] text-ink-soft">Equipe Anime Profile</p>
                </div>
              </div>
              <Itens papeis={v.papeis} refPrimeiro={primeiro} />
            </div>
          )}
        </>
      ) : (
        <span className="size-9 animate-pulse rounded-full bg-white/15 motion-reduce:animate-none" aria-hidden />
      )}
    </div>
  );
}

/** Gaveta do menu (celular e telas médias): o mesmo bloco, no lugar do link "Entrar". */
export function UserMenuDrawer({ onNavigate }: { onNavigate: () => void }) {
  const v = useViewer();
  return (
    <div className="mx-3 hidden rounded-2xl border border-line p-2 logado:block!">
      {v.fase === "pronto" ? (
        <>
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar inicial={v.inicial} tamanho="g" />
            <div className="min-w-0">
              <p className="truncate font-bold">{v.nome}</p>
              <p className="text-[0.8rem] text-ink-soft">Equipe Anime Profile</p>
            </div>
          </div>
          <Itens papeis={v.papeis} onNavigate={onNavigate} />
        </>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2" aria-hidden>
          <span className="size-10 animate-pulse rounded-full bg-sunken motion-reduce:animate-none" />
        </div>
      )}
    </div>
  );
}
