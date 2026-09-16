import { describe, expect, it } from 'vitest'
import { buildAutoSku, isProdutoDisponivelParaOrcamento, resolveEstoqueStatus } from './estoque-status'

describe('estoque-status', () => {
  it('marca indisponível com qty <= 0', () => {
    expect(resolveEstoqueStatus(0)).toBe('Indisponível')
    expect(resolveEstoqueStatus(-1)).toBe('Indisponível')
    expect(resolveEstoqueStatus(1)).toBe('Disponível')
  })

  it('gera SKU automático', () => {
    const sku = buildAutoSku({
      unidadeId: 'abcd-1234',
      sequence: 7,
      now: new Date('2026-09-14T12:00:00'),
    })
    expect(sku).toBe('SKU-ABCD-20260914-0007')
  })

  it('filtra orçamento só disponíveis', () => {
    expect(isProdutoDisponivelParaOrcamento({ status: 'Disponível', quantidade: 2 })).toBe(true)
    expect(isProdutoDisponivelParaOrcamento({ status: 'Indisponível', quantidade: 5 })).toBe(false)
    expect(isProdutoDisponivelParaOrcamento({ status: 'Disponível', quantidade: 0 })).toBe(false)
  })
})
