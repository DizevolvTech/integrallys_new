// Janelas de resumo dos cards do início do especialista (cartão 1073, vídeo c09).
// Funções puras: filtro de cada card, colunas e formatação das linhas.

export type ResumoCard =
  | 'consultas'
  | 'pendentes'
  | 'concluidas'
  | 'realizados'
  | 'faltas'
  | 'cancelamentos'
  | 'retornos'
  | 'receita'
  | 'prescricoes'

export interface ResumoColuna {
  key: string
  label: string
  align?: 'right'
}

export type ResumoLinha = { id: string } & Record<string, string>

export interface ResumoDefinicao {
  titulo: string
  vazio: string
  periodo: 'hoje' | 'mes'
  colunas: ResumoColuna[]
}

const C = {
  cliente: { key: 'cliente', label: 'Cliente' },
  data: { key: 'data', label: 'Data' },
  horario: { key: 'horario', label: 'Horário' },
  procedimento: { key: 'procedimento', label: 'Procedimento' },
  especialista: { key: 'especialista', label: 'Especialista' },
  tempo: { key: 'tempo', label: 'Tempo em atendimento' },
  valor: { key: 'valor', label: 'Valor', align: 'right' as const },
}

export const RESUMO_CARDS: Record<ResumoCard, ResumoDefinicao> = {
  consultas: { titulo: 'Consultas de hoje', vazio: 'Nenhuma consulta hoje.', periodo: 'hoje', colunas: [C.cliente, C.horario, C.procedimento] },
  pendentes: { titulo: 'Pendentes', vazio: 'Ninguém aguardando agora.', periodo: 'hoje', colunas: [C.cliente, C.horario, C.procedimento] },
  concluidas: { titulo: 'Concluídas hoje', vazio: 'Nenhum atendimento concluído hoje.', periodo: 'hoje', colunas: [C.cliente, C.data, C.horario, C.procedimento, C.especialista, C.tempo] },
  realizados: { titulo: 'Atendimentos realizados', vazio: 'Nenhum atendimento realizado no período.', periodo: 'mes', colunas: [C.cliente, C.data, C.horario, C.especialista, C.procedimento, C.valor, C.tempo] },
  faltas: { titulo: 'Faltas', vazio: 'Nenhuma falta no período.', periodo: 'mes', colunas: [C.cliente, C.data, C.horario, { key: 'justificativa', label: 'Justificativa' }] },
  cancelamentos: { titulo: 'Cancelamentos', vazio: 'Nenhum cancelamento no período.', periodo: 'mes', colunas: [C.cliente, C.data, C.horario, { key: 'justificativa', label: 'Justificativa' }] },
  retornos: { titulo: 'Retornos', vazio: 'Nenhum retorno agendado no período.', periodo: 'mes', colunas: [C.cliente, C.data, C.horario, C.procedimento, C.especialista, C.tempo] },
  receita: { titulo: 'Receita gerada', vazio: 'Nenhuma receita no período.', periodo: 'mes', colunas: [C.cliente, C.procedimento, C.data, C.horario, C.especialista, C.valor] },
  prescricoes: { titulo: 'Prescrições convertidas', vazio: 'Nenhuma prescrição virou venda no período.', periodo: 'mes', colunas: [C.cliente, C.data, { ...C.valor, label: 'Valor total' }] },
}

export function ehResumoCard(valor: string | null): valor is ResumoCard {
  return valor !== null && Object.prototype.hasOwnProperty.call(RESUMO_CARDS, valor)
}

/** Status que cada card lê em `agendamentos` (null = qualquer atendimento marcado). */
export const STATUS_DO_CARD: Partial<Record<ResumoCard, string[]>> = {
  pendentes: ['Check-in'],
  concluidas: ['Check-out', 'Concluído'],
  realizados: ['Check-out', 'Concluído'],
  receita: ['Check-out', 'Concluído'],
  faltas: ['Faltou'],
  cancelamentos: ['Cancelado'],
}

/** Retornos agendados: tudo que é atendimento marcado de verdade (mesma regra de `agendamentoConta`). */
export const STATUS_SEM_ATENDIMENTO = ['Cancelado', 'Faltou', 'Bloqueado', 'Adiado', 'Disponível']

export function periodoDoMes(todayIso: string): { de: string; ate: string } {
  const ultimo = new Date(Date.UTC(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)), 0)).getUTCDate()
  return { de: `${todayIso.slice(0, 7)}-01`, ate: `${todayIso.slice(0, 8)}${String(ultimo).padStart(2, '0')}` }
}

export const VAZIO = '—'

export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : VAZIO)
export const horaCurta = (hora: string | null | undefined) => (hora ? hora.slice(0, 5) : VAZIO)
export const brl = (valor: number | string | null | undefined) =>
  Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Tempo entre o início e o fim do atendimento; '—' para atendimento antigo, sem início ou fim registrado. */
export function formatarTempoAtendimento(inicio: string | null | undefined, fim: string | null | undefined): string {
  if (!inicio || !fim) return VAZIO
  const ms = new Date(fim).getTime() - new Date(inicio).getTime()
  if (!Number.isFinite(ms) || ms < 0) return VAZIO
  const min = Math.round(ms / 60000)
  if (min < 1) return '< 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

/** Justificativa de falta/cancelamento: o motivo digitado na agenda fica em `observacoes` ("Cancelado: motivo"). */
export function extrairJustificativa(observacoes: string | null | undefined): string {
  const texto = String(observacoes ?? '').replace(/^\s*cancelado\s*:?\s*/i, '').trim()
  return texto || VAZIO
}

export interface AgendamentoResumoRow {
  id: string
  data_agendamento: string
  horario_inicio: string | null
  tipo: string | null
  observacoes: string | null
  valor_procedimento: number | string | null
  atendimento_inicio_em: string | null
  atendimento_fim_em: string | null
  paciente_id: string | null
  procedimento_id: string | null
}

export interface NomesResumo {
  pacientes: Record<string, string>
  procedimentos: Record<string, string>
  especialista: string
}

const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function montarLinhaAgendamento(row: AgendamentoResumoRow, nomes: NomesResumo): ResumoLinha {
  const procedimento =
    (row.procedimento_id && nomes.procedimentos[row.procedimento_id]) || capitalizar(String(row.tipo ?? '').trim()) || 'Consulta'
  return {
    id: row.id,
    cliente: (row.paciente_id && nomes.pacientes[row.paciente_id]) || 'Paciente',
    data: dataBr(row.data_agendamento),
    horario: horaCurta(row.horario_inicio),
    procedimento,
    especialista: nomes.especialista,
    valor: brl(row.valor_procedimento),
    tempo: formatarTempoAtendimento(row.atendimento_inicio_em, row.atendimento_fim_em),
    justificativa: extrairJustificativa(row.observacoes),
  }
}

export interface PrescricaoResumoRow {
  id: string
  paciente_id: string | null
  data_prescricao: string | null
  valor_total: number | string | null
}

export function montarLinhaPrescricao(row: PrescricaoResumoRow, nomes: NomesResumo): ResumoLinha {
  return {
    id: `presc-${row.id}`,
    cliente: (row.paciente_id && nomes.pacientes[row.paciente_id]) || 'Paciente',
    data: dataBr(row.data_prescricao),
    horario: VAZIO,
    procedimento: 'Prescrição convertida em venda',
    especialista: nomes.especialista,
    valor: brl(row.valor_total),
    tempo: VAZIO,
    justificativa: VAZIO,
  }
}
