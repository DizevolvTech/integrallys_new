/** Custo e margem de prescrição/venda — só gestor, admin e master recebem esses campos (decidido no servidor). */
export function podeVerCustoMargem(role?: string | null): boolean {
  return role === 'gestor' || role === 'admin' || role === 'master'
}

const arredonda = (n: number) => Math.round(n * 100) / 100

export type LinhaCusto = { quantity: number; unitPrice: number; custoUnitario?: number | null }

/** Margem por item: (preço unitário − custo unitário) × quantidade. Sem custo conhecido => sem margem. */
export function margemDoItem(linha: LinhaCusto) {
  if (linha.custoUnitario == null) return { custoUnitario: undefined, custoTotal: undefined, margem: undefined, margemPercentual: undefined }
  const custoTotal = arredonda(linha.custoUnitario * linha.quantity)
  const receita = arredonda(linha.unitPrice * linha.quantity)
  const margem = arredonda(receita - custoTotal)
  return {
    custoUnitario: arredonda(linha.custoUnitario),
    custoTotal,
    margem,
    margemPercentual: custoTotal > 0 ? arredonda((margem / custoTotal) * 100) : undefined,
  }
}

/** Totais da prescrição: a receita é o valor total já com desconto; o custo soma os itens com custo conhecido. */
export function margemDaPrescricao(linhas: LinhaCusto[], valorTotal: number) {
  const comCusto = linhas.filter((l) => l.custoUnitario != null)
  if (comCusto.length === 0) return { custoTotal: undefined, margemTotal: undefined, margemPercentual: undefined }
  const custoTotal = arredonda(comCusto.reduce((s, l) => s + (l.custoUnitario ?? 0) * l.quantity, 0))
  const margemTotal = arredonda(valorTotal - custoTotal)
  return { custoTotal, margemTotal, margemPercentual: custoTotal > 0 ? arredonda((margemTotal / custoTotal) * 100) : undefined }
}
