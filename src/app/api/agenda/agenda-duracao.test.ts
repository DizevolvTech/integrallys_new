import { describe, expect, it } from 'vitest'
import { minutesToHHMM, planejarOcupacao, timeToMinutes } from './agenda-duracao'

const r = (id: string, status: string, i: string, f: string) => ({
  id,
  status,
  horario_inicio: `${i}:00`,
  horario_fim: `${f}:00`,
})

describe('planejarOcupacao', () => {
  it('10:00 com 40min: o slot de 10:40 continua livre, o de 10:30 seria consumido', () => {
    const plano = planejarOcupacao({
      inicioMin: 600,
      fimMin: 640,
      outros: [r('a', 'Disponível', '10:40', '11:20')],
    })
    expect(plano).toEqual({ ok: true, liberarSlotIds: [] })
  })

  it('duração maior (60min) consome o slot seguinte que invade o intervalo', () => {
    const plano = planejarOcupacao({
      inicioMin: 600,
      fimMin: 660,
      outros: [r('a', 'Disponível', '10:40', '11:20'), r('b', 'Disponível', '11:20', '12:00')],
    })
    expect(plano).toEqual({ ok: true, liberarSlotIds: ['a'] })
  })

  it('atendimento já marcado dentro do intervalo bloqueia', () => {
    const plano = planejarOcupacao({
      inicioMin: 600,
      fimMin: 660,
      outros: [r('x', 'Agendado', '10:40', '11:20')],
    })
    expect(plano.ok).toBe(false)
  })

  it('atendimento anterior que ainda não terminou bloqueia o início', () => {
    const plano = planejarOcupacao({
      inicioMin: 630,
      fimMin: 670,
      outros: [r('x', 'Confirmado', '10:00', '10:40')],
    })
    expect(plano.ok).toBe(false)
  })

  it('cancelado e encostado (fim == início) não conflitam', () => {
    expect(
      planejarOcupacao({
        inicioMin: 640,
        fimMin: 680,
        outros: [r('x', 'Agendado', '10:00', '10:40'), r('y', 'Cancelado', '10:40', '11:20')],
      }),
    ).toEqual({ ok: true, liberarSlotIds: [] })
  })
})

describe('helpers de horário', () => {
  it('converte HH:MM e HH:MM:SS', () => {
    expect(timeToMinutes('10:40:00')).toBe(640)
    expect(minutesToHHMM(640)).toBe('10:40')
    expect(timeToMinutes(null)).toBeNull()
  })
})
