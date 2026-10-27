/** Margem de lucro sobre o preço de venda (receita), em %; null quando não há receita. */
export function margemPercentual(receita: number, custo: number): number | null {
  if (!Number.isFinite(receita) || receita <= 0) return null
  return Math.round(((receita - custo) / receita) * 1000) / 10
}

export function formatarMargemPct(valor: number | null): string {
  return valor === null ? '—' : `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
