// Servidor Express de produção. Carregado por server.js depois de definir NODE_ENV.
import compression from "compression";
import express from "express";
import { createRequestHandler } from "@react-router/express";
import { dbConfigFromEnv, migrate } from "./db/migrate.mjs";
import { mediaDir } from "./server-paths.mjs";
import { redirectInfo } from "./redirects.mjs";

const PORT = Number(process.env.PORT || 3000);
// Endereço de teste (novo.animeprofile.com.br): nada entra no Google.
const NOINDEX = process.env.SITE_NOINDEX === "1";

async function prepareDatabase() {
  // O MySQL da Hostinger só aceita conexão local, então as migrations rodam daqui.
  const db = dbConfigFromEnv();
  if (!db) {
    console.log("[db] sem DB_NAME/DB_USER: o site sobe sem banco");
    return;
  }
  try {
    const applied = await migrate(db);
    console.log(applied.length ? `[migrate] ${applied.length} aplicada(s): ${applied.join(", ")}` : "[migrate] banco atualizado");
  } catch (err) {
    // Não derruba o site: as páginas mostram erro só onde o banco é usado.
    console.error("[migrate] falhou:", err?.message ?? err);
  }
}

async function main() {
  await prepareDatabase();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  // Domínio canônico sem www (evita conteúdo duplicado no Google).
  app.use((req, res, next) => {
    const host = req.headers.host ?? "";
    if (host.startsWith("www.")) return res.redirect(301, `https://${host.slice(4)}${req.originalUrl}`);
    // Endereços do site antigo que saíram (Clãs, Comunidades, jogos, /en, Faça parte...).
    const hit = redirectInfo(req.path, req.originalUrl.slice(req.path.length));
    if (hit) return res.redirect(hit.status, hit.to);
    next();
  });
  if (NOINDEX) {
    app.use((_req, res, next) => {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      next();
    });
  }
  app.use(compression());
  // Painel, contas e rotas internas nunca entram no Google nem em cache compartilhado.
  app.use(["/admin", "/api", "/login", "/sair"], (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Arquivos com hash no nome podem ficar em cache "para sempre".
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
  app.use(express.static("build/client", { maxAge: "1h" }));
  // Arquivos enviados (fora da pasta do app, sobrevivem aos deploys). Nome nunca é reaproveitado.
  app.use("/media", express.static(mediaDir(), { immutable: true, maxAge: "1y", index: false }));

  // Páginas públicas (sem sessão nem cookie): a CDN pode guardar 60 s e servir a versão antiga por mais 2 min enquanto
  // busca a nova. Aguenta a virada do domínio sem pesar no banco. Notícia nova demora no máximo ~1 min para aparecer.
  app.use((req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") && !res.getHeader("Cache-Control") && !/^\/(api|admin|unsubscribe|login|sair)\b/.test(req.path)) {
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    }
    next();
  });

  const build = await import("./build/server/index.js");
  app.use(createRequestHandler({ build, mode: process.env.NODE_ENV }));

  app.listen(PORT, () => console.log(`[animeprofile] ouvindo na porta ${PORT}`));
}

main().catch((err) => {
  console.error("[animeprofile] falha ao iniciar:", err);
  process.exit(1);
});
