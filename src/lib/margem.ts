/** Margem de lucro: diferença em R$ e percentual sobre o custo (custo 50 / venda 150 => R$ 100 e 200%). */
export type Margem = { valor: number; percentual: number | null }

const arredonda = (n: number) => Math.round(n * 100) / 100

export function calcularMargem(custo?: number | null, venda?: number | null): Margem | null {
  if (custo == null || venda == null || !Number.isFinite(custo) || !Number.isFinite(venda)) return null
  return { valor: arredonda(venda - custo), percentual: custo > 0 ? arredonda(((venda - custo) / custo) * 100) : null }
}

/** Totalizador de estoque: soma custo e venda x quantidade e deriva a margem do conjunto. */
export function totalizarMargem(itens: Array<{ quantidade: number; precoCusto?: number | null; precoVenda?: number | null }>) {
  let custo = 0
  let venda = 0
  let quantidade = 0
  for (const i of itens) {
    quantidade += i.quantidade
    custo += (i.precoCusto ?? 0) * i.quantidade
    venda += (i.precoVenda ?? 0) * i.quantidade
  }
  custo = arredonda(custo)
  venda = arredonda(venda)
  return { quantidade, custo, venda, margem: calcularMargem(custo, venda) as Margem }
}

export function formatarMargem(m: Margem | null): string {
  if (!m) return '—'
  const valor = m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return m.percentual == null ? valor : `${valor} (${m.percentual.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`
}
