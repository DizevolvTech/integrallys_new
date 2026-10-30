import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PrescricaoInput, PrescricaoItem } from '@/hooks/use-prescricoes'
import { PrescricoesView } from './prescricoes-view'

const criar = vi.hoisted(() => vi.fn())
const lista = vi.hoisted(() => ({ atual: [] as PrescricaoItem[] }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/hooks/use-api', () => ({ useApi: () => ({}) }))
vi.mock('@/hooks/use-pacientes', () => ({ usePacientes: () => ({ data: [] }) }))
vi.mock('@/hooks/use-usuarios', () => ({ useUsuarios: () => ({ data: [] }) }))
vi.mock('@/features/estoque/hooks/use-estoque', () => ({ useEstoque: () => ({ data: [] }) }))
vi.mock('@/features/retornos/hooks/use-retornos', () => ({
  registrarRetornoMaisTarde: vi.fn(),
  useRetornoPendentePacientes: () => ({ pacientesComRetornoPendente: new Set(), reload: vi.fn() }),
}))
vi.mock('@/features/retornos/retorno-pendente-badge', () => ({ RetornoPendenteBadge: () => null }))
vi.mock('@/features/recibos', () => ({ ReciboModal: () => null }))
vi.mock('@/hooks/use-prescricoes', () => ({
  usePrescricoes: () => ({
    data: lista.atual,
    error: null,
    isLoading: false,
    createPrescricao: criar,
    updatePrescricao: vi.fn(),
    deletePrescricao: vi.fn(),
  }),
}))
// O modal real é testado à parte; aqui só importa o contrato do `onSave` (precisa devolver a promessa da gravação).
vi.mock('./modals', () => {
  const Nulo = () => null
  return {
    AgendarRetornoModal: Nulo,
    DetalhesVendaModal: Nulo,
    EditarPrescricaoModal: Nulo,
    ExcluirPrescricaoModal: Nulo,
    CardDetalheModal: Nulo,
    GerarVendaModal: Nulo,
    NovaVendaModal: function NovaVendaStub({ onSave }: { onSave: (p: PrescricaoInput) => Promise<void> | void }) {
      const [resultado, setResultado] = useState('')
      return (
        <div>
          <button
            type="button"
            onClick={() =>
              Promise.resolve(onSave({ pacienteId: 'p', valorTotal: 1, status: 'Convertida' })).then(
                () => setResultado('gravou'),
                (err: Error) => setResultado(`falhou: ${err.message}`),
              )
            }
          >
            finalizar-stub
          </button>
          <p>{resultado}</p>
        </div>
      )
    },
  }
})

describe('PrescricoesView — nova venda', () => {
  it('repassa a falha do servidor ao modal em vez de engoli-la (venda não gravada não pode parecer feita)', async () => {
    criar.mockRejectedValueOnce(new Error('Caixa não aberto — abra o caixa do dia antes de finalizar a venda'))
    render(<PrescricoesView />)
    await userEvent.click(screen.getByRole('button', { name: 'finalizar-stub' }))
    await waitFor(() =>
      expect(screen.getByText(/falhou: Caixa não aberto/)).toBeInTheDocument(),
    )
  })

  it('só avisa sucesso quando a gravação termina', async () => {
    criar.mockResolvedValueOnce(undefined)
    render(<PrescricoesView />)
    await userEvent.click(screen.getByRole('button', { name: 'finalizar-stub' }))
    await waitFor(() => expect(screen.getByText('gravou')).toBeInTheDocument())
  })
})
