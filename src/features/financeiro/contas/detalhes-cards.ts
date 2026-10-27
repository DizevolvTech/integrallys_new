import type { CaixaItem } from '@/hooks/use-caixa'
import type { FinanceiroItem } from '@/hooks/use-financeiro'
import { formaCaixaLabel } from '@/features/caixa/caixa-format'
import { isLiquidado } from '../financeiro.utils'
import type { GrupoDetalhe } from './detalhe-grupos-modal'
import { montarGrupos, totalDosGrupos, type LinhaAgrupavel } from './detalhe-util'
import { formatarMoeda } from '@/lib/moeda'

export type DetalheCard = {
  titulo: string
  descricao?: string
  total: number
  grupos: GrupoDetalhe[]
  agrupadoPor?: string
}

export type TipoDetalheFinanceiro = 'entradas' | 'saidas' | 'saldo' | 'centros' | 'a-vencer'
export type TipoDetalheCaixa = 'saldo-inicial' | 'entradas' | 'saidas' | 'saldo-atual'

/** "PIX · Visa · 3x" → "PIX" (agrupa pela forma, sem bandeira e parcelas). */
export function formaDoLancamento(item: { metodo?: string }): string {
  return item.metodo?.split(' · ')[0]?.trim() || 'Não informada'
}

function linhaLancamento(item: FinanceiroItem, grupo: string): LinhaAgrupavel {
  return {
    id: item.id,
    titulo: item.beneficiario ? `${item.descricao} — ${item.beneficiario}` : item.descricao,
    subtitulo: `${item.categoria}${item.status ? ` · ${item.status}` : ''}`,
    valor: item.valor,
    grupo,
  }
}

export function detalheLancamentos(tipo: TipoDetalheFinanceiro, data: FinanceiroItem[]): DetalheCard {
  const receitas = data.filter((item) => item.tipo === 'receita')
  const despesas = data.filter((item) => item.tipo === 'despesa')
  const porForma = (itens: FinanceiroItem[]) =>
    montarGrupos(itens.map((item) => linhaLancamento(item, formaDoLancamento(item))))

  if (tipo === 'entradas') {
    const grupos = porForma(receitas)
    return { titulo: 'Total de entradas', total: totalDosGrupos(grupos), grupos }
  }
  if (tipo === 'saidas') {
    const grupos = porForma(despesas)
    return { titulo: 'Total de saídas', total: totalDosGrupos(grupos), grupos }
  }
  if (tipo === 'a-vencer') {
    const grupos = porForma(data.filter((item) => !isLiquidado(item.status)))
    return { titulo: 'Pendências em aberto', total: totalDosGrupos(grupos), grupos }
  }
  if (tipo === 'centros') {
    const grupos = montarGrupos(data.map((item) => linhaLancamento(item, item.categoria || 'Sem categoria')))
    return { titulo: 'Centros financeiros', total: totalDosGrupos(grupos), grupos, agrupadoPor: 'Por categoria' }
  }
  const entradas = montarGrupos(receitas.map((item) => linhaLancamento(item, 'Entradas')))
  const saidas = montarGrupos(despesas.map((item) => linhaLancamento(item, 'Saídas')))
  const totalEntradas = totalDosGrupos(entradas)
  const totalSaidas = totalDosGrupos(saidas)
  return {
    titulo: 'Saldo consolidado',
    descricao: `Entradas menos saídas: ${formatarMoeda(totalEntradas)} − ${formatarMoeda(totalSaidas)}`,
    total: Math.round((totalEntradas - totalSaidas) * 100) / 100,
    grupos: [...entradas, ...saidas],
    agrupadoPor: 'Composição',
  }
}

export function detalheCaixa(
  tipo: TipoDetalheCaixa,
  movimentos: CaixaItem[],
  caixa: { saldoInicial: number; entradas: number; saidas: number; saldo: number },
): DetalheCard {
  const linha = (item: CaixaItem, grupo: string): LinhaAgrupavel => ({
    id: item.id,
    titulo: item.descricao,
    subtitulo: [item.hora, item.operador].filter(Boolean).join(' · '),
    valor: item.valor,
    grupo,
  })
  const doTipo = (alvo: 'entrada' | 'saida') => movimentos.filter((item) => item.tipo === alvo)

  if (tipo === 'entradas' || tipo === 'saidas') {
    const grupos = montarGrupos(doTipo(tipo === 'entradas' ? 'entrada' : 'saida').map((item) => linha(item, formaCaixaLabel(item.forma))))
    return { titulo: tipo === 'entradas' ? 'Entradas do caixa' : 'Saídas do caixa', total: totalDosGrupos(grupos), grupos }
  }
  const composicao: GrupoDetalhe[] = [
    { chave: 'inicial', rotulo: 'Saldo inicial', total: caixa.saldoInicial, linhas: [] },
    ...montarGrupos(doTipo('entrada').map((item) => linha(item, 'Entradas'))),
    ...montarGrupos(doTipo('saida').map((item) => linha(item, 'Saídas'))),
  ]
  return {
    titulo: tipo === 'saldo-inicial' ? 'Saldo inicial do caixa' : 'Saldo atual do caixa',
    descricao: 'Saldo inicial + entradas − saídas',
    total: tipo === 'saldo-inicial' ? caixa.saldoInicial : caixa.saldo,
    grupos: tipo === 'saldo-inicial' ? composicao.slice(0, 1) : composicao,
    agrupadoPor: 'Composição',
  }
}
