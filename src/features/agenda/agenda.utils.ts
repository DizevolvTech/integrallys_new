import type { AgendaItem } from '@/hooks/use-agenda'
import type { AgendaSlot, MonthDayCell, ViewMode, WeekDayData } from './agenda.types'

/** Converte item da API em slot da grade (preserva pagamento e procedimento). */
export function mapAgendaItemToSlot(item: AgendaItem): AgendaSlot {
  return {
    id: item.id,
    hora: item.horario,
    horaFim: item.horarioFim,
    pacienteId: item.pacienteId,
    paciente: item.paciente,
    profissionalId: item.profissionalId,
    profissional: item.profissional,
    status: item.status,
    data: item.data,
    tipo: item.tipo,
    titulo: item.titulo,
    modalidade: item.modalidade,
    plataformaOnline: item.plataformaOnline,
    urlOnline: item.urlOnline,
    valorProcedimento: item.valorProcedimento,
    procedimentoId: item.procedimentoId,
    procedimento: item.procedimento,
    observacoes: item.observacoes,
    pagamento: item.pagamento,
    totalPago: item.totalPago,
    dataPagamentoAnterior: item.dataPagamentoAnterior,
    foraJanela: item.foraJanela,
    motivoEncaixe: item.motivoEncaixe,
  }
}

export function formatAgendaDate(date: Date, viewMode: ViewMode) {
  const formatter = new Intl.DateTimeFormat(
    'pt-BR',
    viewMode === 'mes'
      ? { month: 'long', year: 'numeric' }
      : { weekday: 'long', day: '2-digit', month: 'long' },
  )

  const formatted = formatter.format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Duração a partir de início/fim (HH:MM). Retorna null se não calculável — UI omite badge. */
export function formatSlotDuration(hora: string, horaFim?: string): string | null {
  if (!horaFim) return null
  const parse = (value: string) => {
    const [h, m] = value.slice(0, 5).split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return h * 60 + m
  }
  const start = parse(hora)
  const end = parse(horaFim)
  if (start == null || end == null) return null
  const diff = end - start
  if (diff <= 0) return null
  if (diff < 60) return `${diff}min`
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export function normalizeAgendaStatus(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized.includes('confirm')) return 'Confirmado'
  if (normalized.includes('check-in')) return 'Check-in'
  if (normalized.includes('check-out')) return 'Check-out'
  if (normalized.includes('atendimento')) return 'Em Atendimento'
  if (normalized.includes('atras')) return 'Em Atraso'
  if (normalized.includes('cancel')) return 'Cancelado'
  if (normalized.includes('pend')) return 'Aguardando'
  if (normalized.includes('conclu')) return 'Concluído'
  if (normalized.includes('faltou')) return 'Faltou'
  if (normalized.includes('adiad')) return 'Adiado'
  if (normalized.includes('bloque')) return 'Bloqueado'
  if (normalized.includes('agend')) return 'Agendado'
  return status || 'Agendado'
}

/** Status selecionáveis no dropdown da recepção/agenda. */
export const AGENDA_STATUS_DROPDOWN = [
  'Agendado',
  'Confirmado',
  'Check-in',
  'Em Atendimento',
  'Check-out',
  'Em Atraso',
  'Cancelado',
] as const

/** Status elegíveis a virarem "Em Atraso" automaticamente. */
export const STATUS_ELEGIVEIS_ATRASO = ['Agendado', 'Confirmado', 'Check-in'] as const

/**
 * true quando data (YYYY-MM-DD) + horário (HH:MM) já passaram no relógio local.
 * Usado para bloquear booking retroativo e marcar atraso.
 */
/** Fuso da clínica: o servidor roda em UTC, então "agora" precisa ser lido no relógio de Brasília. */
export const CLINIC_TIME_ZONE = 'America/Sao_Paulo'

/** Data/hora de parede de `instant` no fuso da clínica, como número comparável (AAAAMMDDHHMM). */
function wallClockStamp(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return get('year') * 1e8 + get('month') * 1e6 + get('day') * 1e4 + get('hour') * 100 + get('minute')
}

/** `dataIso` + `horario` são o relógio da clínica (Brasília); compara com o "agora" no mesmo fuso. */
export function isHorarioPassado(
  dataIso: string,
  horario: string,
  agora: Date = new Date(),
  timeZone: string = CLINIC_TIME_ZONE,
): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso.trim())
  if (!dateMatch) return false
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(horario.trim())
  if (!timeMatch) return false

  const slot =
    Number(dateMatch[1]) * 1e8 +
    Number(dateMatch[2]) * 1e6 +
    Number(dateMatch[3]) * 1e4 +
    Number(timeMatch[1]) * 100 +
    Number(timeMatch[2])
  return slot < wallClockStamp(agora, timeZone)
}

