import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RetornoPendenteLink, rotaDoRetorno } from './retorno-pendente-link'

describe('rotaDoRetorno', () => {
  it('com retorno marcado abre a agenda no dia; sem retorno abre o novo agendamento de retorno', () => {
    expect(rotaDoRetorno('p1', '2026-11-20')).toBe('/agenda?data=2026-11-20')
    expect(rotaDoRetorno('p1', null)).toBe('/agenda?modal=novo&tipo=retorno&patientId=p1')
  })
})

describe('RetornoPendenteLink', () => {
  it('sem retorno marcado: título "Agendar retorno" e abre o agendamento do retorno', async () => {
    const onAbrir = vi.fn()
    render(<RetornoPendenteLink pacienteId="p1" onAbrir={onAbrir} />)
    const botao = screen.getByRole('button', { name: 'Agendar retorno' })
    expect(botao).toHaveAttribute('title', 'Agendar retorno')
    await userEvent.click(botao)
    expect(onAbrir).toHaveBeenCalledWith('/agenda?modal=novo&tipo=retorno&patientId=p1')
  })
  it('com retorno marcado: título "Ver retorno na agenda" e abre a agenda no dia', async () => {
    const onAbrir = vi.fn()
    render(<RetornoPendenteLink pacienteId="p1" dataRetornoMarcado="2026-11-20" onAbrir={onAbrir} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver retorno na agenda' }))
    expect(onAbrir).toHaveBeenCalledWith('/agenda?data=2026-11-20')
  })
})
