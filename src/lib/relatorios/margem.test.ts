import { describe, expect, it } from 'vitest'
import { formatarMargemPct, margemPercentual } from '@/lib/relatorios/margem'

describe('margemPercentual', () => {
  it('calcula a margem sobre o preço de venda com uma casa', () => {
    expect(margemPercentual(250, 100)).toBe(60)
    expect(margemPercentual(184.9, 100)).toBe(45.9)
  })

  it('sem receita não há percentual', () => {
    expect(margemPercentual(0, 10)).toBeNull()
    expect(formatarMargemPct(null)).toBe('—')
  })

  it('margem negativa é mantida', () => {
    expect(margemPercentual(100, 130)).toBe(-30)
  })

  it('formata em pt-BR', () => {
    expect(formatarMargemPct(45.9)).toBe('45,9%')
  })
})
