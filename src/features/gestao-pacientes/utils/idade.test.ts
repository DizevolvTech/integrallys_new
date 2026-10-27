import { describe, expect, it } from 'vitest'
import { calcularIdade } from './idade'

describe('calcularIdade', () => {
  const hoje = new Date('2026-10-27T12:00:00')
  it('conta anos completos', () => {
    expect(calcularIdade('2000-10-27', hoje)).toBe(26)
    expect(calcularIdade('2000-10-28', hoje)).toBe(25)
  })
  it('menor de idade', () => {
    expect(calcularIdade('2010-01-01', hoje)).toBe(16)
  })
  it('data ausente ou invalida', () => {
    expect(calcularIdade('', hoje)).toBeNull()
    expect(calcularIdade(undefined, hoje)).toBeNull()
    expect(calcularIdade('abc', hoje)).toBeNull()
    expect(calcularIdade('2030-01-01', hoje)).toBeNull()
  })
})
