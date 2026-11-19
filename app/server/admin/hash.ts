// Hash de senha do admin (scrypt). Arquivo sem dependências do site: o `npm run admin:hash` roda direto no Node.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/**
 * Formato: scrypt:N:r:p:<salt base64>:<hash base64>
 * Sem "$": alguns painéis tratam "$algo" como variável e apagam o trecho.
 */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${N}:${R}:${P}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function parseHash(stored: string) {
  const s = stored.trim();
  const parts = s.split(s.includes(":") ? ":" : "$");
  const [alg, n, r, p, salt, hash] = parts;
  if (parts.length !== 6 || alg !== "scrypt" || !Number(n) || !Number(r) || !Number(p) || !salt || !hash) return null;
  return { n: Number(n), r: Number(r), p: Number(p), salt, hash };
}

export async function verifyPassword(password: string, stored: string) {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const { n, r, p, salt, hash } = parsed;
  const expected = Buffer.from(hash, "base64");
  const got = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}
