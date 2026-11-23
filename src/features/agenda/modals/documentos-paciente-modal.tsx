'use client'

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DocumentosDoPacienteCard } from '@/features/documentacao-gerar'

interface DocumentosPacienteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pacienteId: string | null
  pacienteNome?: string
  pacienteTelefone?: string | null
}

/** Documentos emitidos do paciente do agendamento, com Baixar PDF, Imprimir e WhatsApp. */
export function DocumentosPacienteModal({ open, onOpenChange, pacienteId, pacienteNome, pacienteTelefone }: DocumentosPacienteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="grid-cols-[minmax(0,1fr)] bg-app-card dark:bg-app-card-dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal text-app-text-primary dark:text-white">
            <FileText className="h-5 w-5 text-[var(--app-primary)]" />
            Documentos emitidos
          </DialogTitle>
          <DialogDescription>{pacienteNome ? `Documentos de ${pacienteNome}` : 'Documentos do paciente'}</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 p-6 pt-0">
          {open && pacienteId ? (
            <DocumentosDoPacienteCard pacienteId={pacienteId} pacienteTelefone={pacienteTelefone} limit={50} />
          ) : (
            <p className="py-6 text-center text-sm text-app-text-muted">Paciente não encontrado neste agendamento.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="h-11 w-full rounded-integrallys bg-app-primary px-8 font-normal text-white hover:bg-app-primary-hover">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
