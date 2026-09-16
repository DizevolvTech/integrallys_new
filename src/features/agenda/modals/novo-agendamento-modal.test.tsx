import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NovoAgendamentoModal } from './novo-agendamento-modal'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))
vi.mock('@/features/procedimentos/hooks/use-procedimentos', () => ({
  useProcedimentos: () => ({ data: [], isLoading: false, error: null }),
}))
vi.mock('@/features/gestao-bancaria/hooks/use-contas-bancarias', () => ({
  useContasBancarias: () => ({ data: [], isLoading: false, error: null, accessDenied: false }),
}))

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  toasts.error.mockClear()
  toasts.success.mockClear()
})

function renderModal(
  overrides: Partial<ComponentProps<typeof NovoAgendamentoModal>> = {},
) {
  const onRequestFullCadastro = vi.fn()
  render(
    <NovoAgendamentoModal
      isOpen
      onClose={vi.fn()}
      patients={[{ id: '1', nome: 'Ana' }]}
      professionals={['Dr. Teste']}
      onRequestFullCadastro={onRequestFullCadastro}
      {...overrides}
    />,
  )
  return { onRequestFullCadastro }
}

describe('NovoAgendamentoModal — paciente autocomplete + cadastro completo', () => {
  it('mostra opção de cadastro completo quando a busca não acha paciente', async () => {
    const user = userEvent.setup()
    renderModal()

    const search = screen.getByPlaceholderText(/buscar ou digitar nome/i)
    await user.type(search, 'João Inexistente')

    expect(await screen.findAllByRole('button', { name: /cadastrar paciente completo/i })).not.toHaveLength(0)
  })

  it('filtra pacientes cadastrados ao digitar o nome', async () => {
    const user = userEvent.setup()
    renderModal({
      patients: [
        { id: '1', nome: 'Ana Silva' },
        { id: '2', nome: 'Bruno Costa' },
      ],
    })

    await user.type(screen.getByPlaceholderText(/buscar ou digitar nome/i), 'Ana')

    expect(await screen.findByRole('option', { name: /Ana Silva/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Bruno Costa/i })).not.toBeInTheDocument()
  })

  it('solicita cadastro completo com o nome digitado', async () => {
    const user = userEvent.setup()
    const { onRequestFullCadastro } = renderModal()

    await user.type(screen.getByPlaceholderText(/buscar ou digitar nome/i), 'João Inexistente')
    const buttons = await screen.findAllByRole('button', { name: /cadastrar paciente completo/i })
    await user.click(buttons[0])

    await waitFor(() => {
      expect(onRequestFullCadastro).toHaveBeenCalledWith('João Inexistente')
    })
  })

  it('seleciona paciente criado via prop createdPatient', async () => {
    const { rerender } = render(
      <NovoAgendamentoModal
        isOpen
        onClose={vi.fn()}
        patients={[{ id: '1', nome: 'Ana' }]}
        professionals={['Dr. Teste']}
        createdPatient={null}
      />,
    )

    rerender(
      <NovoAgendamentoModal
        isOpen
        onClose={vi.fn()}
        patients={[{ id: '1', nome: 'Ana' }]}
        professionals={['Dr. Teste']}
        createdPatient={{ id: 'novo-1', nome: 'João Completo' }}
      />,
    )

    expect(await screen.findByText(/Selecionado: João Completo/i)).toBeInTheDocument()
  })
})
