export const PRIORIDADES = ['Urgente', 'Alta', 'Média', 'Baixa'] as const
export const PERIODOS = ['Manhã', 'Tarde', 'Noite', 'Final do dia', 'Qualquer horário'] as const
export const PERIODO_PADRAO = 'Qualquer horário'

const DIA_MS = 24 * 60 * 60 * 1000

function chave(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/** Itens antigos guardam 'manha'/'tarde' em minúsculas; texto livre antigo é mantido como está. */
export function normalizePeriodo(valor: string | null | undefined): string {
  const texto = (valor ?? '').trim()
  if (!texto) return ''
  const achado = PERIODOS.find((periodo) => chave(periodo) === chave(texto))
  return achado ?? texto
}

export function periodoOptions(atual: string): string[] {
  const normalizado = normalizePeriodo(atual)
  return normalizado && !PERIODOS.some((p) => p === normalizado) ? [...PERIODOS, normalizado] : [...PERIODOS]
}

export function isAltaPrioridade(prioridade: string) {
  const k = chave(prioridade)
  return k === 'alta' || k === 'urgente'
}

export function diasEmEspera(entradaIso: string | null | undefined, agora: Date = new Date()): number | null {
  if (!entradaIso) return null
  const entrada = new Date(entradaIso)
  if (Number.isNaN(entrada.getTime())) return null
  return Math.max(0, Math.floor((agora.getTime() - entrada.getTime()) / DIA_MS))
}

export function formatDias(dias: number | null): string {
  if (dias === null) return '-'
  if (dias === 0) return 'hoje'
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

export function mediaDiasEmEspera(entradas: Array<string | null | undefined>, agora: Date = new Date()): number {
  const dias = entradas.map((e) => diasEmEspera(e, agora)).filter((d): d is number => d !== null)
  if (dias.length === 0) return 0
  return Math.round(dias.reduce((soma, d) => soma + d, 0) / dias.length)
}

export interface AgendarFila {
  id: string
  pacienteId?: string
  especialistaId?: string
  especialista?: string
  procedimentoId?: string
}

/** Leva ao fluxo existente de novo agendamento com paciente, especialista e procedimento preenchidos. */
export function buildAgendarUrl(item: AgendarFila): string {
  const params = new URLSearchParams({ modal: 'novo', patientId: item.pacienteId ?? '', listaEsperaId: item.id })
  if (item.especialistaId) params.set('profissionalId', item.especialistaId)
  else if (item.especialista) params.set('profissional', item.especialista)
  if (item.procedimentoId) params.set('procedimentoId', item.procedimentoId)
  return `/agenda?${params.toString()}`
}

export function normalizeBusca(texto: string) {
  return chave(texto)
}
