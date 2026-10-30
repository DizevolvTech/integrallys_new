'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface AgendaBloqueio {
  id: string
  profissionalId: string | null
  unidadeId: string | null
  dataInicio: string
  dataFim: string
  horarioInicio: string | null
  horarioFim: string | null
  diaInteiro: boolean
  tipo: string
  justificativa: string | null
  createdBy: string | null
  createdAt: string
  /** Compromisso pessoal que gerou o bloqueio (some junto com ele). */
  agendamentoId?: string | null
}

export interface AgendaBloqueioInput {
  profissionalId?: string | null
  unidadeId?: string | null
  dataInicio: string
  dataFim: string
  horarioInicio?: string | null
  horarioFim?: string | null
  diaInteiro: boolean
  tipo: string
  justificativa?: string | null
}

interface ListResponse {
  data: AgendaBloqueio[]
}

interface ItemResponse {
  data: AgendaBloqueio
}

export function useAgendaBloqueios(params: { inicio?: string; fim?: string } = {}) {
  const api = useApi()
  const [data, setData] = useState<AgendaBloqueio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const inicio = params.inicio ?? null
  const fim = params.fim ?? null

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const search = new URLSearchParams()
      if (inicio) search.set('inicio', inicio)
      if (fim) search.set('fim', fim)
      const qs = search.toString()
      const res = await api.get<ListResponse>(`/api/agenda/bloqueios${qs ? `?${qs}` : ''}`)
      setData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar bloqueios')
    } finally {
      setIsLoading(false)
    }
  }, [api, inicio, fim])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (payload: AgendaBloqueioInput) => {
      const res = await api.post<ItemResponse>('/api/agenda/bloqueios', payload)
      setData((current) => [...current, res.data])
      return res.data
    },
    [api],
  )

  const remove = useCallback(
    async (id: string) => {
      await api.delete<{ data: { id: string } }>(`/api/agenda/bloqueios?id=${encodeURIComponent(id)}`)
      setData((current) => current.filter((item) => item.id !== id))
    },
    [api],
  )

  return { data, isLoading, error, reload: load, create, remove }
}
