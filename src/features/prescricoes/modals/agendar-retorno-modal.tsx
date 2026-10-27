'use client'

import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AgendarRetornoModalProps {
  isOpen: boolean
  onClose: () => void
  patientName?: string
  onConfirm?: () => void
  onLater?: () => void
}

/** Fechar sem escolher (X, Esc, clique fora) equivale a "Mais tarde": a tag de retorno pendente não se perde. */
export function AgendarRetornoModal({ isOpen, onClose, patientName, onConfirm, onLater }: AgendarRetornoModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return
        onLater?.()
        onClose()
      }}
    >
      <DialogContent size="sm" className="p-0 overflow-hidden bg-app-card dark:bg-app-card-dark border-none rounded-[24px] shadow-2xl">
        <div className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="h-20 w-20 app-status-info dark:bg-transparent rounded-full flex items-center justify-center mb-2">
            <Calendar className="h-10 w-10 text-[var(--app-primary)] dark:text-[var(--app-info-text)]" strokeWidth={1.5} />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-[var(--app-text-primary)] dark:text-white">
              Deseja agendar o retorno do paciente?
            </h2>
            <p className="text-[var(--app-text-secondary)] dark:text-white/70 text-base leading-relaxed">
              A Prescrição/Vendas foi concluída com sucesso.<br />
              Paciente: <span className="font-bold text-[var(--app-text-primary)] dark:text-white">{patientName}</span>
            </p>
          </div>

          <div className="w-full bg-app-bg-secondary dark:bg-app-hover p-4 rounded-xl border border-app-border dark:border-app-border-dark text-left flex gap-3">
            <div className="mt-0.5 min-w-[20px]">
              <Clock className="h-5 w-5 text-[var(--app-text-secondary)] dark:text-app-text-muted" />
            </div>
            <p className="text-sm text-[var(--app-text-secondary)] dark:text-app-text-muted">
              Se optar por <span className="font-semibold text-[var(--app-text-primary)] dark:text-white">&quot;Mais tarde&quot;</span>, adicionaremos um lembrete de <strong>Retorno Pendente</strong> à lista.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full pt-2">
            <Button
              variant="outline"
              onClick={() => { onLater?.(); onClose() }}
              className="flex-1 h-12 rounded-xl text-[#344054] dark:text-white border-app-border dark:border-app-border-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover font-semibold"
            >
              Mais tarde
            </Button>
            <Button
              onClick={() => { onConfirm?.(); onClose() }}
              className="flex-1 h-12 rounded-xl bg-app-primary hover:bg-app-primary-hover text-white font-bold shadow-lg shadow-[var(--app-primary)]/20 flex items-center justify-center gap-2"
            >
              Sim, agendar agora
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
