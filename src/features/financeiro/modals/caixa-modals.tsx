'use client'

import {
  AlertTriangle,
  Edit,
  Eye,
  Wallet,
  X,
} from 'lucide-react'
import { InfoField } from '@/components/shared/info-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CaixaItem } from '@/hooks/use-caixa'
import { formatCurrency } from '../financeiro.utils'

type CaixaModalType = null | 'abrir' | 'suprimento' | 'sangria' | 'fechar'

interface CaixaFormState {
  saldoInicial: string
  descricao: string
  valor: string
  valorTransferido: string
  observacoes: string
}

interface CaixaActionModalProps {
  open: boolean
  mode: CaixaModalType
  onClose: () => void
  form: CaixaFormState
  onChange: (form: CaixaFormState) => void
  onSubmit: () => void
  caixaStatus: {
    aberto: boolean
    entradas: number
    saidas: number
    saldo: number
    movimentos: number
  }
}

export function CaixaActionModal({ open, mode, onClose, form, onChange, onSubmit, caixaStatus }: CaixaActionModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[95%] rounded-[24px] border border-app-border p-0 overflow-hidden dark:border-app-border-dark">
        <div className="relative bg-app-card dark:bg-app-card-dark">
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 z-10 text-app-text-muted hover:text-app-text-primary dark:hover:text-white">
            <X size={20} />
          </Button>
          <DialogHeader className="px-6 pb-2 pt-6">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                mode === 'fechar' || mode === 'sangria'
                  ? 'app-status-danger'
                  : 'bg-app-bg-secondary dark:bg-app-card/5'
              }`}>
                {mode === 'fechar' || mode === 'sangria' ? (
                  <AlertTriangle className="h-5 w-5 text-[var(--app-danger-text)]" />
                ) : (
                  <Wallet className="h-5 w-5 text-app-text-secondary dark:text-white/60" />
                )}
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">
                  {mode === 'abrir' && 'Abrir caixa'}
                  {mode === 'suprimento' && 'Recebimento'}
                  {mode === 'sangria' && 'Pagamento'}
                  {mode === 'fechar' && 'Fechar caixa'}
                </DialogTitle>
                <DialogDescription className="text-sm font-normal text-app-text-secondary dark:text-white/60">
                  {mode === 'abrir' && 'Inicie a operação diária do caixa a partir do saldo inicial do dia.'}
                  {mode === 'suprimento' && 'Registre um recebimento (entrada de dinheiro) enquanto o caixa estiver aberto.'}
                  {mode === 'sangria' && 'Registre um pagamento (saída de dinheiro) do caixa aberto.'}
                  {mode === 'fechar' && 'Revise os totais do dia antes de encerrar o caixa.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mx-6 mt-4 rounded-[18px] border border-app-border bg-app-bg-secondary/35 p-5 dark:border-app-border-dark dark:bg-app-hover/40">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">Entradas hoje</p>
                <p className="mt-2 text-lg font-normal text-[var(--app-success-text)]">{formatCurrency(caixaStatus.entradas)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">Saídas hoje</p>
                <p className="mt-2 text-lg font-normal text-[var(--app-danger-text)]">{formatCurrency(caixaStatus.saidas)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">Saldo atual</p>
                <p className="mt-2 text-lg font-normal text-app-text-primary dark:text-white">{formatCurrency(caixaStatus.saldo)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">Movimentações</p>
                <p className="mt-2 text-lg font-normal text-app-text-primary dark:text-white">{caixaStatus.movimentos}</p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            {mode === 'abrir' && (
              <div className="mt-6 space-y-4">
                <div className="space-y-3">
                  <Label>Saldo inicial</Label>
                  <Input value={form.saldoInicial} onChange={(event) => onChange({ ...form, saldoInicial: event.target.value })} placeholder="0,00" className="h-11 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
                </div>
                <div className="space-y-3">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(event) => onChange({ ...form, observacoes: event.target.value })} placeholder="Informações adicionais para abertura" className="min-h-[96px] rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
                </div>
              </div>
            )}

            {(mode === 'suprimento' || mode === 'sangria') && (
              <div className="mt-6 space-y-4">
                <div className="space-y-3">
                  <Label>Valor</Label>
                  <Input value={form.valor} onChange={(event) => onChange({ ...form, valor: event.target.value })} placeholder="0,00" className="h-11 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
                </div>
                <div className="space-y-3">
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao} onChange={(event) => onChange({ ...form, descricao: event.target.value })} placeholder={mode === 'suprimento' ? 'Motivo do recebimento' : 'Motivo do pagamento'} className="min-h-[96px] rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
                </div>
              </div>
            )}

            {mode === 'fechar' && (
              <div className="mt-6 space-y-4">
                <div className="space-y-3">
                  <Label>Valor a transferir</Label>
                  <Input value={form.valorTransferido} onChange={(event) => onChange({ ...form, valorTransferido: event.target.value })} placeholder="0,00" className="h-11 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
                </div>
                <div className="space-y-3">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(event) => onChange({ ...form, observacoes: event.target.value })} placeholder="Observações de fechamento" className="min-h-[96px] rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
                </div>
              </div>
            )}

            <DialogFooter className="mt-8 border-t border-app-border pt-6 dark:border-app-border-dark">
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:flex-1 h-11 rounded-xl px-6 border-app-border dark:border-app-border-dark">
                Cancelar
              </Button>
              <Button type="button" className="w-full sm:flex-1 h-11 rounded-xl px-6 text-white font-normal" onClick={onSubmit}>
                {mode === 'abrir' && 'Confirmar abertura'}
                {mode === 'suprimento' && 'Registrar recebimento'}
                {mode === 'sangria' && 'Registrar pagamento'}
                {mode === 'fechar' && 'Confirmar fechamento'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CaixaViewModalProps {
  open: boolean
  onClose: () => void
  item: CaixaItem | null
}

export function CaixaViewModal({ open, onClose, item }: CaixaViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[95%] rounded-[24px] border border-app-border p-0 overflow-hidden dark:border-app-border-dark">
        <div className="relative bg-app-card dark:bg-app-card-dark">
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 z-10 text-app-text-muted hover:text-app-text-primary dark:hover:text-white">
            <X size={20} />
          </Button>
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-app-bg-secondary dark:bg-app-card/5 flex items-center justify-center shrink-0">
                <Eye className="h-5 w-5 text-app-text-secondary dark:text-white/60" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">Detalhes</DialogTitle>
                <DialogDescription className="text-sm font-normal text-app-text-secondary dark:text-white/60">
                  Informações completas da movimentação selecionada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {item && (
            <div className="px-6 pb-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <InfoField label="Descrição" value={item.descricao} className="md:col-span-2" />
                <InfoField label="Tipo" value={item.tipo === 'entrada' ? 'Entrada' : 'Saída'} />
                <InfoField label="Valor" value={formatCurrency(item.valor)} />
                <InfoField label="Hora" value={item.hora || '-'} />
                <InfoField label="Forma" value={item.forma || 'Dinheiro'} />
              </div>
              <div className="overflow-hidden rounded-xl border border-dashed border-app-border dark:border-app-border-dark p-3 flex items-center gap-3 bg-app-bg-secondary/30 dark:bg-transparent">
                <AlertTriangle className="h-4 w-4 text-[var(--app-primary)] shrink-0" />
                <p className="text-xs text-app-text-secondary dark:text-white/60 leading-relaxed italic font-normal">
                  Movimentação registrada na sessão operacional do caixa.
                </p>
              </div>
              <DialogFooter className="border-t border-app-border pt-5 dark:border-app-border-dark">
                <Button type="button" onClick={onClose} className="w-full h-11 rounded-xl text-white font-normal">
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CaixaEditModalProps {
  open: boolean
  onClose: () => void
  item: CaixaItem | null
  form: CaixaFormState
  onChange: (form: CaixaFormState) => void
  onSave: () => void
}

export function CaixaEditModal({ open, onClose, item, form, onChange, onSave }: CaixaEditModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[95%] rounded-[24px] border border-app-border p-0 overflow-hidden dark:border-app-border-dark">
        <div className="relative bg-app-card dark:bg-app-card-dark">
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 z-10 text-app-text-muted hover:text-app-text-primary dark:hover:text-white">
            <X size={20} />
          </Button>
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-app-bg-secondary dark:bg-app-card/5 flex items-center justify-center shrink-0">
                <Edit className="h-5 w-5 text-app-text-secondary dark:text-white/60" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-normal text-app-text-primary dark:text-white tracking-tight">Editar</DialogTitle>
                <DialogDescription className="text-sm font-normal text-app-text-secondary dark:text-white/60">
                  Atualize os dados da movimentação de caixa.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-xl border border-app-border bg-app-bg-secondary/35 p-4 dark:border-app-border-dark dark:bg-app-card/5">
              <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">Movimentação selecionada</p>
              <p className="mt-2 text-base font-normal text-app-text-primary dark:text-white">{item?.descricao || 'Movimentação de caixa'}</p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(event) => onChange({ ...form, descricao: event.target.value })} className="min-h-[96px] rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={form.valor} onChange={(event) => onChange({ ...form, valor: event.target.value })} className="h-11 rounded-xl border-app-border dark:border-app-border-dark bg-app-bg-secondary/50 dark:bg-app-card/5" />
            </div>
            <DialogFooter className="border-t border-app-border pt-5 dark:border-app-border-dark">
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:flex-1 h-11 rounded-xl border-app-border dark:border-app-border-dark">
                Cancelar
              </Button>
              <Button type="button" className="w-full sm:flex-1 h-11 rounded-xl text-white font-normal" onClick={onSave}>
                Salvar alterações
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CaixaDeleteModalProps {
  open: boolean
  onClose: () => void
  item: CaixaItem | null
  onConfirm: () => void
}

export function CaixaDeleteModal({ open, onClose, item, onConfirm }: CaixaDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[95%] rounded-[24px] border border-app-border p-0 overflow-hidden dark:border-app-border-dark">
        <div className="relative bg-app-card dark:bg-app-bg-dark">
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 z-10 text-app-text-muted hover:text-app-text-primary dark:hover:text-white">
            <X size={20} />
          </Button>
          <DialogHeader className="items-center px-6 pb-4 pt-8 text-center">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl app-status-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-[var(--app-danger-text)]" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-normal text-[var(--app-danger-text)] tracking-tight">Estornar</DialogTitle>
                <DialogDescription className="text-sm font-normal text-app-text-secondary dark:text-white/60">
                  Confirme a reversão desta movimentação.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-app-text-secondary dark:text-white/80 leading-relaxed font-normal mt-2">
              Deseja realmente estornar a movimentação <span className="font-normal text-app-text-primary dark:text-white underline underline-offset-4 decoration-red-500/30">{item?.descricao}</span>?
            </p>
            <div className="p-4 bg-app-bg-secondary/50 dark:bg-app-card/[0.02] rounded-xl border border-app-border dark:border-app-border-dark space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-app-text-secondary dark:text-white/60 font-normal">Valor:</span>
                <span className="font-normal text-[var(--app-danger-text)]">{item ? formatCurrency(item.valor) : ''}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-app-text-secondary dark:text-white/60 font-normal">Hora:</span>
                <span className="font-normal text-app-text-primary dark:text-white">{item?.hora || '-'}</span>
              </div>
            </div>
            <DialogFooter className="border-t border-app-border pt-5 dark:border-app-border-dark">
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:flex-1 h-11 rounded-xl border-app-border dark:border-app-border-dark">
                Cancelar
              </Button>
              <Button type="button" className="w-full sm:flex-1 h-11 rounded-xl bg-[var(--app-danger-text)] text-white hover:bg-[var(--app-danger-text)]" onClick={onConfirm}>
                Estornar
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
