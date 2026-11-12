// `npm run db:migrate`: aplica as migrations pendentes no banco do .env (uso local).
import { dbConfigFromEnv, migrate } from "../db/migrate.mjs";

process.loadEnvFile?.(".env");
const config = dbConfigFromEnv();
if (!config) {
  console.error("Defina DB_NAME e DB_USER no .env");
  process.exit(1);
}
const applied = await migrate(config);
console.log(applied.length ? `Aplicadas: ${applied.join(", ")}` : "Banco já atualizado");
