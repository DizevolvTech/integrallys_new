import { formatData } from '@/features/relatorios/format'
import type { FonteOpcoes, OpcaoFiltro } from '@/features/relatorios/hooks/use-opcoes-filtro'
import type { FiltroRelatorio } from '@/features/relatorios/relatorio-config'

/** Descreve os filtros ativos ("Unidade: Centro") para o cabeçalho do PDF e do Excel. */
export function descreverFiltros(
  filtros: FiltroRelatorio[],
  valores: Record<string, string>,
  opcoes: Record<FonteOpcoes, OpcaoFiltro[]>,
  proprio = false,
): string[] {
  const frases: string[] = []
  for (const filtro of filtros) {
    if (proprio && filtro.ocultarSeProprio) continue
    const valor = valores[filtro.key]
    if (!valor || valor === 'todos' || valor === 'todas') continue
    let texto = valor
    if (filtro.tipo === 'data') texto = formatData(valor)
    if (filtro.tipo === 'select') {
      const lista = filtro.opcoes ?? (filtro.fonte ? opcoes[filtro.fonte] : [])
      texto = lista.find((o) => o.value === valor)?.label ?? valor
    }
    frases.push(`${filtro.label}: ${texto}`)
  }
  return frases
}
