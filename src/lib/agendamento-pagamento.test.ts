import { describe, expect, it } from 'vitest'
import { resolvePagamentoAgendamentoInput } from './agendamento-pagamento'

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
