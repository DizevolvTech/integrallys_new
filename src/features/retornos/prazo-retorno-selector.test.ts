import { describe, expect, it } from 'vitest'
import { prazoEscolhido, resumoPrazoRetorno } from './prazo-retorno-selector'

describe('prazoEscolhido', () => {
  it('prazo fixo vai sem dias', () => {
    expect(prazoEscolhido({ tipo: '60', customDias: '' })).toEqual({ tipo: '60' })
  })
  it('personalizado exige dias inteiros positivos', () => {
    expect(prazoEscolhido({ tipo: 'custom', customDias: '45' })).toEqual({ tipo: 'custom', dias: 45 })
    expect(prazoEscolhido({ tipo: 'custom', customDias: '' })).toEqual({ erro: 'Informe um prazo válido em dias.' })
  })
})

describe('resumoPrazoRetorno', () => {
  it('mostra a data prevista antes de confirmar', () => {
    expect(resumoPrazoRetorno({ tipo: '30', customDias: '' }, '2026-10-27')).toBe('Retorno previsto para 26/11/2026.')
    expect(resumoPrazoRetorno({ tipo: '6m', customDias: '' }, '2026-10-27')).toBe('Retorno previsto para 27/04/2027.')
    expect(resumoPrazoRetorno({ tipo: 'custom', customDias: '45' }, '2026-10-27')).toBe('Retorno previsto para 11/12/2026.')
  })
  it('liberado não tem data', () => {
    expect(resumoPrazoRetorno({ tipo: 'liberado', customDias: '' }, '2026-10-27')).toContain('liberado')
  })
})
