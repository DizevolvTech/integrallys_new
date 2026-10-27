'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  PrescricaoRelatorioItem,
  PrescricoesMeta,
} from '@/app/api/relatorios/prescricoes/route'

export type PrescricaoSituacaoFilter = 'todos' | 'ativa' | 'no_prazo' | 'limite_prazo' | 'vencido'

export interface PrescricoesRelatorioFiltros {
  situacao: PrescricaoSituacaoFilter
  clienteNome: string
  profissionalId: string
  unidadeId: string
  desde: string
  ate: string
}

interface PrescricoesRelatorioResponse {
  data: PrescricaoRelatorioItem[]
  meta: PrescricoesMeta & Record<string, unknown>
}

const DEFAULT_META: PrescricoesMeta = {
  total: 0,
  noPrazo: 0,
  limitePrazo: 0,
  vencido: 0,
  semValidade: 0,
  valorTotal: 0,
  valorNoPrazo: 0,
  valorLimitePrazo: 0,
  valorVencido: 0,
  ativas: 0,
  valorAtivas: 0,
  ativasLimitePrazo: 0,
  valorAtivasLimitePrazo: 0,
  vencidas: 0,
  valorVencidas: 0,
}

const DEFAULT_FILTROS: PrescricoesRelatorioFiltros = {
  situacao: 'todos',
  clienteNome: '',
  profissionalId: 'todos',
  unidadeId: 'todos',
  desde: '',
  ate: '',
}

export function usePrescricoesRelatorio() {
  const api = useApi()
  const [filtros, setFiltros] = useState<PrescricoesRelatorioFiltros>(DEFAULT_FILTROS)
  const [debouncedClienteNome, setDebouncedClienteNome] = useState('')
  const [data, setData] = useState<PrescricaoRelatorioItem[]>([])
  const [meta, setMeta] = useState<PrescricoesMeta>(DEFAULT_META)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedClienteNome(filtros.clienteNome.trim())
    }, 300)
    return () => clearTimeout(handle)
  }, [filtros.clienteNome])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.situacao !== 'todos') params.set('situacao', filtros.situacao)
      if (filtros.profissionalId && filtros.profissionalId !== 'todos') {
        params.set('profissionalId', filtros.profissionalId)
      }
      if (filtros.unidadeId && filtros.unidadeId !== 'todos') {
        params.set('unidadeId', filtros.unidadeId)
      }
      if (filtros.desde) params.set('desde', filtros.desde)
      if (filtros.ate) params.set('ate', filtros.ate)

      const qs = params.toString()
      const response = await api.get<PrescricoesRelatorioResponse>(
        `/api/relatorios/prescricoes${qs ? `?${qs}` : ''}`,
      )

      const term = debouncedClienteNome.toLowerCase()
      const filteredByCliente = term
        ? response.data.filter((item) =>
            item.pacienteNome.toLowerCase().includes(term),
          )
        : response.data

      setData(filteredByCliente)
      setMeta({
        total: response.meta.total ?? 0,
        noPrazo: response.meta.noPrazo ?? 0,
        limitePrazo: response.meta.limitePrazo ?? 0,
        vencido: response.meta.vencido ?? 0,
        semValidade: response.meta.semValidade ?? 0,
        valorTotal: response.meta.valorTotal ?? 0,
        valorNoPrazo: response.meta.valorNoPrazo ?? 0,
        valorLimitePrazo: response.meta.valorLimitePrazo ?? 0,
        valorVencido: response.meta.valorVencido ?? 0,
        ativas: response.meta.ativas ?? 0,
        valorAtivas: response.meta.valorAtivas ?? 0,
        ativasLimitePrazo: response.meta.ativasLimitePrazo ?? 0,
        valorAtivasLimitePrazo: response.meta.valorAtivasLimitePrazo ?? 0,
        vencidas: response.meta.vencidas ?? 0,
        valorVencidas: response.meta.valorVencidas ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar prescrições')
    } finally {
      setIsLoading(false)
    }
  }, [
    api,
    filtros.situacao,
    filtros.profissionalId,
    filtros.unidadeId,
    filtros.desde,
    filtros.ate,
    debouncedClienteNome,
  ])

  useEffect(() => {
    void load()
  }, [load])

  return { data, meta, isLoading, error, filtros, setFiltros, reload: load }
}
