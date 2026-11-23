import { describe, expect, it } from 'vitest'
import {
  esperaDesdeCheckin,
  esperaEntre,
  formatarCronometro,
  formatarMinutos,
  mediaMinutos,
} from '@/lib/tempo-espera'

describe('tempo de espera', () => {
  it('cronômetro em mm:ss e h:mm:ss', () => {
    expect(formatarCronometro(0)).toBe('00:00')
    expect(formatarCronometro(309_000)).toBe('05:09')
    expect(formatarCronometro(59 * 60_000 + 59_999)).toBe('59:59')
    expect(formatarCronometro(3_909_000)).toBe('1:05:09')
    expect(formatarCronometro(-5000)).toBe('00:00')
  })

  it('espera desde o check-in usa o relógio informado, sem fuso do navegador', () => {
    const checkin = '2026-11-23T14:00:00+00:00'
    const agora = Date.parse('2026-11-23T11:12:30-03:00') // = 14:12:30 UTC
    expect(esperaDesdeCheckin(checkin, agora)).toBe(12.5 * 60_000)
    expect(esperaDesdeCheckin(null, agora)).toBeNull()
    expect(esperaDesdeCheckin('lixo', agora)).toBeNull()
    expect(esperaDesdeCheckin(checkin, Date.parse(checkin) - 1000)).toBe(0)
  })

  it('espera encerrada exige os dois registros e ordem correta', () => {
    expect(esperaEntre('2026-11-23T14:00:00Z', '2026-11-23T14:07:30Z')).toBe(450_000)
    expect(esperaEntre(null, '2026-11-23T14:07:30Z')).toBeNull()
    expect(esperaEntre('2026-11-23T14:00:00Z', null)).toBeNull()
    expect(esperaEntre('2026-11-23T14:10:00Z', '2026-11-23T14:07:30Z')).toBeNull()
  })

  it('minutos legíveis', () => {
    expect(formatarMinutos(0.4)).toBe('menos de 1 min')
    expect(formatarMinutos(7.5)).toBe('8 min')
    expect(formatarMinutos('12')).toBe('12 min')
    expect(formatarMinutos(65)).toBe('1 h 05 min')
    expect(formatarMinutos(null)).toBe('—')
  })

  it('média', () => {
    expect(mediaMinutos([])).toBeNull()
    expect(mediaMinutos([5, 10, 12])).toBe(9)
    expect(mediaMinutos([7.5, 8])).toBe(7.8)
  })
})
