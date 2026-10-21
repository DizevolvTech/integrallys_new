import { describe, expect, it } from 'vitest'
import { calcularDinheiroNaGaveta, sugerirTransferenciaCofre, validarTransferenciaCofre } from './fechamento'

describe('fechamento de caixa', () => {
  const movs = [
    { tipo: 'entrada', valor: 400, forma: 'dinheiro' },
    { tipo: 'entrada', valor: 100, forma: null },
    { tipo: 'saida', valor: 200, forma: 'dinheiro' },
    { tipo: 'entrada', valor: 900, forma: 'pix' },
    { tipo: 'entrada', valor: 300, forma: 'cartao_credito' },
  ]
  it('conta só dinheiro na gaveta (exemplo do cliente: 250 -> 550)', () => {
    expect(calcularDinheiroNaGaveta(250, movs)).toBe(550)
  })
  it('sugere transferir 300 e manter os 250 de abertura', () => {
    expect(sugerirTransferenciaCofre(250, 550)).toBe(300)
    expect(sugerirTransferenciaCofre(250, 100)).toBe(0)
  })
  it('valida limites da transferência', () => {
    expect(validarTransferenciaCofre(300, 550)).toBeNull()
    expect(validarTransferenciaCofre(550, 550)).toBeNull()
    expect(validarTransferenciaCofre(550.01, 550)).not.toBeNull()
    expect(validarTransferenciaCofre(-1, 550)).not.toBeNull()
    expect(validarTransferenciaCofre(Number.NaN, 550)).not.toBeNull()
  })
})
