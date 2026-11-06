'use client'

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validadeOrcamentoValida, validadePadraoOrcamento } from '@/lib/prescricao-validade'

interface ValidadeOrcamentoDialogProps {
  isOpen: boolean
  /** Hoje (aaaa-mm-dd, fuso de São Paulo): a validade começa em hoje + 7 dias e não pode ser anterior a hoje. */
  hoje: string
  isSubmitting?: boolean
  onCancel: () => void
  onConfirm: (validade: string) => void | Promise<void>
}

/** Pop-up "Validade do orçamento": pergunta até quando o orçamento vale antes de salvar a prescrição ativa. */
export function ValidadeOrcamentoDialog({ isOpen, hoje, isSubmitting = false, onCancel, onConfirm }: ValidadeOrcamentoDialogProps) {
  const [validade, setValidade] = useState(() => validadePadraoOrcamento(hoje))

  useEffect(() => {
    if (isOpen) setValidade(validadePadraoOrcamento(hoje))
  }, [isOpen, hoje])

  const valida = validadeOrcamentoValida(validade, hoje)

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => !aberto && !isSubmitting && onCancel()}>
      <DialogContent size="sm" className="bg-app-card dark:bg-app-card-dark rounded-[24px] border-none p-0 shadow-2xl">
        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl app-status-info text-app-primary dark:text-[var(--app-info-text)]">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-app-text-primary dark:text-white">Validade do orçamento</DialogTitle>
              <p className="text-sm text-app-text-secondary dark:text-white/60">Até quando este orçamento é válido?</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="validade-orcamento" className="text-sm font-semibold text-app-text-primary dark:text-white/70">
              Válido até
            </Label>
            <Input
              id="validade-orcamento"
              type="date"
              min={hoje}
              value={validade}
              onChange={(event) => setValidade(event.target.value)}
              className="h-12 rounded-xl"
            />
            {!valida && (
              <p role="alert" className="text-xs text-[var(--app-danger-text)]">
                Escolha uma data de hoje em diante.
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-11 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => void onConfirm(validade)}
              disabled={!valida || isSubmitting}
              className="h-11 rounded-xl bg-app-primary font-bold text-white hover:bg-app-primary-hover"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar prescrição ativa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
