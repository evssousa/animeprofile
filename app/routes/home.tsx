// Página inicial, na divisão de seções do site atual (docs/design.md). As seções que dependem de dados
// ainda não migrados (ranking do mês, Otaku TV, quiz, blog, comentários e feed) entram quando cada área for construída.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, MessagesSquare, Sofa, Sparkles } from "lucide-react";
import type { Route } from "./+types/home";
import { AiringPoster, AnimePoster, TopTen } from "~/components/anime";
import { PostCard, PostOverlay, PostRow, SectionHead } from "~/components/posts";
import { SEASON_PT, brDay } from "~/lib/anime";
import { readingLabel } from "~/lib/format";
import { seo } from "~/lib/seo";
import { isWideImage } from "~/lib/images";
import { airingBetween, seasonAnimes, trendingAnimes } from "~/server/anime/anime.server";
import { latestPosts, mostRead, trendingTags, type PostCard as Card } from "~/server/content/posts.server";

export async function loader() {
  // Capa grande: as 4 matérias mais recentes com imagem de resolução boa (>= 1280 px). Se faltar, completa com
  // as outras, que aparecem desfocadas no fundo.
  const recent = (await latestPosts({}, 30)).filter((p) => p.image);
  const featured = [...recent.filter(isWideImage), ...recent.filter((p) => !isWideImage(p))].slice(0, 4);
  const exclude = featured.map((p) => p.id);
  const dayStart = new Date(`${brDay(new Date())}T00:00:00-03:00`);
  const [news, articles, topArticles, topAll, tags, airing, trending, season] = await Promise.all([
    latestPosts({ type: "news", excludeIds: exclude }, 8),
    latestPosts({ type: "article", excludeIds: exclude }, 5),
    mostRead(5, "article"),
    mostRead(4),
    trendingTags(14),
    airingBetween(dayStart, new Date(dayStart.getTime() + 86400_000)),
    trendingAnimes(10),
    seasonAnimes(8),
  ]);
  return { featured, news, articles, topArticles, topAll, tags, airing: airing.slice(0, 8), trending, season };
}

