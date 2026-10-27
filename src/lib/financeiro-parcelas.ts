export type ParcelaGerada = {
  numero: number
  total: number
  valor: number
  vencimento: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Soma `meses` a uma data ISO mantendo o dia, ou o último dia do mês quando ele não existe. */
export function adicionarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1))
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimoDia))
  return alvo.toISOString().slice(0, 10)
}

/**
 * Divide o valor em parcelas mensais (em centavos, sem perder nem criar dinheiro).
 * A diferença de centavos fica na última parcela.
 */
export function gerarParcelas(params: {
  valorTotal: number
  parcelas: number
  primeiroVencimento: string
}): ParcelaGerada[] {
  const total = Math.max(1, Math.min(60, Math.trunc(params.parcelas) || 1))
  const centavos = Math.round(params.valorTotal * 100)
  const base = Math.floor(centavos / total)
  return Array.from({ length: total }, (_, index) => {
    const ultima = index === total - 1
    const valorCentavos = ultima ? centavos - base * (total - 1) : base
    return {
      numero: index + 1,
      total,
      valor: valorCentavos / 100,
      vencimento: adicionarMeses(params.primeiroVencimento, index),
    }
  })
}
