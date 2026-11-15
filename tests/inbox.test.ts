// Pedidos de fora que só ficam guardados: Mercado Pago e descadastro (MySQL descartável).
import { createDB } from "mysql-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate.mjs";
import { createPool, query, setPool } from "~/server/db.server";
import { saveInbox } from "~/server/inbox.server";

let server: Awaited<ReturnType<typeof createDB>>;

beforeAll(async () => {
  server = await createDB({ version: "8.4.x", logLevel: "ERROR" });
  const config = { host: "127.0.0.1", port: server.port, user: server.username, database: server.dbName, charset: "utf8mb4", timezone: "Z" };
  await migrate(config, () => {});
  setPool(createPool({ ...config, connectionLimit: 2 }));
  Object.assign(process.env, { DB_NAME: server.dbName, DB_USER: server.username });
});

afterAll(async () => {
  setPool(undefined);
  await server?.stop();
});

describe("inbox", () => {
  it("guarda o webhook inteiro e o descadastro", async () => {
    const req = new Request("https://x.test/api/public/payments/webhook?id=1", { method: "POST", headers: { "x-signature": "ts=1,v1=abc" } });
    expect(await saveInbox("mp-webhook", req, { subject: "POST /x", body: '{"type":"payment","data":{"id":"9"}}', extra: { query: { id: "1" }, signature: "ts=1,v1=abc" } })).toBe(true);
    expect(await saveInbox("descadastro", req, { subject: "Pedido de descadastro", body: "x", extra: { token: "abcdefgh1" } })).toBe(true);
    const rows = await query<{ kind: string; body: string; extra: unknown }>("SELECT kind, body, extra FROM contact_messages ORDER BY id");
    expect(rows.map((r) => r.kind)).toEqual(["mp-webhook", "descadastro"]);
    expect(rows[0].body).toContain('"payment"');
  });
});
