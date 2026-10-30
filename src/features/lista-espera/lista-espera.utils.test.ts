import { describe, expect, it } from 'vitest'
import {
  buildAgendarUrl,
  diasEmEspera,
  formatDias,
  isAltaPrioridade,
  mediaDiasEmEspera,
  normalizePeriodo,
  periodoOptions,
} from './lista-espera.utils'

const agora = new Date('2026-10-30T12:00:00Z')

describe('lista de espera', () => {
  it('calcula dias de espera e média real', () => {
    expect(diasEmEspera('2026-10-14T13:32:00Z', agora)).toBe(15)
    expect(mediaDiasEmEspera(['2026-10-14T13:32:00Z', '2026-10-28T12:00:00Z'], agora)).toBe(9)
    expect(mediaDiasEmEspera([], agora)).toBe(0)
    expect(diasEmEspera('', agora)).toBeNull()
  })
  it('formata duração', () => {
    expect(formatDias(0)).toBe('hoje')
    expect(formatDias(1)).toBe('há 1 dia')
    expect(formatDias(16)).toBe('há 16 dias')
    expect(formatDias(null)).toBe('-')
  })
  it('alta prioridade inclui urgente', () => {
    expect(isAltaPrioridade('Alta')).toBe(true)
    expect(isAltaPrioridade('Urgente')).toBe(true)
    expect(isAltaPrioridade('Média')).toBe(false)
  })
  it('normaliza período antigo e preserva texto livre', () => {
    expect(normalizePeriodo('manha')).toBe('Manhã')
    expect(normalizePeriodo('tarde')).toBe('Tarde')
    expect(normalizePeriodo('depois das 17h')).toBe('depois das 17h')
    expect(periodoOptions('depois das 17h')).toContain('depois das 17h')
    expect(periodoOptions('manha')).toHaveLength(5)
  })
  it('monta URL de agendamento com preenchimento', () => {
    const url = buildAgendarUrl({ id: 'q1', pacienteId: 'p1', especialistaId: 'e1', procedimentoId: 'pr1' })
    expect(url).toContain('modal=novo')
    expect(url).toContain('patientId=p1')
    expect(url).toContain('profissionalId=e1')
    expect(url).toContain('procedimentoId=pr1')
    expect(url).toContain('listaEsperaId=q1')
  })
})
