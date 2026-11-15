// Post do blog (/blog/:username/:slug). Só leitura: reagir e comentar chegam com as contas.
import { data, Link, redirect } from "react-router";
import { Eye, Heart, Sparkles } from "lucide-react";
import type { Route } from "./+types/blog-post";
import { BlogAvatar, BlogTile } from "~/components/blog";
import { Sidebar } from "~/components/sidebar";
import { Comments, ShareBar } from "~/components/post-extras";
import { blogAuthorUrl, stripMarkdown } from "~/lib/blog";
import { formatDateLong, formatDateTime, readingLabel, timeAgo } from "~/lib/format";
import { routePath } from "~/lib/route-path";
import { seo } from "~/lib/seo";
import { SITE, absoluteUrl } from "~/lib/site";
import { blogComments, getBlogPost, relatedBlogPosts } from "~/server/blog/blog.server";
import { loadSidebar } from "~/server/sidebar.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const post = await getBlogPost(params.slug);
  if (!post) throw data(null, { status: 404 });
  // O endereço certo leva o username do autor; qualquer outro vai para ele (301).
  if (routePath(request) !== post.url) throw redirect(post.url, 301);
  const now = new Date();
  const [comments, related, side] = await Promise.all([blogComments(post.id), relatedBlogPosts(post, 3), loadSidebar("blog", { now })]);
  const label = <T extends { createdAt: string }>(c: T) => ({ ...c, ago: timeAgo(c.createdAt, now) });
  const { contentMd, ...rest } = post;
  return {
    post: { ...rest, description: stripMarkdown(post.excerpt || contentMd).slice(0, 158) },
    comments: comments.map((c) => ({ ...label(c), replies: c.replies.map(label) })),
    related,
    side,
  };
}

