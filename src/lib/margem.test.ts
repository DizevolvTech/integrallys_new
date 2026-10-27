import { describe, expect, it } from 'vitest'
import { calcularMargem, formatarMargem, totalizarMargem } from './margem'

describe('margem', () => {
  it('custo 50 e venda 150 => R$ 100 e 200%', () => {
    expect(calcularMargem(50, 150)).toEqual({ valor: 100, percentual: 200 })
  })
  it('custo zero não gera percentual; sem preço não gera margem', () => {
    expect(calcularMargem(0, 80)).toEqual({ valor: 80, percentual: null })
    expect(calcularMargem(null, 80)).toBeNull()
    expect(calcularMargem(10, undefined)).toBeNull()
  })
  it('margem negativa', () => {
    expect(calcularMargem(100, 80)).toEqual({ valor: -20, percentual: -20 })
  })
  it('totaliza quantidade, custo, venda e margem do conjunto', () => {
    const t = totalizarMargem([
      { quantidade: 2, precoCusto: 50, precoVenda: 150 },
      { quantidade: 1, precoCusto: 10, precoVenda: 30 },
    ])
    expect(t).toMatchObject({ quantidade: 3, custo: 110, venda: 330 })
    expect(t.margem).toEqual({ valor: 220, percentual: 200 })
  })
  it('formata em reais e percentual', () => {
    expect(formatarMargem({ valor: 100, percentual: 200 })).toMatch(/R\$\s?100,00 \(200,0%\)/)
    expect(formatarMargem(null)).toBe('—')
  })
})
