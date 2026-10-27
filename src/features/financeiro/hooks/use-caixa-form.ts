'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type {
  CaixaItem,
  CaixaMovimentacaoPayload,
  CloseCaixaPayload,
  OpenCaixaPayload,
} from '@/hooks/use-caixa'
import { isFormaCartao } from '@/features/caixa/caixa-format'
import { parseCurrencyInput } from '../financeiro.utils'

type CaixaModalType = null | 'abrir' | 'suprimento' | 'sangria' | 'fechar'

type CaixaFormState = {
  saldoInicial: string
  descricao: string
  valor: string
  valorTransferido: string
  observacoes: string
  forma: string
  bandeira: string
  parcelas: string
}

interface UseCaixaFormParams {
  onOpen: (payload: OpenCaixaPayload) => Promise<void>
  onAdd: (payload: CaixaMovimentacaoPayload) => Promise<void>
  onClose: (payload: CloseCaixaPayload) => Promise<void>
  onUpdate: (payload: CaixaMovimentacaoPayload) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const initialCaixaForm: CaixaFormState = {
  saldoInicial: '',
  descricao: '',
  valor: '',
  valorTransferido: '',
  observacoes: '',
  forma: 'dinheiro',
  bandeira: '',
  parcelas: '1',
}

export function useCaixaForm({ onOpen, onAdd, onClose, onUpdate, onDelete }: UseCaixaFormParams) {
  const [isCaixaViewOpen, setIsCaixaViewOpen] = useState(false)
  const [isCaixaEditOpen, setIsCaixaEditOpen] = useState(false)
  const [isCaixaDeleteOpen, setIsCaixaDeleteOpen] = useState(false)
  const [activeCaixaModal, setActiveCaixaModal] = useState<CaixaModalType>(null)
  const [selectedCaixaItem, setSelectedCaixaItem] = useState<CaixaItem | null>(null)
  const [caixaForm, setCaixaForm] = useState<CaixaFormState>(initialCaixaForm)

  const resetCaixaForm = () => {
    setCaixaForm(initialCaixaForm)
  }

  const handleOpenCaixaView = (item: CaixaItem) => {
    setSelectedCaixaItem(item)
    setIsCaixaViewOpen(true)
  }

  const handleOpenCaixaEdit = (item: CaixaItem) => {
    setSelectedCaixaItem(item)
    setCaixaForm((current) => ({
      ...current,
      descricao: item.descricao,
      valor: item.valor.toString().replace('.', ','),
    }))
    setIsCaixaEditOpen(true)
  }

  const handleUpdateCaixaMovimento = async () => {
    if (!selectedCaixaItem || !caixaForm.descricao || !caixaForm.valor) {
      toast.error('Preencha descrição e valor da movimentação.')
      return
    }

    try {
      await onUpdate({
        id: selectedCaixaItem.id,
        descricao: caixaForm.descricao,
        valor: parseCurrencyInput(caixaForm.valor),
        tipo: selectedCaixaItem.tipo,
        forma: selectedCaixaItem.forma,
      } satisfies CaixaMovimentacaoPayload)
      toast.success('Movimentação atualizada com sucesso.')
      setIsCaixaEditOpen(false)
      resetCaixaForm()
      setSelectedCaixaItem(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a movimentação.')
    }
  }

  const handleDeleteCaixaMovimento = async () => {
    if (!selectedCaixaItem) return
    try {
      await onDelete(selectedCaixaItem.id)
      toast.success('Movimentação estornada com sucesso.')
      setIsCaixaDeleteOpen(false)
      setSelectedCaixaItem(null)
      resetCaixaForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível estornar a movimentação.')
    }
  }

  const handleSubmitCaixaAction = async () => {
    try {
      if (activeCaixaModal === 'abrir') {
        await onOpen({
          saldoInicial: parseCurrencyInput(caixaForm.saldoInicial),
          observacoes: caixaForm.observacoes,
        })
        toast.success('Caixa aberto com sucesso.')
      } else if (activeCaixaModal === 'suprimento' || activeCaixaModal === 'sangria') {
        if (!caixaForm.descricao || !caixaForm.valor) {
          toast.error('Preencha descrição e valor da movimentação.')
          return
        }
        const valor = parseCurrencyInput(caixaForm.valor)
        const recebimento = activeCaixaModal === 'suprimento'
        const cartao = recebimento && isFormaCartao(caixaForm.forma)
        if (cartao && !caixaForm.bandeira) {
          toast.error('Informe a bandeira do cartão.')
          return
        }
        const credito = recebimento && caixaForm.forma === 'cartao_credito'
        const parcelas = credito ? Math.max(1, Number(caixaForm.parcelas) || 1) : null
        await onAdd({
          descricao: caixaForm.descricao,
          valor,
          tipo: recebimento ? 'entrada' : 'saida',
          ...(recebimento
            ? {
                forma: caixaForm.forma,
                bandeira: cartao ? caixaForm.bandeira : null,
                parcelas,
                valorParcela: parcelas ? Number((valor / parcelas).toFixed(2)) : null,
              }
            : {}),
        })
        toast.success(activeCaixaModal === 'suprimento' ? 'Recebimento registrado.' : 'Pagamento registrado.')
      } else if (activeCaixaModal === 'fechar') {
        await onClose({
          valorTransferido: parseCurrencyInput(caixaForm.valorTransferido),
          observacoes: caixaForm.observacoes,
        })
        toast.success('Caixa fechado com sucesso.')
      }

      setActiveCaixaModal(null)
      resetCaixaForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a operação de caixa.')
    }
  }

  return {
    isCaixaViewOpen,
    setIsCaixaViewOpen,
    isCaixaEditOpen,
    setIsCaixaEditOpen,
    isCaixaDeleteOpen,
    setIsCaixaDeleteOpen,
    activeCaixaModal,
    setActiveCaixaModal,
    selectedCaixaItem,
    setSelectedCaixaItem,
    caixaForm,
    setCaixaForm,
    resetCaixaForm,
    handleOpenCaixaView,
    handleOpenCaixaEdit,
    handleUpdateCaixaMovimento,
    handleDeleteCaixaMovimento,
    handleSubmitCaixaAction,
  }
}
