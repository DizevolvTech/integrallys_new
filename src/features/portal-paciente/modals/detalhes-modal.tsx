'use client'

import { ModalHeader } from '@/components/shared/modal-header'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { PatientAgendaItem } from '../hooks/use-agenda-paciente'

interface DetalhesModalProps {
  isOpen: boolean
  onClose: () => void
  consulta: PatientAgendaItem | null
}

export function DetalhesModal({ isOpen, onClose, consulta }: DetalhesModalProps) {
  if (!consulta) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm" className="w-[95vw] p-0 rounded-[24px] border-none bg-app-card dark:bg-app-card-dark shadow-2xl flex flex-col transition-all duration-300">
        <div className="px-2 pt-2 pb-2">
          <ModalHeader
            title="Detalhes da Consulta"
            description="Visualize as informações completas da sua consulta"
          />
        </div>

        <div className="px-8 pb-8 flex-1 overflow-y-auto">
          <div className="flex flex-col space-y-5 mt-4">
            <div className="flex flex-col space-y-0.5">
              <span className="text-sm text-slate-600 font-bold tracking-wider">Médico</span>
              <span className="text-base text-slate-700 dark:text-slate-200">{consulta.medico}</span>
            </div>
            <div className="flex flex-col space-y-0.5">
              <span className="text-sm text-slate-600 font-bold tracking-wider">Especialidade</span>
              <span className="text-base text-slate-700 dark:text-slate-200">{consulta.especialidade}</span>
            </div>
            <div className="flex flex-col space-y-0.5">
              <span className="text-sm text-slate-600 font-bold tracking-wider">Data e Hora</span>
              <span className="text-base text-slate-700 dark:text-slate-200">{consulta.data}</span>
            </div>
            <div className="flex flex-col space-y-0.5">
              <span className="text-sm text-slate-600 font-bold tracking-wider">Local</span>
              <span className="text-base text-slate-700 dark:text-slate-200">{consulta.local}</span>
            </div>
            {consulta.urlOnline && (
              <div className="flex flex-col space-y-0.5">
                <span className="text-sm text-slate-600 font-bold tracking-wider">
                  {consulta.plataformaOnline || 'Atendimento online'}
                </span>
                <a
                  href={consulta.urlOnline}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-[var(--app-primary)] hover:underline break-all"
                >
                  Abrir link da consulta
                </a>
              </div>
            )}
            <div className="flex flex-col space-y-0.5">
              <span className="text-sm text-slate-600 font-bold tracking-wider">Status</span>
              <Badge className="h-6 px-3 text-xs font-normal rounded-full border-none shadow-sm app-status-info text-[var(--app-primary)] dark:text-[#4ADE80]">
                {consulta.status}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
