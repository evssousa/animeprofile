// Proteção das buscas sob demanda no AniList (ficha de anime ou personagem que ainda não está no banco).
//
// Em 2026-11-14 um robô percorreu o sitemap do endereço de teste (ignorando o robots.txt) e cada página aberta
// virou um pedido ao AniList: ~1.400 em 20 minutos. Regras, por processo e por minuto:
//   - pessoas: até 20 buscas;
//   - robôs: até 5 (o Google precisa conseguir abrir as fichas, mas sem estourar o limite do AniList, ~90/min).
// Sem cota, a página responde 503 ("volte daqui a pouco"), nunca 404: o Google tenta de novo depois.
import { isbot } from "isbot";

const LIMITS = { human: 20, bot: 5 };
let windowStart = 0;
const used = { human: 0, bot: 0 };

export function canFetchRemote(request: Request, now = Date.now()): boolean {
  const kind = isbot(request.headers.get("user-agent") ?? "") ? "bot" : "human";
  if (now - windowStart >= 60_000) {
    windowStart = now;
    used.human = 0;
    used.bot = 0;
  }
  if (used[kind] >= LIMITS[kind]) return false;
  used[kind]++;
  return true;
}

/** A ficha não está guardada e agora não dá para buscar no AniList: a página responde 503. */
export class RemoteUnavailable extends Error {
  constructor() {
    super("ficha ainda não guardada e sem cota para buscar no AniList agora");
  }
}

/** Só para os testes. */
export function resetRemoteGuard() {
  windowStart = 0;
  used.human = 0;
  used.bot = 0;
}
