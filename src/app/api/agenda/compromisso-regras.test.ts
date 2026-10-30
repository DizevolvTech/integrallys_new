import { describe, expect, it } from 'vitest'
import { bloqueioSobrepoe, normalizarParticipanteIds, resolverIntervaloCompromisso } from './compromisso-regras'

describe('resolverIntervaloCompromisso', () => {
  it('17:00 com 45 min cobre até 17:45', () => {
    const r = resolverIntervaloCompromisso({ horario: '17:00', duracaoMin: 45 })
    expect(r.ok && r.intervalo).toMatchObject({ inicioMin: 1020, fimMin: 1065, horarioFim: '17:45' })
  })
  it('usa horarioFim quando enviado e padrão de 30 min sem nada', () => {
    const r1 = resolverIntervaloCompromisso({ horario: '09:00', horarioFim: '10:30' })
    expect(r1.ok && r1.intervalo.fimMin).toBe(630)
    const r2 = resolverIntervaloCompromisso({ horario: '09:00' })
    expect(r2.ok && r2.intervalo.horarioFim).toBe('09:30')
  })
  it('recusa fim antes do início, horário inválido e passagem de dia', () => {
    expect(resolverIntervaloCompromisso({ horario: '10:00', horarioFim: '09:00' }).ok).toBe(false)
    expect(resolverIntervaloCompromisso({ horario: 'x' }).ok).toBe(false)
    expect(resolverIntervaloCompromisso({ horario: '23:30', duracaoMin: 60 }).ok).toBe(false)
  })
})

describe('bloqueioSobrepoe', () => {
  const base = { profissional_id: 'p1', data_inicio: '2026-10-30', data_fim: '2026-10-30', horario_inicio: '17:00:00', horario_fim: '17:45:00', dia_inteiro: false }
  const alvo = (inicioMin: number, fimMin: number) => ({ profissionalId: 'p1', dataIso: '2026-10-30', inicioMin, fimMin })
  it('slot das 17:20 cai dentro do bloqueio 17:00-17:45; 17:45 não', () => {
    expect(bloqueioSobrepoe(base, alvo(1040, 1060))).toBe(true)
    expect(bloqueioSobrepoe(base, alvo(1065, 1085))).toBe(false)
    expect(bloqueioSobrepoe(base, alvo(990, 1020))).toBe(false)
  })
  it('respeita profissional, data e dia inteiro', () => {
    expect(bloqueioSobrepoe({ ...base, profissional_id: 'p2' }, alvo(1020, 1050))).toBe(false)
    expect(bloqueioSobrepoe({ ...base, profissional_id: null }, alvo(1020, 1050))).toBe(true)
    expect(bloqueioSobrepoe({ ...base, dia_inteiro: true, horario_inicio: null, horario_fim: null }, alvo(60, 90))).toBe(true)
    expect(bloqueioSobrepoe(base, { ...alvo(1020, 1050), dataIso: '2026-10-31' })).toBe(false)
  })
})

describe('normalizarParticipanteIds', () => {
  it('filtra inválidos e duplicados', () => {
    const id = '8a6901e8-f4df-4154-a70e-79ad7fec2652'
    expect(normalizarParticipanteIds([id, id.toUpperCase(), 'abc', 3, null])).toEqual([id])
    expect(normalizarParticipanteIds('x')).toEqual([])
  })
})
