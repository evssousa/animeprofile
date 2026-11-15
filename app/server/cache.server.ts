// Cache em memória, por processo: guarda o resultado de consultas das barras laterais por alguns minutos.
// Junta pedidos iguais em andamento (10 visitas ao mesmo tempo fazem 1 consulta) e não guarda erro.
const MAX_KEYS = 300;
const store = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const running = pending.get(key);
  if (running) return running as Promise<T>;
  const p = fn()
    .then((value) => {
      store.delete(key);
      store.set(key, { value, expires: Date.now() + ttlMs });
      while (store.size > MAX_KEYS) store.delete(store.keys().next().value as string);
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

export function clearCache() {
  store.clear();
}
