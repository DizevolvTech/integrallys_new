'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'
import type { TarefaRecorrencia } from '@/lib/tarefa-recorrencia'

export interface TarefaItem {
  id: string
  titulo: string
  descricao: string
  responsavel: string
  responsavelId: string
  status: string
  recorrencia: TarefaRecorrencia | string
  diasSemana: number[]
  alerta: boolean
  prioridade: string
  categoria: string
  vencimentoEm: string
  data: string
  horario: string
  subtarefas: Array<{ id: string; titulo: string; concluida: boolean }>
}

export interface CreateTarefaPayload {
  titulo: string
  descricao?: string
  responsavelId?: string
  responsavelNome?: string
  status?: string
  vencimentoEm?: string
  data?: string
  horario?: string
  recorrencia?: TarefaRecorrencia | string
  diasSemana?: number[]
  alerta?: boolean
  prioridade?: string
  categoria?: string
}

export function useTarefas() {
  const api = useApi()
  const [data, setData] = useState<TarefaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<TarefaItem>>('/api/tarefas')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<ApiListResponse<TarefaItem>>('/api/tarefas')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [api])

  const createTarefa = async (payload: CreateTarefaPayload) => {
    const response = await api.post<ApiListResponse<TarefaItem>>('/api/tarefas', payload)
    setData(response.data)
    return response.data
  }

  const updateTarefa = async (payload: CreateTarefaPayload & { id: string }) => {
    const response = await api.put<ApiListResponse<TarefaItem>>('/api/tarefas', payload)
    setData(response.data)
    return response.data
  }

  const deleteTarefa = async (id: string) => {
    const response = await api.delete<ApiListResponse<TarefaItem>>('/api/tarefas', { id })
    setData(response.data)
    return response.data
  }

  const addSubtarefa = async (tarefaId: string, titulo: string) => {
    await api.post('/api/tarefas/subtarefas', { tarefaId, titulo })
    await load()
  }

  const toggleSubtarefa = async (id: string, concluida: boolean) => {
    await api.put('/api/tarefas/subtarefas', { id, concluida })
    await load()
  }

  const removeSubtarefa = async (id: string) => {
    await api.delete('/api/tarefas/subtarefas', { id })
    await load()
  }

  return {
    data,
    isLoading,
    error,
    load,
    createTarefa,
    updateTarefa,
    deleteTarefa,
    addSubtarefa,
    toggleSubtarefa,
    removeSubtarefa,
  }
}
