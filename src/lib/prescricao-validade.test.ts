import { describe, expect, it } from 'vitest'
import { validadeOrcamentoValida, validadePadraoOrcamento } from './prescricao-validade'

describe('validade do orçamento', () => {
  it('padrão é hoje + 7 dias, inclusive na virada de mês', () => {
    expect(validadePadraoOrcamento('2026-11-06')).toBe('2026-11-13')
    expect(validadePadraoOrcamento('2026-12-28')).toBe('2027-01-04')
  })
  it('aceita hoje em diante; recusa passado e formato inválido', () => {
    expect(validadeOrcamentoValida('2026-11-06', '2026-11-06')).toBe(true)
    expect(validadeOrcamentoValida('2026-11-05', '2026-11-06')).toBe(false)
    expect(validadeOrcamentoValida('', '2026-11-06')).toBe(false)
    expect(validadeOrcamentoValida(undefined, '2026-11-06')).toBe(false)
  })
})
