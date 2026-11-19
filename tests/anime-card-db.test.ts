// Card "Sobre o anime" das matérias (HTML gerado no servidor), cards colocados pelo editor e a lista "Assinado por".
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, setPool } from "~/server/db.server";
import { getAnime } from "~/server/anime/anime.server";
import { animeCardHtml, injetarCardsAnime } from "~/server/anime/card-html.server";
import { sanitizePostHtml } from "~/server/content/sanitize.server";
import { opcoesEditor, salvarPost } from "~/server/admin/posts-edit.server";

let server: Awaited<ReturnType<typeof createDB>>;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
  await exec(
    `INSERT INTO anime_catalog (anilist_id, title, cover_url, banner_url, format, status, episodes, season, season_year, genres, studios, synopsis_en, popularity, is_adult)
     VALUES (21, 'One Piece <b>"x"</b>', 'https://img.example/c.jpg', 'https://img.example/b.jpg', 'TV', 'RELEASING', 1100, 'FALL', 1999, '["Action","Adventure"]', '["Toei Animation"]', 'Um pirata atrás do tesouro.<br>Segunda linha.', 900, 0),
            (22, 'Banner estranho', 'https://img.example/c2.jpg', 'javascript:alert(1)', 'MOVIE', 'FINISHED', 1, NULL, NULL, '[]', '[]', NULL, 10, 0)`,
  );
});
afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("card do anime", () => {
  it("mostra título, dados, sinopse (1º parágrafo), gêneros e o link para a página do anime, com tudo escapado", async () => {
    const a = (await getAnime(21, { remote: false }))!;
    const h = animeCardHtml(a);
    expect(h).toContain('href="/animes/21"');
    expect(h).toContain("Sobre o anime");
    expect(h).toContain("One Piece &lt;b&gt;&quot;x&quot;&lt;/b&gt;"); // nada de HTML vindo do banco
    expect(h).not.toContain("<b>");
    expect(h).toContain("1100 ep.");
    expect(h).toContain("Um pirata atrás do tesouro.");
    expect(h).not.toContain("Segunda linha.");
    expect(h).toContain("Ação");
    expect(h).toContain("https://img.example/b.jpg");
    expect(h).toContain("Ver página completa do anime");
  });

  it("só aceita imagens https (nada de javascript:) e o card funciona sem banner", async () => {
    const h = animeCardHtml((await getAnime(22, { remote: false }))!);
    expect(h).not.toContain("javascript:");
    expect(h).toContain("https://img.example/c2.jpg"); // o pôster entra, o banner inválido não
    expect(h).not.toContain('class="anc-banner"><img');
    expect(h).toContain('href="/animes/22"');
  });
});

describe("card colocado pelo editor", () => {
  const embed = (id: number) => `<div data-anime-card="${id}" data-title="x" class="anime-card-embed"><a href="/animes/${id}" class="anime-card-fallback">Sobre o anime: x</a></div>`;

  it("a limpeza do HTML guarda o card; a página troca pelo card completo e deixa o link simples quando o anime não está no banco", async () => {
    const salvo = sanitizePostHtml(`<p>Texto</p>${embed(21)}${embed(999)}`);
    expect(salvo).toContain('data-anime-card="21"');
    const html = await injetarCardsAnime(salvo);
    expect(html).toContain('data-anime-card-render="21"');
    expect(html).not.toContain('data-anime-card="21"');
    expect(html).toContain('data-anime-card="999"'); // sem ficha: continua o link simples
    expect(html).toContain("Sobre o anime: x");
    expect(await injetarCardsAnime("<p>sem card</p>")).toBe("<p>sem card</p>");
  });
});

describe("Assinado por", () => {
  it("lista só autores de IA e quem já escreveu matérias; quem só comentou fica de fora", async () => {
    await exec("INSERT INTO post_authors (id, kind, slug, name) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'ai', 'lia', 'Lia'), ('aaaaaaaa-0000-4000-8000-000000000002', 'user', 'redacao', 'Redação AP'), ('aaaaaaaa-0000-4000-8000-000000000003', 'user', 'kaiju', 'Kaiju comentarista')");
    await exec("INSERT INTO categories (id, name, slug, kind) VALUES ('cccccccc-0000-4000-8000-000000000001', 'Animes', 'animes', 'news')");
    const r = await salvarPost(
      { id: null, titulo: "Matéria da redação", slug: "", resumo: "", capa: "", tipo: "news", html: "<p>x</p>", categoriaIds: [], tagIds: [], publicadoEm: null, palavraChave: "", autorId: "aaaaaaaa-0000-4000-8000-000000000002", atualizadoEm: null },
      "draft",
    );
    expect(r.ok).toBe(true);
    const { autores } = await opcoesEditor();
    expect(autores.map((a) => [a.nome, a.ia])).toEqual([["Lia", true], ["Redação AP", false]]);
  });
});
