'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'
import type { RelatorioTab } from '@/lib/relatorios/registry'

interface RelatoriosMeta {
  tabs?: RelatorioTab[]
}

/** Abas de Relatórios que o servidor libera para o perfil logado. */
export function useRelatorios() {
  const api = useApi()
  const [tabs, setTabs] = useState<RelatorioTab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<ApiListResponse<unknown>>('/api/relatorios')
        if (!mounted) return
        const meta = response.meta as RelatoriosMeta | undefined
        setTabs(Array.isArray(meta?.tabs) ? meta.tabs : [])
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [api])

  return { tabs, isLoading, error }
}
