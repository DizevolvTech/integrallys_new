// Retornos do início (item 41): a regra de situação (no prazo / limite / vencido) mora na view
// retornos_em_aberto (migração 117), a mesma usada pela tela /retornos; aqui só contamos.

export type SituacaoRetorno = 'no_prazo' | 'limite' | 'vencido'

// Status que NÃO representam um atendimento marcado de verdade.
const STATUS_SEM_AGENDAMENTO = ['cancel', 'faltou', 'dispon', 'bloque', 'adiad']

export function agendamentoConta(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return !STATUS_SEM_AGENDAMENTO.some((parte) => s.includes(parte))
}

export interface ContagemRetornos {
  noPrazo: number
  limitePrazo: number
  vencidos: number
}

export function contarSituacoes(rows: ReadonlyArray<{ situacao?: string | null }>): ContagemRetornos {
  const total: ContagemRetornos = { noPrazo: 0, limitePrazo: 0, vencidos: 0 }
  for (const row of rows) {
    if (row.situacao === 'vencido') total.vencidos += 1
    else if (row.situacao === 'limite') total.limitePrazo += 1
    else if (row.situacao === 'no_prazo') total.noPrazo += 1
  }
  return total
}
