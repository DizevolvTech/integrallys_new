export type ViewMode = 'dia' | 'semana' | 'mes'

export type AgendaModal =
  | 'novo'
  | 'lista-espera'
  | 'aniversariantes'
  | 'tarefas'
  | 'bloqueio'
  | 'remarcar'
  | 'cancelar'
  | 'detalhes'
  | 'cobranca'
  | 'estornar-recebimento'
  | 'visualizar'
  | 'ficha-paciente'
  | 'chamar-especialista'
  | null

export interface AgendaSlot {
  id: string
  hora: string
  /** Fim do slot (HH:MM); usado para duração real — nunca assumir 30min. */
  horaFim?: string
  pacienteId?: string
  paciente: string
  profissionalId?: string
  profissional: string
  status: string
  data?: string
  tipo?: string
  titulo?: string
  local?: string
  participantes?: string
  compromissoGrupoId?: string
  organizadorId?: string
  participanteIds?: string[]
  modalidade?: string
  plataformaOnline?: string
  urlOnline?: string
  valorProcedimento?: number
  procedimentoId?: string
  procedimento?: string
  observacoes?: string
  pagamento?: string
  totalPago?: number
  dataPagamentoAnterior?: string
  foraJanela?: boolean
  motivoEncaixe?: string
}

export interface WeekDayData {
  key: string
  date: Date
  label: string
  shortLabel: string
  isToday: boolean
}

export interface MonthDayCell {
  key: string
  date: Date | null
  isCurrentMonth: boolean
  isToday: boolean
}
