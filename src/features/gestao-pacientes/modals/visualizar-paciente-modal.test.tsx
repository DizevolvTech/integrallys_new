import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/documentacao-gerar', () => ({ DocumentosDoPacienteCard: () => <div>docs</div> }))
vi.mock('@/features/gestao-pacientes/components/exames-paciente-card', () => ({ ExamesPacienteCard: () => <div>exames</div> }))
vi.mock('@/lib/api-client', () => ({ apiClient: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { VisualizarPacienteModal } from './visualizar-paciente-modal'

describe('Visualizar paciente: rolagem interna', () => {
  it('limita a altura à tela e rola o corpo por dentro (Salvar não fica fora da tela)', () => {
    render(
      <VisualizarPacienteModal
        isOpen
        onClose={() => {}}
        paciente={{ id: 'p1', name: 'Ana', cpf: '1' } as never}
        initialTab="crm"
      />,
    )
    const corpo = screen.getByTestId('visualizar-paciente-corpo')
    expect(corpo.className).toContain('overflow-y-auto')
    expect(corpo.className).toContain('min-h-0')
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('max-h-[90dvh]')
    expect(dialog.className).toContain('flex-col')
    // overflow-hidden no conteúdo é o que cortava o final do modal sem barra
    expect(dialog.className).not.toMatch(/overflow-y-auto/)
    expect(corpo.contains(screen.getByText('Salvar estágio'))).toBe(true)
  })
})
