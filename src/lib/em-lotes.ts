/** Divide uma lista em lotes (padrão 150): `.in()` do PostgREST nunca recebe lista sem limite. */
export function emLotes<T>(lista: readonly T[], tamanho = 150): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho))
  return lotes
}
