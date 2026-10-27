'use client'

import type { useAgendaCalendar } from '../hooks/use-agenda-calendar'
import { getStatusBadgeTone } from '../agenda.utils'
import { bloqueiosDoDia, isoDateLocal } from '../bloqueios.utils'
import type { AgendaBloqueio } from '../hooks/use-agenda-bloqueios'
import { BloqueioChip } from './bloqueio-chip'

interface AgendaMonthViewProps {
  monthAgendaSummary: ReturnType<typeof useAgendaCalendar>['monthAgendaSummary']
  onSelectDay: (date: Date) => void
  bloqueios?: AgendaBloqueio[]
  bloqueiosProfissionais?: Array<{ id: string; nome: string }>
  selectedProfessional?: string
}

const MAX_BLOQUEIOS_POR_DIA = 2

export function AgendaMonthView({
  monthAgendaSummary,
  onSelectDay,
  bloqueios = [],
  bloqueiosProfissionais = [],
  selectedProfessional = 'todos',
}: AgendaMonthViewProps) {
  const profIdToNome = new Map(bloqueiosProfissionais.map((p) => [p.id, p.nome]))
  return (
    <div className="border border-app-border dark:border-app-border-dark rounded-integrallys overflow-hidden">
      <div className="grid grid-cols-7 bg-app-bg-secondary dark:bg-app-bg-dark/50 border-b border-app-border dark:border-app-border-dark">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label) => (
          <div
            key={label}
            className="py-3 text-center text-sm font-normal text-app-text-secondary dark:text-app-text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {monthAgendaSummary.map((day, index) => {
          const bloqueiosDia = day.date
            ? bloqueiosDoDia(bloqueios, isoDateLocal(day.date), selectedProfessional, profIdToNome)
            : []
          return (
          <button
            key={day.key}
            type="button"
            onClick={() => {
              if (!day.date) return
              onSelectDay(day.date)
            }}
            className={`min-h-[120px] p-2 border-r border-b transition-colors text-left ${
              index % 7 === 6 ? 'border-r-0' : ''
            } ${
              day.date
                ? 'bg-app-card dark:bg-app-bg-dark hover:bg-app-bg-secondary dark:hover:bg-app-hover'
                : 'bg-app-bg-secondary/30 dark:bg-app-bg-dark/10'
            } ${
              day.isToday ? 'ring-1 ring-inset ring-app-primary/30' : ''
            } border-app-border dark:border-app-border-dark`}
            disabled={!day.date}
          >
            {day.date && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      day.isToday ? 'bg-app-primary text-white' : 'text-app-text-primary dark:text-white'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                  <div className="rounded-full bg-app-card px-2 py-1 text-xs text-app-text-secondary shadow-sm dark:bg-app-card-dark dark:text-white/70">
                    {day.count}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {bloqueiosDia.slice(0, MAX_BLOQUEIOS_POR_DIA).map((b) => (
                    <BloqueioChip
                      key={`bloq-${b.id}`}
                      bloqueio={b}
                      profissionalNome={b.profissionalId ? profIdToNome.get(b.profissionalId) : null}
                      compacto
                    />
                  ))}
                  {bloqueiosDia.length > MAX_BLOQUEIOS_POR_DIA && (
                    <div className="text-xs text-app-text-muted">
                      +{bloqueiosDia.length - MAX_BLOQUEIOS_POR_DIA} bloqueio(s)
                    </div>
                  )}
                  {day.count > 0 ? (
                    <>
                      {day.confirmed > 0 && (
                        <div className={`rounded-full px-2 py-1 text-xs ${getStatusBadgeTone('Confirmado')}`}>
                          {day.confirmed} Confirmado{day.confirmed > 1 ? 's' : ''}
                        </div>
                      )}
                      {day.pending > 0 && (
                        <div className={`rounded-full px-2 py-1 text-xs ${getStatusBadgeTone('Aguardando')}`}>
                          {day.pending} Aguardando
                        </div>
                      )}
                      {day.canceled > 0 && (
                        <div className={`rounded-full px-2 py-1 text-xs ${getStatusBadgeTone('Cancelado')}`}>
                          {day.canceled} Cancelado{day.canceled > 1 ? 's' : ''}
                        </div>
                      )}
                      {day.professionals.map((professional) => (
                        <div key={professional} className="truncate text-xs text-app-text-secondary dark:text-white/60">
                          {professional}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="mt-6 text-xs text-app-text-muted">Sem consultas</div>
                  )}
                </div>
              </>
            )}
          </button>
          )
        })}
      </div>
    </div>
  )
}
