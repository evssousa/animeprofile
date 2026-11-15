// Baixa os arquivos dos buckets públicos do Storage do site antigo para uma pasta local (backup das imagens).
//
// Uso: node scripts/baixar-storage.mjs <lista-objetos.tsv> <pasta de destino> <.env do site antigo>
//   A lista tem o cabeçalho "bucket<TAB>name<TAB>size" (uma linha por objeto, tirada de storage.objects do dump).
// Lê só VITE_SUPABASE_URL do .env e não imprime valores. Pode rodar de novo: pula o que já existe com o mesmo tamanho.
// Grava <destino>/<bucket>/<name> e <destino>/relatorio.json (totais por bucket e nomes que falharam).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [listPath, dest, envPath] = process.argv.slice(2);
if (!listPath || !dest || !envPath) {
  console.error("Uso: node scripts/baixar-storage.mjs <lista-objetos.tsv> <pasta de destino> <.env do site antigo>");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const BASE = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("O .env não tem VITE_SUPABASE_URL.");
  process.exit(1);
}

const rows = readFileSync(listPath, "utf8")
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const [bucket, name, size] = l.split("\t");
    return { bucket, name, size: Number(size) || 0 };
  })
  // Nome terminado em "/" é pasta vazia; nome com ".." nunca vira caminho fora do destino.
  .filter((r) => r.bucket && r.name && !r.name.endsWith("/") && !r.name.split("/").includes(".."));

const report = {};
const bump = (bucket, key, n = 1) => ((report[bucket] ??= { arquivos: 0, bytes: 0, jaExistiam: 0, falhas: 0, nomesComFalha: [] })[key] += n);

async function fetchWithRetry(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = new Error(`HTTP ${res.status}`);
      if (res.status === 400 || res.status === 403 || res.status === 404) break; // bucket privado ou objeto removido
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw last;
}

let done = 0;
async function one(r) {
  const file = join(dest, r.bucket, ...r.name.split("/"));
  bump(r.bucket, "arquivos");
  if (existsSync(file) && (r.size === 0 || statSync(file).size === r.size)) {
    bump(r.bucket, "jaExistiam");
    bump(r.bucket, "bytes", statSync(file).size);
    return;
  }
  try {
    const url = `${BASE}/storage/v1/object/public/${r.bucket}/${r.name.split("/").map(encodeURIComponent).join("/")}`;
    const bytes = await fetchWithRetry(url);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    bump(r.bucket, "bytes", bytes.length);
  } catch (e) {
    bump(r.bucket, "falhas");
    const b = report[r.bucket];
    if (b.nomesComFalha.length < 200) b.nomesComFalha.push(`${r.name} (${e.message})`);
  }
  if (++done % 500 === 0) console.log(`${done} de ${rows.length}...`);
}

const queue = [...rows];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) await one(r);
  }),
);
mkdirSync(dest, { recursive: true });
writeFileSync(join(dest, "relatorio.json"), JSON.stringify(report, null, 2));
for (const [b, v] of Object.entries(report)) console.log(`${b}: ${v.arquivos} arquivos, ${(v.bytes / 1024 / 1024).toFixed(1)} MB, ${v.jaExistiam} já existiam, ${v.falhas} falhas`);
