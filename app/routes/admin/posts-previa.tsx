// Prévia de uma matéria (e de uma versão antiga) dentro do painel: o texto desenhado como na página pública.
// Nunca é uma página pública que dependa de sessão (o cache da CDN): fica em /admin, que é sempre no-store e noindex.
import { data, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/posts-previa";
import { adminMeta } from "~/lib/admin-meta";
import { carregarPost, lerVersao } from "~/server/admin/posts-edit.server";
import { sanitizePostHtml } from "~/server/content/sanitize.server";
import { requireAdmin } from "~/server/auth/viewer.server";

export const meta = () => adminMeta("Prévia");

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const r = await carregarPost(params.id);
  if (!r) throw data("Post não encontrado", { status: 404 });
  const versaoId = Number(new URL(request.url).searchParams.get("versao"));
  const v = Number.isInteger(versaoId) && versaoId > 0 ? await lerVersao(params.id, versaoId) : null;
  return {
    id: r.post.id,
    daVersao: !!v,
    titulo: v?.titulo ?? r.post.titulo,
    capa: v?.capa ?? r.post.capa,
    html: sanitizePostHtml(v?.html ?? r.post.html),
    tipo: r.post.tipo,
    status: r.post.status,
  };
}

export default function PreviaPost({ loaderData: p }: Route.ComponentProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-[0.88rem]">
        <p className="font-semibold">
          Prévia{p.daVersao ? " de uma versão antiga" : ""}: {p.status === "published" && !p.daVersao ? "esta matéria está no site" : "isto não está no site"}.
        </p>
        <Link to={`/admin/posts/${p.id}`} className="inline-flex items-center gap-1.5 font-bold underline">
          <ArrowLeft className="size-4" aria-hidden /> Voltar ao editor
        </Link>
      </div>
      <article className="mx-auto mt-6 max-w-[760px]">
        <p className="text-[0.75rem] font-bold tracking-[0.14em] text-brand uppercase dark:text-glow">{p.tipo === "article" ? "Artigo" : "Notícia"}</p>
        <h1 className="mt-2 text-[2.1rem] leading-tight font-extrabold tracking-[-0.02em]">{p.titulo || "Sem título"}</h1>
        {p.capa && <img src={p.capa} alt="" className="mt-5 aspect-video w-full rounded-2xl object-cover" />}
        {/* o HTML passa por sanitizePostHtml na gravação e de novo aqui */}
        <div className="prose-ap mt-6" dangerouslySetInnerHTML={{ __html: p.html }} />
      </article>
    </div>
  );
}
