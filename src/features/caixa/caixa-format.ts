import { BANDEIRAS_VENDA } from '@/lib/bandeiras-cartao'

// Rótulos do caixa compartilhados pela tela da recepção (Caixa) e pela aba Caixa do gestor.

/** Vídeo de 26/10: "Suprimento" passa a se chamar Recebimento e "Sangria", Pagamento. */
export const ROTULO_ENTRADA_CAIXA = 'Recebimento'
export const ROTULO_SAIDA_CAIXA = 'Pagamento'

/** Mesma lista da venda (Prescrição/Vendas), para o caixa e os relatórios agruparem a bandeira igual. */
export const BANDEIRAS_CARTAO = BANDEIRAS_VENDA

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

/** "Cartão · Visa · 3× de R$ 33,33" / "PIX · Conta PJ Sicredi": a forma com bandeira, parcelas ou conta do PIX. */
export function formaDetalheTexto(item: {
  forma?: string | null
  bandeira?: string | null
  parcelas?: number | null
  valorParcela?: number | null
  contaBancariaNome?: string | null
}): string {
  const partes: string[] = [formaCaixaLabel(item.forma)]
  if (item.contaBancariaNome && item.forma === 'pix') partes.push(item.contaBancariaNome)
  if (item.bandeira) partes.push(item.bandeira)
  if (item.parcelas && item.parcelas > 1) {
    partes.push(
      item.valorParcela != null
        ? `${item.parcelas}× de R$ ${item.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : `${item.parcelas}×`,
    )
  }
  return partes.join(' · ')
}
