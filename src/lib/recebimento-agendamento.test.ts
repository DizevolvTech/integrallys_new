import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/app-api', () => ({ getAppSupabase: vi.fn() }))
vi.mock('@/lib/request-auth', () => ({ getScopedUnitId: vi.fn(), isScopedRole: vi.fn() }))

import { formaCaixaLabel } from '@/features/caixa/caixa-format'
import { hojeClinica, metodoParaFormaCaixa } from './recebimento-agendamento'

describe('recebimento da agenda no caixa', () => {
  it('converte o método da cobrança na forma do caixa', () => {
    expect(metodoParaFormaCaixa('Dinheiro')).toBe('dinheiro')
    expect(metodoParaFormaCaixa('PIX')).toBe('pix')
    expect(metodoParaFormaCaixa('Cartão de Crédito')).toBe('cartao_credito')
    expect(metodoParaFormaCaixa('Cartão de Débito')).toBe('cartao_debito')
    expect(metodoParaFormaCaixa('Transferência')).toBe('transferencia')
  })
  it('só dinheiro conta como dinheiro (o cofre recebe só dinheiro)', () => {
    for (const m of ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência']) {
      expect(metodoParaFormaCaixa(m)).not.toBe('dinheiro')
    }
  })
  it('rótulo da forma na tabela do caixa', () => {
    expect(formaCaixaLabel('cartao_credito')).toBe('Crédito')
    expect(formaCaixaLabel('debito')).toBe('Débito')
    expect(formaCaixaLabel('transferencia')).toBe('Transferência')
    expect(formaCaixaLabel(null)).toBe('Dinheiro')
  })
  it('dia do caixa segue o fuso da clínica', () => {
    expect(hojeClinica(new Date('2026-10-27T01:30:00Z'))).toBe('2026-10-26')
  })
})
