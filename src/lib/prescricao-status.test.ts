import { describe, expect, it } from 'vitest'
import { classificarPrescricao, normalizarStatusPrescricao, validadeParaIso } from './prescricao-status'

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


describe('classificarPrescricao', () => {
  const hoje = '2026-10-27'
  it('ativa só com status Ativa e validade futura ou ausente', () => {
    expect(classificarPrescricao('Ativo', '05/11/2026', hoje)).toBe('ativa')
    expect(classificarPrescricao('Ativa', null, hoje)).toBe('ativa')
    expect(classificarPrescricao('Pendente', '2026-11-13', hoje)).toBe('outra')
  })
  it('vencida por status ou por validade passada em registro aberto', () => {
    expect(classificarPrescricao('Vencida', '2026-12-01', hoje)).toBe('vencida')
    expect(classificarPrescricao('Ativo', '2026-10-26', hoje)).toBe('vencida')
    expect(classificarPrescricao('Pendente', '21/10/2026', hoje)).toBe('vencida')
  })
  it('convertida e cancelada não viram ativa nem vencida', () => {
    expect(classificarPrescricao('Convertida', '2020-01-01', hoje)).toBe('concluida')
    expect(classificarPrescricao('Cancelado', '2020-01-01', hoje)).toBe('outra')
  })
  it('validadeParaIso aceita os dois formatos', () => {
    expect(validadeParaIso('05/11/2026')).toBe('2026-11-05')
    expect(validadeParaIso('2026-11-05')).toBe('2026-11-05')
    expect(validadeParaIso('-')).toBeNull()
  })
})
