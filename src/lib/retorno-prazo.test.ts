import { describe, expect, it } from 'vitest'
import { calcularPrazoRetorno, rotuloPrazoRetorno } from './retorno-prazo'

describe('calcularPrazoRetorno', () => {
  it('soma 30/60/90/120 dias à data do atendimento', () => {
    expect(calcularPrazoRetorno('30', '2026-10-27')).toEqual({ ok: true, dataPrevista: '2026-11-26', prazoDias: 30 })
    expect(calcularPrazoRetorno('120', '2026-10-27')).toMatchObject({ dataPrevista: '2027-02-24', prazoDias: 120 })
  })
  it('6 meses respeita fim de mês', () => {
    expect(calcularPrazoRetorno('6m', '2026-08-31')).toMatchObject({ ok: true, dataPrevista: '2027-02-28' })
    expect(calcularPrazoRetorno('6m', '2026-10-27')).toMatchObject({ dataPrevista: '2027-04-27' })
  })
  it('liberado não tem data prevista', () => {
    expect(calcularPrazoRetorno('liberado', '2026-10-27')).toEqual({ ok: true, dataPrevista: null, prazoDias: null })
  })
  it('personalizado exige dias inteiros positivos (ex.: 45)', () => {
    expect(calcularPrazoRetorno('custom', '2026-10-27', 45)).toMatchObject({ dataPrevista: '2026-12-11', prazoDias: 45 })
    expect(calcularPrazoRetorno('custom', '2026-10-27', 0).ok).toBe(false)
    expect(calcularPrazoRetorno('custom', '2026-10-27', 1.5).ok).toBe(false)
    expect(calcularPrazoRetorno('custom', '2026-10-27', null).ok).toBe(false)
  })
  it('rejeita tipo e data inválidos', () => {
    expect(calcularPrazoRetorno('15', '2026-10-27').ok).toBe(false)
    expect(calcularPrazoRetorno('30', '27/10/2026').ok).toBe(false)
  })
})

describe('rotuloPrazoRetorno', () => {
  it('mostra dias no personalizado', () => {
    expect(rotuloPrazoRetorno('custom', 45)).toBe('45 dias')
    expect(rotuloPrazoRetorno('6m', null)).toBe('6 meses')
  })
})
