import { ehBandeiraVenda } from './bandeiras-cartao'

/** Formas de pagamento aceitas numa venda de Prescrição/Vendas. */
export const FORMAS_VENDA = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'consumo'] as const
export type FormaVenda = (typeof FORMAS_VENDA)[number]

export function ehFormaVenda(forma: unknown): forma is FormaVenda {
  return typeof forma === 'string' && (FORMAS_VENDA as readonly string[]).includes(forma)
}

/**
 * Forma gravada em `caixa_movimentos.forma`. O resumo do caixa só soma 'cartao_credito' / 'cartao_debito';
 * os apelidos antigos 'credito' / 'debito' também viram a forma de cartão.
 */
export function formaCaixaDaVenda(forma: string | null | undefined): string {
  switch (forma) {
    case 'pix':
      return 'pix'
    case 'cartao_credito':
    case 'credito':
      return 'cartao_credito'
    case 'cartao_debito':
    case 'debito':
      return 'cartao_debito'
    default:
      return 'dinheiro'
  }
}

export interface PagamentoVendaEntrada {
  forma: string | null | undefined
  bandeira?: string | null
  contaBancariaId?: string | null
  numeroParcelas?: number | null
}

export interface PagamentoVendaErro {
  code: 'FORMA_PAGAMENTO_OBRIGATORIA' | 'BANDEIRA_OBRIGATORIA' | 'CONTA_PIX_OBRIGATORIA' | 'PARCELAS_INVALIDAS'
  message: string
}

/**
 * Regra única (servidor e tela) para concluir a venda: forma escolhida (consumo vale como forma);
 * cartão exige bandeira; crédito exige parcelas de 1 a 12; PIX exige a conta do PIX.
 * Devolve o primeiro problema, ou null quando pode concluir.
 */
export function validarPagamentoVenda(entrada: PagamentoVendaEntrada): PagamentoVendaErro | null {
  const { forma } = entrada
  if (!ehFormaVenda(forma)) {
    return { code: 'FORMA_PAGAMENTO_OBRIGATORIA', message: 'Escolha a forma de pagamento' }
  }
  if ((forma === 'cartao_credito' || forma === 'cartao_debito') && !ehBandeiraVenda(entrada.bandeira)) {
    return { code: 'BANDEIRA_OBRIGATORIA', message: 'Escolha a bandeira do cartão' }
  }
  if (forma === 'cartao_credito') {
    const parcelas = Number(entrada.numeroParcelas ?? 1)
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 12) {
      return { code: 'PARCELAS_INVALIDAS', message: 'Escolha a quantidade de parcelas (1 a 12)' }
    }
  }
  if (forma === 'pix' && !(typeof entrada.contaBancariaId === 'string' && entrada.contaBancariaId.trim() !== '')) {
    return { code: 'CONTA_PIX_OBRIGATORIA', message: 'Escolha a conta do PIX' }
  }
  return null
}

/** Dados de pagamento que seguem para o movimento do caixa (só o que cada forma usa). */
export function detalhesPagamentoCaixa(entrada: PagamentoVendaEntrada & { valorTotal: number }) {
  const cartao = entrada.forma === 'cartao_credito' || entrada.forma === 'cartao_debito'
  const parcelas = entrada.forma === 'cartao_credito' ? Number(entrada.numeroParcelas ?? 1) : cartao ? 1 : null
  return {
    bandeira: cartao ? (entrada.bandeira ?? null) : null,
    parcelas,
    valor_parcela: parcelas ? Math.round((entrada.valorTotal / parcelas + Number.EPSILON) * 100) / 100 : null,
    conta_bancaria_id: entrada.forma === 'pix' ? (entrada.contaBancariaId ?? null) : null,
  }
}
