'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface AnamneseItem {
  id: string
  pacienteId?: string
  paciente: string
  data: string
  tipo: string
  queixa: string
  imc?: number
  peso?: number
  gordura?: number
  altura?: number
  massaMuscular?: number
  gorduraVisceral?: number
  massaOssea?: number
  aguaCorporal?: number
  camposExtras?: Record<string, unknown>
}

export interface NovaAnamneseInput {
  id?: string
  pacienteId: string
  data: string
  tipo: string
  queixa: string
  imc?: number
  peso?: number
  gordura?: number
  altura?: number
  massaMuscular?: number
  gorduraVisceral?: number
  massaOssea?: number
  aguaCorporal?: number
  camposExtras?: Record<string, unknown>
}

export function useAnamnese() {
  const api = useApi()
  const [data, setData] = useState<AnamneseItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<AnamneseItem>>('/api/anamnese')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar anamnese')
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
        const response = await api.get<ApiListResponse<AnamneseItem>>('/api/anamnese')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar anamnese')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [api])

  const createAnamnese = async (payload: NovaAnamneseInput) => {
    const response = await api.post<ApiListResponse<AnamneseItem>>('/api/anamnese', payload)
    setData(response.data)
    return response.data
  }

  const updateAnamnese = async (payload: NovaAnamneseInput) => {
    const response = await api.put<ApiListResponse<AnamneseItem>>('/api/anamnese', payload)
    setData(response.data)
    return response.data
  }

  const deleteAnamnese = async (id: string) => {
    const response = await api.delete<ApiListResponse<AnamneseItem>>('/api/anamnese', { id })
    setData(response.data)
    return response.data
  }

  return { data, isLoading, error, load, createAnamnese, updateAnamnese, deleteAnamnese }
}
