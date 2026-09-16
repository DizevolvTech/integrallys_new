'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface EstoqueCategoria {
  id: string
  nome: string
  unidadeId?: string | null
  ativo: boolean
}

export function useEstoqueCategorias() {
  const api = useApi()
  const [data, setData] = useState<EstoqueCategoria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: EstoqueCategoria[] }>('/api/estoque/categorias')
      setData(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (nome: string) => {
      const res = await api.post<{ data: EstoqueCategoria }>('/api/estoque/categorias', { nome })
      setData((current) => [...current, res.data].sort((a, b) => a.nome.localeCompare(b.nome)))
      return res.data
    },
    [api],
  )

  const update = useCallback(
    async (payload: { id: string; nome: string; ativo?: boolean }) => {
      const res = await api.put<{ data: EstoqueCategoria }>('/api/estoque/categorias', payload)
      setData((current) =>
        current
          .map((item) => (item.id === res.data.id ? res.data : item))
          .filter((item) => item.ativo !== false)
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      )
      return res.data
    },
    [api],
  )

  const remove = useCallback(
    async (id: string) => {
      await api.delete('/api/estoque/categorias', { id })
      setData((current) => current.filter((item) => item.id !== id))
    },
    [api],
  )

  return { data, isLoading, error, reload: load, create, update, remove }
}
