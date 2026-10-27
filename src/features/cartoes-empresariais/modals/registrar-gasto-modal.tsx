'use client'

import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NovoMovimentoInput } from '../hooks/use-cartoes-empresariais'

interface Props {
  open: boolean
  cartaoId: string | null
  cartaoNome?: string
  onClose: () => void
  onSubmit: (payload: NovoMovimentoInput) => Promise<void>
  isSubmitting?: boolean
}

interface FormState {
  descricao: string
  valor: string
  parcelas: string
  dataCompra: string
  beneficiario: string
  categoria: string
}

const INITIAL: FormState = {
  descricao: '',
  valor: '',
  parcelas: '1',
  dataCompra: new Date().toISOString().slice(0, 10),
  beneficiario: '',
  categoria: '',
}

const PARCELAS_OPCOES = Array.from({ length: 12 }, (_, idx) => String(idx + 1))

export function RegistrarGastoModal({ open, cartaoId, cartaoNome, onClose, onSubmit, isSubmitting }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)

  useEffect(() => {
    if (!open) setForm(INITIAL)
  }, [open])

  const handleSave = async () => {
    if (!cartaoId) return
    if (!form.descricao.trim()) return
    const valor = Number(form.valor.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) return

    await onSubmit({
      cartaoId,
      descricao: form.descricao.trim(),
      valor,
      parcelas: Number(form.parcelas) || 1,
      dataCompra: form.dataCompra,
      beneficiario: form.beneficiario.trim() || null,
      categoria: form.categoria.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent size="lg" className="gap-0 rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="flex flex-col bg-app-card dark:bg-app-card-dark">
          <ModalHeader
            className="px-8 pb-6 pt-8"
            icon={Receipt}
            title="Registrar gasto"
            description={cartaoNome ? `Adicionando movimento ao cartão ${cartaoNome}.` : 'Adicione um novo movimento ao cartão.'}
          />

          <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3 md:col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                  placeholder="Descreva a compra"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-3">
                <Label>Valor total da compra (R$)</Label>
                <Input
                  value={form.valor}
                  onChange={(event) => setForm((current) => ({ ...current, valor: event.target.value }))}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-3">
                <Label>Parcelas</Label>
                <Select
                  value={form.parcelas}
                  onValueChange={(value) => setForm((current) => ({ ...current, parcelas: value }))}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARCELAS_OPCOES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Data da compra</Label>
                <Input
                  type="date"
                  value={form.dataCompra}
                  onChange={(event) => setForm((current) => ({ ...current, dataCompra: event.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-3">
                <Label>Beneficiário</Label>
                <Input
                  value={form.beneficiario}
                  onChange={(event) => setForm((current) => ({ ...current, beneficiario: event.target.value }))}
                  placeholder="Estabelecimento ou fornecedor"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label>Categoria</Label>
                <Input
                  value={form.categoria}
                  onChange={(event) => setForm((current) => ({ ...current, categoria: event.target.value }))}
                  placeholder="Ex.: Material de escritório"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-app-border bg-app-bg-secondary/35 px-8 py-6 dark:border-app-border-dark dark:bg-app-hover/30">
            <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-xl px-6">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSubmitting || !cartaoId || !form.descricao.trim() || !form.valor}
              className="h-11 rounded-xl bg-app-primary px-6 text-white"
            >
              {isSubmitting ? 'Salvando...' : 'Registrar movimento'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
