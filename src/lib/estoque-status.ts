/**
 * Regras de status automático do estoque (Onda 4 · Call 09/09).
 * Indisponível quando qty <= 0; Disponível caso contrário.
 * Estoque mínimo gera alerta na UI, não muda o status canônico.
 */
export function resolveEstoqueStatus(quantidade: number, _estoqueMinimo = 0): 'Disponível' | 'Indisponível' {
  return Number(quantidade) <= 0 ? 'Indisponível' : 'Disponível'
}

/** Gera SKU sequencial por unidade quando o usuário não informa. */
export function buildAutoSku(params: {
  unidadeId?: string | null
  sequence: number
  now?: Date
}): string {
  const date = params.now ?? new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const unitHint = (params.unidadeId ?? 'ALL').replace(/-/g, '').slice(0, 4).toUpperCase()
  const seq = String(Math.max(1, Math.floor(params.sequence))).padStart(4, '0')
  return `SKU-${unitHint}-${y}${m}${d}-${seq}`
}

export function isProdutoDisponivelParaOrcamento(item: {
  status?: string | null
  quantidade?: number | null
}): boolean {
  const qty = Number(item.quantidade ?? 0)
  if (qty <= 0) return false
  const status = String(item.status ?? '').toLowerCase()
  if (status.includes('indispon')) return false
  return true
}
