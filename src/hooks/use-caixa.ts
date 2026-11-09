'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import type { ApiListResponse } from '@/types/api'

export interface CaixaItem {
  id: string
  descricao: string
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  dia?: string
  hora?: string
  forma?: string
  operador?: string
  sessaoId?: string
  bandeira?: string | null
  parcelas?: number | null
  valorParcela?: number | null
  formaPagamentoId?: string
  dataIso?: string | null
  contaBancariaId?: string | null
  contaBancariaNome?: string | null
  vinculoTipo?: string | null
  vinculoId?: string | null
  vinculoNome?: string | null
  /** 'prescricao' | 'agendamento' | 'manual' | 'pagamento_online' | 'estorno' */
  origem?: string
  /** Preenchido na saída/entrada de estorno: id da movimentação original. */
  estornoDeId?: string | null
  /** Movimentação original que já foi estornada (não pode ser estornada de novo). */
  estornado?: boolean
  estornoMotivo?: string | null
}

/** Dados da janela "Estornar movimentação" (vêm do servidor). */
export interface EstornoPrevia {
  id: string
  descricao: string
  tipo: 'entrada' | 'saida'
  valor: number
  origem: string
  estornavel: boolean
  motivoRecusa: string | null
  prescricao: { id: string; numero: string; status: string; tipo: string | null } | null
  produtosEstoque: { nome: string; quantidade: number }[]
  temProdutoEstoque: boolean
}

export interface EstornoPayload {
  id: string
  motivo: string
  devolverEstoque?: boolean
  prescricaoAcao?: 'cancelar' | 'reabrir'
}

export interface EstornoResultado {
  caixaMovimentoId: string | null
  produtosDevolvidos: number
  prescricaoStatus: string | null
  mensagem: string
}

export interface CaixaFormaResumo {
  forma: string
  label: string
  value: number
  contas?: { label: string; value: number }[]
}

/** Período exibido: um dia ({ de } = { ate }) ou um intervalo. Vazio = hoje. */
export interface CaixaPeriodo {
  de?: string
  ate?: string
}

export interface CaixaSessionState {
  sessionId: string | null
  isOpen: boolean
  saldoInicial: number
  saldoAtual: number
  entradas: number
  saidas: number
  /** Parte das saídas que são estornos (já somada em `saidas`). */
  estornos: number
  movimentos: number
  openedAt: string | null
  openedByName: string | null
  closedAt: string | null
  temSessao: boolean
  /** Dia passado ou intervalo: só leitura. */
  consulta: boolean
  multiplo: boolean
  de: string | null
  ate: string | null
  resumoFormas: CaixaFormaResumo[]
  listaCortada: boolean
}

interface CaixaMetaResponse extends Record<string, unknown> {
  caixa?: {
    sessionId?: string | null
    isOpen?: boolean
    saldoInicial?: number
    saldoAtual?: number
    entradas?: number
    saidas?: number
    estornos?: number
    movimentos?: number
    openedAt?: string | null
    openedByName?: string | null
    closedAt?: string | null
    temSessao?: boolean
    periodo?: { de: string; ate: string; multiplo: boolean; consulta: boolean }
    resumoFormas?: CaixaFormaResumo[]
    listaCortada?: boolean
  }
}

interface CaixaResponse extends ApiListResponse<CaixaItem> {
  meta: CaixaMetaResponse
}

export interface OpenCaixaPayload {
  saldoInicial: number
  observacoes?: string
  unidadeId?: string
}

export interface CaixaMovimentacaoPayload {
  id?: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  forma?: string
  unidadeId?: string
  bandeira?: string | null
  parcelas?: number | null
  valorParcela?: number | null
  contaBancariaId?: string | null
  vinculoTipo?: string | null
  vinculoId?: string | null
  vinculoNome?: string | null
}

export interface CloseCaixaPayload {
  valorTransferido?: number
  observacoes?: string
  unidadeId?: string
  resumo?: Record<string, unknown>
}

