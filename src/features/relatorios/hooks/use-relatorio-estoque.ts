'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface CurvaAbcRow {
  produtoId: string
  produtoNome: string
  categoria: string
  quantidadeSaida: number
  valorConsumido: number
  percentualAcumulado: number
  classe: 'A' | 'B' | 'C'
  taxaGiro: number
  estoqueAtual: number
  valorEstoque: number
}

export interface CurvaAbcResponse {
  curvaAbc: CurvaAbcRow[]
  semMovimentacao: Array<{ produtoId: string; produtoNome: string; diasSemMovimento: number }>
  valorTotalEstoque: number
  diasAnalisados: number
}

const INITIAL_CURVA_ABC: CurvaAbcResponse = {
  curvaAbc: [],
  semMovimentacao: [],
  valorTotalEstoque: 0,
  diasAnalisados: 90,
}

export function useCurvaAbc(dias: number, ativo = true) {
  const api = useApi()
  const [data, setData] = useState<CurvaAbcResponse>(INITIAL_CURVA_ABC)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!ativo) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: 'curva-abc', dias: String(dias) })
      const res = await api.get<CurvaAbcResponse>(`/api/relatorios/estoque?${params.toString()}`)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar curva ABC')
    } finally {
      setIsLoading(false)
    }
  }, [api, dias, ativo])

  useEffect(() => {
    void load()
  }, [load])

  return { data, isLoading, error, reload: load }
}

export type GrupoValidade = 'vencidos' | 'ate_60' | 'acima_60' | 'sem_validade'

export interface ItemValidade {
  id: string
  produto: string
  lote: string
  validade: string | null
  quantidade: number
}

export interface ValidadeResponse {
  grupos: Partial<Record<GrupoValidade, { total: number; itens: ItemValidade[] }>>
}

/** Resumo de validade do estoque com os mesmos filtros (unidade, busca e categoria) da tabela. */
export function useValidadeEstoque(filtros: { unidade_id?: string; q?: string; categoria?: string }) {
  const api = useApi()
  const [data, setData] = useState<ValidadeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chave = JSON.stringify(filtros)

  useEffect(() => {
    let atual = true
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ view: 'validade' })
        for (const [k, v] of Object.entries(JSON.parse(chave) as Record<string, string>)) {
          if (v && v !== 'todos') params.set(k, v)
        }
        const res = await api.get<ValidadeResponse>(`/api/relatorios/estoque?${params.toString()}`)
        if (!atual) return
        setData(res)
        setError(null)
      } catch (err) {
        if (atual) setError(err instanceof Error ? err.message : 'Erro ao carregar a validade do estoque')
      }
    }, 350)
    return () => {
      atual = false
      clearTimeout(timer)
    }
  }, [api, chave])

  return { data, error }
}
