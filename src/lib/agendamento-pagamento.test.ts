import { describe, expect, it } from 'vitest'
import { resolvePagamentoAgendamentoInput, validarValorContraSaldo } from './agendamento-pagamento'

describe('resolvePagamentoAgendamentoInput', () => {
  it('exige valor e método', () => {
    expect(resolvePagamentoAgendamentoInput({ agendamentoId: 'a1', valor: 0, metodo: 'PIX' }).ok).toBe(
      false,
    )
    expect(
      resolvePagamentoAgendamentoInput({ agendamentoId: 'a1', valor: 10, metodo: '' }).ok,
    ).toBe(false)
  })

  it('cartão exige bandeira', () => {
    const result = resolvePagamentoAgendamentoInput({
      agendamentoId: 'a1',
      valor: 50,
      metodo: 'Cartão de Crédito',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('BANDEIRA_OBRIGATORIA')
  })

  it('pix exige conta', () => {
    const result = resolvePagamentoAgendamentoInput({
      agendamentoId: 'a1',
      valor: 50,
      metodo: 'PIX',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONTA_PIX_OBRIGATORIA')
  })

  it('aceita cartão com bandeira e parcelas', () => {
    const result = resolvePagamentoAgendamentoInput({
      agendamentoId: 'a1',
      valor: 100,
      metodo: 'Cartão de Crédito',
      bandeira: 'Visa',
      parcelas: 3,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.bandeira).toBe('Visa')
      expect(result.data.parcelas).toBe(3)
    }
  })

  it('aceita pix com conta', () => {
    const result = resolvePagamentoAgendamentoInput({
      agendamentoId: 'a1',
      valor: 30,
      metodo: 'PIX',
      contaBancariaId: 'conta-1',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.contaBancariaId).toBe('conta-1')
  })
})

describe('validarValorContraSaldo', () => {
  it('recusa valor acima do saldo em aberto e informa o saldo', () => {
    const r = validarValorContraSaldo({ valorDevido: 300, totalPago: 120, valor: 240 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('VALOR_ACIMA_DO_SALDO')
      expect(r.saldo).toBe(180)
      expect(r.message).toMatch(/180,00/)
    }
  })

  it('aceita valor igual ou menor que o saldo (parcial inclusive)', () => {
    expect(validarValorContraSaldo({ valorDevido: 300, totalPago: 120, valor: 180 }).ok).toBe(true)
    expect(validarValorContraSaldo({ valorDevido: 300, totalPago: 120, valor: 50.5 }).ok).toBe(true)
  })

  it('já quitado: qualquer valor é recusado; sem valor de procedimento não há limite', () => {
    expect(validarValorContraSaldo({ valorDevido: 300, totalPago: 300, valor: 10 }).ok).toBe(false)
    expect(validarValorContraSaldo({ valorDevido: 0, totalPago: 0, valor: 10 }).ok).toBe(true)
  })
})
