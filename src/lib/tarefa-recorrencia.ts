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
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = new Date(from.getTime())
    candidate.setUTCDate(from.getUTCDate() + offset)
    if (allowed.includes(candidate.getUTCDay())) return candidate
  }
  return null
}

/**
 * Próximo vencimento a partir de uma data base (ISO ou Date). Usa o calendário
 * UTC porque o horário da tarefa é gravado como relógio de parede em UTC.
 */
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
      next.setUTCDate(next.getUTCDate() + 1)
      return next
    case 'dias_uteis':
      return nextMatchingWeekday(base, [1, 2, 3, 4, 5])
    case 'semanal':
      next.setUTCDate(next.getUTCDate() + 7)
      return next
    case 'quinzenal':
      next.setUTCDate(next.getUTCDate() + 14)
      return next
    case 'mensal':
      next.setUTCMonth(next.getUTCMonth() + 1)
      return next
    case 'anual':
      next.setUTCFullYear(next.getUTCFullYear() + 1)
      return next
    case 'dias_especificos':
      return nextMatchingWeekday(base, normalizeDiasSemana(diasSemana))
    default:
      return null
  }
}

/** Quantos dias à frente as ocorrências de uma série já ficam visíveis. */
export const HORIZONTE_RECORRENCIA_DIAS = 7

/**
 * Limite (inclusivo) até onde gerar ocorrências: fim do dia `hoje + dias` no
 * calendário da clínica. Horários de tarefa são gravados como relógio de parede
 * em UTC (o servidor roda em UTC), então o limite segue a mesma convenção.
 */
export function limiteGeracaoRecorrencia(agora: Date = new Date(), dias = HORIZONTE_RECORRENCIA_DIAS): Date {
  const hojeClinica = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
  const limite = new Date(`${hojeClinica}T23:59:59.999Z`)
  limite.setUTCDate(limite.getUTCDate() + dias)
  return limite
}

/**
 * Próximas datas de uma série depois de `aPartirDe` (exclusivo) até `limite`
 * (inclusivo). Mantém o horário da ocorrência base. `max` evita laço infinito
 * com dado inconsistente.
 */
export function proximasOcorrencias(
  recorrencia: TarefaRecorrencia,
  aPartirDe: Date | string,
  limite: Date,
  diasSemana: number[] = [],
  max = 120,
): Date[] {
  const datas: Date[] = []
  let atual: Date | null = new Date(aPartirDe)
  if (Number.isNaN(atual.getTime())) return datas
  while (datas.length < max) {
    atual = nextVencimentoForRecorrencia(recorrencia, atual, diasSemana)
    if (!atual || atual.getTime() > limite.getTime()) break
    datas.push(atual)
  }
  return datas
}

export function formatDiasSemanaLabel(dias: number[]): string {
  const set = new Set(normalizeDiasSemana(dias))
  if (set.size === 0) return ''
  return DIAS_SEMANA_OPTIONS.filter((d) => set.has(d.value))
    .map((d) => d.label)
    .join(', ')
}
