import { describe, expect, it } from 'vitest'
import { formatarMargemPct, margemPercentual } from '@/lib/relatorios/margem'

describe('margemPercentual', () => {
  it('calcula a margem sobre o custo com uma casa (exemplo da cliente: 50 -> 150 = 200%)', () => {
    expect(margemPercentual(150, 50)).toBe(200)
    expect(margemPercentual(250, 100)).toBe(150)
    expect(margemPercentual(184.9, 100)).toBe(84.9)
  })

  it('sem custo não há percentual', () => {
    expect(margemPercentual(10, 0)).toBeNull()
    expect(formatarMargemPct(null)).toBe('—')
  })

  it('margem negativa é mantida', () => {
    expect(margemPercentual(100, 130)).toBe(-23.1)
  })

  it('formata em pt-BR', () => {
    expect(formatarMargemPct(45.9)).toBe('45,9%')
  })
})
