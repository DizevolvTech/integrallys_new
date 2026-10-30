'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SlidersHorizontal } from 'lucide-react'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
import type { EstoqueItem } from '../hooks/use-estoque'

interface AjusteEstoqueModalProps {
  isOpen: boolean
  onClose: () => void
  produtos: EstoqueItem[]
  produtoIdInicial?: string
  onSave: (payload: {
    produtoId: string
    quantidade: number
    justificativa: string
  }) => Promise<void>
}

export function AjusteEstoqueModal({
  isOpen,
  onClose,
  produtos,
  produtoIdInicial,
  onSave,
}: AjusteEstoqueModalProps) {
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('0')
  const [justificativa, setJustificativa] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const opcoesProduto = useMemo(
    () => produtos.map((item) => ({ value: item.id, label: item.produto, hint: `atual: ${item.quantidade}` })),
    [produtos],
  )

  useEffect(() => {
    if (!isOpen) return
    const initial = produtoIdInicial || produtos[0]?.id || ''
    setProdutoId(initial)
    const current = produtos.find((item) => item.id === initial)
    setQuantidade(String(current?.quantidade ?? 0))
    setJustificativa('')
    setIsSaving(false)
  }, [isOpen, produtoIdInicial, produtos])

  useEffect(() => {
    if (!isOpen || !produtoId) return
    const current = produtos.find((item) => item.id === produtoId)
    if (current) setQuantidade(String(current.quantidade ?? 0))
  }, [produtoId, produtos, isOpen])

  const handleSubmit = async () => {
    if (!produtoId) {
      toast.error('Selecione o produto.')
      return
    }
    const qty = Number(quantidade)
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Informe uma quantidade válida (>= 0).')
      return
    }
    if (justificativa.trim().length < 5) {
      toast.error('Informe a justificativa do ajuste (mín. 5 caracteres).')
      return
    }
    setIsSaving(true)
    try {
      await onSave({
        produtoId,
        quantidade: qty,
        justificativa: justificativa.trim(),
      })
      toast.success('Ajuste de estoque aplicado.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível ajustar o estoque.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[24px]">
        <ModalHeader
          icon={SlidersHorizontal}
          title="Ajuste de estoque"
          description="Corrige a quantidade sem NF/fornecedor. Informe a quantidade correta e a justificativa."
        />
        <div className="space-y-4 px-1">
          <div className="space-y-1.5">
            <Label>Produto *</Label>
            <Combobox
              value={produtoId}
              onChange={setProdutoId}
              options={opcoesProduto}
              placeholder="Selecione o produto"
              searchPlaceholder="Digite o nome do produto..."
              emptyText="Nenhum produto encontrado"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade correta *</Label>
            <Input
              type="number"
              min={0}
              value={quantidade}
              onChange={(event) => setQuantidade(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Justificativa *</Label>
            <Textarea
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              placeholder="Ex.: Inventário físico, correção de lançamento..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-integrallys">
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="rounded-integrallys bg-app-primary text-white hover:bg-app-primary-hover"
          >
            {isSaving ? 'Salvando...' : 'Aplicar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
