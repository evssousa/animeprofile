// Formulários públicos: validação, gravação e limite de envios por IP, com MySQL descartável.
import { createDB } from "mysql-memory-server";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, query, setPool } from "~/server/db.server";
import { saveMessage, validate } from "~/server/contact.server";

let server: Awaited<ReturnType<typeof createDB>>;
let pool: mysql.Pool;
const env = { ...process.env };

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  pool = createPool({ ...config, connectionLimit: 3 });
  setPool(pool);
  process.env.DB_NAME = server.dbName;
  process.env.DB_USER = server.username;
});

afterAll(async () => {
  process.env = env;
  setPool(undefined);
  await pool?.end();
  await server?.stop();
});

const ok = { name: "Fulana", email: "fulana@exemplo.com", subject: "Dúvida", body: "Uma mensagem com tamanho suficiente." };
const req = (ip: string) => new Request("http://localhost/contato", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

describe("contato", () => {
  it("valida cada campo com mensagem própria", () => {
    expect(validate(ok)).toEqual({});
    const e = validate({ name: "A", email: "sem-arroba", subject: "", body: "curta" });
    expect(Object.keys(e).sort()).toEqual(["body", "email", "name", "subject"]);
    expect(validate({ ...ok, body: "x".repeat(15) }, { minBody: 20 }).body).toMatch(/20 caracteres/);
  });

  it("grava sem guardar o IP e limita a 5 envios por hora por IP", async () => {
    for (let i = 0; i < 5; i++) expect(await saveMessage("contato", ok, req("203.0.113.7"))).toEqual({ ok: true });
    expect(await saveMessage("contato", ok, req("203.0.113.7"))).toEqual({ ok: false, reason: "limite" });
    expect(await saveMessage("faca-parte", { ...ok, extra: { area: "Redação" } }, req("198.51.100.2"))).toEqual({ ok: true });

    const rows = await query<{ kind: string; ip_hash: string; extra: unknown }>("SELECT kind, ip_hash, extra FROM contact_messages ORDER BY id");
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.ip_hash) && !r.ip_hash.includes("203"))).toBe(true);
    expect(rows[5]).toMatchObject({ kind: "faca-parte", extra: { area: "Redação" } });
  });
});
