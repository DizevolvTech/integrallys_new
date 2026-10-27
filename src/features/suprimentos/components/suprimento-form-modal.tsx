'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DateInput } from '@/components/shared/date-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SuprimentoInput, SuprimentoItem } from '../hooks/use-suprimentos'

interface Props {
  isOpen: boolean
  onClose: () => void
  suprimento: SuprimentoItem | null
  onSave: (payload: SuprimentoInput) => Promise<void>
}

const VAZIO = { nome: '', unidadeMedida: '', quantidade: '0', estoqueMinimo: '0', lote: '', validade: '', precoCusto: '' }

/** Cadastro de suprimento: mesmo controle do estoque (quantidade, mínimo, lote, validade, custo). */
export function SuprimentoFormModal({ isOpen, onClose, suprimento, onSave }: Props) {
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(
      suprimento
        ? {
            nome: suprimento.nome,
            unidadeMedida: suprimento.unidadeMedida ?? '',
            quantidade: String(suprimento.quantidade),
            estoqueMinimo: String(suprimento.estoqueMinimo),
            lote: suprimento.lote ?? '',
            validade: suprimento.validade ?? '',
            precoCusto: suprimento.precoCusto != null ? String(suprimento.precoCusto) : '',
          }
        : VAZIO,
    )
  }, [isOpen, suprimento])

  const set = (patch: Partial<typeof VAZIO>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do suprimento.')
      return
    }
    setSalvando(true)
    try {
      await onSave({
        id: suprimento?.id,
        nome: form.nome.trim(),
        unidadeMedida: form.unidadeMedida.trim() || undefined,
        quantidade: suprimento ? undefined : Number(form.quantidade) || 0,
        estoqueMinimo: Number(form.estoqueMinimo) || 0,
        lote: form.lote.trim() || undefined,
        validade: form.validade || undefined,
        precoCusto: form.precoCusto !== '' ? Number(form.precoCusto) : undefined,
      })
      toast.success(suprimento ? 'Suprimento atualizado.' : 'Suprimento cadastrado.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o suprimento.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-xl rounded-[24px] bg-app-card dark:bg-app-card-dark">
        <DialogTitle>{suprimento ? 'Editar suprimento' : 'Novo suprimento'}</DialogTitle>
        <DialogDescription>Insumos usados nos procedimentos — separados dos produtos de venda.</DialogDescription>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="sup-nome">Nome *</Label>
            <Input id="sup-nome" value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Seringa 5 ml" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-qtd">Quantidade em estoque</Label>
            <Input id="sup-qtd" type="number" min={0} value={form.quantidade} disabled={!!suprimento} onChange={(e) => set({ quantidade: e.target.value })} />
            {suprimento && <p className="text-xs text-app-text-muted">Para alterar o saldo use Entrada, Saída ou Ajuste.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-min">Quantidade mínima</Label>
            <Input id="sup-min" type="number" min={0} value={form.estoqueMinimo} onChange={(e) => set({ estoqueMinimo: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-lote">Lote</Label>
            <Input id="sup-lote" value={form.lote} onChange={(e) => set({ lote: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-validade">Validade</Label>
            <DateInput id="sup-validade" value={form.validade} onChange={(v) => set({ validade: v })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-custo">Preço de custo (R$)</Label>
            <Input id="sup-custo" type="number" min={0} step="0.01" value={form.precoCusto} onChange={(e) => set({ precoCusto: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-un">Unidade de medida</Label>
            <Input id="sup-un" value={form.unidadeMedida} onChange={(e) => set({ unidadeMedida: e.target.value })} placeholder="un, ml, par..." />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-app-primary text-white hover:bg-app-primary-hover" onClick={() => void submit()} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
