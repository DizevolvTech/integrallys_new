'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { ApiClientError } from '@/lib/api-client'

export interface ClinicaConfig {
  id: string
  unidade_id: string
  nome: string
  cidade_uf: string | null
  endereco: string | null
  cep: string | null
  telefone: string | null
  logo_url: string | null
  cor_primaria: string
  cor_secundaria: string
  updated_at: string
}

export type ClinicaConfigInput = Omit<ClinicaConfig, 'id' | 'unidade_id' | 'updated_at'>

interface ApiResponse<T> {
  data: T
}

/**
 * Identidade da clínica (1 por unidade). Gestor/recepção leem a da própria unidade; admin/master com mais de
 * uma unidade escolhem qual (`unidadeId`) — sem ela o servidor responde UNIDADE_NAO_INFORMADA.
 */
export function useClinicaConfig(unidadeId?: string | null) {
  const api = useApi()
  const [data, setData] = useState<ClinicaConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [precisaEscolherUnidade, setPrecisaEscolherUnidade] = useState(false)
  const query = unidadeId ? `?unidadeId=${encodeURIComponent(unidadeId)}` : ''

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await api.get<ApiResponse<ClinicaConfig | null>>(`/api/clinica-config${query}`)
        if (!mounted) return
        setData(res.data)
      } catch (err) {
        if (!mounted) return
        setData(null)
        if (err instanceof ApiClientError && err.code === 'UNIDADE_NAO_INFORMADA') {
          setPrecisaEscolherUnidade(true)
          return
        }
        setError(err instanceof Error ? err.message : 'Erro ao carregar identidade da clínica')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [api, query])

  const save = useCallback(
    async (input: ClinicaConfigInput) => {
      const res = await api.put<ApiResponse<ClinicaConfig>>(
        '/api/clinica-config',
        unidadeId ? { ...input, unidadeId } : input,
      )
      setData(res.data)
      return res.data
    },
    [api, unidadeId],
  )

  const uploadLogo = useCallback(
    async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      if (unidadeId) formData.append('unidadeId', unidadeId)

      const response = await fetch('/api/clinica-config/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Falha ao enviar logo')
      }
      const payload = (await response.json()) as ApiResponse<{ logo_url: string }>
      setData((current) => (current ? { ...current, logo_url: payload.data.logo_url } : current))
      return payload.data.logo_url
    },
    [unidadeId],
  )

  return { data, isLoading, error, save, uploadLogo, precisaEscolherUnidade }
}
