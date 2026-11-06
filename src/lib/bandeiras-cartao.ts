/** Bandeiras aceitas na venda (Prescrição/Vendas) paga no cartão de crédito ou débito. */
export const BANDEIRAS_VENDA = ['Mastercard', 'Visa', 'Elo', 'American Express', 'Hipercard', 'Outra'] as const
export type BandeiraVenda = (typeof BANDEIRAS_VENDA)[number]

export function ehBandeiraVenda(valor: unknown): valor is BandeiraVenda {
  return typeof valor === 'string' && (BANDEIRAS_VENDA as readonly string[]).includes(valor)
}
