import { describe, expect, it } from 'vitest'
import { anoValidoParaMarcar } from './aniversario-envio'

describe('anoValidoParaMarcar', () => {
  const hoje = new Date('2026-10-30T15:00:00Z')
  it('aceita o ano corrente e anteriores, recusa o ano seguinte', () => {
    expect(anoValidoParaMarcar(2026, hoje)).toBe(true)
    expect(anoValidoParaMarcar(2025, hoje)).toBe(true)
    expect(anoValidoParaMarcar(2027, hoje)).toBe(false)
  })
  it('usa o ano de São Paulo na virada (31/12 22h em SP já é 01/01 UTC)', () => {
    expect(anoValidoParaMarcar(2027, new Date('2027-01-01T01:00:00Z'))).toBe(false)
    expect(anoValidoParaMarcar(2026, new Date('2027-01-01T01:00:00Z'))).toBe(true)
  })
})
