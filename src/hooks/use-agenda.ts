'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface AgendaItem {
  id: string
  pacienteId?: string
  paciente: string
  profissionalId?: string
  profissional: string
  horario: string
  horarioFim?: string
  status: string
  data?: string
  tipo?: string
  titulo?: string
  local?: string
  participantes?: string
  /** Compromisso pessoal: id do grupo (uma cópia por participante) e profissionais do grupo. */
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
  tipoEncaixe?: string
  foraJanela?: boolean
  motivoEncaixe?: string
}

export interface AgendaInput {
  id?: string
  pacienteId?: string
  profissional?: string
  /** UUID do profissional (item 15a) — preferido pelo backend sobre o nome. */
  profissionalId?: string
  data: string
  horario: string
  horarioFim?: string
  status?: string
  tipo?: string
  titulo?: string
  local?: string
  participantes?: string
  /** Compromisso pessoal: usuários participantes (a agenda de cada um é bloqueada). */
  participanteIds?: string[]
  /** Compromisso pessoal: duração em minutos (alternativa a horarioFim). */
  duracaoMin?: number
  modalidade?: string
  plataformaOnline?: string
  urlOnline?: string
  valorProcedimento?: number
  procedimentoId?: string
  procedimento?: string
  observacoes?: string
  foraJanela?: boolean
  motivoEncaixe?: string
  serieQuantidade?: number
  serieIntervaloDias?: number
  pagamentoInicial?: {
    valor: number
    metodo: string
    bandeira?: string
    parcelas?: number
    contaBancariaId?: string
    observacoes?: string
  }
}

export interface AgendaPagamentoInicial {
  valor: number
  metodo: string
  bandeira?: string
  parcelas?: number
  contaBancariaId?: string
  observacoes?: string
}

interface AgendaListResponse extends ApiListResponse<AgendaItem> {
  meta: {
    podeEmitirRecibo?: boolean
    patients?: Array<{ id: string; nome: string; procedimentoIds?: string[] }>
    professionals?: Array<{ id: string; nome: string; procedimentoIds?: string[] }>
  } & Record<string, unknown>
}

export function useAgenda() {
  const api = useApi()
  const [data, setData] = useState<AgendaItem[]>([])
  const [patients, setPatients] = useState<Array<{ id: string; nome: string; procedimentoIds?: string[] }>>([])
  const [professionals, setProfessionals] = useState<Array<{ id: string; nome: string; procedimentoIds?: string[] }>>([])
  const [podeEmitirRecibo, setPodeEmitirRecibo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyMeta = (meta: AgendaListResponse['meta']) => {
    setPatients(Array.isArray(meta.patients) ? meta.patients.map((item) => ({ id: String(item.id), nome: String(item.nome) })) : [])
    setProfessionals(Array.isArray(meta.professionals) ? meta.professionals.map((item) => ({ id: String(item.id), nome: String(item.nome), procedimentoIds: Array.isArray(item.procedimentoIds) ? item.procedimentoIds.map(String) : [] })) : [])
    setPodeEmitirRecibo(meta.podeEmitirRecibo === true)
  }

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<AgendaListResponse>('/api/agenda')
      setData(response.data)
      applyMeta(response.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agenda')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<AgendaListResponse>('/api/agenda')
        if (!mounted) return
        setData(response.data)
        applyMeta(response.meta)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar agenda')
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [api])

  const createAgendamento = async (payload: AgendaInput) => {
    const response = await api.post<AgendaListResponse>('/api/agenda', payload)
    setData(response.data)
    applyMeta(response.meta)
    return response.data
  }

  const updateAgendamento = async (payload: AgendaInput) => {
    const response = await api.put<AgendaListResponse>('/api/agenda', payload)
    setData(response.data)
    applyMeta(response.meta)
    return response.data
  }

  const deleteAgendamento = async (id: string, reason?: string) => {
    const response = await api.delete<AgendaListResponse>('/api/agenda', { id, reason })
    setData(response.data)
    applyMeta(response.meta)
    return response.data
  }

  return { data, patients, professionals, podeEmitirRecibo, isLoading, error, load, createAgendamento, updateAgendamento, deleteAgendamento }
}
