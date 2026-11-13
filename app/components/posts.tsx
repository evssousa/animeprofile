// Peças das listas de matérias: cabeçalho de seção, cartões e paginação.
import { Link } from "react-router";
import { formatDate, readingLabel } from "~/lib/format";
import type { PostCard as Card } from "~/server/content/posts.server";

/** Rótulo vermelho + título + link "ver mais", como nas seções da página inicial. */
export function SectionHead({ label, title, more, id }: { label?: string; title: string; more?: { to: string; text: string }; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        {label && <p className="text-[0.82rem] font-bold text-brand">{label}</p>}
        <h2 id={id} className="mt-1.5 text-[1.6rem] leading-tight font-extrabold tracking-[-0.025em] sm:text-[1.9rem]">
          {title}
        </h2>
      </div>
      {more && (
        <Link to={more.to} className="text-[0.9rem] font-bold whitespace-nowrap text-link hover:underline">
          {more.text}
        </Link>
      )}
    </div>
  );
}

function Img({ src, className }: { src: string | null; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" decoding="async" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} bg-[linear-gradient(135deg,#2a1311,#0d0d10)]`} aria-hidden />
  );
}

/** Cartão padrão: imagem em cima, categoria, título e data. */
export function PostCard({ post, priority = false }: { post: Card; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col gap-2.5">
      <div className="overflow-hidden rounded-xl shadow-[0_10px_22px_rgba(60,20,20,.14)]">
        {post.image ? (
          <img
            src={post.image}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <Img src={null} className="aspect-video w-full" />
        )}
      </div>
      {post.category && <span className="text-[0.75rem] font-bold text-brand">{post.category.name}</span>}
      <h3 className="text-[1rem] leading-snug font-bold">
        <Link to={post.url} className="after:absolute after:inset-0 hover:underline">
          {post.title}
        </Link>
      </h3>
      <p className="text-[0.82rem] text-ink-soft">{formatDate(post.publishedAt)}</p>
    </article>
  );
}

/** Cartão grande com o texto sobre a imagem (destaques). */
export function PostOverlay({ post, className = "", titleClass = "text-[1.6rem]" }: { post: Card; className?: string; titleClass?: string }) {
  return (
    <article className={`group relative flex items-end overflow-hidden rounded-[20px] bg-night text-white shadow-[0_20px_40px_rgba(60,20,20,.18)] ${className}`}>
      <Img src={post.image} className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(13,13,16,.95)_0%,rgba(13,13,16,.15)_62%)]" aria-hidden />
      <div className="relative flex flex-col gap-2 p-6">
        {post.category && <span className="text-[0.75rem] font-bold text-glow">{post.category.name}</span>}
        <h3 className={`${titleClass} leading-tight font-extrabold tracking-[-0.02em]`}>
          <Link to={post.url} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>
        <span className="text-[0.82rem] text-white/70">{readingLabel(post.readingMinutes)}</span>
      </div>
    </article>
  );
}

/** Linha compacta: miniatura à esquerda (listas laterais, busca). */
export function PostRow({ post, index }: { post: Card; index?: number }) {
  return (
    <article className="group relative flex items-center gap-3.5">
      {index !== undefined && <span className="w-7 shrink-0 text-[1.6rem] leading-none font-extrabold text-brand/25">{index}</span>}
      <Img src={post.image} className="aspect-[4/3] w-24 shrink-0 rounded-lg" />
      <div className="min-w-0">
        {post.category && <span className="text-[0.72rem] font-bold text-brand">{post.category.name}</span>}
        <h3 className="mt-0.5 text-[0.92rem] leading-snug font-semibold">
          <Link to={post.url} className="after:absolute after:inset-0 group-hover:underline">
            {post.title}
          </Link>
        </h3>
      </div>
    </article>
  );
}

export function PostGrid({ posts, cols = 4 }: { posts: Card[]; cols?: 3 | 4 }) {
  return (
    <div className={`grid gap-x-5 gap-y-8 sm:grid-cols-2 ${cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {posts.map((p, i) => (
        <PostCard key={p.id} post={p} priority={i < 4} />
      ))}
    </div>
  );
}

/** Paginação com ?pagina=N (a 1 não leva parâmetro, para não duplicar endereço no Google). */
export function Pagination({ page, pages, basePath, query = {} }: { page: number; pages: number; basePath: string; query?: Record<string, string> }) {
  if (pages <= 1) return null;
  const href = (n: number) => {
    const qs = new URLSearchParams(query);
    if (n > 1) qs.set("pagina", String(n));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = "grid h-11 min-w-11 place-items-center rounded-[9px] border border-line bg-surface px-3 font-semibold hover:bg-sunken";
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link to={href(page - 1)} className={btn} rel="prev">
          Anterior
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-soft">…</span>}
          {n === page ? (
            <span aria-current="page" className={`${btn} border-brand bg-brand text-brand-ink hover:bg-brand`}>
              {n}
            </span>
          ) : (
            <Link to={href(n)} className={btn}>
              {n}
            </Link>
          )}
        </span>
      ))}
      {page < pages && (
        <Link to={href(page + 1)} className={btn} rel="next">
          Próxima
        </Link>
      )}
    </nav>
  );
}

/** Filtros em pílulas (categorias, Tudo/Notícias/Artigos). */
export function Chips({ items, active }: { items: { label: string; to: string }[]; active?: string }) {
  return (
    <nav aria-label="Filtrar" className="flex flex-wrap gap-2">
      {items.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          aria-current={c.to === active ? "page" : undefined}
          className={`rounded-full border px-4 py-2 text-[0.85rem] font-semibold ${c.to === active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-soft hover:text-ink"}`}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
