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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { imageSize } from "image-size";

// --midia <pasta>: pasta com os arquivos do Storage já baixados (scripts/baixar-storage.mjs); sem ela, baixa do Supabase.
const rawArgs = process.argv.slice(2);
const midiaIdx = rawArgs.indexOf("--midia");
const MIDIA_DIR = midiaIdx >= 0 ? rawArgs[midiaIdx + 1] : null;
if (midiaIdx >= 0) rawArgs.splice(midiaIdx, 2);
const [envPath, target = "https://novo.animeprofile.com.br"] = rawArgs;
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

// Figurinhas: álbuns, catálogo e destaques da semana. As imagens são COPIADAS para o site novo (/media/figurinhas),
// em tamanho original, com uma miniatura WebP de 400 px ao lado. Sem CRON_TOKEN (só gerar o arquivo), as URLs antigas ficam.
const sticker_albums = await fetchAll("sticker_albums", "id,slug,name,description,cover_url,anilist_id,sort_order,available_from,available_until,created_at,updated_at").catch(soft("álbuns de figurinhas"));
const sticker_catalog = await fetchAll("sticker_catalog", "id,album_id,name,rarity,xp,image_url,active,sort_order,created_at,updated_at")
  .catch(() => fetchAll("sticker_catalog", "id,album_id,name,rarity,xp,image_url,sort_order,created_at,updated_at"))
  .catch(soft("figurinhas"));
const weekly_featured_album = (await fetchAll("weekly_featured_album", "week_key,album_id,discount_pct,computed_at", "", "week_key").catch(soft("destaques da semana"))).slice(-4);

const MEDIA_LIMIT = 300 * 1024 * 1024;
let mediaBytes = 0;
let mediaSent = 0;
const media = new Map(); // url antiga -> { url, thumb, width, height } | null
async function copyImage(url) {
  if (!url) return null;
  if (media.has(url)) return media.get(url);
  let result = null;
  try {
    // Sempre o original: o endereço render/image do Supabase recomprime.
    const original = url.replace("/render/image/public/", "/object/public/").split("?")[0];
    const res = await fetch(original);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    mediaBytes += bytes.length;
    if (mediaBytes > MEDIA_LIMIT) {
      console.error(`Parando: as imagens passaram de 300 MB (${(mediaBytes / 1024 / 1024).toFixed(0)} MB). Avise o dono antes de enviar.`);
      process.exit(2);
    }
    const info = imageSize(bytes);
    const ext = ({ jpg: "jpg", jpeg: "jpg", png: "png", webp: "webp", gif: "gif", avif: "avif" })[info.type];
    if (!ext || !info.width) throw new Error("tipo de imagem não aceito");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
    const files = [{ name: `figurinhas/${hash}.${ext}`, body: bytes, type: ext === "jpg" ? "image/jpeg" : `image/${ext}` }];
    let thumb = `/media/figurinhas/${hash}.${ext}`;
    if (info.width > 400 && ext !== "gif") {
      const { default: sharp } = await import("sharp");
      files.push({ name: `figurinhas/${hash}-w400.webp`, body: await sharp(bytes).resize({ width: 400 }).webp({ quality: 90, effort: 5 }).toBuffer(), type: "image/webp" });
      thumb = `/media/figurinhas/${hash}-w400.webp`;
    }
    if (process.env.CRON_TOKEN) {
      for (const f of files) {
        const head = await fetch(`${target.replace(/\/$/, "")}/media/${f.name}`, { method: "HEAD" });
        if (head.ok) continue;
        const up = await fetch(`${target.replace(/\/$/, "")}/api/importar/midia`, { method: "POST", headers: { "x-cron-token": process.env.CRON_TOKEN, "x-media-name": f.name, "Content-Type": f.type }, body: f.body });
        if (!up.ok) throw new Error(`envio HTTP ${up.status}`);
        mediaSent++;
      }
      result = { url: `/media/figurinhas/${hash}.${ext}`, thumb, width: info.width, height: info.height };
    } else {
      result = { url, thumb: url, width: info.width, height: info.height };
    }
  } catch (e) {
    console.log(`Aviso: imagem não copiada (${url.slice(-60)}): ${e.message}. Fica o endereço antigo.`);
  }
  media.set(url, result);
  return result;
}
const urls = [...new Set([...sticker_albums.map((a) => a.cover_url), ...sticker_catalog.map((c) => c.image_url)].filter(Boolean))];
for (let i = 0; i < urls.length; i += 4) await Promise.all(urls.slice(i, i + 4).map(copyImage));
for (const a of sticker_albums) {
  const m = media.get(a.cover_url);
  if (m) a.cover_url = m.url;
}
for (const c of sticker_catalog) {
  const m = media.get(c.image_url);
  if (m) Object.assign(c, { image_url: m.url, thumb_url: m.thumb, image_width: m.width, image_height: m.height });
}
console.log(`Figurinhas: ${sticker_albums.length} álbuns, ${sticker_catalog.length} figurinhas, ${urls.length} imagens (${(mediaBytes / 1024 / 1024).toFixed(1)} MB; ${mediaSent} arquivos novos enviados).`);

