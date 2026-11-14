// Exporta o conteúdo do site antigo (notícias, artigos, categorias, tags e autores) e envia ao site novo.
//
// Roda no computador do desenvolvedor, nunca no servidor: o site novo não conhece endereço nem chave do Supabase.
// Lê só a API pública (a chave pública que qualquer visitante do site antigo recebe) e não imprime nenhum valor
// do .env. O site novo grava com "insere ou atualiza", então rodar de novo só traz o que mudou.
//
// Uso:
//   CRON_TOKEN=... node scripts/exportar-conteudo-antigo.mjs <caminho do .env do site antigo> [endereço do site novo]
//   (endereço padrão: https://novo.animeprofile.com.br)
//   Sem CRON_TOKEN, só gera .import/conteudo.json.gz e não envia.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { imageSize } from "image-size";

const [envPath, target = "https://novo.animeprofile.com.br"] = process.argv.slice(2);
if (!envPath) {
  console.error("Informe o caminho do .env do site antigo.");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const BASE = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
if (!BASE || !KEY) {
  console.error("O .env não tem VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

async function fetchAll(table, select, filter = "", order = "id") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${BASE}/rest/v1/${table}?select=${select}${filter}&order=${order}&limit=1000&offset=${offset}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const POST_COLUMNS =
  "id,slug,post_type,status,title,excerpt,content,featured_image,author_id,ai_author_id,is_ai_generated,anilist_id,focus_keyword,views_count,published_at,created_at,updated_at";

const [posts, categories, tags, ai_news_authors, post_categories, post_tags, tag_redirects] = await Promise.all([
  fetchAll("posts", POST_COLUMNS, "&status=eq.published"),
  fetchAll("categories", "id,name,slug,kind,description,color"),
  fetchAll("tags", "id,name,slug"),
  fetchAll("ai_news_authors", "id,name,slug,avatar_url,signature"),
  fetchAll("post_categories", "post_id,category_id", "", "post_id,category_id"),
  fetchAll("post_tags", "post_id,tag_id", "", "post_id,tag_id"),
  fetchAll("tag_redirects", "old_slug,tag_id", "", "old_slug").catch(() => []),
]);
// Sinopses de anime traduzidas pelo site antigo (custaram chamadas ao Gemini; o resto o site novo busca no AniList).
const anime_catalog = await fetchAll("anime_catalog", "anilist_id,title,synopsis_pt", "&synopsis_pt=not.is.null", "anilist_id").catch((e) => {
  console.log(`Aviso: catálogo de animes não lido (${e.message}).`);
  return [];
});

// Comentários públicos (os escondidos por denúncia ficam de fora), só das matérias exportadas.
const postIdSet = new Set(posts.map((p) => p.id));
const post_comments = (
  await fetchAll("post_comments", "id,post_id,author_id,parent_id,content,created_at", "&hidden_by_reports=eq.false", "id").catch((e) => {
    console.log(`Aviso: comentários não lidos (${e.message}).`);
    return [];
  })
).filter((c) => postIdSet.has(c.post_id));

// Blog da comunidade: posts publicados e não escondidos, comentários, e só as categorias e tags que eles usam.
const soft = (what) => (e) => {
  console.log(`Aviso: ${what} não lidos (${e.message}).`);
  return [];
};
const blog_posts = await fetchAll(
  "blog_posts",
  "id,author_id,slug,title,content,excerpt,cover_url,focus_keyword,status,promoted_post_id,views_count,likes_count,claps_count,bookmarks_count,comments_count,quality_score,published_at,created_at,updated_at",
  "&status=eq.published&hidden_by_reports=eq.false",
  "id",
).catch(soft("posts do blog"));
const blogIds = new Set(blog_posts.map((p) => p.id));
const blog_post_comments = (
  await fetchAll("blog_post_comments", "id,blog_post_id,author_id,parent_id,content,created_at", "&hidden_by_reports=eq.false", "id").catch(soft("comentários do blog"))
).filter((c) => blogIds.has(c.blog_post_id));
const blog_post_categories = (await fetchAll("blog_post_categories", "blog_post_id,category_id", "", "blog_post_id,category_id").catch(soft("categorias do blog"))).filter((r) => blogIds.has(r.blog_post_id));
const blog_post_tags = (await fetchAll("blog_post_tags", "blog_post_id,tag_id", "", "blog_post_id,tag_id").catch(soft("tags do blog"))).filter((r) => blogIds.has(r.blog_post_id));
const usedCats = new Set(blog_post_categories.map((r) => r.category_id));
const usedTags = new Set(blog_post_tags.map((r) => r.tag_id));
const blog_categories = (await fetchAll("blog_categories", "id,user_id,name,slug").catch(soft("categorias do blog"))).filter((c) => usedCats.has(c.id));
const blog_tags = (await fetchAll("blog_tags", "id,user_id,name,slug").catch(soft("tags do blog"))).filter((t) => usedTags.has(t.id));

// Perfis públicos de quem assina matérias (autores humanos) e de quem comentou.
const aiIds = new Set(ai_news_authors.map((a) => a.id));
const userIds = [
  ...new Set([
    ...posts.filter((p) => !p.ai_author_id && p.author_id && !aiIds.has(p.author_id)).map((p) => p.author_id),
    ...post_comments.map((c) => c.author_id),
    ...blog_posts.map((p) => p.author_id),
    ...blog_post_comments.map((c) => c.author_id),
  ]),
];
const profiles = [];
for (let i = 0; i < userIds.length; i += 100) {
  profiles.push(...(await fetchAll("profiles", "id,username,display_name,avatar_url,bio", `&id=in.(${userIds.slice(i, i + 100).join(",")})`)));
}

// Tamanho real de cada capa (só o começo do arquivo é baixado). A página inicial usa na capa grande só as
// imagens com resolução boa.
async function measure(url) {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-131071" } });
    if (!res.ok) return null;
    const { width, height } = imageSize(Buffer.from(await res.arrayBuffer()));
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}
const withImage = posts.filter((p) => p.featured_image);
for (let i = 0; i < withImage.length; i += 8) {
  await Promise.all(
    withImage.slice(i, i + 8).map(async (p) => {
      const d = await measure(p.featured_image);
      p.image_width = d?.width ?? null;
      p.image_height = d?.height ?? null;
    }),
  );
}
const measured = withImage.filter((p) => p.image_width).length;

// Quizzes publicados e quantas pessoas tiveram cada resultado. A chave pública não lê quiz_plays; a contagem sai de
// quiz_record_play chamada com um resultado que não existe: a função, nesse caso, não grava nada e só devolve a
// contagem (conferido em 20261026110000_quizzes.sql: o INSERT/UPDATE fica dentro do IF EXISTS do resultado).
const quizzes = await fetchAll(
  "quizzes",
  "id,slug,title,description,cover_url,kind,data,status,anilist_id,plays_count,published_at,created_at,updated_at",
  "&status=eq.published",
  "id",
).catch((e) => {
  console.log(`Aviso: quizzes não lidos (${e.message}).`);
  return [];
});
const quiz_result_counts = [];
for (let i = 0; i < quizzes.length; i += 5) {
  await Promise.all(
    quizzes.slice(i, i + 5).map(async (q) => {
      try {
        const res = await fetch(`${BASE}/rest/v1/rpc/quiz_record_play`, {
          method: "POST",
          headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ _quiz: q.id, _result: "__exportacao__", _score: null }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const r of await res.json()) quiz_result_counts.push({ quiz_id: q.id, result_id: r.result_id, plays: Number(r.plays) });
      } catch (e) {
        console.log(`Aviso: contagem do quiz ${q.slug} não lida (${e.message}).`);
      }
    }),
  );
}

const snapshot = { posts, categories, tags, ai_news_authors, profiles, post_categories, post_tags, tag_redirects, anime_catalog, post_comments, quizzes, quiz_result_counts, blog_posts, blog_categories, blog_tags, blog_post_categories, blog_post_tags, blog_post_comments };
const gz = gzipSync(JSON.stringify(snapshot));
mkdirSync(".import", { recursive: true });
writeFileSync(".import/conteudo.json.gz", gz);
console.log(
  `Exportado: ${posts.length} matérias, ${categories.length} categorias, ${tags.length} tags, ${ai_news_authors.length + profiles.length} autores (${(gz.length / 1024 / 1024).toFixed(1)} MB compactado). Capas medidas: ${measured} de ${withImage.length}. Sinopses de anime: ${anime_catalog.length}. Comentários: ${post_comments.length}. Blog: ${blog_posts.length} posts, ${blog_post_comments.length} comentários. Quizzes: ${quizzes.length} (partidas: ${quiz_result_counts.reduce((n, r) => n + r.plays, 0)}).`,
);

if (!process.env.CRON_TOKEN) {
  console.log("Sem CRON_TOKEN: arquivo salvo em .import/conteudo.json.gz, nada enviado.");
  process.exit(0);
}
const res = await fetch(`${target.replace(/\/$/, "")}/api/importar/conteudo`, {
  method: "POST",
  headers: { "Content-Type": "application/gzip", "x-cron-token": process.env.CRON_TOKEN },
  body: gz,
});
console.log(`Enviado para ${target}: HTTP ${res.status} ${await res.text()}`);
console.log("O site novo grava em segundo plano. Resultado: /api/cron/status (tarefa importar-conteudo).");
