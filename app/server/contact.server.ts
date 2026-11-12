// Mensagens dos formulários públicos (Contato e Faça parte). Sem conta: protegido por campo-isca
// (robôs preenchem, pessoas não veem) e por limite de envios por IP. O Turnstile entra com as chaves.
import { createHash } from "node:crypto";
import { exec, hasDatabase, query } from "./db.server";

export type ContactKind = "contato" | "faca-parte";
export type FieldErrors = Partial<Record<string, string>>;
export type ContactInput = { name: string; email: string; subject: string; body: string; extra?: Record<string, string> };

const MAX_PER_HOUR = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

/** Hash do IP com o dia: dá para contar envios repetidos sem guardar o IP de ninguém. */
function ipHash(ip: string) {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${day}|${process.env.CRON_TOKEN ?? ""}`).digest("hex");
}

export function validate(input: ContactInput, { minBody = 10 } = {}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.name.length < 2) errors.name = "Escreva seu nome.";
  else if (input.name.length > 100) errors.name = "Use até 100 caracteres.";
  if (!EMAIL_RE.test(input.email) || input.email.length > 255) errors.email = "Confira o e-mail: ele precisa ter o formato nome@exemplo.com.";
  if (!input.subject) errors.subject = "Escolha um assunto.";
  if (input.body.length < minBody) errors.body = `Escreva pelo menos ${minBody} caracteres.`;
  else if (input.body.length > 4000) errors.body = "A mensagem passou de 4.000 caracteres.";
  return errors;
}

export type SaveResult = { ok: true } | { ok: false; reason: "limite" | "indisponivel" };

export async function saveMessage(kind: ContactKind, input: ContactInput, request: Request): Promise<SaveResult> {
  if (!hasDatabase()) return { ok: false, reason: "indisponivel" };
  const hash = ipHash(clientIp(request));
  if (hash) {
    const [row] = await query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contact_messages WHERE ip_hash = ? AND created_at > UTC_TIMESTAMP(3) - INTERVAL 1 HOUR",
      [hash],
    );
    if (Number(row?.n ?? 0) >= MAX_PER_HOUR) return { ok: false, reason: "limite" };
  }
  await exec("INSERT INTO contact_messages (kind, name, email, subject, body, extra, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    kind,
    input.name,
    input.email,
    input.subject,
    input.body,
    input.extra ? JSON.stringify(input.extra) : null,
    hash,
  ]);
  return { ok: true };
}

/** Lê um campo de texto do formulário, já sem espaços nas pontas. */
export const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
