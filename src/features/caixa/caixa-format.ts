// Rótulos do caixa compartilhados pela tela da recepção (Caixa) e pela aba Caixa do gestor.

/** Vídeo de 26/10: "Suprimento" passa a se chamar Recebimento e "Sangria", Pagamento. */
export const ROTULO_ENTRADA_CAIXA = 'Recebimento'
export const ROTULO_SAIDA_CAIXA = 'Pagamento'

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