/** Preferir `capabilities.iniciarAtendimento` de `/api/auth/me` nas views. */
export function canIniciarAtendimento(role: string | undefined | null): boolean {
  return role === 'especialista' || role === 'master'
}

export type PagamentoSituacao = 'Pago' | 'Parcial' | 'Pendente' | 'Sem valor'

/** Situação de pagamento para ícones/cores na grade — deriva do backend ou dos valores. */
export function resolvePagamentoSituacao(input: {
  pagamento?: string
  valorProcedimento?: number
  totalPago?: number
}): PagamentoSituacao {
  const valor = input.valorProcedimento ?? 0
  const pago = input.totalPago ?? 0

  // Valores reais prevalecem sobre o rótulo da view (evita falso "Pago" na grade).
  if (valor > 0) {
    if (pago <= 0) return 'Pendente'
    if (pago >= valor) return 'Pago'
    return 'Parcial'
  }

  const raw = (input.pagamento ?? '').trim().toLowerCase()
  if (raw.includes('parcial')) return 'Parcial'
  if (raw === 'pago' || raw.includes('quitad')) return 'Pago'
  if (raw.includes('sem valor')) return 'Sem valor'
  if (raw === 'pendente') return 'Pendente'

  return 'Sem valor'
}

export function getPagamentoIconTone(situacao: PagamentoSituacao): string {
  switch (situacao) {
    case 'Pago':
      return 'text-[var(--app-success-text)]'
    case 'Parcial':
      return 'text-[var(--app-warning-text)]'
    case 'Pendente':
      return 'text-slate-500 dark:text-slate-400'
    case 'Sem valor':
      return 'text-app-text-muted dark:text-app-text-muted'
  }
}

export function getPagamentoButtonTone(situacao: PagamentoSituacao): string {
  switch (situacao) {
    case 'Pago':
      return 'bg-[color:var(--app-success-bg)]/60 hover:bg-[color:var(--app-success-bg)]'
    case 'Parcial':
      return 'bg-[color:var(--app-warning-bg)]/60 hover:bg-[color:var(--app-warning-bg)]'
    case 'Pendente':
      return 'bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/40 dark:hover:bg-slate-800'
    case 'Sem valor':
      return 'hover:bg-app-bg-secondary/80 dark:hover:bg-app-hover'
  }
}

export function getPagamentoLegendDot(situacao: PagamentoSituacao): string {
  switch (situacao) {
    case 'Pago':
      return 'bg-[var(--app-success-text)]'
    case 'Parcial':
      return 'bg-[var(--app-warning-text)]'
    case 'Pendente':
      return 'bg-slate-400 dark:bg-slate-500'
    case 'Sem valor':
      return 'bg-app-text-muted'
  }
}

export function getStatusButtonTone(status: string) {
  switch (normalizeAgendaStatus(status)) {
    case 'Confirmado':
      return 'bg-app-primary'
    case 'Agendado':
      return 'bg-slate-500'
    case 'Check-in':
    case 'Aguardando':
      return 'bg-sky-600'
    case 'Em Atendimento':
      return 'bg-indigo-600'
    case 'Check-out':
      return 'bg-emerald-600'
    case 'Em Atraso':
      return 'bg-amber-500 text-app-text-primary'
    case 'Cancelado':
      return 'bg-[var(--app-danger-text)]'
    case 'Concluído':
    case 'Concluido':
      return 'bg-slate-500'
    case 'Faltou':
      return 'bg-orange-500'
    case 'Adiado':
      return 'bg-purple-500'
    case 'Bloqueado':
      return 'bg-gray-600'
    default:
      return 'bg-app-primary'
  }
}

