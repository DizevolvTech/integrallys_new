import type { LucideIcon } from 'lucide-react'
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from 'lucide-react'
import { getStatusBadgeClass } from '@/lib/status-badges'

export const FINANCEIRO_TABS = [
  { value: 'recebimentos', label: 'Recebimentos' },
  { value: 'pagamentos', label: 'Pagamentos' },
  { value: 'lancamentos', label: 'Lançamentos' },
  { value: 'caixa', label: 'Caixa' },
]

export const TAB_DESCRIPTIONS: Record<string, string> = {
  recebimentos: 'Acompanhe entradas confirmadas, categorias de receita e saldo do período.',
  pagamentos: 'Centralize saídas financeiras, despesas recorrentes e custos administrativos.',
  lancamentos: 'Visualize o consolidado financeiro com todas as movimentações retornadas pela API.',
  caixa: 'Resumo operacional com destaque para saldo, entradas e saídas do caixa.',
}

export interface FinanceiroStatCard {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  tone: string
}

export const FINANCEIRO_STAT_ICONS = {
  receitas: ArrowDownLeft,
  despesas: ArrowUpRight,
  saldo: Wallet,
  centros: Landmark,
}

export const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const parseCurrencyInput = (value: string) => {
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getFinanceStatusBadgeClass = (status?: string) => {
  return getStatusBadgeClass(status || '')
}

export const getFinanceStatusLabel = (status?: string) => {
  if (!status) return 'A vencer'
  const normalized = status.toLowerCase()
  if (normalized.includes('pago') || normalized.includes('quitado')) return 'Liquidado'
  if (normalized.includes('vencid')) return 'Atrasado'
  if (normalized.includes('pendente') || normalized.includes('parcial')) return 'A vencer'
  return status
}

export const isLiquidado = (status?: string) => {
  const s = (status ?? '').toLowerCase()
  return s.includes('pago') || s.includes('quitado')
}
