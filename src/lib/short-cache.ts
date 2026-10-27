interface Entry<T> {
  expiresAt: number
  value: Promise<T>
}

const MAX_ENTRIES = 500
const store = new Map<string, Entry<unknown>>()

/**
 * Cache curto por processo com deduplicação de chamadas simultâneas: as várias requisições
 * paralelas de uma mesma tela compartilham uma única consulta. Falhas e resultados que
 * `deveGuardar` rejeita não ficam em cache. Usar só para dado estável (sessão, permissão).
 */
export function memoizeShort<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  deveGuardar: (valor: T) => boolean = () => true,
): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expiresAt > now) return hit.value

  if (store.size >= MAX_ENTRIES) {
    for (const [k, e] of store) if (e.expiresAt <= now) store.delete(k)
    if (store.size >= MAX_ENTRIES) store.clear()
  }

  const value = loader()
  const entry: Entry<T> = { expiresAt: now + ttlMs, value }
  store.set(key, entry)
  value.then(
    (v) => {
      if (!deveGuardar(v) && store.get(key) === entry) store.delete(key)
    },
    () => {
      if (store.get(key) === entry) store.delete(key)
    },
  )
  return value
}

export function limparCacheCurto(prefixo = '') {
  for (const k of store.keys()) if (k.startsWith(prefixo)) store.delete(k)
}
