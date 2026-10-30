'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface TarefaCategoria {
  id: string
  nome: string
}

const URL = '/api/tarefas/categorias'

/** Categorias de tarefa cadastradas (ativas) e as ações de gerenciá-las. */
export function useTarefaCategorias() {
  const api = useApi()
  const [categorias, setCategorias] = useState<TarefaCategoria[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api
      .get<ApiListResponse<TarefaCategoria>>(URL)
      .then((response) => mounted && setCategorias(response.data))
      .catch(() => undefined)
      .finally(() => mounted && setIsLoading(false))
    return () => {
      mounted = false
    }
  }, [api])

  const apply = useCallback((response: ApiListResponse<TarefaCategoria>) => setCategorias(response.data), [])

  return {
    categorias,
    isLoading,
    addCategoria: async (nome: string) => apply(await api.post<ApiListResponse<TarefaCategoria>>(URL, { nome })),
    renameCategoria: async (id: string, nome: string) =>
      apply(await api.put<ApiListResponse<TarefaCategoria>>(URL, { id, nome })),
    removeCategoria: async (id: string) => apply(await api.delete<ApiListResponse<TarefaCategoria>>(URL, { id })),
  }
}

export type TarefaCategoriasApi = ReturnType<typeof useTarefaCategorias>
