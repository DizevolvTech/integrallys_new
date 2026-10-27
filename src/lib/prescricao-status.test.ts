import { describe, expect, it } from 'vitest'
import { normalizarStatusPrescricao } from './prescricao-status'

describe('normalizarStatusPrescricao', () => {
  it('unifica masculino/feminino', () => {
    expect(normalizarStatusPrescricao('Ativo')).toBe('Ativa')
    expect(normalizarStatusPrescricao('Ativa')).toBe('Ativa')
    expect(normalizarStatusPrescricao('Cancelado')).toBe('Cancelada')
    expect(normalizarStatusPrescricao('Pendente')).toBe('Pendente')
    expect(normalizarStatusPrescricao('Convertida')).toBe('Convertida')
    expect(normalizarStatusPrescricao('Vencida')).toBe('Vencida')
  })
  it('desconhecido', () => {
    expect(normalizarStatusPrescricao('xyz')).toBe('Outro')
    expect(normalizarStatusPrescricao(null)).toBe('Outro')
  })
})
