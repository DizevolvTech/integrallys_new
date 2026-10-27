'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ContaItem } from '@/lib/financeiro-contas'
import type { GrupoForma, ResumoFinanceiro, SituacaoFinanceira } from '@/lib/financeiro-situacao'

export type { ContaItem }

export interface FiltrosContasUi {
  de: string
  ate: string
  pessoa: string
  produto: string
  formaId: string
  situacao: '' | SituacaoFinanceira
  categoriaId: string
  profissionalId: string
  procedimentoId: string
}

export const FILTROS_VAZIOS: FiltrosContasUi = {
  de: '',
  ate: '',
  pessoa: '',
  produto: '',
  formaId: '',
  situacao: '',
  categoriaId: '',
  profissionalId: '',
  procedimentoId: '',
}

export interface OpcoesContas {
  formas: Array<{ id: string; nome: string; tipo: string }>
  categorias: Array<{ id: string; nome: string; tipo: 'receita' | 'despesa' }>
  profissionais: Array<{ id: string; nome: string }>
  procedimentos: Array<{ id: string; nome: string }>
  fornecedores: Array<{ id: string; nome: string }>
}

export interface PeriodoContas {
  de: string
  ate: string
  informado: boolean
}

interface ContasResponse {
  data: ContaItem[]
  resumo: ResumoFinanceiro
  periodo: PeriodoContas
}

const RESUMO_VAZIO: ResumoFinanceiro = { liquidado: 0, aVencer: 0, atrasado: 0 }
const OPCOES_VAZIAS: OpcoesContas = { formas: [], categorias: [], profissionais: [], procedimentos: [], fornecedores: [] }

function montarQuery(tipo: string, filtros: FiltrosContasUi) {
  const params = new URLSearchParams({ tipo })
  for (const [chave, valor] of Object.entries(filtros)) if (valor) params.set(chave, valor)
  return params
}

/** Contas a receber (receita) ou a pagar (despesa) filtradas no servidor. */
export function useContas(tipo: 'receita' | 'despesa') {
  const api = useApi()
  const [filtros, setFiltros] = useState<FiltrosContasUi>(FILTROS_VAZIOS)
  const [contas, setContas] = useState<ContaItem[]>([])
  const [resumo, setResumo] = useState<ResumoFinanceiro>(RESUMO_VAZIO)
  const [periodo, setPeriodo] = useState<PeriodoContas | null>(null)
  const [opcoes, setOpcoes] = useState<OpcoesContas>(OPCOES_VAZIAS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ultima = useRef(0)

  const query = useMemo(() => montarQuery(tipo, filtros).toString(), [tipo, filtros])

  const load = useCallback(async () => {
    const numero = ++ultima.current
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<ContasResponse>(`/api/financeiro/contas?${query}`)
      if (numero !== ultima.current) return
      setContas(response.data)
      setResumo(response.resumo)
      setPeriodo(response.periodo)
    } catch (err) {
      if (numero === ultima.current) setError(err instanceof Error ? err.message : 'Erro ao carregar contas')
    } finally {
      if (numero === ultima.current) setIsLoading(false)
    }
  }, [api, query])

  // Texto digitado espera uma pausa; os demais filtros aplicam na hora.
  useEffect(() => {
    const espera = setTimeout(() => void load(), 300)
    return () => clearTimeout(espera)
  }, [load])

  useEffect(() => {
    api
      .get<{ data: OpcoesContas }>('/api/financeiro/contas/opcoes')
      .then((response) => setOpcoes(response.data))
      .catch(() => undefined)
  }, [api])

  const buscarDetalhe = useCallback(
    (situacao: Exclude<SituacaoFinanceira, 'cancelado'>) =>
      api.get<{ data: Array<GrupoForma<ContaItem>>; periodo: PeriodoContas }>(
        `/api/financeiro/contas?${montarQuery(tipo, { ...filtros, situacao: '' }).toString()}&detalhe=${situacao}`,
      ),
    [api, tipo, filtros],
  )

  return { filtros, setFiltros, contas, resumo, periodo, opcoes, isLoading, error, reload: load, buscarDetalhe }
}
