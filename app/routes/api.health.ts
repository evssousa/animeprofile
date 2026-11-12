// Saúde do app, usada para conferir o deploy: o app subiu, o banco responde e qual migration está aplicada.
import { hasDatabase, query } from "~/server/db.server";

export async function loader() {
  let database: "ok" | "sem banco" | "erro" = "sem banco";
  let migration: string | null = null;
  if (hasDatabase()) {
    try {
      const rows = await query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1");
      migration = rows[0]?.version ?? null;
      database = "ok";
    } catch {
      database = "erro";
    }
  }
  return Response.json({ ok: database !== "erro", database, migration, node: process.version }, { headers: { "Cache-Control": "no-store" } });
}
