'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { SuprimentoItem } from '@/lib/suprimentos'
import type { ApiListResponse } from '@/types/api'

export type { SuprimentoItem }

export interface SuprimentoInput {
  id?: string
  nome: string
  categoria?: string
  sku?: string
  quantidade?: number
  estoqueMinimo?: number
  lote?: string
  validade?: string
  precoCusto?: number
  unidadeMedida?: string
}

export interface MovimentoSuprimentoInput {
  action: 'entrada' | 'saida' | 'ajuste'
  suprimentoId: string
  quantidade: number
  motivo?: string
  lote?: string
  validade?: string
  precoCusto?: number
}

export interface ControleSuprimentos {
  resumo: Array<{
    suprimentoId: string
    nome: string
    quantidade: number
    estoqueMinimo: number
    validade?: string
    abaixoMinimo: boolean
    vencendo: boolean
    vencido: boolean
    entradas: number
    saidas: number
    consumoProcedimentos: number
    custoConsumo: number
  }>
  totais: { entradas: number; saidas: number; baixasProcedimento: number; custoConsumido: number; abaixoMinimo: number; vencendo: number; truncado: boolean }
  movimentos: Array<{
    id: string
    suprimento: string
    tipo: string
    origem: string
    quantidade: number
    saldoApos: number
    motivo: string | null
    criadoEm: string
    operador: string | null
    automatico: boolean
  }>
  total: number
}

export function useSuprimentos() {
  const api = useApi()
  const [data, setData] = useState<SuprimentoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    api
      .get<ApiListResponse<SuprimentoItem>>('/api/suprimentos')
      .then((res) => ativo && setData(res.data))
      .catch((err) => ativo && setError(err instanceof Error ? err.message : 'Erro ao carregar suprimentos'))
      .finally(() => ativo && setIsLoading(false))
    return () => {
      ativo = false
    }
  }, [api])

  const salvar = async (payload: SuprimentoInput) => {
    const res = payload.id
      ? await api.put<ApiListResponse<SuprimentoItem>>('/api/suprimentos', payload)
      : await api.post<ApiListResponse<SuprimentoItem>>('/api/suprimentos', payload)
    setData(res.data)
  }
  const movimentar = async (payload: MovimentoSuprimentoInput) => {
    const res = await api.post<ApiListResponse<SuprimentoItem>>('/api/suprimentos', payload)
    setData(res.data)
  }
  const excluir = async (id: string) => {
    const res = await api.delete<ApiListResponse<SuprimentoItem>>('/api/suprimentos', { id })
    setData(res.data)
  }
  return { data, isLoading, error, salvar, movimentar, excluir }
}

export interface FiltrosControle {
  de?: string
  ate?: string
  suprimentoId?: string
  origem?: string
  limit: number
  offset: number
}

export function useControleSuprimentos(filtros: FiltrosControle) {
  const api = useApi()
  const [data, setData] = useState<ControleSuprimentos | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { de, ate, suprimentoId, origem, limit, offset } = filtros

  const carregar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      if (de) q.set('de', de)
      if (ate) q.set('ate', ate)
      if (suprimentoId) q.set('suprimentoId', suprimentoId)
      if (origem) q.set('origem', origem)
      const res = await api.get<{ data: ControleSuprimentos }>(`/api/suprimentos/relatorio?${q}`)
      setData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o relatório')
    } finally {
      setIsLoading(false)
    }
  }, [api, de, ate, suprimentoId, origem, limit, offset])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return { data, isLoading, error, recarregar: carregar }
}
