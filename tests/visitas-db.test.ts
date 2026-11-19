// Contador de visitas com banco: regras da coleta, soma por dia, visitante do dia, contador por matéria, sal e retenção.
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, exec, query, setPool } from "~/server/db.server";
import { agora, gravarAgora, registrar, zerarMemoria } from "~/visitas/server/coleta.server";
import { limparVisitas } from "~/visitas/server/limpeza.server";
import { esquecerSal, salDoDia } from "~/visitas/server/sal.server";

let server: Awaited<ReturnType<typeof createDB>>;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const T0 = Date.parse("2026-11-19T15:00:00Z"); // 12:00 em Brasília
const HOJE = "2026-11-19";

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 4 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
});
afterAll(async () => {
  zerarMemoria();
  setPool(undefined);
  await server?.stop();
});
beforeEach(async () => {
  zerarMemoria();
  esquecerSal();
  for (const t of ["visit_daily", "visit_pages", "visit_dims", "visit_seen"]) await exec(`DELETE FROM ${t}`);
});

function sinal(corpo: Record<string, unknown>, o: { ua?: string; ip?: string; cookie?: string; headers?: Record<string, string> } = {}) {
  return new Request("https://animeprofile.com.br/api/v", {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "user-agent": o.ua ?? CHROME, "x-forwarded-for": o.ip ?? "200.1.1.1", host: "animeprofile.com.br", "accept-language": "pt-BR,pt;q=0.9", ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.headers ?? {}) },
  });
}
const dia = async () => (await query<{ pageviews: number; entries: number; visitors: number; bots: number }>("SELECT pageviews, entries, visitors, bots FROM visit_daily WHERE day = ?", [HOJE]))[0];

