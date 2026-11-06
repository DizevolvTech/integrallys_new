import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaixaItem, CaixaSessionState } from '@/hooks/use-caixa'
import { CaixaView } from './caixa-view'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const caixa = vi.hoisted(() => ({
  addMovimentacao: vi.fn().mockResolvedValue(undefined),
  state: { data: [] as unknown[], session: {} as unknown },
}))
vi.mock('@/hooks/use-caixa', () => ({
  useCaixa: () => ({
    data: caixa.state.data,
    session: caixa.state.session,
    isLoading: false,
    error: null,
    openCaixa: vi.fn(),
    closeCaixa: vi.fn(),
    updateMovimentacao: vi.fn(),
    deleteMovimentacao: vi.fn(),
    addMovimentacao: caixa.addMovimentacao,
  }),
}))
vi.mock('@/features/prescricoes/hooks/use-payment-config', () => ({
  usePaymentConfig: () => ({ getCardFee: () => 0, hasMaquininhaConfig: true, isLoading: false }),
}))
vi.mock('@/features/gestao-bancaria/hooks/use-contas-pix', () => ({
  useContasPix: () => ({
    data: [
      { id: 'c1', nome: 'Sicredi', banco: null },
      { id: 'c2', nome: 'Bradesco', banco: null },
    ],
  }),
}))
vi.mock('@/features/caixa/components/use-vinculo-opcoes', () => ({
  useVinculoOpcoes: () => ({ opcoes: [{ value: 'p1', label: 'Maria Silva' }], carregando: false, erro: null }),
}))

const item = (parcial: Partial<CaixaItem>): CaixaItem => ({
  id: 'x',
  descricao: 'Consulta',
  tipo: 'entrada',
  valor: 100,
  data: '06/11/2026 10:00:00',
  dia: '06/11/2026',
  hora: '10:00:00',
  forma: 'dinheiro',
  operador: 'Recepção',
  ...parcial,
})

const sessao = (parcial: Partial<CaixaSessionState> = {}): CaixaSessionState => ({
  sessionId: 's1',
  isOpen: true,
  saldoInicial: 50,
  saldoAtual: 330,
  entradas: 300,
  saidas: 20,
  movimentos: 3,
  openedAt: '2026-11-06T11:00:00.000Z',
  openedByName: 'Ana Recepção',
  closedAt: null,
  temSessao: true,
  consulta: false,
  multiplo: false,
  de: '2026-11-06',
  ate: '2026-11-06',
  resumoFormas: [
    { forma: 'dinheiro', label: 'Dinheiro', value: 100 },
    { forma: 'pix', label: 'PIX', value: 200, contas: [{ label: 'PIX · Sicredi', value: 200 }] },
    { forma: 'cartao_credito', label: 'Cartão crédito', value: 0 },
    { forma: 'cartao_debito', label: 'Cartão débito', value: 0 },
  ],
  listaCortada: false,
  ...parcial,
})

beforeEach(() => {
  caixa.addMovimentacao.mockClear()
  toasts.error.mockClear()
  caixa.state.data = [
    item({ id: '1', descricao: 'Consulta Maria', forma: 'dinheiro', valor: 100, vinculoTipo: 'paciente', vinculoNome: 'Maria Silva' }),
    item({ id: '2', descricao: 'Pix retorno', forma: 'pix', valor: 200, contaBancariaNome: 'Sicredi' }),
    item({ id: '3', descricao: 'Material', tipo: 'saida', valor: 20 }),
  ]
  caixa.state.session = sessao()
})

describe('CaixaView — cards e resumo', () => {
  it('Entradas abre a lista das entradas com forma, conta do PIX, vínculo e total', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByTestId('card-entradas'))
    const painel = within(screen.getByTestId('resumo-entradas'))
    expect(painel.getByText('Consulta Maria')).toBeInTheDocument()
    expect(painel.getByText('Paciente: Maria Silva')).toBeInTheDocument()
    expect(painel.getByText('PIX · Sicredi')).toBeInTheDocument()
    expect(painel.queryByText('Material')).not.toBeInTheDocument()
    expect(painel.getByText(/Total: R\$\s*300,00/)).toBeInTheDocument()
  })

  it('Saídas lista só as saídas', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByTestId('card-saidas'))
    const painel = within(screen.getByTestId('resumo-saidas'))
    expect(painel.getByText('Material')).toBeInTheDocument()
    expect(painel.queryByText('Consulta Maria')).not.toBeInTheDocument()
  })

  it('Saldo atual mostra inicial + entradas − saídas = atual', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByTestId('card-saldo_atual'))
    const painel = within(screen.getByTestId('resumo-saldo_atual'))
    expect(painel.getByText('Saldo inicial').nextSibling).toHaveTextContent(/50,00/)
    expect(painel.getByTestId('saldo-demonstrativo')).toHaveTextContent(/330,00/)
  })

  it('Saldo inicial mostra a abertura (operador e valor)', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByTestId('card-saldo_inicial'))
    const painel = within(screen.getByTestId('resumo-saldo_inicial'))
    expect(painel.getByText('Ana Recepção')).toBeInTheDocument()
    expect(painel.getByText(/50,00/)).toBeInTheDocument()
  })

  it('Resumo lateral mostra o PIX por conta', () => {
    render(<CaixaView />)
    expect(screen.getAllByText(/PIX · Sicredi/).length).toBeGreaterThan(0)
  })

  it('lista de movimentações mostra o vínculo junto da descrição', () => {
    render(<CaixaView />)
    expect(screen.getAllByText('Paciente: Maria Silva').length).toBeGreaterThan(0)
  })
})

describe('CaixaView — dia passado', () => {
  it('é só consulta: botões de abrir, receber, pagar e fechar ficam desligados', () => {
    caixa.state.session = sessao({ consulta: true, isOpen: false, de: '2026-11-05', ate: '2026-11-05' })
    render(<CaixaView />)
    expect(screen.getByText(/Consulta de 05\/11\/2026/)).toBeInTheDocument()
    for (const nome of ['Abrir caixa', 'Recebimento', 'Pagamento', 'Fechar caixa']) {
      expect(screen.getByRole('button', { name: nome })).toBeDisabled()
    }
  })
})

describe('CaixaView — Recebimento', () => {
  it('exige o vínculo e a conta do PIX antes de registrar', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByRole('button', { name: 'Recebimento' }))
    expect(screen.getByTestId('vinculo-campo')).toHaveTextContent('Vinculado a')

    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(toasts.error).toHaveBeenCalledWith('Escolha a quem o lançamento está vinculado.')
    expect(caixa.addMovimentacao).not.toHaveBeenCalled()
  })
})
