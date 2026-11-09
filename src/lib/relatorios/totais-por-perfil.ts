import type { RelatorioTipo } from '@/lib/relatorios/registry'

/** Totalizadores de dinheiro da aba Consultas que a recepção não recebe. */
const TOTAIS_FINANCEIROS_CONSULTAS = ['recebido', 'aberto'] as const

/** Totalizador do Estoque (posição) que a recepção não recebe: o valor de venda de todo o estoque. */
const TOTAIS_FINANCEIROS_ESTOQUE = ['venda'] as const

/** Remove do `totais` o que o perfil não pode ver; os demais perfis recebem tudo. */
export function ocultarTotaisFinanceirosDaRecepcao(
  tipo: RelatorioTipo,
  perfil: string,
  totais: Record<string, unknown>,
): Record<string, unknown> {
  if (perfil !== 'recepcao') return totais
  const ocultar: readonly string[] =
    tipo === 'consultas' ? TOTAIS_FINANCEIROS_CONSULTAS : tipo === 'estoque-posicao' ? TOTAIS_FINANCEIROS_ESTOQUE : []
  if (ocultar.length === 0) return totais
  const copia = { ...totais }
  for (const chave of ocultar) delete copia[chave]
  return copia
}

export const METRICAS_DESEMPENHO = ['agendamentos', 'realizados', 'cancelados', 'faltas', 'pacientes', 'taxa'] as const
export type MetricaDesempenho = (typeof METRICAS_DESEMPENHO)[number]

export function metricaDesempenhoValida(valor: unknown): valor is MetricaDesempenho {
  return typeof valor === 'string' && (METRICAS_DESEMPENHO as readonly string[]).includes(valor)
}