export function meta({ loaderData: d }: Route.MetaArgs) {
  if (!d) return [{ title: "Post não encontrado | Anime Profile" }];
  const p = d.post;
  const canonical = p.promotedArticleSlug ? `/artigos/${p.promotedArticleSlug}` : undefined;
  return seo({
    title: p.title,
    description: p.description,
    path: p.url,
    canonical,
    type: "article",
    image: p.coverUrl,
    publishedTime: p.publishedAt,
    modifiedTime: p.updatedAt,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          headline: p.title,
          description: p.description,
          image: p.coverUrl ? [p.coverUrl] : undefined,
          datePublished: p.publishedAt,
          dateModified: p.updatedAt ?? p.publishedAt,
          mainEntityOfPage: absoluteUrl(canonical ?? p.url),
          inLanguage: "pt-BR",
          author: { "@type": "Person", name: p.author.name, url: absoluteUrl(blogAuthorUrl(p.author.slug)) },
          publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absoluteUrl("/logo-192.png") } },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
            { "@type": "ListItem", position: 3, name: p.title, item: absoluteUrl(p.url) },
          ],
        },
      ],
    },
  });
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, comments, related, side } = loaderData;
  const cat = post.categories[0];
  return (
    <article>
      <header className="relative overflow-hidden rounded-b-[28px] bg-night text-night-ink shadow-[0_24px_50px_rgba(60,20,20,.16)]">
        {post.coverUrl && <img src={post.coverUrl} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(13,13,16,.9)_0%,rgba(13,13,16,.4)_100%)]" aria-hidden />
        <div className="relative mx-auto max-w-[1328px] px-4 pt-8 pb-12 sm:px-8 sm:pt-12 sm:pb-16 lg:px-14">
          <nav aria-label="Você está em" className="flex flex-wrap items-center gap-2 text-[0.85rem] text-white/70">
            <Link to="/" className="hover:text-white">
              Início
            </Link>
            <span aria-hidden>/</span>
            <Link to="/blog" className="hover:text-white">
              Blog
            </Link>
            {cat && (
              <>
                <span aria-hidden>/</span>
                <Link to={`/blog/categoria/${cat.slug}`} className="font-semibold text-glow hover:text-white">
                  {cat.name}
                </Link>
              </>
            )}
          </nav>
          <h1 className="mt-5 max-w-[24ch] text-[2rem] leading-[1.06] font-extrabold tracking-[-0.035em] text-balance sm:text-[3rem]">{post.title}</h1>
          {post.excerpt && <p className="mt-5 max-w-[64ch] text-[1.05rem] leading-relaxed text-white/80 sm:text-lg">{post.excerpt}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-[0.9rem] text-white/75">
            <Link to={post.author.url} className="flex items-center gap-2.5 font-semibold text-white hover:underline">
              <BlogAvatar src={post.author.avatarUrl} name={post.author.name} size="size-9" />
              {post.author.name}
            </Link>
            <time dateTime={post.publishedAt ?? undefined}>{formatDateTime(post.publishedAt)}</time>
            <span>{readingLabel(post.readingMinutes)}</span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" aria-hidden /> {post.views.toLocaleString("pt-BR")} leituras
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1328px] px-4 py-10 sm:px-8 sm:py-14 lg:px-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="mb-8">
              <ShareBar url={absoluteUrl(post.url)} title={post.title} />
            </div>
            {post.promotedArticleSlug && (
              <p className="mb-8 flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-3 text-[0.92rem] font-semibold">
                <Sparkles className="size-4 text-brand" aria-hidden />
                Este post foi promovido a artigo oficial do site.{" "}
                <Link to={`/artigos/${post.promotedArticleSlug}`} className="text-link underline">
                  Ler o artigo
                </Link>
              </p>
            )}
            <div className="prose-ap max-w-none" dangerouslySetInnerHTML={{ __html: post.html }} />

            {post.tags.length > 0 && (
              <div className="mt-12 flex flex-wrap gap-2" aria-label="Assuntos">
                {post.tags.map((t) => (
                  <Link key={t.slug} to={`/blog/tag/${t.slug}`} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.85rem] font-semibold text-ink-soft hover:text-ink">
                    #{t.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface p-4" aria-label="Reações">
              <button type="button" disabled title="Entre para reagir (em breve)" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[0.9rem] font-semibold opacity-70">
                <Heart className="size-4" aria-hidden /> {post.likes.toLocaleString("pt-BR")} curtidas
              </button>
              <button type="button" disabled title="Entre para reagir (em breve)" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[0.9rem] font-semibold opacity-70">
                👏 {post.claps.toLocaleString("pt-BR")} palmas
              </button>
              <span className="text-[0.85rem] text-ink-soft">Reagir chega com as contas.</span>
            </div>

            <aside className="mt-8 flex flex-wrap items-center gap-4 rounded-[18px] border border-line bg-surface p-5">
              <BlogAvatar src={post.author.avatarUrl} name={post.author.name} size="size-14" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-bold text-brand">Escrito por</p>
                <p className="text-[1.05rem] font-extrabold">{post.author.name}</p>
              </div>
              <Link to={post.author.url} className="rounded-[9px] border border-line px-4 py-2.5 text-[0.9rem] font-semibold hover:bg-sunken">
                Mais posts do autor
              </Link>
            </aside>

            <p className="mt-8 text-[0.85rem] text-ink-soft">
              Publicado em {formatDateLong(post.publishedAt)}. Este texto é de um usuário e não representa a redação do Anime Profile.{" "}
              <Link to="/contato" className="font-semibold text-link underline">
                Denunciar
              </Link>
              .
            </p>

            <Comments items={comments} />
          </div>
          <Sidebar blocks={side} label="Mais do blog" />
        </div>

        {related.length > 0 && (
          <section aria-labelledby="relacionados" className="mt-16 border-t border-line pt-12">
            <h2 id="relacionados" className="text-[1.6rem] font-extrabold tracking-[-0.02em]">
              Posts relacionados
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <BlogTile key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

