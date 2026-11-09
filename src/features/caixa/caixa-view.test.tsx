import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaixaItem, CaixaSessionState } from '@/hooks/use-caixa'
import { CaixaView } from './caixa-view'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const caixa = vi.hoisted(() => ({
  addMovimentacao: vi.fn().mockResolvedValue(undefined),
  carregarPrevia: vi.fn(),
  estornar: vi.fn(),
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
    carregarPreviaEstorno: caixa.carregarPrevia,
    estornarMovimentacao: caixa.estornar,
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
  estornos: 0,
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
    expect(painel.getAllByText('Consulta Maria').length).toBeGreaterThan(0)
    expect(painel.getAllByText('Paciente: Maria Silva').length).toBeGreaterThan(0)
    expect(painel.getAllByText(/PIX · Sicredi/).length).toBeGreaterThan(0)
    expect(painel.queryByText('Material')).not.toBeInTheDocument()
    expect(painel.getByText(/Total: R\$\s*300,00/)).toBeInTheDocument()
  })

  it('Saídas lista só as saídas', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByTestId('card-saidas'))
    const painel = within(screen.getByTestId('resumo-saidas'))
    expect(painel.getAllByText('Material').length).toBeGreaterThan(0)
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

describe('CaixaView — layout', () => {
  it('janela do resumo no celular: cartões empilhados (data/hora, descrição, vínculo, forma, valor), tabela só de md', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    await user.click(screen.getByTestId('card-entradas'))
    const cartoes = within(screen.getByTestId('resumo-cartoes'))
    expect(screen.getByTestId('resumo-cartoes').className).toContain('md:hidden')
    expect(cartoes.getAllByRole('listitem')).toHaveLength(2)
    expect(cartoes.getByText('Consulta Maria')).toBeInTheDocument()
    expect(cartoes.getByText('Paciente: Maria Silva')).toBeInTheDocument()
    expect(cartoes.getAllByText(/^Forma:/)).toHaveLength(2)
    expect(cartoes.getAllByText(/R\$\s*100,00/)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('tabela de movimentações em 6 colunas, Ações sempre visível e sem rolagem horizontal própria', () => {
    render(<CaixaView />)
    const tabela = screen.getByTestId('caixa-tabela-movimentos')
    expect(tabela.className).not.toContain('overflow-x-auto')
    const cabecalho = within(tabela).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecalho).toEqual(['Data/Hora', 'Descrição', 'Forma', 'Valor', 'Operador', 'Ações'])
    expect(within(tabela).getByRole('columnheader', { name: 'Ações' }).className).toContain('sticky')
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

describe('CaixaView — Estornar', () => {
  const previaVenda = {
    id: 'v1', descricao: 'Venda PRESC-1 - Maria', tipo: 'entrada' as const, valor: 150, origem: 'prescricao', estornavel: true, motivoRecusa: null,
    prescricao: { id: 'p1', numero: 'PRESC-1', status: 'Convertida', tipo: 'Prescrição' },
    produtosEstoque: [{ nome: 'Luvas', quantidade: 2 }], temProdutoEstoque: true,
  }

  beforeEach(() => {
    caixa.carregarPrevia.mockReset()
    caixa.estornar.mockReset()
    toasts.success.mockClear()
    caixa.state.data = [
      item({ id: 'v1', descricao: 'Venda PRESC-1 - Maria', valor: 150, origem: 'prescricao' }),
      item({ id: 'e1', descricao: 'Estorno: Venda antiga', tipo: 'saida', valor: 40, origem: 'estorno', estornoDeId: 'v0' }),
      item({ id: 'v0', descricao: 'Venda antiga', valor: 40, origem: 'prescricao', estornado: true }),
    ]
  })

  async function abrirJanela(user: ReturnType<typeof userEvent.setup>) {
    const tabela = within(screen.getByTestId('caixa-tabela-movimentos'))
    const linha = tabela.getByText('Venda PRESC-1 - Maria').closest('tr') as HTMLElement
    await user.click(within(linha).getByRole('button'))
    await user.click(await screen.findByRole('menuitem', { name: /Estornar/ }))
  }

  it('estorno e movimentação já estornada não oferecem Estornar; a original aparece como Estornado', async () => {
    const user = userEvent.setup({ delay: null })
    render(<CaixaView />)
    const tabela = within(screen.getByTestId('caixa-tabela-movimentos'))
    expect(tabela.getByText('Estornado')).toBeInTheDocument()
    for (const texto of ['Estorno: Venda antiga', 'Venda antiga']) {
      const linha = tabela.getByText(texto).closest('tr') as HTMLElement
      await user.click(within(linha).getByRole('button'))
      expect(screen.queryByRole('menuitem', { name: /Estornar/ })).not.toBeInTheDocument()
      await user.keyboard('{Escape}')
    }
  })

  it('venda com produto: janela com valor, motivo, Devolver (Sim) e Cancelar/Reabrir; confirma com os padrões', async () => {
    const user = userEvent.setup({ delay: null })
    caixa.carregarPrevia.mockResolvedValue(previaVenda)
    caixa.estornar.mockResolvedValue({ caixaMovimentoId: 's1', produtosDevolvidos: 1, prescricaoStatus: 'Cancelado', mensagem: 'Movimentação estornada. Produtos devolvidos ao estoque. Prescrição cancelada.' })
    render(<CaixaView />)
    await abrirJanela(user)
    expect(await screen.findByText('Estornar movimentação')).toBeInTheDocument()
    expect(screen.getByTestId('estorno-valor')).toHaveTextContent(/150,00/)
    expect(await screen.findByRole('button', { name: 'Sim', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reabrir (volta para Ativa)' })).toBeInTheDocument()

    const confirmar = screen.getByRole('button', { name: 'Confirmar estorno' })
    expect(confirmar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo do estorno *'), 'curto')
    expect(confirmar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo do estorno *'), ' e agora longo')
    await user.click(confirmar)
    expect(caixa.estornar).toHaveBeenCalledWith({ id: 'v1', motivo: 'curto e agora longo', devolverEstoque: true, prescricaoAcao: 'cancelar' })
    expect(toasts.success).toHaveBeenCalled()
  })

  it('Não devolver + Reabrir seguem para o servidor; erro do servidor aparece em aviso', async () => {
    const user = userEvent.setup({ delay: null })
    caixa.carregarPrevia.mockResolvedValue(previaVenda)
    caixa.estornar.mockRejectedValue(new Error('O caixa de hoje não está aberto. Abra o caixa para registrar o estorno.'))
    render(<CaixaView />)
    await abrirJanela(user)
    await user.click(await screen.findByRole('button', { name: 'Não' }))
    await user.click(screen.getByRole('button', { name: 'Reabrir (volta para Ativa)' }))
    await user.type(screen.getByLabelText('Motivo do estorno *'), 'trocou a forma de pagamento')
    await user.click(screen.getByRole('button', { name: 'Confirmar estorno' }))
    expect(caixa.estornar).toHaveBeenCalledWith({ id: 'v1', motivo: 'trocou a forma de pagamento', devolverEstoque: false, prescricaoAcao: 'reabrir' })
    expect(toasts.error).toHaveBeenCalledWith('O caixa de hoje não está aberto. Abra o caixa para registrar o estorno.')
  })

  it('lançamento manual: só valor e motivo, sem opções de estoque ou prescrição', async () => {
    const user = userEvent.setup({ delay: null })
    caixa.carregarPrevia.mockResolvedValue({ ...previaVenda, origem: 'manual', prescricao: null, produtosEstoque: [], temProdutoEstoque: false })
    render(<CaixaView />)
    await abrirJanela(user)
    await screen.findByLabelText('Motivo do estorno *')
    expect(screen.queryByRole('button', { name: 'Reabrir (volta para Ativa)' })).not.toBeInTheDocument()
    expect(screen.queryByText('Devolver os produtos ao estoque')).not.toBeInTheDocument()
  })
})
