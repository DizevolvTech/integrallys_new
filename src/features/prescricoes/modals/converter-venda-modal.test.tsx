import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createContext, useContext, type ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ConverterVendaModal, type ConverterVendaPrescricao } from './converter-venda-modal'

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
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => toasts.error.mockClear())

const prescricao: ConverterVendaPrescricao = {
  id: 'pr1',
  numero: 'EN-5006',
  paciente: 'Fernanda',
  valorTotal: 200,
  items: [{ productName: 'Vitamina D', quantity: 2, unitPrice: 100, total: 200 }],
}

function montar(onConfirm = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<ConverterVendaModal isOpen onClose={onClose} prescription={prescricao} onConfirm={onConfirm} />)
  return { onConfirm, onClose, user: userEvent.setup() }
}

describe('ConverterVendaModal', () => {
  it('mostra os itens e o total, e sem forma o botão fica desabilitado com "Escolha a forma de pagamento"', () => {
    montar()
    expect(screen.getByText('Vitamina D')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a forma de pagamento')
    expect(screen.getByRole('button', { name: 'Converter em venda' })).toBeDisabled()
  })

  it('PIX aplica o desconto da forma, exige a conta e envia o total com desconto', async () => {
    const { onConfirm, user } = montar()
    await user.click(screen.getByRole('button', { name: 'PIX' }))
    expect(screen.getByTestId('desconto-forma-travado')).toHaveTextContent('5,00%')
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a conta do PIX')
    await user.click(screen.getByRole('option', { name: /Conta Nubank/ }))
    await user.click(screen.getByRole('button', { name: 'Converter em venda' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ formaPagamento: 'pix', contaBancariaId: 'conta1', valorTotal: 190 })
  })

  it('crédito envia bandeira e parcelas; débito não tem parcelas', async () => {
    const { onConfirm, user } = montar()
    await user.click(screen.getByRole('button', { name: 'Crédito' }))
    await user.click(screen.getByRole('option', { name: '1/2' }))
    await user.click(screen.getByRole('option', { name: 'Elo' }))
    await user.click(screen.getByRole('button', { name: 'Converter em venda' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ formaPagamento: 'cartao_credito', bandeira: 'Elo', numeroParcelas: 2, valorParcela: 100, valorTotal: 200 })
  })

  it('consumo vale sem bandeira nem conta', async () => {
    const { onConfirm, user } = montar()
    await user.click(screen.getByRole('button', { name: 'Consumo' }))
    expect(screen.getByRole('button', { name: 'Converter em venda' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Converter em venda' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ formaPagamento: 'consumo' })
  })

  it('erro do servidor (caixa fechado) aparece e o modal continua aberto', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Caixa não aberto — abra o caixa do dia antes de finalizar a venda'))
    const { onClose, user } = montar(onConfirm)
    await user.click(screen.getByRole('button', { name: 'Dinheiro' }))
    await user.click(screen.getByRole('button', { name: 'Converter em venda' }))
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Caixa não aberto — abra o caixa do dia antes de finalizar a venda'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sucesso fecha o modal', async () => {
    const { onClose, user } = montar()
    await user.click(screen.getByRole('button', { name: 'Dinheiro' }))
    await user.click(screen.getByRole('button', { name: 'Converter em venda' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
