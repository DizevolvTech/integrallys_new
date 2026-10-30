'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CancelarCompromissoModalProps {
  isOpen: boolean
  onClose: () => void
  compromissoTitulo?: string
  onConfirm: () => Promise<void>
}

export function CancelarCompromissoModal({
  isOpen,
  onClose,
  compromissoTitulo,
  onConfirm,
}: CancelarCompromissoModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [motivo, setMotivo] = useState('')

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      toast.success('Compromisso cancelado.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar o compromisso.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton={true}
        className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-8 rounded-[24px] bg-app-card dark:bg-app-card-dark border-none shadow-2xl gap-8 custom-scrollbar"
      >
        <DialogTitle className="sr-only">Cancelar compromisso</DialogTitle>
        <div className="space-y-6">
          <div className="relative flex items-start gap-3 sm:gap-5">
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full app-status-danger dark:bg-transparent flex items-center justify-center shrink-0">
              <X className="h-7 w-7 text-[var(--app-danger-text)] dark:text-[var(--app-danger-text)]" />
            </div>
            <div className="min-w-0 space-y-1 pr-10">
              <h2 className="text-xl sm:text-2xl font-normal text-app-text-primary dark:text-white leading-tight break-words">
                Cancelar compromisso
              </h2>
              <p className="text-app-text-muted dark:text-app-text-muted text-base leading-relaxed break-words">
                {compromissoTitulo
                  ? `Tem certeza que deseja cancelar ${compromissoTitulo}?`
                  : 'Tem certeza que deseja cancelar este compromisso?'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-0 h-8 w-8 flex items-center justify-center rounded-lg border border-app-border dark:border-app-border-dark bg-white dark:bg-transparent hover:bg-app-bg-secondary dark:hover:bg-app-hover transition-colors shrink-0"
            >
              <X className="h-4 w-4 text-app-text-muted" />
            </button>
          </div>

          <div className="app-status-danger/50 dark:bg-transparent border border-transparent dark:border-red-900/20 rounded-integrallys-lg p-5 space-y-2">
            <div className="flex items-center gap-2 text-[var(--app-danger-text)] dark:text-[var(--app-danger-text)] font-normal">
              <AlertTriangle className="h-4 w-4" />
              <span>Atenção: esta ação não pode ser desfeita</span>
            </div>
            <p className="text-[var(--app-danger-text)]/80 dark:text-[var(--app-danger-text)]/80 text-sm leading-relaxed">
              O compromisso será marcado como cancelado e removido da agenda pessoal.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-normal text-app-text-primary dark:text-white">
              Motivo do cancelamento (opcional)
            </Label>
            <Textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
              className="min-h-[120px] rounded-integrallys-lg border-app-border dark:border-app-border-dark bg-white dark:bg-transparent p-4 placeholder:text-app-text-muted focus-visible:ring-red-500/50 resize-none text-base"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-12 w-full sm:w-auto px-8 rounded-[12px] border-app-border text-app-text-primary hover:bg-app-bg-secondary dark:border-app-border-dark dark:text-white/80 dark:hover:bg-app-hover font-normal"
            >
              Manter compromisso
            </Button>
            <Button
              className="h-12 w-full sm:w-auto px-8 rounded-[12px] bg-[#d93f48] justify-center hover:bg-[#c1323a] text-white font-normal shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] flex items-center gap-2"
              onClick={() => void handleConfirm()}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              <span>{isLoading ? 'Cancelando...' : 'Confirmar cancelamento'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