export function meta() {
  return seo({
    title: "Anime Profile",
    description: "Notícias de anime, artigos, coleção de figurinhas, quizzes e comunidade otaku em português.",
    path: "/",
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { featured, news, articles, topArticles, topAll, tags, airing, trending, season } = loaderData;
  const [leadArticle, ...moreArticles] = articles;
  return (
    <>
      {featured.length > 0 && <Hero slides={featured} />}

      <div className="mx-auto flex max-w-[1328px] flex-col gap-[72px] px-4 py-14 sm:px-8 lg:px-14">
        {airing.length > 0 && (
          <section aria-labelledby="no-ar" className="flex flex-col gap-6">
            <SectionHead id="no-ar" label="Ao vivo" title="Animes no ar hoje" more={{ to: "/animes/calendario", text: "Calendário da semana" }} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
              {airing.map((it) => (
                <AiringPoster key={`${it.anime.id}-${it.episode}`} item={it} />
              ))}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <section aria-labelledby="top10" className="flex flex-col gap-6">
            <SectionHead id="top10" label="Top 10 da semana" title="Os animes mais comentados agora" more={{ to: "/animes", text: "Ver animes" }} />
            <TopTen items={trending} />
          </section>
        )}

        {season.items.length > 0 && (
          <section aria-labelledby="temporada" className="flex flex-col gap-6">
            <SectionHead
              id="temporada"
              label="Temporada atual"
              title={`Animes de ${SEASON_PT[season.season]} ${season.year}`}
              more={{ to: "/animes#temporada", text: "Ver temporada" }}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
              {season.items.map((a) => (
                <AnimePoster key={a.id} anime={a} />
              ))}
            </div>
          </section>
        )}

        {leadArticle && (
          <section aria-labelledby="artigos" className="flex flex-col gap-6">
            <SectionHead id="artigos" label="Artigos" title="Guias, listas e indicações para o verdadeiro otaku" more={{ to: "/artigos", text: "Todos os artigos" }} />
            <div className="grid gap-6 lg:grid-cols-12">
              <PostOverlay post={leadArticle} className="min-h-[420px] lg:col-span-5" titleClass="text-[1.5rem] sm:text-[1.7rem]" />
              <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:col-span-4">
                {moreArticles.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
              {topArticles.length > 0 && (
                <aside className="rounded-[18px] border border-line bg-surface p-5 lg:col-span-3">
                  <h3 className="text-[1.05rem] font-extrabold">Mais lidos do mês</h3>
                  <ol className="mt-4 flex flex-col gap-4">
                    {topArticles.map((p, i) => (
                      <li key={p.id} className="flex gap-3">
                        <span className="w-6 shrink-0 text-[1.4rem] leading-none font-extrabold text-brand/25">{i + 1}</span>
                        <Link to={p.url} className="text-[0.9rem] leading-snug font-semibold hover:underline">
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </aside>
              )}
            </div>
          </section>
        )}

        {news.length > 0 && (
          <section aria-labelledby="noticias" className="flex flex-col gap-6">
            <SectionHead id="noticias" label="Notícias" title="O que está acontecendo agora" more={{ to: "/noticias?tipo=noticias", text: "Todas as notícias" }} />
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {news.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}

        <Collection />

        <section aria-labelledby="diferencial" className="flex flex-col gap-6">
          <div className="text-center">
            <p className="text-[0.82rem] font-bold text-brand">O diferencial</p>
            <h2 id="diferencial" className="mt-1.5 text-[1.9rem] font-extrabold tracking-[-0.025em]">
              Muito mais que notícias
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-[18px] border border-line bg-surface p-6">
                <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-[22px]" aria-hidden />
                </span>
                <h3 className="mt-4 text-[1.05rem] font-extrabold">{title}</h3>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {(tags.length > 0 || topAll.length > 0) && (
          <div className="grid gap-10 lg:grid-cols-12">
            {tags.length > 0 && (
              <section aria-labelledby="em-alta" className="flex flex-col gap-5 lg:col-span-5">
                <SectionHead id="em-alta" label="Em alta" title="Os assuntos que a comunidade ama" />
                <ul className="flex flex-wrap gap-2.5">
                  {tags.map((t) => (
                    <li key={t.slug}>
                      <Link to={`/tag/${t.slug}`} className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-[0.9rem] font-semibold text-ink-soft hover:text-ink">
                        #{t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {topAll.length > 0 && (
              <section aria-labelledby="mais-lidos" className="flex flex-col gap-5 lg:col-span-7">
                <SectionHead id="mais-lidos" label="Mais lidos" title="Os mais lidos do mês" />
                <ol className="grid gap-4 sm:grid-cols-2">
                  {topAll.map((p, i) => (
                    <li key={p.id}>
                      <PostRow post={p} index={i + 1} />
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        <section className="relative flex flex-col items-center gap-4 overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#c2352b,#7e1d17)] px-6 py-14 text-center text-white">
          <p className="text-[0.85rem] font-bold text-[#ffd3ce]">Faça parte da comunidade</p>
          <h2 className="max-w-[24ch] text-[1.9rem] leading-tight font-extrabold tracking-[-0.025em] sm:text-[2.3rem]">
            Notícias, artigos e uma comunidade otaku gamificada esperando por você
          </h2>
          <p className="max-w-[56ch] text-white/85">Crie a conta grátis, ganhe seu primeiro pacote de figurinhas e suba no ranking lendo o que você já gosta.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link to="/cadastro" className="rounded-[9px] bg-white px-6 py-3.5 font-extrabold text-brand">
              Criar conta grátis
            </Link>
            <Link to="/login" className="rounded-[9px] bg-white/15 px-6 py-3.5 font-bold hover:bg-white/25">
              Já tenho conta
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

const FEATURES = [
  { icon: Sparkles, title: "Figurinhas colecionáveis", text: "Abra pacotes, troque repetidas e complete os álbuns de cada temporada." },
  { icon: Award, title: "Ranking e missões", text: "Ganhe XP lendo, jogando quizzes e completando missões diárias." },
  { icon: MessagesSquare, title: "Comunidade de verdade", text: "Feed, blog, mensagens e comentários com quem gosta do mesmo que você." },
  { icon: Sofa, title: "Quarto otaku", text: "Monte seu quarto, cuide do seu pet e mostre sua coleção no perfil." },
];

/** Carrossel de destaques na faixa escura. Troca sozinho a cada 7 s (pausa com o mouse em cima ou com "reduzir movimento"). */
function Hero({ slides }: { slides: Card[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((n) => (n + 1) % slides.length), 7000);
    return () => clearTimeout(t);
  }, [i, paused, slides.length]);
  const s = slides[i];
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex min-h-[560px] flex-col overflow-hidden rounded-b-[32px] bg-night text-night-ink shadow-[0_30px_60px_rgba(60,20,20,.18)] sm:min-h-[640px]"
    >
      {slides.map((sl, n) => (
        <img
          key={sl.id}
          src={sl.image!}
          alt=""
          loading={n === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${isWideImage(sl) ? "" : "scale-110 blur-2xl"} ${n === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,16,.97)_0%,rgba(13,13,16,.78)_38%,rgba(13,13,16,.1)_75%),linear-gradient(0deg,rgba(13,13,16,.92)_0%,rgba(13,13,16,0)_42%)]"
        aria-hidden
      />
      <div className="relative mx-auto mt-auto flex w-full max-w-[1328px] flex-wrap items-end gap-8 px-4 pt-16 pb-10 sm:px-8 lg:px-14">
        <div className="flex w-full max-w-[660px] min-w-0 flex-col gap-4 md:w-auto md:flex-[1_1_480px]" aria-live="polite">
          <div className="flex flex-wrap gap-2 text-[0.75rem] font-bold">
            <span className="rounded-[7px] bg-brand px-2.5 py-1.5">Destaque</span>
            {s.category && <span className="rounded-[7px] bg-white/15 px-2.5 py-1.5 font-semibold">{s.category.name}</span>}
            <span className="rounded-[7px] bg-white/15 px-2.5 py-1.5 font-semibold">{readingLabel(s.readingMinutes)}</span>
          </div>
          <h1 className="text-[2.1rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-[3.4rem]">
            <Link to={s.url} className="hover:underline">
              {s.title}
            </Link>
          </h1>
          {s.excerpt && <p className="line-clamp-3 text-[1.02rem] leading-relaxed text-white/80">{s.excerpt}</p>}
          <div className="mt-1 flex gap-3">
            <Link to={s.url} className="rounded-[9px] bg-white px-6 py-3.5 font-extrabold text-night">
              Ler matéria
            </Link>
          </div>
        </div>
        {slides.length > 1 && (
          <div className="ml-auto hidden gap-3 md:flex">
            {slides.map((sl, n) => (
              <button
                key={sl.id}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Destaque ${n + 1} de ${slides.length}: ${sl.title}`}
                aria-current={n === i ? "true" : undefined}
                className={`flex w-[150px] flex-col gap-2 text-left ${n === i ? "opacity-100" : "opacity-55 hover:opacity-90"}`}
              >
                <img src={sl.image!} alt="" className={`h-[84px] w-full rounded-[10px] object-cover ${n === i ? "ring-2 ring-white" : ""}`} />
                <span className="h-[3px] overflow-hidden rounded bg-white/20">
                  <span
                    key={`${i}-${paused}`}
                    className={`block h-full bg-brand ${n === i && !paused ? "animate-[ap-progress_7s_linear_forwards]" : n === i ? "w-full" : "w-0"}`}
                  />
                </span>
                <span className="line-clamp-2 text-[0.75rem] leading-snug font-semibold">{sl.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Painel escuro da coleção de figurinhas (o álbum de verdade chega com as contas). */
function Collection() {
  return (
    <section
      aria-labelledby="colecao"
      className="relative flex flex-wrap items-center gap-10 overflow-hidden rounded-[26px] bg-[#17141a] bg-[radial-gradient(520px_340px_at_78%_50%,rgba(194,53,43,.35),rgba(23,20,26,0)_70%),radial-gradient(420px_260px_at_100%_0%,rgba(140,90,255,.22),rgba(23,20,26,0)_70%)] p-6 text-night-ink shadow-[0_30px_60px_rgba(60,20,20,.22)] sm:p-11"
    >
      <div className="flex w-full max-w-[520px] min-w-0 flex-col gap-3.5 md:w-auto md:flex-[1_1_340px]">
        <p className="text-[0.82rem] font-bold text-glow">Coleção</p>
        <h2 id="colecao" className="text-[1.9rem] leading-[1.08] font-extrabold tracking-[-0.025em] sm:text-[2.3rem]">
          Colete figurinhas raras dos seus animes favoritos
        </h2>
        <p className="leading-relaxed text-white/72">Abra pacotes de 1 ou de 10, troque repetidas com a comunidade e ganhe XP a cada pacote aberto.</p>
        <ul className="flex flex-wrap gap-2 text-[0.75rem] font-bold">
          <li className="rounded-full bg-white/10 px-2.5 py-1.5">Comum</li>
          <li className="rounded-full bg-[rgba(99,230,190,.16)] px-2.5 py-1.5 text-[#63e6be]">Rara</li>
          <li className="rounded-full bg-[rgba(177,151,252,.18)] px-2.5 py-1.5 text-[#c8b6ff]">Épica</li>
          <li className="rounded-full bg-[rgba(242,193,78,.18)] px-2.5 py-1.5 text-[#f2c14e]">Lendária</li>
        </ul>
        <Link to="/figurinhas" className="mt-2 self-start rounded-[9px] bg-brand px-6 py-3.5 font-extrabold text-brand-ink shadow-[0_10px_30px_rgba(194,53,43,.4)] hover:brightness-110">
          Conhecer as figurinhas
        </Link>
      </div>
      <div className="relative mx-auto h-[300px] w-[300px] max-w-full shrink-0 origin-top scale-[.92] sm:scale-100" aria-hidden>
        <div className="absolute top-4 left-6 flex h-[260px] w-[170px] -rotate-6 flex-col items-center justify-center gap-3 overflow-hidden rounded-[18px] bg-[linear-gradient(160deg,#f25b4e,#9e1f18_60%,#5c0e0a)] shadow-[0_30px_60px_rgba(0,0,0,.6),inset_0_0_0_2px_rgba(255,255,255,.18)]">
          <span className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0)_30%,rgba(255,255,255,.35)_45%,rgba(255,255,255,0)_60%)]" />
          <span className="absolute inset-x-0 top-0 h-5 bg-[repeating-linear-gradient(90deg,rgba(0,0,0,.25)_0_6px,rgba(0,0,0,0)_6px_12px)]" />
          <img src="/logo-192.png" alt="" className="size-16 rounded-2xl" />
          <span className="text-center text-[1.05rem] leading-tight font-extrabold">
            Pacote
            <br />
            da temporada
          </span>
        </div>
        <div className="absolute top-0 right-2 h-[170px] w-[124px] rotate-6 rounded-[14px] border-[5px] border-[#f2c14e] bg-[conic-gradient(from_210deg,#ff0080,#ffd600,#00ffaa,#008cff,#be00ff,#ff0080)] opacity-90 shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_30px_rgba(242,193,78,.45)]" />
        <div className="absolute right-10 bottom-0 h-[150px] w-[110px] -rotate-3 rounded-[14px] border-[5px] border-[#b197fc] bg-[linear-gradient(160deg,#3b2a6b,#17141a)] shadow-[0_20px_40px_rgba(0,0,0,.55),0_0_26px_rgba(177,151,252,.35)]" />
      </div>
    </section>
  );
}
