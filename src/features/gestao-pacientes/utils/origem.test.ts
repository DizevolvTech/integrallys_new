import { describe, expect, it } from 'vitest'
import { descreverOrigem } from './origem'

describe('origem do paciente na ficha', () => {
  it('mostra quem indicou', () => {
    expect(descreverOrigem('indicacao', 'Camila Ribeiro')).toBe('Indicação de Camila Ribeiro')
  })
  it('outras origens', () => {
    expect(descreverOrigem('google', '')).toBe('Google')
    expect(descreverOrigem('outros', 'Feira')).toBe('Outros — Feira')
    expect(descreverOrigem('Nao informado', '')).toBe('-')
    expect(descreverOrigem(undefined, undefined)).toBe('-')
  })
})
