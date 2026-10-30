'use client'

import { Calendar, FileText, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AgendaSlot } from '../agenda.types'
import { useParticipantesCompromisso } from '../hooks/use-participantes-compromisso'

interface CompromissoDetalhesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: AgendaSlot | null
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor) return null
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <p className="text-app-text-secondary dark:text-app-text-muted">{rotulo}</p>
      <p className="text-right text-app-text-primary dark:text-white">{valor}</p>
    </div>
  )
}

/** Detalhes somente leitura de um compromisso da agenda pessoal (sem campos de paciente). */
export function CompromissoDetalhesModal({ open, onOpenChange, item }: CompromissoDetalhesModalProps) {
  const temIds = (item?.participanteIds?.length ?? 0) > 0
  const { data: usuarios } = useParticipantesCompromisso(open && temIds)
  if (!item) return null
  const participantes = (item.participanteIds ?? [])
    .map((id) => usuarios.find((u) => u.id === id)?.nome)
    .filter((nome): nome is string => Boolean(nome))
  const participantesTexto = participantes.length > 0 ? participantes.join(', ') : item.participantes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-card dark:bg-app-card-dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal">
            <FileText className="h-5 w-5 text-[var(--app-primary)]" />
            {item.titulo || 'Compromisso'}
          </DialogTitle>
          <DialogDescription>Detalhes do compromisso</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6 pt-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-app-text-primary dark:text-white">
            <Calendar className="h-4 w-4 text-[var(--app-primary)]" /> Quando
          </div>
          <div className="space-y-2 pl-6">
            <Linha rotulo="Data" valor={item.data} />
            <Linha rotulo="Horário" valor={item.horaFim ? `${item.hora} – ${item.horaFim}` : item.hora} />
            <Linha rotulo="Tipo" valor={item.tipo} />
            <Linha rotulo="Agenda de" valor={item.profissional} />
            <Linha rotulo="Situação" valor={item.status} />
          </div>
          {(item.local || participantesTexto) && (
            <>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-app-text-primary dark:text-white">
                {item.local ? <MapPin className="h-4 w-4 text-[var(--app-primary)]" /> : <Users className="h-4 w-4 text-[var(--app-primary)]" />}
                Local e participantes
              </div>
              <div className="space-y-2 pl-6">
                <Linha rotulo="Local" valor={item.local} />
                <Linha rotulo="Participantes" valor={participantesTexto} />
              </div>
            </>
          )}
          {item.observacoes && (
            <p className="whitespace-pre-wrap pl-6 text-sm text-app-text-secondary dark:text-app-text-muted">{item.observacoes}</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="h-11 w-full rounded-integrallys sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
