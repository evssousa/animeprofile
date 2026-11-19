// Página da matéria: /noticias/<slug> e /artigos/<slug>, os mesmos endereços do site antigo.
// Se o tipo do endereço não bater (artigo aberto em /noticias), redireciona para o certo.
import { data, Link, redirect } from "react-router";
import type { Route } from "./+types/post";
import { Comments, ShareBar } from "~/components/post-extras";
import { Sidebar } from "~/components/sidebar";
import { PostCard } from "~/components/posts";
import { formatDateLong, formatDateTime, readingLabel, timeAgo } from "~/lib/format";
import { routePath } from "~/lib/route-path";
import { seo } from "~/lib/seo";
import { SITE, absoluteUrl } from "~/lib/site";
import { isWideImage } from "~/lib/images";
import { getAnime } from "~/server/anime/anime.server";
import { getPost, postComments, relatedPosts, withToc } from "~/server/content/posts.server";
import { animeCardHtml, injetarCardsAnime } from "~/server/anime/card-html.server";
import { loadSidebar } from "~/server/sidebar.server";
import { splitLongParagraphs } from "~/server/robot/html";

export async function loader({ params, request }: Route.LoaderArgs) {
  const post = await getPost(params.slug);
  if (!post) throw data(null, { status: 404 });
  const path = routePath(request);
  if (path !== post.url) throw redirect(post.url, 301);
  // A capa aparece sempre como imagem de verdade no começo do texto (no cabeçalho ela é só o fundo escurecido atrás do título).
  // Só não repete quando o texto JÁ COMEÇA com essa mesma imagem; se a imagem estiver mais para o meio, a capa continua no topo.
  const coverFile = post.image?.split("?")[0].split("/").pop()?.replace(/-\d+(\.\w+)$/, "$1") ?? "";
  const coverBase = coverFile.replace(/\.\w+$/, "");
  const inicioDoTexto = post.html.slice(0, 700);
  const textoComecaComCapa = !!coverBase && /<img/i.test(inicioDoTexto) && inicioDoTexto.includes(coverBase);
  const showCover = Boolean(post.image) && !textoComecaComCapa;
  // Parágrafos longos (as matérias do robô antigo vinham em blocos de 150+ palavras) viram parágrafos de 2 a 3 frases.
  const comCards = await injetarCardsAnime(post.html); // cards de anime colocados no texto pelo editor
  let { html, toc } = withToc(splitLongParagraphs(comCards));
  // Vídeo no começo do texto: vai ANTES da matéria, em largura total. A capa, se existir, desce para logo abaixo do 1º título.
  let video: string | null = null;
  let coverBelowHeading = false;
  const lead = html.match(/^\s*(<div class="aspect-video[^"]*">\s*<iframe[\s\S]*?<\/iframe>\s*<\/div>)/i);
  if (lead) {
    video = lead[1];
    html = html.slice(lead[0].length).trimStart();
    if (showCover && post.image) {
      const figure = `<figure class="my-6"><img src="${post.image}" alt="" class="aspect-video w-full rounded-[18px] object-cover" loading="lazy" /></figure>`;
      const h = html.search(/<\/h2>/i);
      const at = h >= 0 ? h + 5 : html.search(/<\/p>/i) >= 0 ? html.search(/<\/p>/i) + 4 : 0;
      html = html.slice(0, at) + figure + html.slice(at);
      coverBelowHeading = true;
    }
  }

  // Barra lateral (como no site antigo): anime da matéria, destaque, últimas, comentários, índice e em alta
  // (docs/plano-sidebars.md). O anime vem só do banco (sem buscar no AniList), para a matéria abrir rápido.
  const now = new Date();
  const anime = post.anilistId ? await getAnime(post.anilistId, { remote: false }).catch(() => null) : null;
  const [related, comments, sidebar] = await Promise.all([
    relatedPosts(post, 4),
    postComments(post.id),
    loadSidebar("materia", { now, type: post.type, excludeId: post.id, anilistId: post.anilistId, anime, toc }),
  ]);
  const label = <T extends { createdAt: string }>(c: T) => ({ ...c, ago: timeAgo(c.createdAt, now) });
  // Card "Sobre o anime" no fim da matéria (quando ela é sobre um anime), a não ser que o texto já tenha o card desse anime.
  const animeCard = anime && !html.includes(`data-anime-card-render="${anime.id}"`) ? animeCardHtml(anime) : null;
  return {
    post: { ...post, html },
    animeCard,
    related,
    showCover: showCover && !coverBelowHeading,
    video,
    sidebar,
    comments: comments.map((c) => ({ ...label(c), replies: c.replies.map(label) })),
  };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Matéria não encontrada | Anime Profile" }];
  const p = d.post;
  return seo({
    title: p.title,
    description: p.excerpt,
    path: p.url,
    type: "article",
    image: p.image,
    publishedTime: p.publishedAt,
    modifiedTime: p.updatedAt,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": p.type === "news" ? "NewsArticle" : "Article",
      headline: p.title,
      description: p.excerpt ?? undefined,
      image: p.image ? [p.image] : undefined,
      datePublished: p.publishedAt,
      dateModified: p.updatedAt ?? p.publishedAt,
      mainEntityOfPage: absoluteUrl(p.url),
      author: p.author
        ? { "@type": "Person", name: p.author.name, url: absoluteUrl(p.author.url), ...(p.isAi ? { disambiguatingDescription: "Autor de IA, com revisão da redação" } : {}) }
        : { "@type": "Organization", name: SITE.name },
      publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absoluteUrl("/logo-192.png") } },
      keywords: p.tags.map((t) => t.name).join(", ") || undefined,
    },
  });
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { post, related, showCover, video, sidebar, comments, animeCard } = loaderData;
  const section = post.type === "news" ? { label: "Notícias", to: "/noticias?tipo=noticias" } : { label: "Artigos", to: "/artigos" };
  return (
    <article>
      <header className="relative overflow-hidden rounded-b-[28px] bg-night text-night-ink shadow-[0_24px_50px_rgba(60,20,20,.16)]">
        {post.image && (
          <img
            src={post.image}
            alt=""
            className={`absolute inset-0 size-full object-cover ${isWideImage(post) ? "opacity-45" : "scale-110 opacity-50 blur-2xl"}`}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,16,.97)_0%,rgba(13,13,16,.8)_45%,rgba(13,13,16,.35)_100%),linear-gradient(0deg,rgba(13,13,16,.9)_0%,rgba(13,13,16,0)_45%)]" aria-hidden />
        <div className="relative mx-auto max-w-[1328px] px-4 pt-8 pb-12 sm:px-8 sm:pt-12 sm:pb-16 lg:px-14">
          <nav aria-label="Você está em" className="flex flex-wrap items-center gap-2 text-[0.85rem] text-white/70">
            <Link to="/" className="hover:text-white">
              Início
            </Link>
            <span aria-hidden>/</span>
            <Link to={section.to} className="hover:text-white">
              {section.label}
            </Link>
            {post.category && (
              <>
                <span aria-hidden>/</span>
                <Link to={`/categoria/${post.category.slug}`} className="font-semibold text-glow hover:text-white">
                  {post.category.name}
                </Link>
              </>
            )}
          </nav>
          <h1 className="mt-5 max-w-[24ch] text-[2rem] leading-[1.06] font-extrabold tracking-[-0.035em] text-balance sm:text-[3rem]">{post.title}</h1>
          {post.excerpt && <p className="mt-5 max-w-[64ch] text-[1.05rem] leading-relaxed text-white/80 sm:text-lg">{post.excerpt}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-[0.9rem] text-white/75">
            {post.author && (
              <Link to={post.author.url} className="flex items-center gap-2.5 font-semibold text-white hover:underline">
                {post.author.avatar ? (
                  <img src={post.author.avatar} alt="" className="size-9 rounded-full object-cover" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-brand font-bold">{post.author.name[0]}</span>
                )}
                {post.author.name}
              </Link>
            )}
            <time dateTime={post.publishedAt ?? undefined}>{formatDateTime(post.publishedAt)}</time>
            <span>{readingLabel(post.readingMinutes)}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1328px] px-4 py-10 sm:px-8 sm:py-14 lg:px-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-8">
            <ShareBar url={absoluteUrl(post.url)} title={post.title} />
          </div>
          {video && <div className="prose-ap mb-8 max-w-none" dangerouslySetInnerHTML={{ __html: video }} />}
          {showCover && post.image && <img src={post.image} alt="" className="mb-10 -mx-4 aspect-video w-[calc(100%+2rem)] max-w-none rounded-none object-cover sm:mx-0 sm:w-full sm:rounded-[18px] sm:shadow-[0_20px_40px_rgba(60,20,20,.16)]" />}
          <div className="prose-ap max-w-none" dangerouslySetInnerHTML={{ __html: post.html }} />
          {animeCard && <div className="prose-ap mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: animeCard }} />}

          {post.tags.length > 0 && (
            <div className="mt-12 flex flex-wrap gap-2" aria-label="Assuntos">
              {post.tags.map((t) => (
                <Link key={t.slug} to={`/tag/${t.slug}`} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[0.85rem] font-semibold text-ink-soft hover:text-ink">
                  #{t.name}
                </Link>
              ))}
            </div>
          )}

          {post.author && (
            <aside className="mt-10 flex flex-wrap items-center gap-4 rounded-[18px] border border-line bg-surface p-5">
              {post.author.avatar ? (
                <img src={post.author.avatar} alt="" className="size-14 rounded-full object-cover" />
              ) : (
                <span className="grid size-14 place-items-center rounded-full bg-brand text-xl font-bold text-brand-ink">{post.author.name[0]}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-bold text-brand">{post.isAi ? "Autor da redação (IA, com revisão humana)" : "Escrito por"}</p>
                <p className="text-[1.05rem] font-extrabold">{post.author.name}</p>
                {post.authorBio && <p className="mt-1 text-[0.9rem] text-ink-soft">{post.authorBio}</p>}
              </div>
              <Link to={post.author.url} className="rounded-[9px] border border-line px-4 py-2.5 text-[0.9rem] font-semibold hover:bg-sunken">
                Ver perfil
              </Link>
            </aside>
          )}

          <p className="mt-8 text-[0.85rem] text-ink-soft">
            Publicado em {formatDateLong(post.publishedAt)}. Encontrou um erro?{" "}
            <Link to="/contato" className="font-semibold text-link underline">
              Peça uma correção
            </Link>
            .
          </p>

          <Comments items={comments} />
        </div>

        <Sidebar blocks={sidebar} label="Mais do Anime Profile" />
        </div>

        {related.length > 0 && (
          <section aria-labelledby="relacionadas" className="mt-16 border-t border-line pt-12">
            <h2 id="relacionadas" className="text-[1.6rem] font-extrabold tracking-[-0.02em]">
              Leia também
            </h2>
            <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
