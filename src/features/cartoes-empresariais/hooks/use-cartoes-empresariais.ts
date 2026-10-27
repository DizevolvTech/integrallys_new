'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface ParcelaFatura {
  movimentoId: string
  descricao: string
  beneficiario: string | null
  numero: number
  total: number
  valor: number
  vencimento: string
}

export interface FaturaCartao {
  mes: string
  vencimento: string
  total: number
  aberta: boolean
  itens: ParcelaFatura[]
}

export interface CartaoMovimento {
  id: string
  cartaoId: string
  descricao: string
  valor: number
  valorParcela: number
  parcelas: number
  parcelaAtual: number
  dataCompra: string | null
  dataVencimento: string | null
  beneficiario: string | null
  categoria: string | null
  operadorId: string | null
  createdAt: string | null
}

export interface CartaoEmpresarial {
  id: string
  unidadeId: string | null
  nome: string
  bandeira: string | null
  ultimosDigitos: string | null
  limiteTotal: number
  diaVencimento: number | null
  contaBancariaId: string | null
  ativo: boolean
  limiteUtilizado: number
  limiteDisponivel: number
  faturasAbertas: number
  proximoVencimento: string | null
  faturas: FaturaCartao[]
  movimentos: CartaoMovimento[]
}

export interface RecebivelBreakdownRow {
  bandeira: string
  tipo: 'credito' | 'debito'
  bruto: number
  taxa: number
  taxaValor: number
  liquido: number
  quantidade: number
}

interface TotaisRecebiveis {
  brutoCredito: number
  liquidoCredito: number
  brutoDebito: number
  liquidoDebito: number
}

interface CartoesResponse {
  cartoes: CartaoEmpresarial[]
  recebiveisConsolidado: RecebivelBreakdownRow[]
  totaisRecebiveis: TotaisRecebiveis
}

export interface NovoCartaoInput {
  nome: string
  bandeira?: string | null
  ultimosDigitos?: string | null
  limiteTotal: number
  diaVencimento?: number | null
  unidadeId?: string | null
  contaBancariaId?: string | null
}

export interface NovoMovimentoInput {
  cartaoId: string
  descricao: string
  valor: number
  parcelas?: number
  dataCompra?: string
  beneficiario?: string | null
  categoria?: string | null
}

const INITIAL: CartoesResponse = {
  cartoes: [],
  recebiveisConsolidado: [],
  totaisRecebiveis: { brutoCredito: 0, liquidoCredito: 0, brutoDebito: 0, liquidoDebito: 0 },
}

export function useCartoesEmpresariais() {
  const api = useApi()
  const [data, setData] = useState<CartoesResponse>(INITIAL)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<CartoesResponse>('/api/cartoes')
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cartões empresariais')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const criarCartao = async (payload: NovoCartaoInput) => {
    const response = await api.post<CartoesResponse>('/api/cartoes', { action: 'criar_cartao', ...payload })
    setData(response)
    return response
  }

  const registrarMovimento = async (payload: NovoMovimentoInput) => {
    const response = await api.post<CartoesResponse>('/api/cartoes', { action: 'registrar_movimento', ...payload })
    setData(response)
    return response
  }

  const desativarCartao = async (id: string) => {
    const response = await api.delete<CartoesResponse>('/api/cartoes', { id })
    setData(response)
    return response
  }

  return {
    data,
    isLoading,
    error,
    load,
    criarCartao,
    registrarMovimento,
    desativarCartao,
  }
}
