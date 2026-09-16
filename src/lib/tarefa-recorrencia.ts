export const TAREFA_RECORRENCIA_VALUES = [
  'nenhuma',
  'diaria',
  'dias_uteis',
  'semanal',
  'quinzenal',
  'mensal',
  'anual',
  'dias_especificos',
] as const

export type TarefaRecorrencia = (typeof TAREFA_RECORRENCIA_VALUES)[number]

export const TAREFA_RECORRENCIA_LABELS: Record<TarefaRecorrencia, string> = {
  nenhuma: 'Sem recorrência',
  diaria: 'Diariamente',
  dias_uteis: 'Somente dias úteis',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  anual: 'Anualmente',
  dias_especificos: 'Dias específicos da semana',
}

/** 0 = domingo … 6 = sábado */
export const DIAS_SEMANA_OPTIONS = [
  { value: 0, label: 'Dom', full: 'Domingo' },
  { value: 1, label: 'Seg', full: 'Segunda' },
  { value: 2, label: 'Ter', full: 'Terça' },
  { value: 3, label: 'Qua', full: 'Quarta' },
  { value: 4, label: 'Qui', full: 'Quinta' },
  { value: 5, label: 'Sex', full: 'Sexta' },
  { value: 6, label: 'Sáb', full: 'Sábado' },
] as const

export function isTarefaRecorrencia(value: unknown): value is TarefaRecorrencia {
  return typeof value === 'string' && (TAREFA_RECORRENCIA_VALUES as readonly string[]).includes(value)
}

export function normalizeTarefaRecorrencia(value: unknown): TarefaRecorrencia {
  return isTarefaRecorrencia(value) ? value : 'nenhuma'
}

export function normalizeDiasSemana(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<number>()
  for (const item of value) {
    const n = typeof item === 'number' ? item : Number(item)
    if (Number.isInteger(n) && n >= 0 && n <= 6) unique.add(n)
  }
  return [...unique].sort((a, b) => a - b)
}

function nextMatchingWeekday(from: Date, allowed: number[]): Date | null {
  if (allowed.length === 0) return null
  const base = new Date(from.getTime())
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = new Date(base.getTime())
    candidate.setDate(base.getDate() + offset)
    if (allowed.includes(candidate.getDay())) return candidate
  }
  return null
}

/** Próximo vencimento a partir de uma data base (ISO ou Date). */
export function nextVencimentoForRecorrencia(
  recorrencia: TarefaRecorrencia,
  from: Date | string | null | undefined,
  diasSemana: number[] = [],
): Date | null {
  if (recorrencia === 'nenhuma') return null

  const base = from ? new Date(from) : new Date()
  if (Number.isNaN(base.getTime())) return null

  const next = new Date(base.getTime())

  switch (recorrencia) {
    case 'diaria':
      next.setDate(next.getDate() + 1)
      return next
    case 'dias_uteis':
      return nextMatchingWeekday(base, [1, 2, 3, 4, 5])
    case 'semanal':
      next.setDate(next.getDate() + 7)
      return next
    case 'quinzenal':
      next.setDate(next.getDate() + 14)
      return next
    case 'mensal':
      next.setMonth(next.getMonth() + 1)
      return next
    case 'anual':
      next.setFullYear(next.getFullYear() + 1)
      return next
    case 'dias_especificos':
      return nextMatchingWeekday(base, normalizeDiasSemana(diasSemana))
    default:
      return null
  }
}

export function formatDiasSemanaLabel(dias: number[]): string {
  const set = new Set(normalizeDiasSemana(dias))
  if (set.size === 0) return ''
  return DIAS_SEMANA_OPTIONS.filter((d) => set.has(d.value))
    .map((d) => d.label)
    .join(', ')
}
