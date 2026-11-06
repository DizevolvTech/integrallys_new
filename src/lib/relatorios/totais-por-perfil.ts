import type { RelatorioTipo } from '@/lib/relatorios/registry'

/** Totalizadores de dinheiro da aba Consultas que a recepção não recebe. */
const TOTAIS_FINANCEIROS_CONSULTAS = ['recebido', 'aberto'] as const

/** Remove do `totais` o que o perfil não pode ver; os demais perfis recebem tudo. */
export function ocultarTotaisFinanceirosDaRecepcao(
  tipo: RelatorioTipo,
  perfil: string,
  totais: Record<string, unknown>,
): Record<string, unknown> {
  if (tipo !== 'consultas' || perfil !== 'recepcao') return totais
  const copia = { ...totais }
  for (const chave of TOTAIS_FINANCEIROS_CONSULTAS) delete copia[chave]
  return copia
}

export const METRICAS_DESEMPENHO = ['agendamentos', 'realizados', 'cancelados', 'faltas', 'pacientes', 'taxa'] as const
export type MetricaDesempenho = (typeof METRICAS_DESEMPENHO)[number]

export function metricaDesempenhoValida(valor: unknown): valor is MetricaDesempenho {
  return typeof valor === 'string' && (METRICAS_DESEMPENHO as readonly string[]).includes(valor)
}
