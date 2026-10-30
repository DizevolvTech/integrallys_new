import { describe, expect, it } from 'vitest'
import { podeEstornarPagamento, respostaErroEstorno, validarMotivoEstorno } from './estorno-recebimento'

describe('estorno de recebimento', () => {
  it('exige motivo com no mínimo 10 caracteres', () => {
    expect(validarMotivoEstorno('   curto ').ok).toBe(false)
    expect(validarMotivoEstorno(undefined).ok).toBe(false)
    const ok = validarMotivoEstorno('  Valor lançado errado (240 em vez de 120)  ')
    expect(ok.ok && ok.motivo).toBe('Valor lançado errado (240 em vez de 120)')
  })

  it('só estorna recebimento pago e ainda não estornado', () => {
    expect(podeEstornarPagamento({ id: 'a', valor: 240, status: 'Pago', estornadoEm: null })).toBe(true)
    expect(podeEstornarPagamento({ id: 'a', valor: 240, status: 'Pago', estornadoEm: '2026-10-30T10:00:00Z' })).toBe(false)
    expect(podeEstornarPagamento({ id: 'a', valor: 240, status: 'Cancelado', estornadoEm: null })).toBe(false)
    expect(podeEstornarPagamento({ id: 'a', valor: 240, status: 'Pendente', estornadoEm: null })).toBe(false)
  })

  it('traduz códigos da função em status e mensagem', () => {
    expect(respostaErroEstorno('PAGAMENTO_ALREADY_REVERSED').status).toBe(409)
    expect(respostaErroEstorno('CAIXA_FECHADO').message).toMatch(/Abra o caixa/)
    expect(respostaErroEstorno('X', 'falha').status).toBe(500)
  })
})
