// Confere se os endereços do site antigo (sitemaps públicos e páginas do Search Console) respondem bem no site novo.
//
// Uso: node scripts/conferir-enderecos.mjs <base> [--tudo-animes] [--sem-html]
//   <base>  ex.: https://novo.animeprofile.com.br (ensaio) ou https://animeprofile.com.br (depois da virada)
// Lê .import/sitemaps-antigos/*.xml e, se existir, .import/gsc-paginas.csv (a primeira coluna é o endereço).
// Pede cada endereço sem seguir redirecionamento, 8 por vez. Falha (código de saída 1) se aparecer:
//   status 404 ou 5xx (o 503 das fichas de anime é aceito com aviso); 301/302 para um destino que dá 404;
//   "supabase.co" ou "lovable" no HTML; canonical com caminho diferente do endereço pedido.
// Nada é gravado; imprime só endereços públicos e contagens.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Uso: node scripts/conferir-enderecos.mjs <base> [--tudo-animes] [--sem-html]");
  process.exit(1);
}
const ALL_ANIMES = args.includes("--tudo-animes");
const CHECK_HTML = !args.includes("--sem-html");

const paths = new Set();
const addUrl = (u) => {
  try {
    const x = new URL(u, "https://animeprofile.com.br");
    if (/(^|\.)animeprofile\.com\.br$/.test(x.hostname)) paths.add(x.pathname + x.search);
  } catch {
    /* ignora linha inválida */
  }
};
const dir = ".import/sitemaps-antigos";
if (existsSync(dir)) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".xml"))) {
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (!m[1].endsWith(".xml")) addUrl(m[1].replace(/&amp;/g, "&"));
    }
  }
}
if (existsSync(".import/gsc-paginas.csv")) {
  for (const line of readFileSync(".import/gsc-paginas.csv", "utf8").split(/\r?\n/).slice(1)) addUrl(line.split(",")[0].replace(/^"|"$/g, ""));
}
let list = [...paths].sort();
if (!ALL_ANIMES) {
  // As fichas de anime vão ao AniList: confere uma amostra (as demais têm a mesma rota).
  const animes = list.filter((p) => /^\/animes\/\d+$/.test(p));
  const keep = new Set(animes.filter((_, i) => i % Math.ceil(animes.length / 40 || 1) === 0));
  list = list.filter((p) => !/^\/animes\/\d+$/.test(p) || keep.has(p));
}
console.log(`${list.length} endereços para conferir em ${base}${ALL_ANIMES ? "" : " (amostra das fichas de anime)"}.`);

const failures = [];
const warnings = [];
const counts = {};
const redirectTargets = new Map();

async function check(path) {
  let res;
  try {
    res = await fetch(base + path, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (conferencia-animeprofile)" } });
  } catch (e) {
    failures.push(`${path}: sem resposta (${e.message})`);
    return;
  }
  counts[res.status] = (counts[res.status] ?? 0) + 1;
  if (res.status >= 300 && res.status < 400) {
    const to = res.headers.get("location") ?? "";
    redirectTargets.set(path, to);
    return;
  }
  if (res.status === 503 && /^\/animes\/\d+$/.test(path)) return void warnings.push(`${path}: 503 (AniList ocupado)`);
  if (res.status >= 400) return void failures.push(`${path}: ${res.status}`);
  if (!CHECK_HTML || !(res.headers.get("content-type") ?? "").includes("text/html")) return;
  const html = await res.text();
  if (/supabase\.co|lovable/i.test(html)) failures.push(`${path}: HTML cita supabase.co ou lovable`);
  const canon = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html) ?? /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i.exec(html);
  if (canon) {
    try {
      const c = new URL(canon[1]);
      const want = path.split("?")[0].replace(/\/$/, "") || "/";
      const got = c.pathname.replace(/\/$/, "") || "/";
      // Listas com ?tipo= ou ?pagina= têm canonical sem a query; só o caminho precisa bater.
      if (got !== want) warnings.push(`${path}: canonical aponta para ${c.pathname}`);
    } catch {
      failures.push(`${path}: canonical inválido`);
    }
  } else if (!/noindex/i.test(html)) {
    warnings.push(`${path}: sem canonical`);
  }
}

const queue = [...list];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) await check(p);
  }),
);

// Destinos dos redirecionamentos: cada um precisa responder 200 (ou outro redirecionamento resolvido uma vez).
const dests = [...new Set(redirectTargets.values())];
const destQueue = [...dests];
const bad = new Map();
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let d = destQueue.shift(); d; d = destQueue.shift()) {
      try {
        const url = d.startsWith("http") ? d : base + d;
        const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (conferencia-animeprofile)" } });
        if (r.status >= 400 && !(r.status === 503 && /\/animes\/\d+/.test(d))) bad.set(d, r.status);
      } catch (e) {
        bad.set(d, e.message);
      }
    }
  }),
);
for (const [from, to] of redirectTargets) if (bad.has(to)) failures.push(`${from}: redireciona para ${to}, que dá ${bad.get(to)}`);

console.log("Status:", JSON.stringify(counts));
console.log(`Redirecionamentos: ${redirectTargets.size} (${dests.length} destinos distintos)`);
for (const w of warnings.slice(0, 40)) console.log("aviso:", w);
if (warnings.length > 40) console.log(`... e mais ${warnings.length - 40} avisos`);
for (const f of failures.slice(0, 80)) console.log("FALHA:", f);
if (failures.length) {
  console.log(`${failures.length} falhas.`);
  process.exit(1);
}
console.log("Zero falhas.");
