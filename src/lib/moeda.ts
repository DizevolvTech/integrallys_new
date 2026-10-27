const formatadorReal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Dinheiro no padrão brasileiro ("R$ 1.234,50"). Valor inválido vira R$ 0,00. */
export function formatarMoeda(valor: number | string | null | undefined): string {
  const numero = Number(valor)
  return formatadorReal.format(Number.isFinite(numero) ? numero : 0).replace(/\u00a0/g, ' ')
}
