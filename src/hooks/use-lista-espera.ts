'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface ListaEsperaItem {
  id: string
  pacienteId?: string
  paciente: string
  prioridade: string
  especialistaId?: string
  especialista?: string
  procedimentoId?: string
  procedimento?: string
  procedimentoValor?: number
  preferenciaHorario?: string
  entradaEm: string
  observacoes?: string
}

export interface ListaEsperaInput {
  id?: string
  pacienteId: string
  prioridade: string
  especialistaId?: string
  especialista?: string
  procedimentoId?: string
  procedimento?: string
  preferenciaHorario?: string
  observacoes?: string
}

export interface EspecialistaOption {
  id: string
  nome: string
  procedimentoIds: string[]
}

export interface ProcedimentoOption {
  id: string
  nome: string
  valor: number | null
}

interface ListaEsperaMeta {
  specialists?: unknown
  procedures?: unknown
  especialistasOptions?: unknown
  procedimentosOptions?: unknown
}

function parseEspecialistasOptions(value: unknown): EspecialistaOption[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = record.id ? String(record.id) : ''
      const nome = record.nome ? String(record.nome) : ''
      if (!id || !nome) return null
      const procedimentoIds = Array.isArray(record.procedimentoIds)
        ? record.procedimentoIds.map(String).filter(Boolean)
        : []
      return { id, nome, procedimentoIds }
    })
    .filter((item): item is EspecialistaOption => item !== null)
}

function parseProcedimentosOptions(value: unknown): ProcedimentoOption[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = record.id ? String(record.id) : ''
      const nome = record.nome ? String(record.nome) : ''
      if (!id || !nome) return null
      const valor = record.valor != null ? Number(record.valor) : null
      return { id, nome, valor: Number.isFinite(valor) ? valor : null }
    })
    .filter((item): item is ProcedimentoOption => item !== null)
}

export function useListaEspera() {
  const api = useApi()
  const [data, setData] = useState<ListaEsperaItem[]>([])
  const [specialists, setSpecialists] = useState<string[]>([])
  const [procedures, setProcedures] = useState<string[]>([])
  const [especialistasOptions, setEspecialistasOptions] = useState<EspecialistaOption[]>([])
  const [procedimentosOptions, setProcedimentosOptions] = useState<ProcedimentoOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyResponseMeta = (meta: ListaEsperaMeta) => {
    setSpecialists(Array.isArray(meta.specialists) ? meta.specialists.map(String) : [])
    setProcedures(Array.isArray(meta.procedures) ? meta.procedures.map(String) : [])
    setEspecialistasOptions(parseEspecialistasOptions(meta.especialistasOptions))
    setProcedimentosOptions(parseProcedimentosOptions(meta.procedimentosOptions))
  }

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<ListaEsperaItem>>('/api/lista-espera')
      setData(response.data)
      applyResponseMeta(response.meta as ListaEsperaMeta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lista de espera')
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
        const response = await api.get<ApiListResponse<ListaEsperaItem>>('/api/lista-espera')
        if (!mounted) return
        setData(response.data)
        const meta = response.meta as ListaEsperaMeta
        setSpecialists(Array.isArray(meta.specialists) ? meta.specialists.map(String) : [])
        setProcedures(Array.isArray(meta.procedures) ? meta.procedures.map(String) : [])
        setEspecialistasOptions(parseEspecialistasOptions(meta.especialistasOptions))
        setProcedimentosOptions(parseProcedimentosOptions(meta.procedimentosOptions))
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar lista de espera')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [api])

  const createItem = async (payload: ListaEsperaInput) => {
    const response = await api.post<ApiListResponse<ListaEsperaItem>>('/api/lista-espera', payload)
    setData(response.data)
    applyResponseMeta(response.meta as ListaEsperaMeta)
    return response.data
  }

  const updateItem = async (payload: ListaEsperaInput) => {
    const response = await api.put<ApiListResponse<ListaEsperaItem>>('/api/lista-espera', payload)
    setData(response.data)
    applyResponseMeta(response.meta as ListaEsperaMeta)
    return response.data
  }

  const deleteItem = async (id: string) => {
    const response = await api.delete<ApiListResponse<ListaEsperaItem>>('/api/lista-espera', { id })
    setData(response.data)
    applyResponseMeta(response.meta as ListaEsperaMeta)
    return response.data
  }

  return {
    data,
    specialists,
    procedures,
    especialistasOptions,
    procedimentosOptions,
    isLoading,
    error,
    load,
    createItem,
    updateItem,
    deleteItem,
  }
}
