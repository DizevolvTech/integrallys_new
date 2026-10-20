import type { TarefaItem } from '@/hooks/use-tarefas'

export type PlannerView = 'entrada' | 'dia' | 'semana' | 'mes'

export function toDateKey(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/** Semana começando na segunda-feira. */
export function startOfWeek(date: Date) {
  const offset = (date.getDay() + 6) % 7
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -offset)
}

export function buildWeekDays(date: Date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** Grade do mês: 6 semanas × 7 dias, começando na segunda. */
export function buildMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function isOpen(tarefa: TarefaItem) {
  return tarefa.status !== 'Concluída' && tarefa.status !== 'Cancelada'
}

const PRIORIDADE_PESO: Record<string, number> = { Alta: 0, Média: 1, Baixa: 2 }

/** Ordena por horário (sem horário por último) e depois por prioridade. */
export function sortTarefas(a: TarefaItem, b: TarefaItem) {
  const ha = a.horario || '99:99'
  const hb = b.horario || '99:99'
  if (ha !== hb) return ha.localeCompare(hb)
  return (PRIORIDADE_PESO[a.prioridade] ?? 1) - (PRIORIDADE_PESO[b.prioridade] ?? 1)
}

export interface PlannerFilters {
  mostrarConcluidas: boolean
  mostrarSubtarefas: boolean
  projeto: string
  prioridade: string
  busca: string
  /** Filtro por data da tarefa (AAAA-MM-DD, inclusivo). Vazio = sem limite. */
  dataDe?: string
  dataAte?: string
}

/** Tarefa sem data só aparece quando não há filtro de data. */
export function dentroDoPeriodo(data: string | undefined | null, de?: string, ate?: string) {
  if (!de && !ate) return true
  if (!data) return false
  const dia = String(data).slice(0, 10)
  if (de && dia < de) return false
  if (ate && dia > ate) return false
  return true
}

export function applyFilters(tarefas: TarefaItem[], filters: PlannerFilters) {
  const busca = filters.busca.trim().toLowerCase()
  return tarefas.filter((tarefa) => {
    if (tarefa.status === 'Cancelada') return false
    if (!filters.mostrarConcluidas && tarefa.status === 'Concluída') return false
    if (filters.projeto !== 'todos' && tarefa.categoria !== filters.projeto) return false
    if (filters.prioridade !== 'todas' && tarefa.prioridade !== filters.prioridade) return false
    if (!dentroDoPeriodo(tarefa.data, filters.dataDe, filters.dataAte)) return false
    if (busca && !`${tarefa.titulo} ${tarefa.descricao}`.toLowerCase().includes(busca)) return false
    return true
  })
}

export interface EntradaGroups {
  atrasadas: TarefaItem[]
  hoje: TarefaItem[]
  proximas: TarefaItem[]
  semData: TarefaItem[]
  concluidas: TarefaItem[]
}

export function groupEntrada(tarefas: TarefaItem[], todayKey: string): EntradaGroups {
  const groups: EntradaGroups = { atrasadas: [], hoje: [], proximas: [], semData: [], concluidas: [] }
  for (const tarefa of tarefas) {
    if (!isOpen(tarefa)) groups.concluidas.push(tarefa)
    else if (!tarefa.data) groups.semData.push(tarefa)
    else if (tarefa.data < todayKey) groups.atrasadas.push(tarefa)
    else if (tarefa.data === todayKey) groups.hoje.push(tarefa)
    else groups.proximas.push(tarefa)
  }
  const byDate = (a: TarefaItem, b: TarefaItem) =>
    `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`)
  groups.atrasadas.sort(byDate)
  groups.proximas.sort(byDate)
  groups.hoje.sort(sortTarefas)
  return groups
}
