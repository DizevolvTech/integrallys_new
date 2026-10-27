'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ModalHeader } from '@/components/shared/modal-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { MovimentacaoItem } from '@/features/estoque/hooks/use-estoque'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

interface EstornarMovimentacaoModalProps {
  isOpen: boolean
  onClose: (open: boolean) => void
  movimentacao: MovimentacaoItem | null
  onConfirm: (movimentacaoId: string, motivo: string) => Promise<void>
}

export function EstornarMovimentacaoModal({
  isOpen,
  onClose,
  movimentacao,
  onConfirm,
}: EstornarMovimentacaoModalProps) {
  const [motivo, setMotivo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) setMotivo('')
  }, [isOpen])

  const handleConfirm = async () => {
    if (!movimentacao) return
    const motivoTrim = motivo.trim()
    if (motivoTrim.length < 10) {
      toast.error('Informe um motivo com ao menos 10 caracteres.')
      return
    }
    setIsSubmitting(true)
    try {
      await onConfirm(movimentacao.id, motivoTrim)
      toast.success('Movimentação estornada.')
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao estornar movimentação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEntrada = movimentacao?.tipo === 'entrada'
  const tipoLabel = isEntrada
    ? 'Entrada'
    : movimentacao?.tipoMovimentacao === 'consumo_interno'
      ? 'Consumo interno'
      : 'Saída'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="md" className="gap-0 rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="flex flex-col bg-app-card dark:bg-app-card-dark">
          <ModalHeader
            className="px-8 pb-6 pt-8"
            icon={Undo2}
            title="Estornar movimentação"
            description="Esta ação é irreversível e cria uma movimentação compensatória."
          />

          <div className="flex-1 overflow-y-auto px-8 pb-6 pt-2 custom-scrollbar space-y-5">
            {movimentacao && (
              <div className="rounded-[16px] border border-app-border bg-app-bg-secondary/40 p-4 dark:border-app-border-dark dark:bg-app-hover/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-app-text-muted">Produto</p>
                    <p className="text-sm font-medium text-app-text-primary dark:text-white">
                      {movimentacao.produtoNome}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                    {tipoLabel}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="uppercase tracking-wider text-app-text-muted">Quantidade</p>
                    <p className="mt-0.5 tabular-nums text-app-text-primary dark:text-white">
                      {isEntrada ? '+' : '-'}{movimentacao.quantidade}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-app-text-muted">Data</p>
                    <p className="mt-0.5 text-app-text-primary dark:text-white">
                      {formatarDataHoraClinica(movimentacao.criadoEm)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="estorno-motivo">Motivo do estorno *</Label>
              <Textarea
                id="estorno-motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Descreva o motivo (mínimo 10 caracteres)"
                className="min-h-[110px] rounded-xl"
              />
              <p className="text-[11px] text-app-text-muted">
                Esse motivo fica registrado e aparece na timeline do produto.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-integrallys-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  O estoque será ajustado automaticamente.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A movimentação original será marcada como estornada e uma movimentação compensatória será criada para rastreabilidade.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-app-border bg-app-bg-secondary/35 px-8 py-6 dark:border-app-border-dark dark:bg-app-hover/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={isSubmitting}
              className="h-11 rounded-xl px-6"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting || motivo.trim().length < 10 || !movimentacao}
              className="h-11 rounded-xl bg-[var(--app-danger-text)] px-6 text-white hover:opacity-90"
            >
              {isSubmitting ? 'Estornando...' : 'Confirmar estorno'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
