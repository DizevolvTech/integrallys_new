'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface ProcedimentoItem {
  id: string
  nome: string
  codigo?: string
  descricao?: string
  valor?: number
  duracaoMin?: number
  temRetorno: boolean
  prazoRetornoDias?: number
  valorRetorno?: number
  temPacote: boolean
  intervaloRecorrenciaDias?: number
  quantidadeSugeridaPacote?: number
  ativo: boolean
  /** Item 24: baixa automática de suprimentos ao pagamento. */
  baixaSuprimentos?: boolean
  suprimentos?: Array<{ suprimentoId: string; nome: string; quantidade: number }>
}

export interface ProcedimentoInput {
  id?: string
  nome: string
  codigo?: string
  descricao?: string
  valor?: number
  duracaoMin?: number
  temRetorno?: boolean
  prazoRetornoDias?: number
  valorRetorno?: number
  temPacote?: boolean
  intervaloRecorrenciaDias?: number
  quantidadeSugeridaPacote?: number
  ativo?: boolean
  baixaSuprimentos?: boolean
  suprimentos?: Array<{ suprimentoId: string; quantidade: number }>
}

export function useProcedimentos() {
  const api = useApi()
  const [data, setData] = useState<ProcedimentoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<ProcedimentoItem>>('/api/procedimentos')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar procedimentos')
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
        const response = await api.get<ApiListResponse<ProcedimentoItem>>('/api/procedimentos')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar procedimentos')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [api])

  const createProcedimento = async (payload: ProcedimentoInput) => {
    const response = await api.post<ApiListResponse<ProcedimentoItem>>('/api/procedimentos', payload)
    setData(response.data)
    return response.data
  }

  const updateProcedimento = async (payload: ProcedimentoInput) => {
    const response = await api.put<ApiListResponse<ProcedimentoItem>>('/api/procedimentos', payload)
    setData(response.data)
    return response.data
  }

  const deleteProcedimento = async (id: string) => {
    const response = await api.delete<ApiListResponse<ProcedimentoItem>>('/api/procedimentos', { id })
    setData(response.data)
    return response.data
  }

  return {
    data,
    isLoading,
    error,
    load,
    createProcedimento,
    updateProcedimento,
    deleteProcedimento,
  }
}