function sessaoDaResposta(response: CaixaResponse): CaixaSessionState {
  const caixa = response.meta.caixa
  return {
    sessionId: caixa?.sessionId ?? null,
    isOpen: caixa?.isOpen ?? false,
    saldoInicial: caixa?.saldoInicial ?? 0,
    saldoAtual: caixa?.saldoAtual ?? 0,
    entradas: caixa?.entradas ?? 0,
    saidas: caixa?.saidas ?? 0,
    estornos: caixa?.estornos ?? 0,
    movimentos: caixa?.movimentos ?? 0,
    openedAt: caixa?.openedAt ?? null,
    openedByName: caixa?.openedByName ?? null,
    closedAt: caixa?.closedAt ?? null,
    temSessao: caixa?.temSessao ?? false,
    consulta: caixa?.periodo?.consulta ?? false,
    multiplo: caixa?.periodo?.multiplo ?? false,
    de: caixa?.periodo?.de ?? null,
    ate: caixa?.periodo?.ate ?? null,
    resumoFormas: caixa?.resumoFormas ?? [],
    listaCortada: caixa?.listaCortada ?? false,
  }
}

function urlDoPeriodo(periodo?: CaixaPeriodo) {
  const query = new URLSearchParams()
  if (periodo?.de) query.set('de', periodo.de)
  if (periodo?.ate) query.set('ate', periodo.ate)
  const texto = query.toString()
  return texto ? `/api/caixa?${texto}` : '/api/caixa'
}

export function useCaixa(periodo?: CaixaPeriodo) {
  const api = useApi()
  const [data, setData] = useState<CaixaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CaixaSessionState>(() =>
    sessaoDaResposta({ data: [], meta: {} } as unknown as CaixaResponse),
  )
  const de = periodo?.de
  const ate = periodo?.ate

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.get<CaixaResponse>(urlDoPeriodo({ de, ate }))
        if (!mounted) return
        setData(response.data)
        setSession(sessaoDaResposta(response))
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar caixa')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [api, de, ate])

  const updateFromResponse = (response: CaixaResponse) => {
    setData(response.data)
    setSession(sessaoDaResposta(response))
  }

  const openCaixa = async (payload: OpenCaixaPayload) => {
    const response = await api.post<CaixaResponse>('/api/caixa', { action: 'open', ...payload })
    updateFromResponse(response)
  }

  const addMovimentacao = async (payload: CaixaMovimentacaoPayload) => {
    const response = await api.post<CaixaResponse>('/api/caixa', { action: payload.tipo, ...payload })
    updateFromResponse(response)
  }

  const closeCaixa = async (payload: CloseCaixaPayload = {}) => {
    const response = await api.post<CaixaResponse>('/api/caixa', { action: 'close', ...payload })
    updateFromResponse(response)
  }

  const updateMovimentacao = async (payload: CaixaMovimentacaoPayload) => {
    const response = await api.put<CaixaResponse>('/api/caixa', payload)
    updateFromResponse(response)
  }

  const deleteMovimentacao = async (id: string) => {
    const response = await api.delete<CaixaResponse>('/api/caixa', { id })
    updateFromResponse(response)
  }

  const carregarPreviaEstorno = async (id: string) => {
    const response = await api.get<{ data: EstornoPrevia }>(`/api/caixa/estorno?id=${encodeURIComponent(id)}`)
    return response.data
  }

  /** Estorna (não apaga): o servidor grava a contrapartida no caixa, e a lista é recarregada. */
  const estornarMovimentacao = async (payload: EstornoPayload) => {
    const resultado = await api.post<{ data: EstornoResultado }>('/api/caixa/estorno', payload)
    const response = await api.get<CaixaResponse>(urlDoPeriodo({ de, ate }))
    updateFromResponse(response)
    return resultado.data
  }

  return { data, isLoading, error, session, openCaixa, addMovimentacao, closeCaixa, updateMovimentacao, deleteMovimentacao, carregarPreviaEstorno, estornarMovimentacao }
}
