// Partes da página da matéria: compartilhar e comentários (a barra lateral está em sidebar.tsx).
import { useState } from "react";
import { Link } from "react-router";
import { Check, Link2, MessageCircle } from "lucide-react";
import { formatDate } from "~/lib/format";
import type { Labeled } from "~/lib/sidebar";
import type { CommentItem } from "~/server/content/posts.server";
import { Avatar } from "./sidebar";

export type { Labeled };

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
        <p className="text-[0.92rem] text-ink-soft">
          Comentar volta junto com as contas. {total > 0 && "Os comentários abaixo vieram do site anterior. "}
          <Link to="/site-novo" className="font-semibold text-link underline">
            Saiba mais
          </Link>
        </p>
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
