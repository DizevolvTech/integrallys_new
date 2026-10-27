'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Clock, MoreVertical } from 'lucide-react'
import type { AgendaSlot } from '../agenda.types'
import { bloqueiosDoDia, isoDateLocal } from '../bloqueios.utils'
import type { AgendaBloqueio } from '../hooks/use-agenda-bloqueios'
import { BloqueioChip } from './bloqueio-chip'
import type { useAgendaCalendar } from '../hooks/use-agenda-calendar'
import {
  formatSlotDuration,
  getStatusBadgeTone,
  getStatusCardTone,
  normalizeAgendaStatus,
} from '../agenda.utils'

interface AgendaWeekViewProps {
  weekAgendaGroups: ReturnType<typeof useAgendaCalendar>['weekAgendaGroups']
  /** Alinha empty copy ao day view: todos/agendamentos vs filtro de status. */
  showDaySlots: boolean
  onOpenSlotModal: (modal: 'remarcar' | 'cancelar' | 'detalhes', slot: AgendaSlot) => void
  onSetCurrentDate: (date: Date) => void
  bloqueios?: AgendaBloqueio[]
  bloqueiosProfissionais?: Array<{ id: string; nome: string }>
  selectedProfessional?: string
}

export function AgendaWeekView({
  weekAgendaGroups,
  showDaySlots,
  onOpenSlotModal,
  onSetCurrentDate,
  bloqueios = [],
  bloqueiosProfissionais = [],
  selectedProfessional = 'todos',
}: AgendaWeekViewProps) {
  const profIdToNome = new Map(bloqueiosProfissionais.map((p) => [p.id, p.nome]))
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {weekAgendaGroups.map((day) => {
        const bloqueiosDia = bloqueiosDoDia(bloqueios, isoDateLocal(day.date), selectedProfessional, profIdToNome)
        return (
        <div
          key={day.key}
          className="rounded-integrallys border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-bg-dark overflow-hidden"
        >
          <button
            type="button"
            onClick={() => onSetCurrentDate(day.date)}
            title="Ver este dia"
            className={`w-full p-3 text-center border-b border-app-border dark:border-app-border-dark cursor-pointer hover:opacity-90 transition-opacity ${
              day.isToday ? 'bg-app-primary dark:bg-app-card-dark' : 'bg-app-bg-secondary dark:bg-app-bg-dark/50'
            }`}
          >
            <p
              className={`text-sm ${
                day.isToday ? 'text-white/80' : 'text-app-text-secondary dark:text-app-text-muted'
              }`}
            >
              {day.shortLabel}
            </p>
            <p
              className={`text-xl ${
                day.isToday ? 'text-white' : 'text-app-text-primary dark:text-white'
              }`}
            >
              {day.date.getDate().toString().padStart(2, '0')}
            </p>
            <p
              className={`text-xs ${
                day.isToday ? 'text-white/60' : 'text-app-text-secondary dark:text-app-text-muted'
              }`}
            >
              ({day.items.length})
            </p>
          </button>

          <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
            {bloqueiosDia.map((b) => (
              <BloqueioChip
                key={`bloq-${b.id}`}
                bloqueio={b}
                profissionalNome={b.profissionalId ? profIdToNome.get(b.profissionalId) : null}
              />
            ))}
            {day.items.length === 0 && bloqueiosDia.length === 0 ? (
              <p className="text-xs text-center text-app-text-secondary dark:text-app-text-muted px-1 py-3">
                {showDaySlots ? 'Nenhuma agenda gerada' : 'Nenhum agendamento encontrado'}
              </p>
            ) : (
              day.items.map((item) => {
                const duracao = formatSlotDuration(item.hora, item.horaFim)
                return (
                  <div
                    key={item.id}
                    className={`${getStatusCardTone(item.status)} rounded-[8px] p-3 space-y-2`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-normal text-app-text-primary dark:text-white">{item.hora}</p>
                          {duracao && (
                            <>
                              <Clock className="h-3 w-3 text-app-text-secondary dark:text-app-text-muted" />
                              <span className="text-xs font-normal text-app-text-secondary dark:text-app-text-muted">
                                {duracao}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-tight text-app-text-primary dark:text-white">
                          {item.paciente}
                        </p>
                        <p className="mt-1 text-xs leading-tight text-app-text-secondary dark:text-app-text-muted">
                          {item.profissional}
                        </p>
                        <span className="mt-2 inline-block app-status-neutral px-2 py-0.5 rounded text-xs">
                          Consulta
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeTone(item.status)}`}>
                          {normalizeAgendaStatus(item.status)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" aria-label="Ações do agendamento" className="h-6 w-6 flex items-center justify-center hover:bg-app-card/50 dark:hover:bg-app-hover rounded transition-colors">
                              <MoreVertical className="h-3 w-3 text-app-text-secondary dark:text-white/80" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenSlotModal('detalhes', item)}>Visualizar</DropdownMenuItem>
                            {normalizeAgendaStatus(item.status) !== 'Cancelado' && (
                              <DropdownMenuItem onClick={() => onOpenSlotModal('remarcar', item)}>Reagendar</DropdownMenuItem>
                            )}
                            {normalizeAgendaStatus(item.status) !== 'Cancelado' && (
                              <DropdownMenuItem className="text-[var(--app-danger-text)]" onClick={() => onOpenSlotModal('cancelar', item)}>
                              Desmarcar
                            </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        )
      })}
    </div>
  )
}
