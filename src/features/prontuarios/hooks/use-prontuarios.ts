'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'
import type { ProntuarioDetalhe } from '@/lib/domain-mappers'

export interface ProntuarioItem {
  id: string
  pacienteId?: string
  paciente: string
  data: string
  tipo: string
  status: string
  detalhe?: ProntuarioDetalhe
}

export interface NovoProntuarioInput {
  id?: string
  pacienteId: string
  data: string
  tipo: string
  status: string
}

export function useProntuarios() {
  const api = useApi()
  const [data, setData] = useState<ProntuarioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<ApiListResponse<ProntuarioItem>>('/api/prontuarios')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar prontuarios')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [api])

  const createProntuario = async (payload: NovoProntuarioInput) => {
    const response = await api.post<ApiListResponse<ProntuarioItem>>('/api/prontuarios', payload)
    setData(response.data)
    return response.data
  }

  const updateProntuario = async (payload: NovoProntuarioInput) => {
    const response = await api.put<ApiListResponse<ProntuarioItem>>('/api/prontuarios', payload)
    setData(response.data)
    return response.data
  }

  const deleteProntuario = async (id: string) => {
    const response = await api.delete<ApiListResponse<ProntuarioItem>>('/api/prontuarios', { id })
    setData(response.data)
    return response.data
  }

  return { data, isLoading, error, createProntuario, updateProntuario, deleteProntuario }
}
