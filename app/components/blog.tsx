// Peças do blog da comunidade: avatar, cartão em linha, cartão de grade, contadores e barra lateral.
import { useState } from "react";
import { Link } from "react-router";
import { Eye, Heart, MessageCircle } from "lucide-react";
import type { BlogCardData } from "~/lib/blog";
import { timeAgo } from "~/lib/format";

export function BlogAvatar({ src, name, size = "size-8" }: { src?: string | null; name: string; size?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand text-[0.8rem] font-bold text-brand-ink`}>{name.trim()[0]?.toUpperCase() ?? "?"}</span>;
  return <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className={`${size} shrink-0 rounded-full object-cover`} />;
}

function Cover({ src, title, className }: { src: string | null; title: string; className: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad)
    return (
      <span className={`${className} grid place-items-center bg-[linear-gradient(135deg,#2a1311,#0d0d10)] text-3xl font-extrabold text-white/60`} aria-hidden>
        {title.trim()[0]?.toUpperCase() ?? "B"}
      </span>
    );
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} className={`${className} object-cover`} />;
}

const n = (v: number) => v.toLocaleString("pt-BR");

export function BlogStats({ post }: { post: Pick<BlogCardData, "views" | "likes" | "claps" | "comments"> }) {
  return (
    <span className="flex items-center gap-3 text-[0.8rem] text-ink-soft">
      <span className="inline-flex items-center gap-1" title="Leituras">
        <Eye className="size-3.5" aria-hidden />
        {n(post.views)}
      </span>
      <span className="inline-flex items-center gap-1" title="Curtidas">
        <Heart className="size-3.5" aria-hidden />
        {n(post.likes + post.claps)}
      </span>
      <span className="inline-flex items-center gap-1" title="Comentários">
        <MessageCircle className="size-3.5" aria-hidden />
        {n(post.comments)}
      </span>
    </span>
  );
}

/** Cartão em linha da lista (capa à esquerda). `now` vem do loader para a data relativa não mudar entre servidor e navegador. */
export function BlogRow({ post, now }: { post: BlogCardData; now: string }) {
  return (
    <article className="group relative flex gap-4 rounded-[18px] border border-line bg-surface p-3 sm:gap-5 sm:p-4">
      <Cover src={post.coverUrl} title={post.title} className="aspect-[4/3] w-28 shrink-0 rounded-xl sm:w-44" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-[1.05rem] leading-snug font-extrabold sm:text-[1.2rem]">
          <Link to={post.url} className="line-clamp-2 after:absolute after:inset-0 hover:underline">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="line-clamp-2 hidden text-[0.92rem] text-ink-soft sm:block">{post.excerpt}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <span className="relative z-10 flex items-center gap-2 text-[0.82rem] text-ink-soft">
            <BlogAvatar src={post.author.avatarUrl} name={post.author.name} size="size-6" />
            <Link to={post.author.url} className="font-semibold text-ink hover:underline">
              {post.author.name}
            </Link>
            {post.publishedAt && <span>· {timeAgo(post.publishedAt, new Date(now))}</span>}
          </span>
          <BlogStats post={post} />
        </div>
      </div>
    </article>
  );
}

/** Cartão de grade (página do autor e home). */
export function BlogTile({ post }: { post: BlogCardData }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface">
      <Cover src={post.coverUrl} title={post.title} className="aspect-[16/10] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-[1rem] leading-snug font-bold">
          <Link to={post.url} className="line-clamp-3 after:absolute after:inset-0 hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className="mt-auto text-[0.8rem] text-ink-soft">@{post.author.slug}</p>
      </div>
    </article>
  );
}
