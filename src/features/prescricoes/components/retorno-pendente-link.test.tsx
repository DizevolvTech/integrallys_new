import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { escolherRetornoPendente, RetornoPendenteLink, rotaDoRetorno } from './retorno-pendente-link'

const item = (extra: object) => ({ pacienteId: 'p1', prescricaoId: null, profissionalId: null, procedimentoId: null, ...extra })

describe('rotaDoRetorno', () => {
  it('abre o novo agendamento de retorno com paciente, especialista e procedimento', () => {
    expect(rotaDoRetorno('p1', { profissionalId: 'u1', procedimentoId: 'pr1' })).toBe(
      '/agenda?modal=novo&tipo=retorno&patientId=p1&profissionalId=u1&procedimentoId=pr1',
    )
  })
  it('sem especialista/procedimento no retorno, leva só o paciente', () => {
    expect(rotaDoRetorno('p1', null)).toBe('/agenda?modal=novo&tipo=retorno&patientId=p1')
  })
})

describe('escolherRetornoPendente', () => {
  const lista = [item({ prescricaoId: 'x', profissionalId: 'novo' }), item({ prescricaoId: 'a1', profissionalId: 'dessa' }), item({ pacienteId: 'p2' })]
  it('prefere o retorno ligado à prescrição', () => {
    expect(escolherRetornoPendente(lista, 'p1', 'a1')?.profissionalId).toBe('dessa')
  })
  it('sem ligação, usa o mais recente do paciente', () => {
    expect(escolherRetornoPendente(lista, 'p1', 'zzz')?.profissionalId).toBe('novo')
  })
  it('paciente sem retorno: null', () => {
    expect(escolherRetornoPendente(lista, 'p9')).toBeNull()
  })
})

describe('RetornoPendenteLink', () => {
  it('sempre abre o novo agendamento de retorno preenchido', async () => {
    const onAbrir = vi.fn()
    render(<RetornoPendenteLink pacienteId="p1" retorno={{ profissionalId: 'u1', procedimentoId: 'pr1' }} onAbrir={onAbrir} />)
    await userEvent.click(screen.getByRole('button', { name: 'Agendar retorno' }))
    expect(onAbrir).toHaveBeenCalledWith('/agenda?modal=novo&tipo=retorno&patientId=p1&profissionalId=u1&procedimentoId=pr1')
  })
})
