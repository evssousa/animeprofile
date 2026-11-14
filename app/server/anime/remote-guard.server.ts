// Proteção das buscas sob demanda no AniList (ficha de anime ou personagem que ainda não está no banco).
//
// Em 2026-11-14 um robô percorreu o sitemap do endereço de teste (ignorando o robots.txt) e cada página aberta
// virou um pedido ao AniList: ~1.400 em 20 minutos. Regras:
//   1. robôs nunca disparam busca: veem só o que já está guardado;
//   2. no máximo 20 buscas por minuto por processo, para não estourar o limite do AniList (~90/min).
import { isbot } from "isbot";

const PER_MINUTE = 20;
let windowStart = 0;
let used = 0;

export function canFetchRemote(request: Request, now = Date.now()): boolean {
  if (isbot(request.headers.get("user-agent") ?? "")) return false;
  if (now - windowStart >= 60_000) {
    windowStart = now;
    used = 0;
  }
  if (used >= PER_MINUTE) return false;
  used++;
  return true;
}

/** Só para os testes. */
export function resetRemoteGuard() {
  windowStart = 0;
  used = 0;
}
