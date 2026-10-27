// Rótulos do caixa compartilhados pela tela da recepção (Caixa) e pela aba Caixa do gestor.

/** Vídeo de 26/10: "Suprimento" passa a se chamar Recebimento e "Sangria", Pagamento. */
export const ROTULO_ENTRADA_CAIXA = 'Recebimento'
export const ROTULO_SAIDA_CAIXA = 'Pagamento'

export const BANDEIRAS_CARTAO = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outros'] as const

export const FORMAS_RECEBIMENTO_CAIXA = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
] as const

export function isFormaCartao(forma: string): boolean {
  return forma === 'cartao_credito' || forma === 'cartao_debito'
}

export function formaCaixaLabel(forma?: string | null): string {
  switch (forma) {
    case 'cartao_credito':
    case 'credito':
      return 'Crédito'
    case 'cartao_debito':
    case 'debito':
      return 'Débito'
    case 'pix':
      return 'PIX'
    case 'transferencia':
      return 'Transferência'
    default:
      return 'Dinheiro'
  }
}

/** Dia (dd/mm/aaaa) de um movimento, a partir do texto "dd/mm/aaaa, hh:mm:ss". */
export function diaDoMovimento(item: { dia?: string; data?: string }): string {
  if (item.dia) return item.dia
  return (item.data ?? '').split(' ')[0]?.replace(',', '') || '—'
}
