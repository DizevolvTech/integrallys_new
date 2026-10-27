export type SituacaoFinanceira = 'liquidado' | 'a_vencer' | 'atrasado' | 'cancelado'

export const SITUACAO_LABEL: Record<SituacaoFinanceira, string> = {
  liquidado: 'Liquidado',
  a_vencer: 'A vencer',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
}

function normaliza(status: string | null | undefined) {
  return (status ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Pendente = A vencer; passou do vencimento sem pagar = Atrasado. */
export function situacaoLancamento(params: {
  status: string | null | undefined
  vencimento: string | null | undefined
  hoje: string
}): SituacaoFinanceira {
  const status = normaliza(params.status)
  if (status.includes('cancel')) return 'cancelado'
  if (status.includes('vencid')) return 'atrasado'
  if (status.includes('pago') || status.includes('quitado') || status.includes('liquidado')) {
    return 'liquidado'
  }
  const vencimento = params.vencimento?.slice(0, 10)
  if (vencimento && vencimento < params.hoje) return 'atrasado'
  return 'a_vencer'
}

export type PeriodoFinanceiro = { de: string; ate: string }

/** Sem filtro de período os totais mostram o dia de hoje. */
export function periodoEfetivo(de: string | null, ate: string | null, hoje: string): PeriodoFinanceiro {
  if (!de && !ate) return { de: hoje, ate: hoje }
  return { de: de ?? '0001-01-01', ate: ate ?? '9999-12-31' }
}

export type ItemResumivel = {
  valor: number
  situacao: SituacaoFinanceira
  forma: string
  dataReferencia: string
}

export type ResumoFinanceiro = Record<'liquidado' | 'aVencer' | 'atrasado', number>

/**
 * Totais dos cards. Liquidado segue o período (sem filtro: hoje); atrasado, por definição já vencido,
 * vai desde o início até o fim do período (sem filtro: tudo o que está atrasado). "A vencer" segue o
 * período; sem filtro é tudo o que ainda vai vencer de hoje em diante (saldo de atendimento futuro,
 * parcelas futuras), senão o saldo a receber de um agendamento para a semana que vem nunca apareceria.
 */
export function resumirPeriodo(
  itens: ItemResumivel[],
  periodo: PeriodoFinanceiro,
  hoje: string,
  periodoInformado: boolean,
): ResumoFinanceiro {
  const resumo: ResumoFinanceiro = { liquidado: 0, aVencer: 0, atrasado: 0 }
  for (const item of itens) {
    const noPeriodo = item.dataReferencia >= periodo.de && item.dataReferencia <= periodo.ate
    if (item.situacao === 'liquidado' && noPeriodo) resumo.liquidado += item.valor
    else if (item.situacao === 'a_vencer' && (periodoInformado ? noPeriodo : item.dataReferencia >= hoje)) {
      resumo.aVencer += item.valor
    }
    else if (item.situacao === 'atrasado') {
      const dentro = periodoInformado ? item.dataReferencia <= periodo.ate : item.dataReferencia < hoje
      if (dentro) resumo.atrasado += item.valor
    }
  }
  return {
    liquidado: Math.round(resumo.liquidado * 100) / 100,
    aVencer: Math.round(resumo.aVencer * 100) / 100,
    atrasado: Math.round(resumo.atrasado * 100) / 100,
  }
}

export type GrupoForma<T> = { forma: string; total: number; itens: T[] }

export function agruparPorForma<T extends { valor: number; forma: string }>(itens: T[]): GrupoForma<T>[] {
  const mapa = new Map<string, GrupoForma<T>>()
  for (const item of itens) {
    const atual = mapa.get(item.forma) ?? { forma: item.forma, total: 0, itens: [] }
    atual.total = Math.round((atual.total + item.valor) * 100) / 100
    atual.itens.push(item)
    mapa.set(item.forma, atual)
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}
