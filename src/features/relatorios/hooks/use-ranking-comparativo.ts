'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface RankingProdutoRow {
  produtoId: string | null
  nome: string
  quantidade: number
  receita: number
  margem: number
}

export function useRankingProdutos(dias = 90) {
  const api = useApi()
  const [vendidos, setVendidos] = useState<RankingProdutoRow[]>([])
  const [lucrativos, setLucrativos] = useState<RankingProdutoRow[]>([])
  const [valoresVisiveis, setValoresVisiveis] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<{
        data: { vendidos: RankingProdutoRow[]; lucrativos: RankingProdutoRow[] }
        meta: { valoresVisiveis?: boolean }
      }>(`/api/relatorios/ranking-produtos?dias=${dias}`)
      setVendidos(res.data?.vendidos ?? [])
      setLucrativos(res.data?.lucrativos ?? [])
      setValoresVisiveis(res.meta?.valoresVisiveis !== false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ranking')
    } finally {
      setIsLoading(false)
    }
  }, [api, dias])

  useEffect(() => {
    void load()
  }, [load])

  return { vendidos, lucrativos, valoresVisiveis, isLoading, error, reload: load }
}

export interface RankingProcedimentoRow {
  procedimentoId: string | null
  nome: string
  quantidade: number
  receita: number
}

export function useRankingProcedimentos(dias = 90) {
  const api = useApi()
  const [realizados, setRealizados] = useState<RankingProcedimentoRow[]>([])
  const [receita, setReceita] = useState<RankingProcedimentoRow[]>([])
  const [valoresVisiveis, setValoresVisiveis] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<{
        data: { realizados: RankingProcedimentoRow[]; receita: RankingProcedimentoRow[] }
        meta: { valoresVisiveis?: boolean }
      }>(`/api/relatorios/ranking-procedimentos?dias=${dias}`)
      setRealizados(res.data?.realizados ?? [])
      setReceita(res.data?.receita ?? [])
      setValoresVisiveis(res.meta?.valoresVisiveis !== false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ranking de procedimentos')
    } finally {
      setIsLoading(false)
    }
  }, [api, dias])

  useEffect(() => {
    void load()
  }, [load])

  return { realizados, receita, valoresVisiveis, isLoading, error, reload: load }
}

export interface CaixaGestorData {
  data: string
  sessoes: Array<{
    id: string
    status: string
    saldoInicial: number
    saldoFinal: number
    valorTransferido: number
    abertoEm: string | null
    fechadoEm: string | null
  }>
  movimentos: Array<{
    id: string
    tipo: string
    valor: number
    forma: string | null
    descricao: string | null
    createdAt: string
  }>
  totais: { entradas: number; saidas: number; liquido: number }
  bancos: Array<{ id: string; nome: string; banco: string | null; tipo: string; saldoAtual: number }>
  cofres: Array<{ id: string; nome: string; saldoAtual: number }>
  saldoBancos: number
  saldoCofres: number
}

export function useCaixaGestor() {
  const api = useApi()
  const [data, setData] = useState<CaixaGestorData | null>(null)
  const [valoresVisiveis, setValoresVisiveis] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<{
        data: CaixaGestorData
        meta: { valoresVisiveis?: boolean }
      }>('/api/relatorios/caixa-gestor')
      setData(res.data ?? null)
      setValoresVisiveis(res.meta?.valoresVisiveis !== false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar caixa gestor')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  return { data, valoresVisiveis, isLoading, error, reload: load }
}

export interface ComparativoUnidadeRow {
  unidadeId: string
  unidadeNome: string
  agendamentos: number
  receita: number
  despesa: number
  ticketMedio: number
}

export function useComparativoUnidades(dias = 30) {
  const api = useApi()
  const [data, setData] = useState<ComparativoUnidadeRow[]>([])
  const [valoresVisiveis, setValoresVisiveis] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.get<{
        data: ComparativoUnidadeRow[]
        meta: { valoresVisiveis?: boolean }
      }>(`/api/relatorios/comparativo-unidades?dias=${dias}`)
      setData(res.data ?? [])
      setValoresVisiveis(res.meta?.valoresVisiveis !== false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar comparativo')
    } finally {
      setIsLoading(false)
    }
  }, [api, dias])

  useEffect(() => {
    void load()
  }, [load])

  return { data, valoresVisiveis, isLoading, error, reload: load }
}
