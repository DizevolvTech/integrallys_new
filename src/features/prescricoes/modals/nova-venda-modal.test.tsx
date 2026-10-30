import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createContext, useContext, type ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NovaVendaModal } from './nova-venda-modal'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))
vi.mock('@/features/prescricoes/hooks/use-payment-config', () => ({ usePaymentConfig: () => ({ getCardFee: () => 0 }) }))
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
