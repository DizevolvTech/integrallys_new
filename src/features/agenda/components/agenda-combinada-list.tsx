'use client'

import { EmptyState } from '@/components/shared/empty-state'
import type { AgendaSlot } from '../agenda.types'
import { getStatusBadgeTone, getStatusCardTone } from '../agenda.utils'

interface AgendaCombinadaListProps {
  /** Um grupo por dia (visão do dia = 1 grupo; semana = 7). */
  groups: Array<{ key: string; label: string; items: AgendaSlot[] }>
}

function isPersonal(item: AgendaSlot) {
  return !item.paciente || item.paciente.trim().length === 0
}

/** Visão simultânea (somente leitura): atendimentos + compromissos pessoais na mesma linha do tempo. */
export function AgendaCombinadaList({ groups }: AgendaCombinadaListProps) {
  const hasAny = groups.some((group) => group.items.length > 0)
  if (!hasAny) {
    return <EmptyState title="Nenhum atendimento ou compromisso neste período." />
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        if (group.items.length === 0) return null
        const sorted = [...group.items].sort((a, b) => a.hora.localeCompare(b.hora))
        return (
          <section key={group.key} className="space-y-2" aria-label={group.label}>
            {groups.length > 1 && (
              <h3 className="text-sm font-medium text-app-text-primary dark:text-white">{group.label}</h3>
            )}
            {sorted.map((item) => {
              const personal = isPersonal(item)
              return (
                <div
                  key={item.id}
                  className={`${getStatusCardTone(item.status)} flex flex-wrap items-center gap-3 rounded-integrallys p-3`}
                >
                  <p className="w-24 shrink-0 text-base text-app-text-primary dark:text-white">
                    {item.hora}
                    {item.horaFim ? ` – ${item.horaFim}` : ''}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      personal
                        ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                    }`}
                  >
                    {personal ? 'Pessoal' : 'Atendimento'}
                  </span>
                  <p className="min-w-[160px] flex-1 truncate text-sm text-app-text-primary dark:text-white">
                    {personal ? (item.titulo ?? item.tipo ?? 'Compromisso') : item.paciente}
                    {!personal && (item.procedimento ?? item.tipo) ? ` · ${item.procedimento ?? item.tipo}` : ''}
                  </p>
                  <p className="text-xs text-app-text-secondary dark:text-app-text-muted">{item.profissional}</p>
                  {!personal && (
                    <span className={`rounded px-2 py-0.5 text-xs ${getStatusBadgeTone(item.status)}`}>{item.status}</span>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
