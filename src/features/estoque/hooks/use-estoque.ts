'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface EstoqueItem {
  id: string
  produto: string
  categoria: string
  sku?: string
  quantidade: number
  estoqueMinimo: number
  lote?: string
  validade?: string
  precoCusto?: number
  precoVenda?: number
  unidadeMedida?: string
  status: string
}

export interface EstoqueInput {
  id?: string
  produto: string
  categoria: string
  sku?: string | null
  quantidade: number
  estoqueMinimo?: number | null
  lote?: string | null
  validade?: string | null
  precoCusto?: number | null
  precoVenda?: number | null
  unidadeMedida?: string | null
  status?: string
}

export interface MovimentacaoEstoqueInput {
  produtoId: string
  quantidade: number
  observacoes?: string
  vinculoTipo?: 'cliente' | 'especialista' | 'fornecedor' | null
  vinculoId?: string | null
  vinculoNome?: string | null
  tipoMovimentacao?: 'saida' | 'consumo_interno'
  numeroNf?: string
  cnpjEmitente?: string
  force?: boolean
}

export interface MovimentacaoItem {
  id: string
  produtoId: string
  produtoNome: string
  operadorNome: string
  tipo: 'entrada' | 'saida'
  tipoMovimentacao: string
  quantidade: number
  observacoes: string | null
  vinculoTipo: string | null
  vinculoNome: string | null
  criadoEm: string
  estornada: boolean
}

export interface MovimentacaoFiltros {
  tipo?: string
  produtoId?: string
  de?: string
  ate?: string
  limit?: number
  offset?: number
}

interface MovimentacoesResponse {
  data: MovimentacaoItem[]
  meta: { total: number; limit: number; offset: number }
}

export function useEstoque() {
  const api = useApi()
  const [data, setData] = useState<EstoqueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoItem[]>([])
  const [movimentacoesTotal, setMovimentacoesTotal] = useState(0)
  const [isLoadingMovimentacoes, setIsLoadingMovimentacoes] = useState(false)
  const [movimentacoesError, setMovimentacoesError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ApiListResponse<EstoqueItem>>('/api/estoque')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar estoque')
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
        const response = await api.get<ApiListResponse<EstoqueItem>>('/api/estoque')
        if (!mounted) return
        setData(response.data)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar estoque')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [api])

  const createProduto = async (payload: EstoqueInput) => {
    const response = await api.post<ApiListResponse<EstoqueItem>>('/api/estoque', payload)
    setData(response.data)
    return response.data
  }

  const updateProduto = async (payload: EstoqueInput) => {
    const response = await api.put<ApiListResponse<EstoqueItem>>('/api/estoque', payload)
    setData(response.data)
    return response.data
  }

  const deleteProduto = async (id: string) => {
    const response = await api.delete<ApiListResponse<EstoqueItem>>('/api/estoque', { id })
    setData(response.data)
    return response.data
  }

  const registrarEntrada = async (payload: MovimentacaoEstoqueInput) => {
    const response = await api.post<ApiListResponse<EstoqueItem>>('/api/estoque', { action: 'entrada', ...payload })
    setData(response.data)
    return response.data
  }

  const registrarSaida = async (payload: MovimentacaoEstoqueInput) => {
    const response = await api.post<ApiListResponse<EstoqueItem>>('/api/estoque', { action: 'saida', ...payload })
    setData(response.data)
    return response.data
  }

  const estornarMovimentacao = async (movimentacaoId: string, motivo: string) => {
    const response = await api.post<ApiListResponse<EstoqueItem>>('/api/estoque', {
      action: 'estornar',
      movimentacaoId,
      motivo,
    })
    setData(response.data)
    return response.data
  }

  const registrarAjuste = async (payload: {
    produtoId: string
    quantidade: number
    justificativa: string
  }) => {
    const response = await api.post<ApiListResponse<EstoqueItem>>('/api/estoque', {
      action: 'ajuste',
      ...payload,
    })
    setData(response.data)
    return response.data
  }

  const loadMovimentacoes = useCallback(
    async (filtros?: MovimentacaoFiltros) => {
      setIsLoadingMovimentacoes(true)
      setMovimentacoesError(null)
      try {
        const params = new URLSearchParams({ view: 'movimentacoes' })
        if (filtros?.tipo) params.set('tipo', filtros.tipo)
        if (filtros?.produtoId) params.set('produto_id', filtros.produtoId)
        if (filtros?.de) params.set('de', filtros.de)
        if (filtros?.ate) params.set('ate', filtros.ate)
        if (filtros?.limit != null) params.set('limit', String(filtros.limit))
        if (filtros?.offset != null) params.set('offset', String(filtros.offset))
        const response = await api.get<MovimentacoesResponse>(`/api/estoque?${params.toString()}`)
        setMovimentacoes(response.data)
        setMovimentacoesTotal(response.meta?.total ?? 0)
        return response.data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar movimentações'
        setMovimentacoesError(message)
        throw err
      } finally {
        setIsLoadingMovimentacoes(false)
      }
    },
    [api],
  )

  return {
    data,
    isLoading,
    error,
    load,
    createProduto,
    updateProduto,
    deleteProduto,
    registrarEntrada,
    registrarSaida,
    movimentacoes,
    movimentacoesTotal,
    isLoadingMovimentacoes,
    movimentacoesError,
    loadMovimentacoes,
    estornarMovimentacao,
    registrarAjuste,
  }
}
