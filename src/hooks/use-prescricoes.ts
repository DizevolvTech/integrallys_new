'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export type DescontoTipo = 'value' | 'percent'

export interface PrescricaoItemLine {
  productId?: string
  productName: string
  quantity: number
  posology?: string
  unitPrice: number
  total: number
  /** Só gestor/admin/master: a API omite estes campos para os demais perfis. */
  custoUnitario?: number
  custoTotal?: number
  margem?: number
  margemPercentual?: number
}

export interface PrescricaoItemInput {
  productId?: string
  descricao: string
  quantidade: number
  valorUnitario?: number
  posologia?: string
}

export interface PrescricaoItem {
  id: string
  pacienteId?: string
  numero: string
  paciente: string
  valorTotal: number
  valorBruto?: number
  numeroParcelas?: number
  valorParcela?: number
  descontoTipo?: DescontoTipo
  descontoPercentual?: number
  descontoValor?: number
  justificativaDesconto?: string
  vendedorId?: string
  status: string
  data?: string
  tipo?: string
  validade?: string
  observacoes?: string
  items?: PrescricaoItemLine[]
  /**
   * CR-SEC-01 (2.2): `true` quando a API ocultou os valores monetários para o
   * perfil atual (especialista). Nesse caso `valorTotal` vem `0` e os demais
   * campos de valor vêm `undefined` — não exibir bloco de preço.
   */
  valoresOcultos?: boolean
  /** Só gestor/admin/master (decidido no servidor). */
  custoTotal?: number
  margemTotal?: number
  margemPercentual?: number
}

export interface PrescricaoInput {
  id?: string
  pacienteId: string
  numero?: string
  valorTotal: number
  valorBruto?: number
  numeroParcelas?: number
  valorParcela?: number
  descontoTipo?: DescontoTipo
  descontoPercentual?: number
  descontoValor?: number
  justificativaDesconto?: string
  vendedorId?: string
  status: string
  tipo?: string
  evolucaoId?: string
  data?: string
  validade?: string
  observacoes?: string
  formaPagamento?: string
  unidadeId?: string
  items?: PrescricaoItemInput[]
  assinaturaBase64?: string
}

export function usePrescricoes() {
  const api = useApi()
  const [data, setData] = useState<PrescricaoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<PrescricaoItem>>('/api/prescricoes')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar prescricoes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<ApiListResponse<PrescricaoItem>>('/api/prescricoes')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar prescricoes')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [api])

  const createPrescricao = async (payload: PrescricaoInput) => {
    const response = await api.post<ApiListResponse<PrescricaoItem>>('/api/prescricoes', payload)
    setData(response.data)
    return response.data
  }

  const updatePrescricao = async (payload: PrescricaoInput) => {
    const response = await api.put<ApiListResponse<PrescricaoItem>>('/api/prescricoes', payload)
    setData(response.data)
    return response.data
  }

  const deletePrescricao = async (id: string) => {
    const response = await api.delete<ApiListResponse<PrescricaoItem>>('/api/prescricoes', { id })
    setData(response.data)
    return response.data
  }

  return { data, isLoading, error, load, createPrescricao, updatePrescricao, deletePrescricao }
}
