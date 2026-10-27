import { describe, expect, it } from 'vitest'
import { formatarMoeda } from './moeda'

describe('formatarMoeda', () => {
  it('usa vírgula decimal e ponto de milhar', () => {
    expect(formatarMoeda(95)).toBe('R$ 95,00')
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50')
  })
  it('tolera valor inválido', () => {
    expect(formatarMoeda(null)).toBe('R$ 0,00')
    expect(formatarMoeda('abc')).toBe('R$ 0,00')
  })
})