describe("coleta de visitas", () => {
  it("3 sinais iguais em 30 s contam 1 página (recarregamento rápido)", async () => {
    expect((await registrar(sinal({ p: "/noticias/x", f: 1 }), T0)).contou).toBe(true);
    expect(await registrar(sinal({ p: "/noticias/x", f: 0 }), T0 + 5_000)).toEqual({ contou: false, motivo: "recarregamento" });
    expect((await registrar(sinal({ p: "/noticias/x", f: 0 }), T0 + 20_000)).contou).toBe(false);
    expect((await registrar(sinal({ p: "/noticias/x", f: 0 }), T0 + 31_000)).contou).toBe(true); // passou de 30 s
    await gravarAgora();
    expect((await dia()).pageviews).toBe(2);
  });

  it("robô não conta página: soma só em robôs ignorados", async () => {
    expect(await registrar(sinal({ p: "/", f: 1 }, { ua: GOOGLEBOT }), T0)).toEqual({ contou: false, motivo: "robô" });
    expect(await registrar(sinal({ p: "/", f: 1 }, { ua: "" }), T0)).toMatchObject({ motivo: "robô" });
    await gravarAgora();
    expect(await dia()).toMatchObject({ pageviews: 0, bots: 2 });
  });

  it("o dono (cookie do admin), pré-carregamento, outro site e corpo grande não contam", async () => {
    expect((await registrar(sinal({ p: "/", f: 1 }, { cookie: "__ap_admin=abc" }), T0)).motivo).toBe("admin");
    expect((await registrar(sinal({ p: "/", f: 1 }, { headers: { "sec-purpose": "prefetch" } }), T0)).motivo).toBe("prefetch");
    expect((await registrar(sinal({ p: "/", f: 1 }, { headers: { origin: "https://site-malicioso.example" } }), T0)).motivo).toBe("outro site");
    expect((await registrar(sinal({ p: "/", f: 1 }, { headers: { "sec-fetch-site": "cross-site" } }), T0)).motivo).toBe("outro site");
    expect((await registrar(sinal({ p: "/", f: 1, lixo: "x".repeat(2000) }, { headers: { "content-length": "2100" } }), T0)).motivo).toBe("corpo grande");
    expect((await registrar(sinal({ p: "/admin" , f: 1 }), T0)).motivo).toBe("endereço");
    expect((await registrar(sinal({ p: "/?q=naruto", f: 1 }), T0)).motivo).toBe("endereço");
    expect((await registrar(new Request("https://animeprofile.com.br/api/v", { method: "GET" }), T0)).motivo).toBe("método");
    await gravarAgora();
    expect(await dia()).toBeUndefined();
  });

  it("entrada vinda do Google: 1 entrada, origem busca, domínio, aparelho, navegador, sistema e idioma", async () => {
    await registrar(sinal({ p: "/noticias/x", r: "https://www.google.com/", f: 1 }, { ua: IPHONE }), T0);
    await gravarAgora();
    expect(await dia()).toMatchObject({ pageviews: 1, entries: 1, visitors: 1 });
    const dims = await query<{ dim: string; value: string; n: number }>("SELECT dim, value, n FROM visit_dims WHERE day = ? ORDER BY dim", [HOJE]);
    expect(dims).toEqual(
      expect.arrayContaining([
        { dim: "origem", value: "busca", n: 1 },
        { dim: "ref_busca", value: "google.com", n: 1 },
        { dim: "aparelho", value: "celular", n: 1 },
        { dim: "navegador", value: "Safari", n: 1 },
        { dim: "sistema", value: "iOS", n: 1 },
        { dim: "idioma", value: "pt-BR", n: 1 },
      ]),
    );
    expect(await query("SELECT path, kind, views, entries FROM visit_pages WHERE day = ?", [HOJE])).toEqual([{ path: "/noticias/x", kind: "materia", views: 1, entries: 1 }]);
  });

  it("troca de endereço por clique (f=0) conta página, mas não entrada; referrer do próprio site também não", async () => {
    await registrar(sinal({ p: "/noticias/a", f: 0 }), T0);
    await registrar(sinal({ p: "/noticias/b", r: "https://animeprofile.com.br/noticias/a", f: 1 }), T0 + 1000);
    await gravarAgora();
    expect(await dia()).toMatchObject({ pageviews: 2, entries: 0 });
    expect(await query("SELECT 1 FROM visit_dims WHERE day = ?", [HOJE])).toHaveLength(0);
  });

  it("campanha (UTM) vira a origem e a dimensão de campanha", async () => {
    await registrar(sinal({ p: "/", r: "https://l.instagram.com/", u: "Teste|Link|Painel", f: 1 }), T0);
    await gravarAgora();
    const dims = await query<{ dim: string; value: string }>("SELECT dim, value FROM visit_dims WHERE day = ? AND dim IN ('origem', 'campanha')", [HOJE]);
    expect(dims).toEqual(expect.arrayContaining([{ dim: "origem", value: "campanha" }, { dim: "campanha", value: "teste / link / painel" }]));
  });

  it("a mesma pessoa em duas páginas no dia é 1 visitante; outra pessoa é outro", async () => {
    await registrar(sinal({ p: "/a", f: 1 }), T0);
    await registrar(sinal({ p: "/b", f: 0 }), T0 + 40_000);
    await registrar(sinal({ p: "/a", f: 1 }, { ip: "200.9.9.9" }), T0 + 50_000);
    await gravarAgora();
    expect(await dia()).toMatchObject({ pageviews: 3, visitors: 2 });
    expect(agora(T0 + 60_000)).toBe(2);
    // gravar de novo no dia não conta o mesmo visitante outra vez (visit_seen impede)
    zerarMemoria();
    await registrar(sinal({ p: "/c", f: 0 }), T0 + 120_000);
    await gravarAgora();
    expect((await dia()).visitors).toBe(2);
  });

  it("matéria aberta 2 vezes em 30 min soma 1 em views_count; depois de 30 min soma de novo", async () => {
    await query(
      "INSERT INTO posts (id, post_type, slug, status, title, content_html, views_count, published_at) VALUES ('p-visitas-1', 'news', 'materia-visitas', 'published', 'Teste', '<p>x</p>', 10, '2026-11-01 12:00:00')",
    );
    await registrar(sinal({ p: "/noticias/materia-visitas", f: 1 }), T0);
    await registrar(sinal({ p: "/noticias/materia-visitas", f: 0 }), T0 + 40_000); // passou da janela de recarga, mas está nos 30 min
    await gravarAgora();
    expect((await query<{ v: number }>("SELECT views_count AS v FROM posts WHERE id = 'p-visitas-1'"))[0].v).toBe(11);
    await registrar(sinal({ p: "/noticias/materia-visitas", f: 0 }), T0 + 31 * 60_000);
    await gravarAgora();
    expect((await query<{ v: number }>("SELECT views_count AS v FROM posts WHERE id = 'p-visitas-1'"))[0].v).toBe(12);
  });

  it("o sal muda a cada dia: o mesmo visitante tem outro código no dia seguinte", async () => {
    const hoje = await salDoDia("2026-11-19");
    expect(await salDoDia("2026-11-19")).toBe(hoje);
    esquecerSal();
    expect(await salDoDia("2026-11-19")).toBe(hoje); // lido do banco
    esquecerSal();
    const amanha = await salDoDia("2026-11-20");
    expect(amanha).not.toBe(hoje);
    // o sal guardado é só o de hoje: o de ontem foi apagado
    const [row] = await query<{ value: unknown }>("SELECT value FROM system_config WHERE name = 'visitas.sal'");
    expect(String(typeof row.value === "string" ? row.value : JSON.stringify(row.value))).not.toContain(hoje);
  });

  it("a limpeza apaga códigos de dias passados e páginas muito antigas, e mantém os totais por dia", async () => {
    await exec("INSERT INTO visit_daily (day, pageviews) VALUES ('2024-01-01', 5), (?, 1)", [HOJE]);
    await exec("INSERT INTO visit_seen (day, vhash) VALUES ('2026-11-18', ?), (?, ?)", [Buffer.alloc(16, 1), HOJE, Buffer.alloc(16, 2)]);
    await exec("INSERT INTO visit_pages (day, path, kind, views) VALUES ('2024-01-01', '/velha', 'outra', 3), (?, '/nova', 'outra', 1)", [HOJE]);
    await exec("INSERT INTO visit_dims (day, dim, value, n) VALUES ('2024-01-01', 'origem', 'direto', 3), (?, 'origem', 'direto', 1)", [HOJE]);
    const r = await limparVisitas(new Date(T0));
    expect(r).toEqual({ visitasSeenApagadas: 1, visitasPaginasApagadas: 1, visitasDimsApagadas: 1 });
    expect(await query("SELECT 1 FROM visit_daily")).toHaveLength(2); // totais por dia ficam
    expect(await query("SELECT path FROM visit_pages")).toEqual([{ path: "/nova" }]);
  });
});

