'use client'

import { useMemo } from 'react'
import type { CaixaItem, CaixaSessionState } from '@/hooks/use-caixa'
import type { FinanceiroItem } from '@/hooks/use-financeiro'
import { formaCaixaLabel } from '@/features/caixa/caixa-format'
import {
  FINANCEIRO_STAT_ICONS,
  formatCurrency,
  isLiquidado,
  type FinanceiroStatCard,
} from '../financeiro.utils'

export function useFinanceiroStats(
  data: FinanceiroItem[],
  caixaData: CaixaItem[],
  caixaSession: CaixaSessionState,
) {
  const cards = useMemo<FinanceiroStatCard[]>(() => {
    const receitas = data.filter((item) => item.tipo === 'receita').reduce((acc, item) => acc + item.valor, 0)
    const despesas = data.filter((item) => item.tipo === 'despesa').reduce((acc, item) => acc + item.valor, 0)
    const saldo = receitas - despesas
    const centrosAtivos = new Set(data.map((item) => item.categoria)).size

    return [
      {
        title: 'Total de entradas',
        value: formatCurrency(receitas),
        subtitle: 'Receitas acumuladas nas movimentações disponíveis',
        icon: FINANCEIRO_STAT_ICONS.receitas,
        tone: 'text-[var(--app-success-text)]',
      },
      {
        title: 'Total de saídas',
        value: formatCurrency(despesas),
        subtitle: 'Despesas administrativas e operacionais',
        icon: FINANCEIRO_STAT_ICONS.despesas,
        tone: 'text-[var(--app-danger-text)]',
      },
      {
        title: 'Saldo consolidado',
        value: formatCurrency(saldo),
        subtitle: 'Diferença entre receitas e despesas do período',
        icon: FINANCEIRO_STAT_ICONS.saldo,
        tone: 'text-app-text-primary dark:text-white',
      },
      {
        title: 'Centros financeiros',
        value: String(centrosAtivos),
        subtitle: 'Categorias financeiras com movimentação ativa',
        icon: FINANCEIRO_STAT_ICONS.centros,
        tone: 'text-[var(--app-info-text)]',
      },
    ]
  }, [data])

  const dreSummary = useMemo(() => {
    const receitas = data.filter((item) => item.tipo === 'receita').reduce((acc, item) => acc + item.valor, 0)
    const despesas = data.filter((item) => item.tipo === 'despesa').reduce((acc, item) => acc + item.valor, 0)
    return [
      { label: 'Receita operacional', value: formatCurrency(receitas), tone: 'text-[var(--app-success-text)]' },
      { label: 'Despesas operacionais', value: formatCurrency(despesas), tone: 'text-[var(--app-danger-text)]' },
      { label: 'Resultado atual', value: formatCurrency(receitas - despesas), tone: 'text-app-text-primary dark:text-white' },
    ]
  }, [data])

  const topCategories = useMemo(() => {
    const categories = Array.from(new Set(data.map((item) => item.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    return categories
      .map((category) => ({
        categoria: category,
        total: data.filter((item) => item.categoria === category).reduce((acc, item) => acc + item.valor, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
  }, [data])

  const recebimentosSummary = useMemo(() => {
    const recebimentos = data.filter((item) => item.tipo === 'receita')
    const liquidado = recebimentos.reduce((acc, item) => (isLiquidado(item.status) ? acc + item.valor : acc), 0)
    const aReceber = recebimentos.reduce((acc, item) => (isLiquidado(item.status) ? acc : acc + item.valor), 0)
    return {
      liquidado,
      aReceber,
      pendencias: recebimentos.filter((item) => !isLiquidado(item.status)).length,
    }
  }, [data])

  const pagamentosSummary = useMemo(() => {
    const pagamentos = data.filter((item) => item.tipo === 'despesa')
    const pago = pagamentos.reduce((acc, item) => (isLiquidado(item.status) ? acc + item.valor : acc), 0)
    const aPagar = pagamentos.reduce((acc, item) => (isLiquidado(item.status) ? acc : acc + item.valor), 0)
    return {
      pago,
      aPagar,
      pendencias: pagamentos.filter((item) => !isLiquidado(item.status)).length,
    }
  }, [data])

  const lancamentosSummary = useMemo(() => {
    const entradas = data.filter((item) => item.tipo === 'receita')
    const saidas = data.filter((item) => item.tipo === 'despesa')
    return {
      entradas: entradas.reduce((acc, item) => acc + item.valor, 0),
      saidas: saidas.reduce((acc, item) => acc + item.valor, 0),
      saldo: entradas.reduce((acc, item) => acc + item.valor, 0) - saidas.reduce((acc, item) => acc + item.valor, 0),
      pendente: data.reduce((acc, item) => (isLiquidado(item.status) ? acc : acc + item.valor), 0),
    }
  }, [data])

  const caixaTodayData = useMemo(() => {
    const today = new Date()
    const todayKey = today.toLocaleDateString('pt-BR')
    return caixaData.filter((item) => {
      if (!item.data) return false
      return item.data.includes(todayKey)
    })
  }, [caixaData])

  const caixaStatus = useMemo(() => {
    const entradas = caixaSession.entradas
    const saidas = caixaSession.saidas
    const aberto = caixaSession.isOpen
    return {
      aberto,
      entradas,
      saidas,
      saldo: caixaSession.saldoAtual,
      movimentos: caixaSession.movimentos,
      saldoInicial: caixaSession.saldoInicial,
    }
  }, [caixaSession])

  // Entradas do dia por forma (antes tudo caía em Dinheiro e o resto ficava zerado).
  const resumoForma = useMemo(() => {
    const total = (label: string) =>
      caixaTodayData
        .filter((item) => item.tipo === 'entrada' && formaCaixaLabel(item.forma) === label)
        .reduce((acc, item) => acc + item.valor, 0)
    return ['Dinheiro', 'PIX', 'Crédito', 'Débito', 'Transferência'].map((label) => ({
      label: label === 'Crédito' ? 'Cartão crédito' : label === 'Débito' ? 'Cartão débito' : label,
      value: total(label),
    }))
  }, [caixaTodayData])

  return {
    cards,
    dreSummary,
    topCategories,
    recebimentosSummary,
    pagamentosSummary,
    lancamentosSummary,
    caixaTodayData,
    caixaStatus,
    resumoForma,
  }
}