export function getStatusCardTone(status: string) {
  switch (normalizeAgendaStatus(status)) {
    case 'Confirmado':
      return 'bg-[#eaf2ff] dark:bg-[#10213e] border-l-4 border-app-primary'
    case 'Agendado':
      return 'bg-slate-50 dark:bg-slate-900/35 border-l-4 border-slate-400 dark:border-slate-500'
    case 'Check-in':
      return 'bg-sky-50 dark:bg-sky-950/30 border-l-4 border-app-primary'
    case 'Em Atendimento':
      return 'bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500'
    case 'Check-out':
      return 'bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-[var(--app-success-text)]'
    case 'Em Atraso':
      return 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-[var(--app-warning-text)]'
    case 'Cancelado':
      return 'bg-gray-100 dark:bg-gray-900/40 border-l-4 border-gray-400 dark:border-gray-600 opacity-60'
    case 'Aguardando':
      return 'bg-slate-50 dark:bg-slate-900/40 border-l-4 border-app-primary'
    default:
      return 'bg-app-bg-secondary dark:bg-app-bg-dark/50 border-l-4 border-app-border'
  }
}

/**
 * Retorna classes CSS para o badge pill de status na agenda.
 * Equivalente ao getBadgeStyle() do projeto original.
 */
export function getStatusBadgeTone(status: string): string {
  const s = normalizeAgendaStatus(status)
  const isAmber = s === 'Em Atraso'
  return `bg-transparent ${isAmber ? 'text-app-text-primary' : 'text-white'} border-none font-normal`
}

export function filterAgendaItemsByStatus(items: AgendaSlot[], filter: string) {
  switch (filter) {
    case 'agendamentos':
      return items.filter((item) =>
        ['Confirmado', 'Agendado', 'Em Atraso'].includes(normalizeAgendaStatus(item.status)),
      )
    case 'aguardando':
      return items.filter((item) => normalizeAgendaStatus(item.status) === 'Check-in')
    case 'atendimento':
      return items.filter((item) => normalizeAgendaStatus(item.status) === 'Em Atendimento')
    case 'atendidos':
      return items.filter((item) => ['Check-out'].includes(normalizeAgendaStatus(item.status)))
    default:
      return items
  }
}

export function buildWeekDays(baseDate: Date): WeekDayData[] {
  const current = new Date(baseDate)
  const day = current.getDay()
  const diffToSunday = current.getDate() - day
  const start = new Date(current)
  start.setDate(diffToSunday)

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const label = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    })
    const shortLabel = date.toLocaleDateString('pt-BR', { weekday: 'short' })
    const today = new Date()
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()

    return {
      key: date.toISOString(),
      date,
      label,
      shortLabel,
      isToday,
    }
  })
}

export function buildMonthDays(baseDate: Date): MonthDayCell[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startWeekday = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const cells: MonthDayCell[] = []
  const today = new Date()

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({
      key: `empty-start-${i}`,
      date: null,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()

    cells.push({
      key: date.toISOString(),
      date,
      isCurrentMonth: true,
      isToday,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `empty-end-${cells.length}`,
      date: null,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  return cells
}

/** Anda um período na navegação da agenda: dia = 1 dia, semana = 7 dias, mês = 1 mês (sem estourar o fim do mês). */
export function deslocarPeriodo(base: Date, modo: ViewMode, sentido: 1 | -1): Date {
  const next = new Date(base)
  if (modo === 'mes') {
    const dia = next.getDate()
    next.setDate(1)
    next.setMonth(next.getMonth() + sentido)
    const ultimo = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(dia, ultimo))
  } else {
    next.setDate(next.getDate() + (modo === 'semana' ? 7 : 1) * sentido)
  }
  return next
}
