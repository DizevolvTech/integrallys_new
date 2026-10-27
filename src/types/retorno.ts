import type { SituacaoRetorno } from '@/lib/retorno-prazo'

export interface RetornoItem {
  id: string
  pacienteId: string
  paciente: string
  /** Data do atendimento que originou o retorno (DD/MM/AAAA). */
  data: string
  ultimosProcedimentos: Array<{ data: string; nome: string }>
  especialistaId: string | null
  especialista: string
  /** DD/MM/AAAA ou vazio quando não há prazo definido. */
  dataPrevista: string
  prazo: string
  situacao: SituacaoRetorno
  origem: 'atendimento' | 'prescricao'
}

export interface RetornosContagem {
  no_prazo: number
  limite: number
  vencido: number
}

export interface RetornosListaMeta {
  total: number
  page: number
  pageSize: number
  contagem: RetornosContagem
}
