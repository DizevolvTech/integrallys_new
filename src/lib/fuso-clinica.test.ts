import { describe, expect, it } from 'vitest'
import { formatarDataHoraClinica, formatarHoraClinica } from './fuso-clinica'

describe('fuso da clínica', () => {
  it('converte UTC para Brasília (3 h a menos)', () => {
    expect(formatarDataHoraClinica('2026-10-27T15:13:37.097831+00:00')).toBe('27/10/2026, 12:13')
    expect(formatarHoraClinica('2026-10-27T15:13:00Z')).toBe('12:13')
  })
  it('vira o dia certo perto da meia-noite UTC', () => {
    expect(formatarDataHoraClinica('2026-10-28T01:30:00Z')).toBe('27/10/2026, 22:30')
  })
  it('trata vazio e texto inválido', () => {
    expect(formatarDataHoraClinica(null)).toBe('—')
    expect(formatarDataHoraClinica('lixo')).toBe('lixo')
    expect(formatarHoraClinica('lixo')).toBe('')
  })
})
