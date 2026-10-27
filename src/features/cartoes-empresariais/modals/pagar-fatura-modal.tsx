'use client'

import { CheckCircle2 } from 'lucide-react'
import { ModalHeader } from '@/components/shared/modal-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import type { CartaoEmpresarial } from '../hooks/use-cartoes-empresariais'
import { formatCurrency, formatDate } from '../formato'

interface Props {
  cartao: CartaoEmpresarial | null
  contaNome: string | null
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
}

export function PagarFaturaModal({ cartao, contaNome, isSubmitting, onClose, onConfirm }: Props) {
  const fatura = cartao?.faturaAtual
  return (
    <Dialog open={Boolean(cartao && fatura)} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent size="md" className="gap-0 rounded-[24px] border border-app-border p-0 dark:border-app-border-dark">
        <div className="flex flex-col bg-app-card dark:bg-app-card-dark">
          <ModalHeader
            className="px-6 pb-4 pt-6"
            icon={CheckCircle2}
            title="Registrar pagamento da fatura"
            description={cartao?.nome}
          />
          {cartao && fatura && (
            <dl className="space-y-3 px-6 pb-6 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-app-text-secondary">Valor da fatura</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(fatura.total)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-app-text-secondary">Vencimento</dt>
                <dd>{formatDate(fatura.vencimento)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-app-text-secondary">Conta</dt>
                <dd>{contaNome ?? 'Não informada'}</dd>
              </div>
              <p className="rounded-xl bg-app-bg-secondary/60 p-3 text-xs text-app-text-secondary dark:bg-app-hover">
                Será gerada uma despesa paga no Financeiro com o valor total da fatura. O limite do cartão é liberado.
              </p>
            </dl>
          )}
          <DialogFooter className="border-t border-app-border bg-app-bg-secondary/35 px-6 py-4 dark:border-app-border-dark dark:bg-app-hover/30">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="h-11 rounded-xl px-6">
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirm} disabled={isSubmitting} className="h-11 rounded-xl bg-app-primary px-6 text-white">
              {isSubmitting ? 'Registrando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