const snapshot = { posts, categories, tags, ai_news_authors, profiles, post_categories, post_tags, tag_redirects, anime_catalog, post_comments, quizzes, quiz_result_counts, blog_posts, blog_categories, blog_tags, blog_post_categories, blog_post_tags, blog_post_comments, sticker_albums, sticker_catalog, weekly_featured_album };
// Imagens do Storage do site antigo (matérias, quiz, blog, avatares): copia para /media/<bucket>/<caminho> e troca os
// endereços no retrato. Sem CRON_TOKEN nada é enviado nem trocado. Se um arquivo falhar, fica o endereço antigo.
let snapshotJson = JSON.stringify(snapshot);
{
  // Os dois formatos (object e render/image) levam ao mesmo objeto <bucket>/<caminho>; a query (?width=...) some.
  const URL_RE = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/(?:object|render\/image)\/public\/(post-images|profile-media|images|feed-images)\/([A-Za-z0-9_.\/-]+?\.(?:png|jpe?g|webp|gif|avif))(?:\?[^"\s\\)<>,]*)?/gi;
  const found = new Map();
  for (const m of snapshotJson.matchAll(URL_RE)) found.set(`${m[1]}/${m[2]}`, true);
  const names = [...found.keys()];
  // Links no texto para o endereço de teste do Lovable viram o domínio de verdade.
  snapshotJson = snapshotJson.replace(/https?:\/\/(?:www\.)?animeprofile\.lovable\.app/gi, "https://animeprofile.com.br");
  const stats = { enviados: 0, jaExistiam: 0, falhas: [] };
  const okNames = new Set();
  if (process.env.CRON_TOKEN) {
    const base = target.replace(/\/$/, "");
    const copy = async (name) => {
      try {
        const head = await fetch(`${base}/media/${name}`, { method: "HEAD" });
        if (head.ok) {
          stats.jaExistiam++;
          return okNames.add(name);
        }
        let bytes;
        const local = MIDIA_DIR ? join(MIDIA_DIR, ...name.split("/")) : null;
        if (local && existsSync(local)) bytes = readFileSync(local);
        else {
          const res = await fetch(`${BASE}/storage/v1/object/public/${name.split("/").map(encodeURIComponent).join("/")}`);
          if (!res.ok) throw new Error(`origem HTTP ${res.status}`);
          bytes = Buffer.from(await res.arrayBuffer());
        }
        const type = imageSize(bytes).type;
        const mime = type === "jpg" ? "image/jpeg" : `image/${type}`;
        const up = await fetch(`${base}/api/importar/midia`, { method: "POST", headers: { "x-cron-token": process.env.CRON_TOKEN, "x-media-name": name, "Content-Type": mime }, body: bytes });
        if (!up.ok) throw new Error(`envio HTTP ${up.status}`);
        stats.enviados++;
        okNames.add(name);
      } catch (e) {
        stats.falhas.push(`${name} (${e.message})`);
      }
    };
    const queue = [...names];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let n = queue.shift(); n; n = queue.shift()) await copy(n);
      }),
    );
    snapshotJson = snapshotJson.replace(URL_RE, (all, bucket, path) => (okNames.has(`${bucket}/${path}`) ? `/media/${bucket}/${path}` : all));
  }
  console.log(`Mídia: ${names.length} imagens no conteúdo; ${stats.enviados} enviadas, ${stats.jaExistiam} já existiam, ${stats.falhas.length} falhas${process.env.CRON_TOKEN ? "" : " (sem CRON_TOKEN: nada enviado nem trocado)"}.`);
  for (const f of stats.falhas.slice(0, 30)) console.log(`  falhou: ${f}`);
}
const gz = gzipSync(snapshotJson);
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
