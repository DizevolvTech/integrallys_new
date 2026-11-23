import { fireEvent, render, screen } from '@testing-library/react'
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

describe('Visualizar paciente: foto', () => {
  const comFoto = { id: 'p2', name: 'Camila', cpf: '1', photoUrl: 'http://x/foto.jpg' } as never

  it('com foto, abre o modal do paciente e a foto fica contida no avatar (relative)', () => {
    render(<VisualizarPacienteModal isOpen onClose={() => {}} paciente={comFoto} />)
    expect(screen.getByText('Visualizar paciente')).toBeTruthy()
    const botao = screen.getByRole('button', { name: 'Ampliar foto do paciente' })
    // sem "relative" a imagem (fill = absolute) cobria o modal inteiro
    expect(botao.className).toContain('relative')
    expect(botao.className).toContain('overflow-hidden')
  })

  it('a foto só abre ampliada ao tocar nela', () => {
    render(<VisualizarPacienteModal isOpen onClose={() => {}} paciente={comFoto} />)
    expect(screen.queryByText('Foto ampliada do paciente')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto do paciente' }))
    expect(screen.getByText('Foto ampliada do paciente')).toBeTruthy()
    expect(screen.getByText('Visualizar paciente')).toBeTruthy()
  })
})
