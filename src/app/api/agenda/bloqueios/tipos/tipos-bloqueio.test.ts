import { describe, expect, it } from 'vitest'
import { adicionarTipoBloqueio, parseTiposBloqueio, TIPO_BLOQUEIO_REGEX } from './tipos-bloqueio'

describe('tipos de bloqueio', () => {
  it('sem valor usa os padrões', () => {
    expect(parseTiposBloqueio(null)).toContain('Folga')
  })
  it('lê JSON e lista por vírgula', () => {
    expect(parseTiposBloqueio('["A"," B "]')).toEqual(['A', 'B'])
    expect(parseTiposBloqueio('A, B')).toEqual(['A', 'B'])
  })
  it('não duplica ignorando maiúsculas', () => {
    expect(adicionarTipoBloqueio(['Folga'], 'folga').criado).toBe(false)
    expect(adicionarTipoBloqueio(['Folga'], 'Dentista')).toEqual({ criado: true, tipos: ['Folga', 'Dentista'] })
  })
  it('valida o nome', () => {
    expect(TIPO_BLOQUEIO_REGEX.test('Produção de marketing')).toBe(true)
    expect(TIPO_BLOQUEIO_REGEX.test('<script>')).toBe(false)
  })
})
