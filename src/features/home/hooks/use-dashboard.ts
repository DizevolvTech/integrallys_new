'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

export interface DashboardCardItem {
  id: string
  label: string
  value: string
  description?: string
  /** Atalho: o card abre esta tela ao clicar (definido no servidor). */
  href?: string
}

export interface DashboardAppointment {
  id: string
  patient: string
  professional: string
  procedure: string
  status: string
  time: string
}

export interface DashboardRecentPatient {
  id: string
  initials: string
  name: string
  type: string
  time: string
  status: string
}

export interface DashboardEspecialistaCharts {
  atendimentosPorSemana: Array<{ semana: string; total: number }>
  tiposConsulta: Array<{ tipo: string; total: number }>
}

export type TipoFaturamento = 'procedimentos' | 'consultas' | 'produtos' | 'outros'

export interface DashboardPerformance {
  periodo: { de: string; ate: string }
  realizados: number
  faltas: number
  cancelamentos: number
  retornosAgendados: number
  ocupacao: { ocupados: number; disponiveis: number; percentual: number }
  receita: { atendimentos: number; prescricoes: number; total: number }
  prescricoes: { total: number; convertidas: number; taxaConversao: number }
  porStatus: Array<{ chave: 'realizados' | 'faltas' | 'cancelamentos'; nome: string; total: number }>
  retornos: { limitePrazo: number; vencidos: number }
}

export interface DashboardInadimplencia {
  totalValor: number
  totalLancamentos: number
  link: string
}

export interface DashboardNoShowSemanal {
  cancelados: number
  noShow: number
  total: number
  taxaCancelamento: string
  taxaNoShow: string
}

export interface DashboardAniversarianteSemana {
  id: string
  nome: string
  dataNascimento: string
  diaAniversario: string
}

export interface DashboardMeta {
  unidades: Array<{ id: string; nome: string }>
  periodo: { de: string; ate: string }
  filtros: { periodo: string; unidadeId: string | null }
}

export interface DashboardData {
  variant: 'admin' | 'gestor' | 'recepcao' | 'especialista' | 'master'
  cards: DashboardCardItem[]
  appointments: DashboardAppointment[]
  recentPatients: DashboardRecentPatient[]
  retornos: {
    noPrazo: number
    limitePrazo: number
    vencidos: number
  }
  performance?: DashboardPerformance
  finance: {
    recebimentosPendentes: string
    pagamentosPendentes: string
    saldoPrevisto: string
  }
  admin: {
    activities: Array<{ label: string; time: string; color: string }>
    unitStatus: {
      ativas: number
      manutencao: number
      agendamentosHoje: number
    }
    birthdays: Array<{ id: string; name: string; date: string }>
    saldoCaixas: Array<{ id: string; unidadeId: string; unidade: string; status: string; saldo: number; troco: number; cofre: number }>
    saldoBancos: Array<{ id: string; unidade: string; nome: string; banco: string; tipo: string; saldo: number }>
    financeiroPorUnidade: Array<{ unidadeId: string | null; unidade: string; entradas: number; saidas: number; saldo: number; faturamento: Record<TipoFaturamento, number> }>
    faturamentoTotal: Record<TipoFaturamento, number>
    notasEmitidas: { registrado: boolean; aviso: string; pendentes?: number; emitidas?: number; valorPendente?: number; valorEmitido?: number }
    unidadesComparativo: Array<{ unidadeId: string | null; unidadeNome: string; agendamentos: number; receita: number }>
    prescricoesPendentes: { limitePrazo: number; vencidos: number }
    retornosPendentes: { limitePrazo: number; vencidos: number }
    listaEsperaCount: number
    estoqueCritico: { count: number; itens: Array<{ id: string; nome: string; quantidade: number; estoqueMinimo: number }> }
    topProcedimentos: Array<{ nome: string; total: number }>
    inadimplencia: DashboardInadimplencia
    noShowSemanal: DashboardNoShowSemanal
    aniversariantesSemana: DashboardAniversarianteSemana[]
  }
  gestor: {
    accounts: Array<{ id: string; type: string; name: string; balance: string; color: string; href?: string }>
    paymentsDue: Array<{ title: string; cat: string; date: string; value: string }>
    receivables: Array<{ title: string; cat: string; date: string; value: string }>
  }
  especialistaCharts?: DashboardEspecialistaCharts
  adminCharts?: DashboardEspecialistaCharts
  meta?: DashboardMeta
}

const initialData: DashboardData = {
  variant: 'recepcao',
  cards: [],
  appointments: [],
  recentPatients: [],
  retornos: {
    noPrazo: 0,
    limitePrazo: 0,
    vencidos: 0,
  },
  finance: {
    recebimentosPendentes: '0',
    pagamentosPendentes: '0',
    saldoPrevisto: '0',
  },
  admin: {
    activities: [],
    unitStatus: {
      ativas: 0,
      manutencao: 0,
      agendamentosHoje: 0,
    },
    birthdays: [],
    saldoCaixas: [],
    saldoBancos: [],
    financeiroPorUnidade: [],
    faturamentoTotal: { procedimentos: 0, consultas: 0, produtos: 0, outros: 0 },
    notasEmitidas: { registrado: false, aviso: '' },
    unidadesComparativo: [],
    prescricoesPendentes: { limitePrazo: 0, vencidos: 0 },
    retornosPendentes: { limitePrazo: 0, vencidos: 0 },
    listaEsperaCount: 0,
    estoqueCritico: { count: 0, itens: [] },
    topProcedimentos: [],
    inadimplencia: { totalValor: 0, totalLancamentos: 0, link: '/financeiro?status=pendente&vencido=true' },
    noShowSemanal: { cancelados: 0, noShow: 0, total: 0, taxaCancelamento: '0%', taxaNoShow: '0%' },
    aniversariantesSemana: [],
  },
  gestor: {
    accounts: [],
    paymentsDue: [],
    receivables: [],
  },
}

export interface DashboardFilters {
  periodo?: string
  de?: string
  ate?: string
  unidadeId?: string | null
}

export function useDashboard(filters?: DashboardFilters) {
  const api = useApi()
  const [data, setData] = useState<DashboardData>(initialData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const periodo = filters?.periodo ?? ''
  const de = filters?.de ?? ''
  const ate = filters?.ate ?? ''
  const unidadeId = filters?.unidadeId ?? ''

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (periodo) params.set('periodo', periodo)
        if (de) params.set('de', de)
        if (ate) params.set('ate', ate)
        if (unidadeId && unidadeId !== 'all') params.set('unidade_id', unidadeId)
        const qs = params.toString()
        const url = qs ? `/api/dashboard?${qs}` : '/api/dashboard'
        const response = await api.get<DashboardData>(url)
        if (!mounted) return
        setData(response)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [api, periodo, de, ate, unidadeId])

  return { data, isLoading, error }
}
