import type { ColunaRelatorio } from '@/features/relatorios/relatorio-config'
import { formatData, formatDataHora, ROTULO_FORMA } from '@/features/relatorios/format'

function textoDaCelula(coluna: ColunaRelatorio, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (coluna.tipo === 'data') return formatData(valor)
  if (coluna.tipo === 'dataHora') return formatDataHora(valor)
  if (coluna.tipo === 'forma') return ROTULO_FORMA[String(valor)] ?? String(valor)
  if (coluna.tipo === 'dinheiro' || coluna.tipo === 'pct' || coluna.tipo === 'numero') {
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: coluna.tipo === 'numero' ? 0 : 2 })
  }
  return String(valor)
}

const escapar = (texto: string) => `"${texto.replace(/"/g, '""')}"`

/** Baixa as linhas da página atual em CSV (separador ; para abrir direto no Excel em português). */
export function exportarCsv(tipo: string, colunas: ColunaRelatorio[], linhas: Array<Record<string, unknown>>) {
  const cabecalho = colunas.map((c) => escapar(c.label)).join(';')
  const corpo = linhas.map((l) => colunas.map((c) => escapar(textoDaCelula(c, l[c.key]))).join(';'))
  const blob = new Blob([`\uFEFF${[cabecalho, ...corpo].join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
