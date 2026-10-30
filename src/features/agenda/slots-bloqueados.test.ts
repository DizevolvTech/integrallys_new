import { describe, expect, it } from 'vitest'
import type { AgendaItem } from '@/hooks/use-agenda'
import type { AgendaBloqueio } from './hooks/use-agenda-bloqueios'
import { removerSlotsBloqueados } from './slots-bloqueados'

const slot = (data: string, horario: string, horarioFim: string, profissionalId = 'p1'): AgendaItem => ({
  id: `${data}-${horario}-${profissionalId}`,
  paciente: '',
  profissionalId,
  profissional: 'Dra. Maria Santos',
  horario,
  horarioFim,
  status: 'Disponível',
  data,
})

const bloqueio = (parcial: Partial<AgendaBloqueio>): AgendaBloqueio => ({
  id: 'b',
  profissionalId: 'p1',
  unidadeId: null,
  dataInicio: '2026-10-28',
  dataFim: '2026-11-04',
  horarioInicio: null,
  horarioFim: null,
  diaInteiro: true,
  tipo: 'Férias',
  justificativa: null,
  createdBy: null,
  createdAt: '',
  ...parcial,
})

describe('removerSlotsBloqueados', () => {
  it('remove horários de dia inteiro em bloqueio de vários dias (meio do intervalo)', () => {
    const itens = [slot('02/11/2026', '09:00', '09:30'), slot('05/11/2026', '09:00', '09:30'), slot('27/10/2026', '09:00', '09:30')]
    expect(removerSlotsBloqueados(itens, [bloqueio({})]).map((i) => i.data)).toEqual(['05/11/2026', '27/10/2026'])
  })

  it('bloqueio parcial remove só horários que sobrepõem [início, fim)', () => {
    const b = bloqueio({ diaInteiro: false, dataInicio: '2026-11-02', dataFim: '2026-11-02', horarioInicio: '10:00', horarioFim: '11:00' })
    const itens = [slot('02/11/2026', '09:30', '10:00'), slot('02/11/2026', '10:00', '10:30'), slot('02/11/2026', '10:45', '11:15'), slot('02/11/2026', '11:00', '11:30')]
    expect(removerSlotsBloqueados(itens, [b]).map((i) => i.horario)).toEqual(['09:30', '11:00'])
  })

  it('não afeta outro especialista, mas bloqueio sem especialista vale para todos', () => {
    const itens = [slot('02/11/2026', '09:00', '09:30', 'p2')]
    expect(removerSlotsBloqueados(itens, [bloqueio({})])).toHaveLength(1)
    expect(removerSlotsBloqueados(itens, [bloqueio({ profissionalId: null })])).toHaveLength(0)
  })

  it('mantém atendimentos já agendados', () => {
    const agendado = { ...slot('02/11/2026', '09:00', '09:30'), status: 'Agendado' }
    expect(removerSlotsBloqueados([agendado], [bloqueio({})])).toHaveLength(1)
  })
})
