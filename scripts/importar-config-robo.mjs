// Envia a configuração do robô de notícias do site antigo para o site novo (POST /api/robo/config).
//
// Uso (PowerShell):
//   $env:CRON_TOKEN = "..."; node scripts/importar-config-robo.mjs <robo-config.json> [endereço do site novo]
//   (o endereço padrão é https://novo.animeprofile.com.br)
//
// O <robo-config.json> é o resultado da consulta SQL do passo 7 de docs/plano-robo-noticias.md, rodada no Lovable Cloud.
// O guia editorial é lido de ../animeprofile-old/src/lib/ai-news/worker/prompt.ts (constante EDITORIAL_GUIDE) e vai junto.
// Nem o guia nem as personas ficam no repositório (público): seguem para o banco do site. O script imprime só contagens.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const [file, siteArg] = process.argv.slice(2);
const site = (siteArg || "https://novo.animeprofile.com.br").replace(/\/$/, "");
if (!file || !existsSync(file)) {
  console.error("Uso: node scripts/importar-config-robo.mjs <robo-config.json> [endereço do site novo]");
  process.exit(1);
}
if (!process.env.CRON_TOKEN) {
  console.error("Defina CRON_TOKEN no ambiente (nunca na linha de comando).");
  process.exit(1);
}

let config = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
// O editor SQL às vezes devolve uma lista com 1 linha, ou o objeto dentro de uma coluna.
if (Array.isArray(config)) config = config[0];
if (config && typeof config === "object" && !("sources" in config)) config = Object.values(config).find((v) => v && typeof v === "object" && "sources" in v) ?? config;

const here = dirname(fileURLToPath(import.meta.url));
const promptFile = resolve(here, "..", "..", "animeprofile-old", "src", "lib", "ai-news", "worker", "prompt.ts");
let guia;
if (existsSync(promptFile)) {
  const src = readFileSync(promptFile, "utf8");
  const start = src.indexOf("const EDITORIAL_GUIDE = `");
  const end = src.indexOf("`.trim();", start);
  if (start >= 0 && end > start) guia = src.slice(start + "const EDITORIAL_GUIDE = `".length, end).replaceAll("\\`", "`").trim();
}

const body = { ...config, ...(guia ? { guia } : {}) };
const res = await fetch(`${site}/api/robo/config`, {
  method: "POST",
  headers: { "Content-Type": "application/gzip", "x-cron-token": process.env.CRON_TOKEN },
  body: gzipSync(Buffer.from(JSON.stringify(body))),
});
const text = await res.text();
console.log(`Resposta ${res.status}: ${text.slice(0, 500)}`);
console.log(`Enviado: fontes ${body.sources?.length ?? 0}, autores ${body.authors?.length ?? 0}, lista negra ${body.blacklist?.length ?? 0}, tópicos ${body.topics?.length ?? 0}, horários ${body.slots?.length ?? 0}, guia ${guia ? "sim" : "NÃO"}.`);
if (!res.ok) process.exit(1);
