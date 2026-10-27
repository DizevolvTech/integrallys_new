'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { RetornoItem, RetornosListaMeta } from '@/types/retorno'

export interface RetornosFiltros {
  situacao: string
  q: string
  profissionalId: string
  procedimentoId: string
  de: string
  ate: string
  page: number
  pageSize: number
}

interface RetornosResponse {
  data: RetornoItem[]
  meta: RetornosListaMeta
}

export function buildRetornosQuery(filtros: RetornosFiltros): string {
  const params = new URLSearchParams()
  params.set('page', String(filtros.page))
  params.set('pageSize', String(filtros.pageSize))
  if (filtros.situacao) params.set('situacao', filtros.situacao)
  if (filtros.q.trim().length >= 2) params.set('q', filtros.q.trim())
  if (filtros.profissionalId) params.set('profissionalId', filtros.profissionalId)
  if (filtros.procedimentoId) params.set('procedimentoId', filtros.procedimentoId)
  if (filtros.de) params.set('de', filtros.de)
  if (filtros.ate) params.set('ate', filtros.ate)
  return params.toString()
}

export function useRetornos(filtros: RetornosFiltros) {
  const api = useApi()
  const [data, setData] = useState<RetornoItem[]>([])
  const [meta, setMeta] = useState<RetornosListaMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const query = buildRetornosQuery(filtros)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<RetornosResponse>(`/api/retornos?${query}`)
      setData(response.data)
      setMeta(response.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar retornos')
    } finally {
      setIsLoading(false)
    }
  }, [api, query])

  useEffect(() => {
    void load()
  }, [load])

  return { data, meta, isLoading, error, reload: load }
}

/** Ids dos pacientes com retorno em aberto (tag "Retorno pendente" persistente). */
export function useRetornoPendentePacientes() {
  const api = useApi()
  const [ids, setIds] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    try {
      const response = await api.get<{ data: string[] }>('/api/retornos/pendentes')
      setIds(new Set(response.data))
    } catch {
      // sem permissão ou offline: a tag simplesmente não aparece
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  return { pacientesComRetornoPendente: ids, reload }
}

export async function registrarRetornoMaisTarde(
  post: <T>(url: string, body?: unknown) => Promise<T>,
  params: { pacienteId: string; prescricaoId?: string },
) {
  return post('/api/retornos', { origem: 'prescricao', ...params })
}
