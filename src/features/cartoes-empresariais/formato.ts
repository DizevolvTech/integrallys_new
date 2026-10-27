const MESES_CURTOS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

/** "29/jan." como na referência da cliente. */
export function formatDiaMes(value: string | null): string {
  if (!value) return '—'
  const [, month, day] = value.split('-')
  const nome = MESES_CURTOS[Number(month) - 1]
  return nome ? `${day}/${nome}` : '—'
}
