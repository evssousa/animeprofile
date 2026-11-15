// Pedidos que chegam de fora e só ficam guardados até as contas voltarem (notificações do Mercado Pago, descadastro de
// e-mail). Vão para contact_messages com um `kind` próprio; a economia e as contas processam depois.
import { exec, hasDatabase } from "./db.server";
import { clientIp, ipHash } from "./http.server";

export type InboxKind = "mp-webhook" | "descadastro";

/** Guarda o pedido inteiro. Devolve false se não conseguiu (quem chamou responde 500 para o remetente tentar de novo). */
export async function saveInbox(kind: InboxKind, request: Request, opts: { subject: string; body: string; extra?: Record<string, unknown> }): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await exec("INSERT INTO contact_messages (kind, name, email, subject, body, extra, ip_hash) VALUES (?, ?, '', ?, ?, ?, ?)", [
      kind,
      kind === "mp-webhook" ? "Mercado Pago" : "Descadastro",
      opts.subject.slice(0, 120),
      opts.body.slice(0, 60000),
      opts.extra ? JSON.stringify(opts.extra) : null,
      ipHash(clientIp(request)),
    ]);
    return true;
  } catch (err) {
    console.error(`[inbox] não gravou ${kind}:`, err);
    return false;
  }
}
