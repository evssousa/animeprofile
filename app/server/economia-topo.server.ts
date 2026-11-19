// Números da economia que aparecem no topo de quem está logado (sequência de check-in, AP Coins, Rubis e nível), como no site antigo.
// A economia (check-in, moedas, loja, níveis) ainda não foi refeita: hoje só o administrador entra e ele começa do zero, então
// esta função devolve o estado inicial. Na fase da economia, ela passa a ler o banco (e a importação traz os saldos reais de cada um).
import type { Viewer } from "./auth/viewer.server";

export type EconomiaTopo = { sequencia: number; apCoins: number; rubis: number; nivel: number; xp: number; xpProximo: number };

export async function economiaDoUsuario(_viewer: Viewer): Promise<EconomiaTopo> {
  return { sequencia: 0, apCoins: 0, rubis: 0, nivel: 1, xp: 0, xpProximo: 100 };
}
