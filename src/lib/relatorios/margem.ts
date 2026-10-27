import { calcularMargem } from '@/lib/margem'

/** Margem % sobre o CUSTO (regra da cliente: custo 50 / venda 150 => 200%); null sem custo. Uma casa decimal. */
export function margemPercentual(receita: number, custo: number): number | null {
  const pct = calcularMargem(custo, receita)?.percentual
  return pct == null ? null : Math.round(pct * 10) / 10
}

export function formatarMargemPct(valor: number | null): string {
  return valor === null ? '—' : `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
