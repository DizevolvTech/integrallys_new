import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { AgendaDayView } from './agenda-day-view'
import type { AgendaSlot } from '../agenda.types'

const slot: AgendaSlot = {
  id: 'a1',
  hora: '09:00',
  horaFim: '09:30',
  pacienteId: 'p1',
  paciente: 'Ana Rodrigues',
  profissional: 'Dra. Maria',
  status: 'Agendado',
  data: '2026-11-23',
}

function abrirMenu(item: AgendaSlot) {
  const onOpenSlotModal = vi.fn()
  render(
    <AgendaDayView
      dayFilteredItems={[item]}
      selectedProfessional="todos"
      showDaySlots
      onOpenSlotModal={onOpenSlotModal}
      onOpenCharge={vi.fn()}
      onCallSpecialist={vi.fn()}
      onStatusChange={vi.fn()}
    />,
  )
  const gatilho = screen.getByLabelText('Mais ações')
  fireEvent.pointerDown(gatilho, { button: 0, pointerType: 'mouse' })
  return onOpenSlotModal
}

describe('Agenda: menu do agendamento', () => {
  it('tem "Visualizar documentos" e abre o modal de documentos do agendamento', () => {
    const onOpenSlotModal = abrirMenu(slot)
    fireEvent.click(screen.getByText('Visualizar documentos'))
    expect(onOpenSlotModal).toHaveBeenCalledWith('documentos', slot)
  })

  it('não mostra o item quando o slot não tem paciente', () => {
    abrirMenu({ ...slot, paciente: '', pacienteId: undefined })
    expect(screen.queryByText('Visualizar documentos')).toBeNull()
    expect(screen.getByText('Ficha do paciente')).toBeTruthy()
  })
})