describe("consultas do painel", () => {
  it("cartões, série de 30 dias, páginas com título, dimensões e resumo, com 40 dias de dados semeados", async () => {
    const { cartoes, serie30, paginas, dimensoes, resumoPeriodo } = await import("~/visitas/server/consultas.server");
    const { somarDias } = await import("~/visitas/core/dia");
    await exec("DELETE FROM visit_daily");
    await exec("DELETE FROM visit_pages");
    await exec("DELETE FROM visit_dims");
    // 40 dias: 100 páginas vistas por dia (200 hoje), 40 visitantes, 30 entradas, 2 robôs
    for (let i = 0; i < 40; i++) await exec("INSERT INTO visit_daily (day, pageviews, entries, visitors, bots) VALUES (?, ?, 30, 40, 2)", [somarDias(HOJE, -i), i === 0 ? 200 : 100]);
    await exec("INSERT INTO visit_pages (day, path, kind, views, entries) VALUES (?, '/noticias/materia-visitas', 'materia', 50, 10), (?, '/', 'inicio', 30, 5), (?, '/animes/1', 'anime', 20, 5), (?, '/', 'inicio', 40, 5)", [HOJE, HOJE, HOJE, somarDias(HOJE, -3)]);
    await exec("INSERT INTO visit_dims (day, dim, value, n) VALUES (?, 'origem', 'busca', 8), (?, 'origem', 'direto', 2), (?, 'ref_busca', 'google.com', 8), (?, 'aparelho', 'celular', 7)", [HOJE, HOJE, HOJE, HOJE]);

    const c = await cartoes(HOJE);
    expect(c.hoje).toMatchObject({ pageviews: 200, visitantes: 40, variacao: null });
    expect(c.ontem).toMatchObject({ pageviews: 100, variacao: 0 });
    expect(c.d7.pageviews).toBe(200 + 6 * 100); // hoje + 6 dias
    expect(c.d7.variacao).toBe(14); // 800 contra 700
    expect(c.d7.mediaVisitantes).toBe(40);
    expect(c.d30.pageviews).toBe(200 + 29 * 100);
    expect(c.total).toEqual({ pageviews: 200 + 39 * 100, desde: somarDias(HOJE, -39) });

    const s = await serie30(HOJE);
    expect(s).toHaveLength(30);
    expect(s.at(-1)).toMatchObject({ dia: HOJE, pageviews: 200 });
    expect(s[0].dia).toBe(somarDias(HOJE, -29));

    const p = await paginas("7d", HOJE, "tudo", 10);
    expect(p.itens.map((i) => [i.path, i.views])).toEqual([["/", 70], ["/noticias/materia-visitas", 50], ["/animes/1", 20]]);
    expect(p.itens[0]).toMatchObject({ titulo: "Página inicial", tipo: "inicio" });
    expect(p.itens[1].titulo).toBe("Teste"); // título da matéria criada no teste anterior
    expect(p.total).toBe(140);
    expect((await paginas("hoje", HOJE, "materias", 10)).itens.map((i) => i.path)).toEqual(["/noticias/materia-visitas"]);

    const d = await dimensoes("7d", HOJE);
    expect(d.origem).toEqual([{ valor: "busca", n: 8 }, { valor: "direto", n: 2 }]);
    expect(d.ref_busca).toEqual([{ valor: "google.com", n: 8 }]);
    expect(await resumoPeriodo("7d", HOJE)).toMatchObject({ robos: 14, paginas: 800, entradas: 210 });
  });
});
