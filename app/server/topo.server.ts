// Dados do topo do site: sugestões da busca e o painel "Agora". Públicos e iguais para todos (a CDN pode guardar).
import { cached } from "./cache.server";
import { query } from "./db.server";
import { airingBetween, sugerirAnimes } from "./anime/anime.server";
import { latestPosts, sugerirPosts, trendingTags, VISIBLE } from "./content/posts.server";
import { sugerirQuizzes } from "./quiz/quiz.server";
import { diaBrasilia, somarDias } from "~/visitas/core/dia";

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);

export type Sugestoes = {
  q: string;
  emAlta: { nome: string; slug: string }[];
  animes: { id: number; titulo: string; url: string; capa: string | null; info: string }[];
  posts: { titulo: string; url: string; imagem: string | null; tipo: "news" | "article"; publicadoEm: string | null }[];
  quizzes: { titulo: string; url: string }[];
};

const FORMATOS: Record<string, string> = { TV: "TV", TV_SHORT: "TV curta", MOVIE: "Filme", OVA: "OVA", ONA: "ONA", SPECIAL: "Especial", MUSIC: "Música" };

/** Com menos de 2 letras devolve só as tags em alta; senão, animes, matérias e quizzes (só do banco, nunca do AniList). */
export function sugestoes(qBruto: string): Promise<Sugestoes> {
  const q = norm(qBruto);
  return cached(`sug:${q}`, 5 * 60_000, async () => {
    if (q.length < 2) {
      const tags = await trendingTags(8);
      return { q, emAlta: tags.map((t) => ({ nome: t.name, slug: t.slug })), animes: [], posts: [], quizzes: [] };
    }
    const [animes, posts, quizzes] = await Promise.all([sugerirAnimes(q, 4), sugerirPosts(q, 4), sugerirQuizzes(q, 2)]);
    return {
      q,
      emAlta: [],
      animes: animes.map((a) => ({ id: a.id, titulo: a.title, url: a.url, capa: a.cover, info: [a.seasonYear, a.format ? (FORMATOS[a.format] ?? a.format) : null].filter(Boolean).join(" · ") })),
      posts: posts.map((p) => ({ titulo: p.title, url: p.url, imagem: p.image, tipo: p.type, publicadoEm: p.publishedAt })),
      quizzes: quizzes.map((z) => ({ titulo: z.title, url: `/quiz/${z.slug}` })),
    };
  });
}

export type Agora = {
  noticias: { titulo: string; url: string; imagem: string | null; publicadoEm: string | null }[];
  noAr: { titulo: string; url: string; capa: string | null; episodio: number; horario: string }[];
  amanha: boolean;
  emAlta: { nome: string; slug: string }[];
  hoje: number;
};

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Última hora, episódios que ainda vão ao ar hoje (ou os de amanhã, se não restar nenhum) e as tags em alta. */
export function agora(now = new Date()): Promise<Agora> {
  return cached("agora", 60_000, async () => {
    const hoje = diaBrasilia(now);
    const inicioHoje = new Date(`${hoje}T03:00:00Z`); // Brasília = UTC−3
    const fimHoje = new Date(`${somarDias(hoje, 1)}T03:00:00Z`);
    const fimAmanha = new Date(`${somarDias(hoje, 2)}T03:00:00Z`);
    const [noticias, restantes, tags, [cont]] = await Promise.all([
      latestPosts({ type: "news" }, 3),
      airingBetween(now, fimHoje),
      trendingTags(6),
      query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts p WHERE ${VISIBLE} AND p.post_type = 'news' AND p.published_at >= ?`, [inicioHoje]),
    ]);
    const amanha = restantes.length === 0;
    const lista = amanha ? await airingBetween(fimHoje, fimAmanha) : restantes;
    return {
      noticias: noticias.map((p) => ({ titulo: p.title, url: p.url, imagem: p.image, publicadoEm: p.publishedAt })),
      noAr: lista.slice(0, 4).map((i) => ({ titulo: i.anime.title, url: i.anime.url, capa: i.anime.cover, episodio: i.episode, horario: hora.format(new Date(i.airingAt)) })),
      amanha,
      emAlta: tags.map((t) => ({ nome: t.name, slug: t.slug })),
      hoje: Number(cont?.n ?? 0),
    };
  });
}
