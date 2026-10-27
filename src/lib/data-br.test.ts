import { describe, expect, it } from 'vitest'
import { dataBrParaIso } from './data-br'

describe('dataBrParaIso', () => {
  it('converte dd/mm/aaaa e mantém ISO', () => {
    expect(dataBrParaIso('15/09/2026')).toBe('2026-09-15')
    expect(dataBrParaIso('2026-09-15')).toBe('2026-09-15')
  })
  it('rejeita datas inválidas', () => {
    expect(dataBrParaIso('31/02/2026')).toBeNull()
    expect(dataBrParaIso('abc')).toBeNull()
    expect(dataBrParaIso(undefined)).toBeNull()
  })
})
