// Ficha do personagem: /animes/personagem/<id do AniList>, o mesmo endereço do site antigo.
import { data, Link } from "react-router";
import type { Route } from "./+types/personagem";
import { seo } from "~/lib/seo";
import { getCharacter } from "~/server/anime/characters.server";
import { canFetchRemote } from "~/server/anime/remote-guard.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw data(null, { status: 404 });
  let character;
  try {
    character = await getCharacter(id, { remote: canFetchRemote(request) });
  } catch {
    // AniList fora do ar, ou ficha ainda não guardada e sem cota para buscar agora: "volte daqui a pouco".
    throw data(null, { status: 503, headers: { "Retry-After": "120" } });
  }
  if (!character) throw data(null, { status: 404 });
  return { character };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Personagem não encontrado | Anime Profile" }];
  const c = d.character;
  const firstAnime = c.appearances[0]?.title;
  // Sem os trechos de spoiler na descrição que vai para o Google.
  const about = c.about.filter((s) => !s.spoiler).map((s) => s.text).join(" ").replace(/\s+/g, " ").slice(0, 150);
  return seo({
    title: firstAnime ? `${c.name} (${firstAnime})` : c.name,
    description: about || `${c.name}: quem é, em quais animes aparece e quem dubla.`,
    path: `/animes/personagem/${c.id}`,
    image: c.image,
  });
}

export default function Personagem({ loaderData }: Route.ComponentProps) {
  const { character: c } = loaderData;
  return (
    <article>
      <header className="relative overflow-hidden rounded-b-[28px] bg-night text-night-ink shadow-[0_24px_50px_rgba(60,20,20,.16)]">
        {c.image && <img src={c.image} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,16,.95)_0%,rgba(13,13,16,.7)_60%,rgba(13,13,16,.5)_100%)]" aria-hidden />
        <div className="relative mx-auto flex max-w-[1328px] flex-wrap items-end gap-8 px-4 pt-8 pb-12 sm:px-8 sm:pt-12 lg:px-14">
          {c.image && <img src={c.image} alt={`Imagem de ${c.name}`} className="w-[150px] shrink-0 rounded-[14px] shadow-[0_20px_40px_rgba(0,0,0,.5)] sm:w-[190px]" />}
          <div className="min-w-0 flex-[1_1_300px]">
            <nav aria-label="Você está em" className="flex flex-wrap gap-2 text-[0.85rem] text-white/70">
              <Link to="/animes" className="hover:text-white">
                Animes
              </Link>
              {c.appearances[0] && (
                <>
                  <span aria-hidden>/</span>
                  <Link to={c.appearances[0].url} className="hover:text-white">
                    {c.appearances[0].title}
                  </Link>
                </>
              )}
            </nav>
            <h1 className="mt-3 text-[2rem] leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-[3rem]">{c.name}</h1>
            {c.native && <p className="mt-2 text-lg text-white/70">{c.native}</p>}
            {c.alternative.length > 0 && <p className="mt-2 text-[0.9rem] text-white/55">Também chamado de {c.alternative.join(", ")}</p>}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1328px] gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-14">
        <div className="flex min-w-0 flex-col gap-12">
          {c.about.length > 0 && (
            <section aria-labelledby="sobre">
              <h2 id="sobre" className="text-[1.5rem] font-extrabold">
                Sobre
              </h2>
              <p className="mt-2 text-[0.85rem] text-ink-soft">Texto original do AniList, em inglês. Os spoilers ficam escondidos.</p>
              <div className="prose-ap mt-3">
                {c.about.map((s, i) =>
                  s.spoiler ? (
                    <details key={i} className="rounded-xl border border-line bg-surface px-4 py-2">
                      <summary className="cursor-pointer font-semibold text-brand">Mostrar spoiler</summary>
                      <p className="mt-2 whitespace-pre-line">{s.text}</p>
                    </details>
                  ) : (
                    <p key={i} className="whitespace-pre-line">
                      {s.text}
                    </p>
                  ),
                )}
              </div>
            </section>
          )}

          {c.appearances.length > 0 && (
            <section aria-labelledby="aparece">
              <h2 id="aparece" className="text-[1.5rem] font-extrabold">
                Aparece em
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
                {c.appearances.map((a) => (
                  <article key={a.id} className="group relative flex flex-col gap-2">
                    {a.cover ? (
                      <img src={a.cover} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl object-cover shadow-[0_10px_22px_rgba(60,20,20,.16)]" style={{ backgroundColor: a.color ?? undefined }} />
                    ) : (
                      <div className="aspect-[2/3] w-full rounded-xl bg-sunken" />
                    )}
                    <h3 className="text-[0.88rem] leading-snug font-semibold">
                      <Link to={a.url} className="line-clamp-2 after:absolute after:inset-0 hover:underline">
                        {a.title}
                      </Link>
                    </h3>
                    <p className="text-[0.75rem] text-ink-soft">{[a.role, a.detail].filter(Boolean).join(" · ")}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {c.facts.length > 0 && (
            <section aria-labelledby="ficha" className="rounded-[18px] border border-line bg-surface p-5">
              <h2 id="ficha" className="text-[1.05rem] font-extrabold">
                Ficha
              </h2>
              <dl className="mt-3 flex flex-col gap-2.5 text-[0.9rem]">
                {c.facts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {c.voices.length > 0 && (
            <section aria-labelledby="dubladores" className="rounded-[18px] border border-line bg-surface p-5">
              <h2 id="dubladores" className="text-[1.05rem] font-extrabold">
                Dublagem japonesa
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {c.voices.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    {v.image ? <img src={v.image} alt="" loading="lazy" className="size-12 rounded-full object-cover" /> : <span className="size-12 rounded-full bg-sunken" />}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{v.name}</p>
                      {v.native && <p className="text-[0.8rem] text-ink-soft">{v.native}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <a href={`https://anilist.co/character/${c.id}`} target="_blank" rel="noreferrer" className="text-[0.85rem] font-semibold text-link underline">
            Ver no AniList
          </a>
        </aside>
      </div>
    </article>
  );
}
