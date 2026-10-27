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

export function useCurvaAbc(dias: number) {
  const api = useApi()
  const [data, setData] = useState<CurvaAbcResponse>(INITIAL_CURVA_ABC)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
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
  }, [api, dias])

  useEffect(() => {
    void load()
  }, [load])

  return { data, isLoading, error, reload: load }
}
