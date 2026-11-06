import { describe, expect, it } from 'vitest'
import { hojeClinicaChave, resolverPeriodo } from './periodo-caixa'

const HOJE = '2026-11-06'

describe('resolverPeriodo', () => {
  it('sem parâmetros: hoje, não é consulta', () => {
    const r = resolverPeriodo({}, HOJE)
    expect(r).toMatchObject({ ok: true, periodo: { de: HOJE, ate: HOJE, consulta: false, multiplo: false } })
  })

  it('dia anterior é consulta, com janela de Brasília (03:00Z a 03:00Z)', () => {
    const r = resolverPeriodo({ data: '2026-11-05' }, HOJE)
    expect(r.ok && r.periodo).toMatchObject({
      consulta: true,
      inicioIso: '2026-11-05T03:00:00.000Z',
      fimIso: '2026-11-06T03:00:00.000Z',
    })
  })

  it('intervalo De/Ate é múltiplo e consulta, mesmo terminando hoje', () => {
    const r = resolverPeriodo({ de: '2026-11-01', ate: HOJE }, HOJE)
    expect(r.ok && r.periodo).toMatchObject({ multiplo: true, consulta: true, fimIso: '2026-11-07T03:00:00.000Z' })
  })

  it('só De: período de um dia', () => {
    const r = resolverPeriodo({ de: '2026-11-03' }, HOJE)
    expect(r.ok && r.periodo).toMatchObject({ de: '2026-11-03', ate: '2026-11-03' })
  })

  it.each([
    [{ data: '2026-13-40' }, 'CAIXA_PERIODO_INVALIDO'],
    [{ data: 'ontem' }, 'CAIXA_PERIODO_INVALIDO'],
    [{ de: '2026-11-05', ate: '2026-11-01' }, 'CAIXA_PERIODO_INVALIDO'],
    [{ data: '2026-11-07' }, 'CAIXA_PERIODO_FUTURO'],
    [{ de: '2026-01-01', ate: HOJE }, 'CAIXA_PERIODO_LONGO'],
  ])('rejeita %j', (params, code) => {
    const r = resolverPeriodo(params, HOJE)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.code).toBe(code)
  })
})

describe('hojeClinicaChave', () => {
  it('23h30 em Brasília ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC', () => {
    expect(hojeClinicaChave(new Date('2026-11-07T02:30:00Z'))).toBe('2026-11-06')
    expect(hojeClinicaChave(new Date('2026-11-07T03:00:00Z'))).toBe('2026-11-07')
  })
})
