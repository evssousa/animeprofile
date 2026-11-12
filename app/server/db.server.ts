// Conexão com o MySQL. Só roda no servidor.
//
// Na Hostinger o banco fica no mesmo servidor do site: conectar em 127.0.0.1:3306
// (não em "localhost", que pode resolver para IPv6, nem no host srvNNNN.hstgr.io).
import { randomBytes } from "node:crypto";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export const hasDatabase = () => Boolean(process.env.DB_NAME && process.env.DB_USER);

let pool: Pool | undefined;

export function db(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: Number(process.env.DB_POOL || 5),
      charset: "utf8mb4",
      timezone: "Z", // DATETIME gravado e lido sempre em UTC
      dateStrings: true,
      waitForConnections: true,
    });
  }
  return pool;
}

/** Troca o pool (testes com banco descartável). */
export function setPool(p: Pool | undefined) {
  pool = p;
}

type Executor = Pool | PoolConnection;

/** SELECT tipado: devolve as linhas como `T[]`. */
export async function query<T>(sql: string, params: unknown[] = [], conn: Executor = db()): Promise<T[]> {
  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

/** INSERT/UPDATE/DELETE: devolve linhas afetadas e o id inserido. */
export async function exec(sql: string, params: unknown[] = [], conn: Executor = db()) {
  const [res] = await conn.query<ResultSetHeader>(sql, params);
  return { affected: res.affectedRows, insertId: res.insertId };
}

/**
 * Roda `fn` numa transação. Qualquer erro desfaz tudo. É a base de toda operação que mexe em saldo
 * ou coleção: dentro dela, trave as linhas com `SELECT ... FOR UPDATE`.
 */
export async function tx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** No MariaDB, colunas JSON chegam como texto; no MySQL 8, como objeto. */
export function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** "2026-11-10 14:30:00.000" (UTC, como vem do banco) → ISO "2026-11-10T14:30:00.000Z". */
export function iso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.length === 10 ? value : `${value.replace(" ", "T")}Z`;
}

/** Date → "2026-11-10 14:30:00.000" para gravar em DATETIME(3) (UTC). */
export function sqlDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

/** UUID v7: ordenado pelo tempo (bom para o índice do InnoDB). Os IDs importados continuam v4. */
export function uuidv7(now = Date.now()): string {
  const b = randomBytes(16);
  b.writeUIntBE(now, 0, 6);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
