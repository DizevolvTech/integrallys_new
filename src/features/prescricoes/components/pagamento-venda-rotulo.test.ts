import { describe, expect, it } from 'vitest'
import { rotuloParcelas } from './pagamento-venda-fields'

describe('rotuloParcelas', () => {
  it('usa "Nx", nunca "1/N"', () => {
    expect(rotuloParcelas(1, 0)).toBe('1x')
    expect(rotuloParcelas(3, 0)).toBe('3x')
  })
  it('com total mostra o valor da parcela', () => {
    expect(rotuloParcelas(1, 89.9)).toBe('1x')
    expect(rotuloParcelas(2, 89.9).replace(/\s/g, ' ')).toBe('2x de R$ 44,95')
  })
})
