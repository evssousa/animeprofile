// Botão "Agora" do topo (a partir de 768 px): última hora, episódios no ar hoje e tags em alta, iguais para todos.
// A bolinha vermelha pulsa só quando saiu notícia nova (até 2 h) desde a última vez que a pessoa abriu o painel.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { timeAgo } from "~/lib/format";
import { aguardarAgora, useAgora } from "~/lib/use-agora";

const KEY_VISTO = "ap-agora-visto";
const DUAS_HORAS = 2 * 3600_000;

const lerVisto = () => {
  try {
    return localStorage.getItem(KEY_VISTO) ?? "";
  } catch {
    return "";
  }
};

const linha = "flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-sunken";
const rotulo = "px-2.5 pt-2 pb-1 text-[0.7rem] font-bold tracking-[0.14em] uppercase";

export function AgoraTopo() {
  const estado = useAgora();
  const [aberto, setAberto] = useState(false);
  const [visto, setVisto] = useState("");
  const { pathname } = useLocation();
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => setVisto(lerVisto()), []);
  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    titulo.current?.focus();
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        gatilho.current?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const maisNova = estado.fase === "ok" ? estado.dados.noticias[0]?.publicadoEm ?? "" : "";
  const novidade = !!maisNova && Date.now() - new Date(maisNova).getTime() < DUAS_HORAS && maisNova > visto;

  function alternar() {
    if (!aberto && maisNova) {
      try {
        localStorage.setItem(KEY_VISTO, maisNova);
      } catch {
        // modo privado: vale só nesta visita
      }
      setVisto(maisNova);
    }
    if (!aberto && estado.fase === "erro") void aguardarAgora();
    setAberto((a) => !a);
  }

  return (
    <div ref={raiz} className="relative hidden md:block">
      <button
        ref={gatilho}
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls="painel-agora"
        aria-label={novidade ? "Agora: notícia nova" : "Agora"}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[0.85rem] font-semibold text-white/85 hover:bg-white/[0.12] hover:text-white"
      >
        <span className={`relative size-2 rounded-full ${novidade ? "bg-brand" : "bg-white/40"}`} aria-hidden>
          {novidade && <span className="absolute inset-0 rounded-full bg-brand/70 motion-safe:animate-ping" />}
        </span>
        Agora
      </button>
      {aberto && (
        <div
          id="painel-agora"
          role="dialog"
          aria-labelledby="titulo-agora"
          className="absolute top-[calc(100%+8px)] left-0 z-40 w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface text-ink shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)] motion-safe:animate-[ap-pop_120ms_ease-out]"
        >
          <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
            <h2 id="titulo-agora" ref={titulo} tabIndex={-1} className="text-[0.95rem] font-bold outline-none">
              Agora no Anime Profile
            </h2>
            {estado.fase === "ok" && estado.dados.hoje > 0 && <span className="text-[0.78rem] text-ink-soft tabular-nums">{estado.dados.hoje === 1 ? "1 notícia hoje" : `${estado.dados.hoje} notícias hoje`}</span>}
          </div>
          {estado.fase === "carregando" && (
            <div className="grid gap-1 p-1.5 sm:grid-cols-2" aria-busy="true">
              {[0, 1].map((c) => (
                <div key={c} className="flex flex-col gap-1.5 p-1">
                  {[0, 1, 2].map((k) => (
                    <span key={k} className="h-12 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />
                  ))}
                </div>
              ))}
            </div>
          )}
          {estado.fase === "erro" && (
            <div className="px-4 py-8 text-center">
              <p className="text-[0.9rem] text-ink-soft">Não deu para carregar agora.</p>
              <button
                type="button"
                onClick={() => void aguardarAgora()}
                className="mt-3 h-8 rounded-full border border-line px-3 text-[0.82rem] font-semibold hover:bg-sunken"
              >
                Tentar de novo
              </button>
            </div>
          )}
          {estado.fase === "ok" && (
            <>
              <div className="grid gap-1 p-1.5 sm:grid-cols-2">
                {estado.dados.noticias.length > 0 && (
                  <div>
                    <p className={`${rotulo} text-brand dark:text-glow`}>Última hora</p>
                    {estado.dados.noticias.map((n) => (
                      <Link key={n.url} to={n.url} className={linha}>
                        {n.imagem ? <img src={n.imagem} alt="" width={72} height={48} loading="lazy" className="h-12 w-[72px] shrink-0 rounded-md object-cover" /> : <span className="h-12 w-[72px] shrink-0 rounded-md bg-sunken" />}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[0.88rem] leading-snug font-semibold">{n.titulo}</span>
                          {n.publicadoEm && <span className="block text-[0.75rem] text-ink-soft">{timeAgo(n.publicadoEm)}</span>}
                        </span>
                      </Link>
                    ))}
                    <Link to="/noticias" className="block px-2.5 py-1.5 text-[0.82rem] font-semibold text-link hover:underline">
                      Todas as notícias
                    </Link>
                  </div>
                )}
                <div className={estado.dados.noticias.length ? "" : "sm:col-span-2"}>
                  <p className={`${rotulo} text-ink-soft`}>{estado.dados.amanha ? "Amanhã" : "No ar hoje"}</p>
                  {estado.dados.noAr.length === 0 ? (
                    <p className="px-2.5 py-3 text-[0.85rem] text-ink-soft">Nenhum episódio {estado.dados.amanha ? "amanhã" : "hoje"}.</p>
                  ) : (
                    estado.dados.noAr.map((e) => (
                      <Link key={`${e.url}-${e.episodio}`} to={e.url} className={linha}>
                        {e.capa ? <img src={e.capa} alt="" width={28} height={40} loading="lazy" className="h-10 w-7 shrink-0 rounded-md object-cover" /> : <span className="h-10 w-7 shrink-0 rounded-md bg-sunken" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.88rem] font-semibold">{e.titulo}</span>
                          <span className="block text-[0.75rem] text-ink-soft tabular-nums">
                            Ep. {e.episodio} · {e.horario}
                          </span>
                        </span>
                      </Link>
                    ))
                  )}
                  <Link to="/animes/calendario" className="block px-2.5 py-1.5 text-[0.82rem] font-semibold text-link hover:underline">
                    Calendário da semana
                  </Link>
                </div>
              </div>
              {estado.dados.emAlta.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                  <span className="text-[0.7rem] font-bold tracking-[0.14em] text-ink-soft uppercase">Em alta</span>
                  {estado.dados.emAlta.map((t) => (
                    <Link key={t.slug} to={`/tag/${t.slug}`} className="inline-flex h-8 items-center rounded-full bg-sunken px-3 text-[0.82rem] font-semibold hover:bg-brand-soft">
                      {t.nome}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
