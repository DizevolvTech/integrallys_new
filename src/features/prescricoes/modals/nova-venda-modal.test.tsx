import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createContext, useContext, type ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NovaVendaModal } from './nova-venda-modal'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))
vi.mock('@/features/prescricoes/hooks/use-payment-config', () => ({ usePaymentConfig: () => ({ getCardFee: () => 0 }) }))
vi.mock('@/features/gestao-bancaria/hooks/use-contas-pix', () => ({
  useContasPix: () => ({ data: [{ id: 'conta1', nome: 'Conta Nubank', banco: 'Nu' }] }),
}))
vi.mock('@/features/formas-pagamento/hooks/use-descontos-forma', () => ({
  useDescontosForma: () => ({
    descontos: { pix: 5, dinheiro: 0, cartao_debito: 0, cartao_credito: 0 },
    isLoading: false,
    error: null,
    salvar: vi.fn(),
  }),
}))

// Select do Radix não abre em jsdom: troca por botões simples com a mesma API.
const SelectCtx = createContext<(value: string) => void>(() => {})
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: ReactNode }) => (
    <SelectCtx.Provider value={onValueChange}>{children}</SelectCtx.Provider>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: function Item({ value, children }: { value: string; children: ReactNode }) {
    const onChange = useContext(SelectCtx)
    return (
      <button type="button" role="option" onClick={() => onChange(value)}>
        {children}
      </button>
    )
  },
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

async function montarVenda(onSave: (payload: unknown) => Promise<void>) {
  const user = userEvent.setup()
  render(
    <NovaVendaModal
      isOpen
      onClose={vi.fn()}
      patients={[{ id: 'p1', nome: 'CAMILA MARIA DE OLIVEIRA JESUS' }]}
      products={[{ id: 'prod1', name: 'Suplemento Vitamina D 5000UI', stock: 10, price: 100, costPrice: 40 }]}
      onSave={onSave}
    />,
  )
  await user.click(screen.getByRole('option', { name: 'CAMILA MARIA DE OLIVEIRA JESUS' }))
  await user.click(screen.getByRole('option', { name: /Suplemento Vitamina D/ }))
  await user.click(screen.getByRole('button', { name: /adicionar/i }))
  return user
}

describe('NovaVendaModal — venda finalizada', () => {
  it('não mostra "realizada" nem fecha quando o servidor recusa (ex.: caixa fechado)', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Caixa não aberto — abra o caixa do dia antes de finalizar a venda'))
    const user = await montarVenda(onSave)
    await user.click(screen.getByRole('button', { name: 'Crédito' }))
    await user.click(screen.getByRole('option', { name: 'Visa' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' }))

    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('Caixa não aberto — abra o caixa do dia antes de finalizar a venda'),
    )
    expect(screen.queryByText(/Prescrição\/Vendas realizada/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' })).toBeEnabled()
  })

  it('mostra "realizada" só depois de o servidor gravar', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = await montarVenda(onSave)
    await user.click(screen.getByRole('button', { name: 'Crédito' }))
    await user.click(screen.getByRole('option', { name: 'Visa' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' }))

    expect(await screen.findByText('Prescrição/Vendas realizada!')).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

describe('NovaVendaModal — desconto da forma travado', () => {
  it('aplica o percentual cadastrado, sem campo editável nem configuração dentro da venda', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = await montarVenda(onSave)
    await user.click(screen.getByRole('button', { name: 'PIX' }))
    await user.click(screen.getByRole('option', { name: /Conta Nubank/ }))

    expect(screen.getByTestId('desconto-forma-travado')).toHaveTextContent('5,00%')
    expect(screen.queryByText(/Configurar descontos por forma/)).toBeNull()
    expect(screen.queryByRole('spinbutton')).not.toBeNull() // só a quantidade
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0][0] as Record<string, unknown>
    expect(payload.valorTotal).toBe(95)
    expect(payload).not.toHaveProperty('descontoValor')
    expect(payload).not.toHaveProperty('descontoPercentual')
  })
})

describe('NovaVendaModal — dados obrigatórios da forma', () => {
  it('crédito/débito exigem bandeira e o botão fica desabilitado até escolher', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = await montarVenda(onSave)
    await user.click(screen.getByRole('button', { name: 'Débito' }))
    expect(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a bandeira do cartão')
    expect(screen.queryByText('Quantidade de parcelas')).toBeNull() // débito não tem parcelas

    await user.click(screen.getByRole('option', { name: 'American Express' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ formaPagamento: 'cartao_debito', bandeira: 'American Express', status: 'Convertida' })
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('numeroParcelas', expect.anything())
  })

  it('crédito mostra parcelas e grava bandeira + parcelas', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = await montarVenda(onSave)
    await user.click(screen.getByRole('button', { name: 'Crédito' }))
    expect(screen.getByText('Quantidade de parcelas')).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '1/3' }))
    await user.click(screen.getByRole('option', { name: 'Hipercard' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ formaPagamento: 'cartao_credito', bandeira: 'Hipercard', numeroParcelas: 3, valorParcela: 33.33 })
  })

  it('PIX exige a conta do PIX', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = await montarVenda(onSave)
    await user.click(screen.getByRole('button', { name: 'PIX' }))
    expect(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a conta do PIX')
    await user.click(screen.getByRole('option', { name: /Conta Nubank/ }))
    await user.click(screen.getByRole('button', { name: 'Finalizar Prescrição/Vendas' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ formaPagamento: 'pix', contaBancariaId: 'conta1' })
  })
})

describe('NovaVendaModal — validade do orçamento', () => {
  it('Salvar prescrição ativa abre "Validade do orçamento" com hoje + 7 dias e grava a validade', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T15:00:00Z') })
    try {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const user = await montarVenda(onSave)
      await user.click(screen.getByRole('button', { name: 'Salvar prescrição ativa' }))
      expect(onSave).not.toHaveBeenCalled()
      expect(screen.getByText('Validade do orçamento')).toBeInTheDocument()
      const campo = screen.getByLabelText('Válido até') as HTMLInputElement
      expect(campo.value).toBe('2026-11-13')
      expect(campo.min).toBe('2026-11-06')

      await user.clear(campo)
      await user.type(campo, '2026-11-20')
      const botoes = screen.getAllByRole('button', { name: 'Salvar prescrição ativa' })
      await user.click(botoes[botoes.length - 1])
      await waitFor(() => expect(onSave).toHaveBeenCalled())
      expect(onSave.mock.calls[0][0]).toMatchObject({ status: 'Ativa', validade: '2026-11-20' })
      expect(onSave.mock.calls[0][0]).not.toHaveProperty('formaPagamento', expect.anything())
    } finally {
      vi.useRealTimers()
    }
  })
})
