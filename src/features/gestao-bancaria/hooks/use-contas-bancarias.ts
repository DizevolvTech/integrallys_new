'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { isForbiddenError } from '@/lib/api-client'

export type ContaTipo = 'corrente' | 'poupanca' | 'investimento' | 'dinheiro'

export interface ContaBancaria {
  id: string
  unidadeId: string | null
  nome: string
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo: ContaTipo
  saldoInicial: number
  saldoAtual: number
  saldoConciliado: number
  movimentosTotal: number
  movimentosConciliados: number
  ativo: boolean
  createdAt: string
}

export interface ContaBancariaInput {
  nome: string
  banco?: string
  bancoId?: string
  agencia?: string
  conta?: string
  tipo: ContaTipo
  saldoInicial: number
}

interface ListResponse {
  data: ContaBancaria[]
}

interface ItemResponse {
  data: ContaBancaria
}

export function useContasBancarias() {
  const api = useApi()
  const [data, setData] = useState<ContaBancaria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 403 do requirePermission: a view mostra "acesso negado" em vez do estado de
  // lista vazia. Fica separado de `error` para não renderizar os dois juntos.
  const [accessDenied, setAccessDenied] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setAccessDenied(false)
    try {
      const res = await api.get<ListResponse>('/api/gestao-bancaria')
      setData(res.data)
    } catch (err) {
      if (isForbiddenError(err)) {
        setAccessDenied(true)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao carregar contas bancárias')
      }
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (payload: ContaBancariaInput) => {
      const res = await api.post<ItemResponse>('/api/gestao-bancaria', payload)
      setData((current) => [
        ...current,
        {
          ...res.data,
          saldoAtual: res.data.saldoInicial,
          saldoConciliado: res.data.saldoInicial,
          movimentosTotal: 0,
          movimentosConciliados: 0,
        },
      ])
      await load()
      return res.data
    },
    [api, load],
  )

  return { data, isLoading, error, accessDenied, reload: load, create }
}
