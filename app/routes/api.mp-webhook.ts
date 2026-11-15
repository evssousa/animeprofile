// Notificações do Mercado Pago: /api/public/payments/webhook e /api/public/payments/mercado-pago (os endereços que o
// Mercado Pago já tem cadastrados). Por enquanto só guarda o pedido inteiro; ninguém é creditado aqui. O processamento
// vem com a economia. Responde 200 só depois de gravar e 500 se não conseguir, para o Mercado Pago tentar de novo.
import type { Route } from "./+types/api.mp-webhook";
import { saveInbox } from "~/server/inbox.server";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export function loader() {
  return new Response("ok", { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const raw = (await request.text()).slice(0, 60000);
  const saved = await saveInbox("mp-webhook", request, {
    subject: `${request.method} ${url.pathname}`,
    body: raw,
    extra: {
      query: Object.fromEntries(url.searchParams),
      signature: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      contentType: request.headers.get("content-type"),
    },
  });
  return saved ? new Response("ok", { headers }) : new Response("erro ao gravar", { status: 500, headers });
}
