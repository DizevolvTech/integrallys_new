'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface CaixaItem {
  id: string
  descricao: string
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  dia?: string
  hora?: string
  forma?: string
  operador?: string
  sessaoId?: string
  bandeira?: string | null
  parcelas?: number | null
  valorParcela?: number | null
  formaPagamentoId?: string
}

export interface CaixaSessionState {
  sessionId: string | null
  isOpen: boolean
  saldoInicial: number
  saldoAtual: number
  entradas: number
  saidas: number
  movimentos: number
}

interface CaixaMetaResponse extends Record<string, unknown> {
  caixa?: {
    sessionId?: string | null
    isOpen?: boolean
    saldoInicial?: number
    saldoAtual?: number
    entradas?: number
    saidas?: number
    movimentos?: number
  }
}

interface CaixaResponse extends ApiListResponse<CaixaItem> {
  meta: CaixaMetaResponse
}

export interface OpenCaixaPayload {
  saldoInicial: number
  observacoes?: string
  unidadeId?: string
}

export interface CaixaMovimentacaoPayload {
  id?: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  forma?: string
  unidadeId?: string
  bandeira?: string | null
  parcelas?: number | null
  valorParcela?: number | null
}

export interface CloseCaixaPayload {
  valorTransferido?: number
  observacoes?: string
  unidadeId?: string
  resumo?: Record<string, unknown>
}

export function useCaixa() {
  const api = useApi()
  const [data, setData] = useState<CaixaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CaixaSessionState>({
    sessionId: null,
    isOpen: false,
    saldoInicial: 0,
    saldoAtual: 0,
    entradas: 0,
    saidas: 0,
    movimentos: 0,
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<CaixaResponse>('/api/caixa')
        if (!mounted) return
        setData(response.data)
        setSession({
          sessionId: response.meta.caixa?.sessionId ?? null,
          isOpen: response.meta.caixa?.isOpen ?? false,
          saldoInicial: response.meta.caixa?.saldoInicial ?? 0,
          saldoAtual: response.meta.caixa?.saldoAtual ?? 0,
          entradas: response.meta.caixa?.entradas ?? 0,
          saidas: response.meta.caixa?.saidas ?? 0,
          movimentos: response.meta.caixa?.movimentos ?? 0,
        })
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar caixa')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [api])

  const updateFromResponse = (response: CaixaResponse) => {
    setData(response.data)
    setSession({
      sessionId: response.meta.caixa?.sessionId ?? null,
      isOpen: response.meta.caixa?.isOpen ?? false,
      saldoInicial: response.meta.caixa?.saldoInicial ?? 0,
      saldoAtual: response.meta.caixa?.saldoAtual ?? 0,
      entradas: response.meta.caixa?.entradas ?? 0,
      saidas: response.meta.caixa?.saidas ?? 0,
      movimentos: response.meta.caixa?.movimentos ?? 0,
    })
  }

  const openCaixa = async (payload: OpenCaixaPayload) => {
    const response = await api.post<CaixaResponse>('/api/caixa', { action: 'open', ...payload })
    updateFromResponse(response)
  }

  const addMovimentacao = async (payload: CaixaMovimentacaoPayload) => {
    const response = await api.post<CaixaResponse>('/api/caixa', { action: payload.tipo, ...payload })
    updateFromResponse(response)
  }

  const closeCaixa = async (payload: CloseCaixaPayload = {}) => {
    const response = await api.post<CaixaResponse>('/api/caixa', { action: 'close', ...payload })
    updateFromResponse(response)
  }

  const updateMovimentacao = async (payload: CaixaMovimentacaoPayload) => {
    const response = await api.put<CaixaResponse>('/api/caixa', payload)
    updateFromResponse(response)
  }

  const deleteMovimentacao = async (id: string) => {
    const response = await api.delete<CaixaResponse>('/api/caixa', { id })
    updateFromResponse(response)
  }

  return { data, isLoading, error, session, openCaixa, addMovimentacao, closeCaixa, updateMovimentacao, deleteMovimentacao }
}
