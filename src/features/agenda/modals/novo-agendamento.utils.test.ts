import { describe, expect, it } from 'vitest'
import { mensagemSemHorario, resolveModalidade } from './novo-agendamento.utils'

describe('resolveModalidade (modal → payload)', () => {
  it('online → enum "Online" e mantém a plataforma', () => {
    expect(resolveModalidade('online', 'google_meet')).toEqual({
      modalidade: 'Online',
      plataformaOnline: 'google_meet',
    })
  })

  it('híbrido → "Hibrido" SEM acento (enum public.modalidade_atendimento) e mantém a plataforma', () => {
    expect(resolveModalidade('hibrido', 'zoom')).toEqual({
      modalidade: 'Hibrido',
      plataformaOnline: 'zoom',
    })
  })

  it('presencial → "Presencial" e zera a plataforma (sem lixo)', () => {
    expect(resolveModalidade('presencial', 'google_meet')).toEqual({
      modalidade: 'Presencial',
      plataformaOnline: undefined,
    })
  })
})

describe('mensagemSemHorario', () => {
  const base = { hoje: '2026-10-27', encaixe: false, temHorarios: true }
  it('data passada sem encaixe explica e sugere encaixe', () => {
    const msg = mensagemSemHorario({ ...base, data: '2026-10-20' })
    expect(msg).toContain('já passou')
    expect(msg).toContain('Encaixe')
  })
  it('hoje sem horários restantes é tratado como passado', () => {
    expect(mensagemSemHorario({ ...base, data: '2026-10-27', temHorarios: false })).toContain('já passou')
  })
  it('data futura sem horário pede seleção/grade', () => {
    expect(mensagemSemHorario({ ...base, data: '2026-11-02', temHorarios: false })).toContain('Selecione um horário')
  })
  it('encaixe ligado e passado pede horário futuro', () => {
    expect(mensagemSemHorario({ ...base, data: '2026-10-27', encaixe: true, horarioPassado: true })).toContain('futuro')
  })
})
