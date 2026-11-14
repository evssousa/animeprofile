// Partes da página da matéria: barra lateral (como no site antigo), compartilhar e comentários.
import { useState } from "react";
import { Link } from "react-router";
import { Check, Link2, MessageCircle } from "lucide-react";
import { STATUS_PT, STREAMERS, airTime, brDayLabel } from "~/lib/anime";
import { formatDate } from "~/lib/format";
import type { AnimeFull } from "~/server/anime/anime.server";
import type { CommentItem, PostCard as Card } from "~/server/content/posts.server";
import { PostOverlay, PostRow } from "./posts";

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-line bg-surface p-5">
      <h2 className="text-[1.02rem] font-extrabold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Avatar({ src, name, size = "size-9" }: { src: string | null; name: string; size?: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand text-[0.85rem] font-bold text-brand-ink`}>{name[0]?.toUpperCase()}</span>
  );
}

/** "há 3 h" fixo no servidor (sem diferença de hidratação): o texto vem calculado no loader. */
export type Labeled<T> = T & { ago: string };

export function PostSidebar({
  anime,
  featured,
  latest,
  comments,
  toc,
  trending,
  kindLabel,
}: {
  anime: AnimeFull | null;
  featured: Card | null;
  latest: Card[];
  comments: Labeled<CommentItem>[];
  toc: { id: string; text: string }[];
  trending: Card[];
  kindLabel: "notícias" | "artigos";
}) {
  return (
    <div className="flex flex-col gap-6">
      {anime && (
        <section className="overflow-hidden rounded-[18px] border border-line bg-surface">
          <div className="flex gap-4 p-5">
            {anime.cover && <img src={anime.cover} alt="" className="w-[86px] shrink-0 rounded-[10px] object-cover shadow-md" />}
            <div className="min-w-0">
              <p className="text-[0.78rem] font-bold text-brand">O anime desta matéria</p>
              <h2 className="mt-1 text-[1.02rem] leading-snug font-extrabold">{anime.title}</h2>
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
          <Link to={anime.url} className="block border-t border-line px-5 py-3 text-[0.88rem] font-bold text-link hover:bg-sunken">
            Ficha completa, personagens e trailer
          </Link>
        </section>
      )}

      {featured && <PostOverlay post={featured} className="min-h-[260px]" titleClass="text-[1.15rem]" />}

      {latest.length > 0 && (
        <SideCard title={`Últimas ${kindLabel}`}>
          <ol className="flex flex-col gap-4">
            {latest.map((p) => (
              <li key={p.id}>
                <PostRow post={p} />
              </li>
            ))}
          </ol>
        </SideCard>
      )}

      {comments.length > 0 && (
        <SideCard title="Últimos comentários">
          <ul className="flex flex-col gap-4">
            {comments.map((c) => (
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
      )}

      {/* O fim da coluna acompanha a leitura: fica fixo no topo da tela até o fim do texto. */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-[92px]">
        {toc.length > 1 && (
          <SideCard title="Nesta matéria">
            <ol className="flex flex-col gap-1 border-l border-line">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-[0.88rem] leading-snug text-ink-soft hover:border-brand hover:text-ink">
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </SideCard>
        )}
        {trending.length > 0 && (
          <SideCard title="Em alta">
            <ol className="flex flex-col gap-4">
              {trending.map((p, i) => (
                <li key={p.id}>
                  <PostRow post={p} index={i + 1} />
                </li>
              ))}
            </ol>
          </SideCard>
        )}
      </div>
    </div>
  );
}

/** Compartilhar: WhatsApp, X, Facebook e copiar o link. */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const btn = "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[0.85rem] font-semibold hover:bg-sunken";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Compartilhar">
      <span className="mr-1 text-[0.85rem] font-bold text-ink-soft">Compartilhar</span>
      <a className={btn} href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a className={btn} href={`https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noreferrer">
        X
      </a>
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noreferrer">
        Facebook
      </a>
      <button
        type="button"
        className={btn}
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? <Check className="size-4 text-brand" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}

/** Comentários (só leitura por enquanto: comentar no site novo chega com as contas). */
export function Comments({ items }: { items: (Labeled<CommentItem> & { replies: Labeled<CommentItem>[] })[] }) {
  const total = items.reduce((n, c) => n + 1 + c.replies.length, 0);
  return (
    <section id="comentarios" aria-labelledby="comentarios-titulo" className="mt-14 scroll-mt-24">
      <h2 id="comentarios-titulo" className="flex items-center gap-2 text-[1.5rem] font-extrabold">
        <MessageCircle className="size-6 text-brand" aria-hidden />
        {total === 0 ? "Comentários" : total === 1 ? "1 comentário" : `${total} comentários`}
      </h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[0.92rem] text-ink-soft">{total === 0 ? "Ninguém comentou ainda. Entre na sua conta e seja o primeiro." : "Entre na sua conta para participar da conversa."}</p>
        <Link to="/login" className="rounded-[9px] bg-brand px-4 py-2.5 text-[0.9rem] font-bold text-brand-ink hover:brightness-110">
          Entrar para comentar
        </Link>
      </div>
      {total > 0 && (
        <ul className="mt-6 flex flex-col gap-6">
          {items.map((c) => (
            <li key={c.id}>
              <CommentBody c={c} />
              {c.replies.length > 0 && (
                <ul className="mt-4 ml-6 flex flex-col gap-4 border-l-2 border-line pl-5">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentBody c={r} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentBody({ c }: { c: Labeled<CommentItem> }) {
  return (
    <div className="flex gap-3">
      <Avatar src={c.author.avatar} name={c.author.name} size="size-10" />
      <div className="min-w-0">
        <p className="text-[0.9rem]">
          <span className="font-bold">{c.author.name}</span> <span className="text-ink-soft">@{c.author.slug}</span>{" "}
          <time className="text-ink-soft" dateTime={c.createdAt} title={formatDate(c.createdAt)}>
            {c.ago}
          </time>
        </p>
        <p className="mt-1 whitespace-pre-line text-[0.95rem] leading-relaxed">{c.content}</p>
      </div>
    </div>
  );
}
