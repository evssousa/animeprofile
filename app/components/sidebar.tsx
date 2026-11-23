// Barras laterais (docs/plano-sidebars.md): cartões brancos com borda fina, título curto, listas de matérias.
// Tudo renderizado no servidor, com dados prontos do loader. Bloco sem itens nem chega aqui (loadSidebar tira).
import { AdSlot } from "~/components/ads/AdSlot";
import { Link } from "react-router";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";
import { STATUS_PT, STREAMERS, airTime, brDayLabel } from "~/lib/anime";
import type { BlogCardData } from "~/lib/blog";
import type { Labeled, SideBlockData, SideLink } from "~/lib/sidebar";
import type { CommentItem } from "~/server/content/posts.server";
import { PostOverlay, PostRow } from "./posts";

export function SideCard({ title, more, children }: { title: string; more?: SideLink; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[1.05rem] font-extrabold">{title}</h2>
        {more && (
          <Link to={more.to} className="shrink-0 text-[0.85rem] font-bold text-link hover:underline">
            {more.text}
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Avatar({ src, name, size = "size-9" }: { src: string | null; name: string; size?: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand text-[0.85rem] font-bold text-brand-ink`}>{name[0]?.toUpperCase()}</span>
  );
}

function SideAnime({ block }: { block: Extract<SideBlockData, { kind: "anime" }> }) {
  const { anime, guide, guideTitle } = block;
  const guideList = guide.length > 0 && (
    <div className={anime ? "border-t border-line px-5 py-4" : ""}>
      {anime && <h3 className="text-[0.82rem] font-bold text-brand">{guideTitle}</h3>}
      <ul className={`flex flex-col gap-2.5 ${anime ? "mt-3" : ""}`}>
        {guide.map((g) => (
          <li key={g.url} className="flex items-start gap-2">
            {g.type === "article" ? <BookOpen className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden /> : <Newspaper className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />}
            <Link to={g.url} className="line-clamp-2 text-[0.88rem] leading-snug font-semibold hover:underline">
              {g.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
  if (!anime) return <SideCard title={guideTitle}>{guideList}</SideCard>;
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface">
      <div className="flex gap-4 p-5">
        {anime.cover && <img src={anime.cover} alt="" className="w-[86px] shrink-0 rounded-[10px] object-cover shadow-md" />}
        <div className="min-w-0">
          <p className="text-[0.78rem] font-bold text-brand">O anime desta matéria</p>
          <h2 className="mt-1 text-[1.05rem] leading-snug font-extrabold">{anime.title}</h2>
          {anime.status && <p className="mt-1 text-[0.82rem] text-ink-soft">{STATUS_PT[anime.status] ?? anime.status}</p>}
          {anime.nextAiringAt && anime.nextEpisode && (
            <p className="mt-1 text-[0.82rem] font-semibold">
              Ep. {anime.nextEpisode}: {brDayLabel(anime.nextAiringAt)}, {airTime(anime.nextAiringAt)}
            </p>
          )}
        </div>
      </div>
      {anime.streamers.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-5 pb-4">
          {anime.streamers.map((s) => (
            <li key={s} className="rounded-[7px] px-2.5 py-1 text-[0.78rem] font-bold text-white" style={{ backgroundColor: STREAMERS[s].color }}>
              {STREAMERS[s].label}
            </li>
          ))}
        </ul>
      )}
      {guideList}
      <Link to={anime.url} className="block border-t border-line px-5 py-3 text-[0.88rem] font-bold text-link hover:bg-sunken">
        Ficha completa, personagens e trailer
      </Link>
    </section>
  );
}

function SideComments({ items }: { items: Labeled<CommentItem>[] }) {
  return (
    <SideCard title="Últimos comentários">
      <ul className="flex flex-col gap-4">
        {items.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar src={c.author.avatar} name={c.author.name} />
            <div className="min-w-0 text-[0.85rem]">
              <p>
                <span className="font-bold">{c.author.name}</span> <span className="text-ink-soft">{c.ago}</span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-ink-soft">{c.content}</p>
              {c.post && (
                <Link to={`${c.post.url}#comentarios`} className="mt-1 line-clamp-1 font-semibold text-link hover:underline">
                  em {c.post.title}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SideCard>
  );
}

function BlogItem({ post, index, meta }: { post: BlogCardData; index?: number; meta?: string }) {
  return (
    <li className="group relative flex items-center gap-3">
      {index !== undefined && <span className="w-6 shrink-0 text-[1.4rem] leading-none font-extrabold text-brand/25">{index}</span>}
      {post.coverUrl ? (
        <img src={post.coverUrl} alt="" loading="lazy" className="aspect-[4/3] w-20 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="aspect-[4/3] w-20 shrink-0 rounded-lg bg-[linear-gradient(135deg,#2a1311,#0d0d10)]" aria-hidden />
      )}
      <div className="min-w-0">
        <Link to={post.url} className="line-clamp-2 text-[0.88rem] leading-snug font-semibold after:absolute after:inset-0 group-hover:underline">
          {post.title}
        </Link>
        <p className="mt-1 text-[0.78rem] text-ink-soft">{meta ?? `@${post.author.slug}`}</p>
      </div>
    </li>
  );
}

function Block({ b }: { b: SideBlockData }) {
  switch (b.kind) {
    case "anime":
      return <SideAnime block={b} />;
    case "featured":
      return <PostOverlay post={b.post} className="min-h-[260px]" titleClass="text-[1.15rem]" />;
    case "posts":
      return (
        <SideCard title={b.title} more={b.more}>
          <ol className="flex flex-col gap-4">
            {b.items.map((p, i) => (
              <li key={p.id}>
                <PostRow post={p} index={b.numbered ? i + 1 : undefined} meta={b.meta?.[i]} />
              </li>
            ))}
          </ol>
        </SideCard>
      );
    case "comments":
      return <SideComments items={b.items} />;
    case "toc":
      return (
        <SideCard title="Nesta matéria">
          <ol className="flex flex-col gap-1 border-l border-line">
            {b.items.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-[0.88rem] leading-snug text-ink-soft hover:border-brand hover:text-ink">
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </SideCard>
      );
    case "tags":
      return (
        <SideCard title={b.title}>
          <div className="flex flex-wrap gap-2">
            {b.items.map((t) => (
              <Link key={t.slug} to={`${b.hrefBase}${t.slug}`} className="rounded-full border border-line bg-surface px-3 py-1 text-[0.82rem] font-semibold text-ink-soft hover:border-ink-soft hover:text-ink">
                #{t.name}
              </Link>
            ))}
          </div>
        </SideCard>
      );
    case "categories":
      return (
        <SideCard title={b.title}>
          <ul className="-mx-2.5 flex flex-col">
            {b.items.map((c) => (
              <li key={c.slug}>
                <Link to={`/categoria/${c.slug}`} className="flex items-center justify-between gap-3 rounded-[9px] px-2.5 py-2 text-[0.92rem] font-semibold hover:bg-sunken">
                  {c.name}
                  <span className="rounded-full bg-brand-soft px-2 text-[0.78rem] font-bold text-link tabular-nums">{Number(c.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SideCard>
      );
    case "blog":
      return (
        <SideCard title={b.title} more={b.more}>
          <ul className="flex flex-col gap-4">
            {b.items.map((p, i) => (
              <BlogItem key={p.id} post={p} meta={b.meta?.[i]} />
            ))}
          </ul>
        </SideCard>
      );
    case "authors":
      return (
        <SideCard title={b.title}>
          <ul className="flex flex-col gap-3">
            {b.items.map((a) => (
              <li key={a.slug}>
                <Link to={`/blog/u/${a.slug}`} className="flex items-center gap-3 hover:underline">
                  <Avatar src={a.avatarUrl} name={a.name} />
                  <span className="min-w-0 flex-1 truncate text-[0.92rem] font-semibold">{a.name}</span>
                  <span className="text-[0.8rem] text-ink-soft">
                    {a.total} {a.total === 1 ? "post" : "posts"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SideCard>
      );
    case "cta":
      return (
        <section className="rounded-[18px] border border-line bg-brand-soft p-5">
          <p className="text-[0.82rem] font-bold text-brand">{b.label}</p>
          <p className="mt-1 text-[0.92rem] text-ink-soft">{b.text}</p>
          <Link to={b.link.to} className="mt-3 inline-flex items-center gap-1 font-bold text-link hover:underline">
            {b.link.text} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      );
  }
}

/** A lateral inteira: os blocos na ordem; os "fixos" ficam juntos no fim e acompanham a leitura no computador. */
export function Sidebar({ blocks, label, anuncio = false }: { blocks: SideBlockData[]; label: string; /** Espaço de anúncio no fim da barra (só nas páginas de conteúdo). */ anuncio?: boolean }) {
  const free = blocks.filter((b) => !b.sticky);
  const fixed = blocks.filter((b) => b.sticky);
  const wrap = (b: SideBlockData) => (
    <div key={b.key} className={b.mobile === "hide" ? "hidden lg:block" : undefined}>
      <Block b={b} />
    </div>
  );
  if (!blocks.length) return null;
  return (
    <aside aria-label={label} className="flex flex-col gap-6">
      {free.map(wrap)}
      {fixed.length > 0 && <div className="flex flex-col gap-6 lg:sticky lg:top-[92px]">{fixed.map(wrap)}</div>}
      {anuncio && <AdSlot slot="sidebar" className="hidden lg:block" />}
    </aside>
  );
}
