import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PrescricaoInput, PrescricaoItem } from '@/hooks/use-prescricoes'
import { PrescricoesView } from './prescricoes-view'

const criar = vi.hoisted(() => vi.fn())
const lista = vi.hoisted(() => ({ atual: [] as PrescricaoItem[] }))

const empurrar = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: empurrar }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/hooks/use-api', () => ({ useApi: () => ({}) }))
vi.mock('@/hooks/use-pacientes', () => ({ usePacientes: () => ({ data: [] }) }))
vi.mock('@/hooks/use-usuarios', () => ({ useUsuarios: () => ({ data: [] }) }))
vi.mock('@/features/estoque/hooks/use-estoque', () => ({ useEstoque: () => ({ data: [] }) }))
const pendentes = vi.hoisted(() => ({ ids: new Set<string>(), agendados: {} as Record<string, string> }))
vi.mock('@/features/retornos/hooks/use-retornos', () => ({
  registrarRetornoMaisTarde: vi.fn(),
  useRetornoPendentePacientes: () => ({ pacientesComRetornoPendente: pendentes.ids, reload: vi.fn() }),
}))
vi.mock('@/features/retornos/retorno-pendente-badge', () => ({ RetornoPendenteBadge: () => <span>Retorno pendente</span> }))
vi.mock('./hooks/use-retornos-agendados', () => ({ useRetornosAgendados: () => ({ retornosAgendados: pendentes.agendados, reload: vi.fn() }) }))
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
    ConverterVendaModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <p>tela-converter-em-venda</p> : null),
    LabelEditorModal: ({ isOpen, dataList }: { isOpen: boolean; dataList: unknown[] }) => (isOpen ? <p>rotulos:{dataList.length}</p> : null),
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

const linha = (extra: Partial<PrescricaoItem>): PrescricaoItem => ({
  id: 'a1',
  pacienteId: 'p1',
  numero: 'EN-5006',
  paciente: 'Fernanda',
  valorTotal: 100,
  status: 'Pendente',
  validade: '30/12/2099',
  items: [{ productName: 'Vitamina D', quantity: 1, unitPrice: 100, total: 100, posology: '1 por dia' }],
  ...extra,
})

describe('PrescricoesView — ações da linha', () => {
  it('o carrinho abre a tela de conversão em venda; os rótulos ficam nos três pontinhos', async () => {
    lista.atual = [linha({})]
    render(<PrescricoesView />)
    expect(screen.queryByText('tela-converter-em-venda')).toBeNull()
    await userEvent.click(screen.getAllByRole('button', { name: 'Converter em venda' })[0])
    expect(screen.getByText('tela-converter-em-venda')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Mais ações' })[0])
    await userEvent.click(await screen.findByRole('menuitem', { name: /Imprimir rótulos/ }))
    expect(screen.getByText('rotulos:1')).toBeInTheDocument()
  })

  it('venda já convertida não tem o carrinho', () => {
    lista.atual = [linha({ status: 'Convertida' })]
    render(<PrescricoesView />)
    expect(screen.queryByRole('button', { name: 'Converter em venda' })).toBeNull()
  })

  it('Pendente com validade futura conta nas Ativas; validade passada vira Vencida', () => {
    lista.atual = [linha({ status: 'Pendente' }), linha({ id: 'a2', numero: 'EN-1', status: 'Pendente', validade: '01/01/2020' })]
    render(<PrescricoesView />)
    expect(screen.queryByText('Pendente')).toBeNull() // vigente aparece como Ativa
    expect(screen.getAllByText('Ativa').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vencida').length).toBeGreaterThan(0)
    const cardAtivas = screen.getByRole('button', { name: /Ativas/ })
    expect(cardAtivas).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /Vencidas/ })).toHaveTextContent('1')
  })
})

describe('PrescricoesView — selo Retorno pendente', () => {
  it('sem retorno marcado abre o agendamento do retorno', async () => {
    empurrar.mockClear()
    pendentes.ids = new Set(['p1'])
    pendentes.agendados = {}
    lista.atual = [linha({})]
    render(<PrescricoesView />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Agendar retorno' })[0])
    expect(empurrar).toHaveBeenCalledWith('/agenda?modal=novo&tipo=retorno&patientId=p1')
  })

  it('com retorno marcado abre a agenda no dia', async () => {
    empurrar.mockClear()
    pendentes.ids = new Set(['p1'])
    pendentes.agendados = { p1: '2026-11-20' }
    lista.atual = [linha({})]
    render(<PrescricoesView />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver retorno na agenda' })[0])
    expect(empurrar).toHaveBeenCalledWith('/agenda?data=2026-11-20')
  })
})
