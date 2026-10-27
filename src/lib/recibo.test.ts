import { describe, expect, it } from 'vitest'
import { consultaQuitada, numeroRecibo, rotuloFormaPagamento, vendaEmitiveis } from './recibo'

describe('recibo', () => {
  it('consulta só quitada com pagamento total', () => {
    expect(consultaQuitada(200, 200)).toBe(true)
    expect(consultaQuitada(200, 199.99)).toBe(false)
    expect(consultaQuitada(200, 0)).toBe(false)
    expect(consultaQuitada(0, 50)).toBe(false)
    expect(consultaQuitada(null, null)).toBe(false)
  })
  it('venda só convertida/concluída', () => {
    expect(vendaEmitiveis('Convertida')).toBe(true)
    expect(vendaEmitiveis('Ativa')).toBe(false)
    expect(vendaEmitiveis('Cancelada')).toBe(false)
  })
  it('rótulo da forma de pagamento', () => {
    expect(rotuloFormaPagamento('cartao_credito')).toBe('Cartão de crédito')
    expect(rotuloFormaPagamento('')).toBe('Não informada')
    expect(rotuloFormaPagamento('Boleto')).toBe('Boleto')
  })
  it('numeração', () => {
    expect(numeroRecibo('prescricao', 'abc-123-def')).toBe('REC-ABC123DE')
    expect(numeroRecibo('agendamento', 'abc-123-def')).toBe('REC-AG-ABC123DE')
  })
})
