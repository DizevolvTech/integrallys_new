import { describe, expect, it } from 'vitest'
import { proximaDataAgendaPorPaciente } from './prescricao-retorno-agenda'
import { rotaDoRetorno } from '@/features/prescricoes/components/retorno-pendente-link'

describe('proximaDataAgendaPorPaciente', () => {
  it('só consulta futura (Carlos 10/11): usa essa data', () => {
    const r = proximaDataAgendaPorPaciente([{ paciente_id: 'c', data_agendamento: '2026-11-10', tipo: 'consulta' }])
    expect(r).toEqual({ c: '2026-11-10' })
    expect(rotaDoRetorno('c', r.c)).toBe('/agenda?data=2026-11-10')
  })
  it('prefere retorno (tipo ou procedimento) a um agendamento anterior de outro tipo', () => {
    const r = proximaDataAgendaPorPaciente([
      { paciente_id: 'a', data_agendamento: '2026-11-08', tipo: 'consulta' },
      { paciente_id: 'a', data_agendamento: '2026-11-12', tipo: 'consulta', procedimentos: { nome: 'Retorno (até 30 dias)' } },
      { paciente_id: 'a', data_agendamento: '2026-11-20', tipo: 'retorno' },
      { paciente_id: 'b', data_agendamento: '2026-11-09', tipo: 'Retorno' },
    ])
    expect(r).toEqual({ a: '2026-11-12', b: '2026-11-09' })
  })
  it('paciente sem agendamento futuro não aparece', () => {
    expect(proximaDataAgendaPorPaciente([])).toEqual({})
  })
})
