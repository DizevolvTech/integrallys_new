import { describe, expect, it } from 'vitest'
import { detalhesPagamentoCaixa, formaCaixaDaVenda, validarPagamentoVenda } from './venda-pagamento'

describe('formaCaixaDaVenda', () => {
  it('cartão vira cartao_credito/cartao_debito (o resumo do caixa só soma essas)', () => {
    expect(formaCaixaDaVenda('cartao_credito')).toBe('cartao_credito')
    expect(formaCaixaDaVenda('cartao_debito')).toBe('cartao_debito')
    expect(formaCaixaDaVenda('credito')).toBe('cartao_credito')
    expect(formaCaixaDaVenda('debito')).toBe('cartao_debito')
  })
  it('pix e dinheiro seguem iguais; o resto cai em dinheiro', () => {
    expect(formaCaixaDaVenda('pix')).toBe('pix')
    expect(formaCaixaDaVenda('dinheiro')).toBe('dinheiro')
    expect(formaCaixaDaVenda(null)).toBe('dinheiro')
  })
})

describe('validarPagamentoVenda', () => {
  it('sem forma não conclui', () => {
    expect(validarPagamentoVenda({ forma: null })?.code).toBe('FORMA_PAGAMENTO_OBRIGATORIA')
    expect(validarPagamentoVenda({ forma: '' })?.message).toBe('Escolha a forma de pagamento')
    expect(validarPagamentoVenda({ forma: 'boleto' })?.code).toBe('FORMA_PAGAMENTO_OBRIGATORIA')
  })
  it('consumo, dinheiro valem sem mais nada', () => {
    expect(validarPagamentoVenda({ forma: 'consumo' })).toBeNull()
    expect(validarPagamentoVenda({ forma: 'dinheiro' })).toBeNull()
  })
  it('crédito e débito exigem bandeira; crédito exige parcelas de 1 a 12', () => {
    expect(validarPagamentoVenda({ forma: 'cartao_credito', numeroParcelas: 2 })?.code).toBe('BANDEIRA_OBRIGATORIA')
    expect(validarPagamentoVenda({ forma: 'cartao_debito', bandeira: 'Bandeira X' })?.code).toBe('BANDEIRA_OBRIGATORIA')
    expect(validarPagamentoVenda({ forma: 'cartao_debito', bandeira: 'Visa' })).toBeNull()
    expect(validarPagamentoVenda({ forma: 'cartao_credito', bandeira: 'Elo', numeroParcelas: 13 })?.code).toBe('PARCELAS_INVALIDAS')
    expect(validarPagamentoVenda({ forma: 'cartao_credito', bandeira: 'American Express', numeroParcelas: 12 })).toBeNull()
  })
  it('PIX exige a conta do PIX', () => {
    expect(validarPagamentoVenda({ forma: 'pix' })?.code).toBe('CONTA_PIX_OBRIGATORIA')
    expect(validarPagamentoVenda({ forma: 'pix', contaBancariaId: ' ' })?.code).toBe('CONTA_PIX_OBRIGATORIA')
    expect(validarPagamentoVenda({ forma: 'pix', contaBancariaId: 'c1' })).toBeNull()
  })
})

describe('detalhesPagamentoCaixa', () => {
  it('crédito leva bandeira, parcelas e valor da parcela', () => {
    expect(detalhesPagamentoCaixa({ forma: 'cartao_credito', bandeira: 'Visa', numeroParcelas: 3, valorTotal: 100 })).toEqual({
      bandeira: 'Visa',
      parcelas: 3,
      valor_parcela: 33.33,
      conta_bancaria_id: null,
    })
  })
  it('débito leva bandeira e 1 parcela; PIX leva a conta; dinheiro não leva nada', () => {
    expect(detalhesPagamentoCaixa({ forma: 'cartao_debito', bandeira: 'Elo', valorTotal: 80 })).toMatchObject({ bandeira: 'Elo', parcelas: 1, valor_parcela: 80 })
    expect(detalhesPagamentoCaixa({ forma: 'pix', contaBancariaId: 'c1', valorTotal: 50 })).toEqual({ bandeira: null, parcelas: null, valor_parcela: null, conta_bancaria_id: 'c1' })
    expect(detalhesPagamentoCaixa({ forma: 'dinheiro', bandeira: 'Visa', contaBancariaId: 'c1', valorTotal: 50 })).toEqual({ bandeira: null, parcelas: null, valor_parcela: null, conta_bancaria_id: null })
  })
})
