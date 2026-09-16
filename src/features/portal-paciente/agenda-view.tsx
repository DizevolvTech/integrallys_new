'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Clock, MapPin, Eye, Edit2, X, ExternalLink } from 'lucide-react'
import { DetalhesModal } from './modals/detalhes-modal'
import { CancelarModal } from './modals/cancelar-modal'
import { useAgendaPaciente, type PatientAgendaItem } from './hooks/use-agenda-paciente'

export function AgendaView() {
  const { data, error, isLoading, cancelAgendamento } = useAgendaPaciente()
  const [selectedAppointment, setSelectedAppointment] = useState<PatientAgendaItem | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(true)

  const visibleAppointments = showOnlyScheduled
    ? data.filter((appointment) => appointment.status !== 'Cancelado')
    : data

  const handleOpenDetails = (appointment: PatientAgendaItem) => {
    setSelectedAppointment(appointment)
    setIsDetailsOpen(true)
  }

  const handleOpenCancel = (appointment: PatientAgendaItem) => {
    setSelectedAppointment(appointment)
    setIsCancelOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return
    await cancelAgendamento(selectedAppointment.id)
    setIsCancelOpen(false)
    setSelectedAppointment(null)
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Minha Agenda"
        description={`${visibleAppointments.length} consultas na lista`}
        actions={
          <>
            <Button
              variant={showOnlyScheduled ? 'outline' : 'default'}
              className="flex-1 sm:flex-none"
              onClick={() => setShowOnlyScheduled((prev) => !prev)}
            >
              {showOnlyScheduled ? 'Mostrar todos' : 'Mostrar ativos'}
            </Button>
            <Button className="flex-1 sm:flex-none" asChild>
                <Link href="/portal/novo-agendamento">
                <Plus className="h-4 w-4 shrink-0" />
                Novo Agendamento
              </Link>
            </Button>
          </>
        }
      />

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {isLoading && <p className="text-app-text-secondary">Carregando agenda...</p>}

      {!isLoading && !error && (
        <div className="grid gap-4">
          {visibleAppointments.map((item) => (
            <div
              key={item.id}
              className="bg-app-card dark:bg-app-card-dark rounded-integrallys-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4 border border-app-border dark:border-app-border-dark shadow-sm transition-all duration-300 hover:scale-[1.01] sm:hover:scale-[1.02] hover:shadow-md cursor-pointer active:scale-95"
            >
              <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-[12px] app-status-info dark:app-status-info0/10 text-[var(--app-info-text)] dark:text-[var(--app-info-text)] flex items-center justify-center shadow-sm">
                  <Calendar className="h-6 w-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-base sm:text-base text-[var(--app-text-primary)] dark:text-white truncate">
                      {item.medico}
                    </h3>
                    <Badge
                      className={`
                        h-5 px-2 text-xs font-semibold rounded-full border-none whitespace-nowrap
                        ${item.status === 'Confirmada' || item.status === 'Concluído'
                          ? 'app-status-info text-[var(--app-primary)] dark:app-status-info dark:text-[#4ADE80]'
                          : item.status === 'Agendado'
                            ? 'app-status-info text-[var(--app-info-text)] dark:bg-transparent dark:text-[var(--app-info-text)]'
                            : 'app-status-danger text-[var(--app-danger-text)] dark:bg-transparent dark:text-[var(--app-danger-text)]'
                        }
                      `}
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-app-text-secondary dark:text-white/60 font-medium mb-2">
                    {item.especialidade}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-xs text-app-text-secondary dark:text-white/60">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5 text-[var(--app-info-text)]" />
                      {item.data}
                    </span>
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 text-red-400" />
                      {item.local}
                    </span>
                    {item.urlOnline && (
                      <a
                        href={item.urlOnline}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[var(--app-primary)] hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {item.plataformaOnline || 'Link online'}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-row items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-app-border dark:border-app-border-dark sm:ml-auto shrink-0 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none h-10 sm:h-9 px-2 sm:px-3 flex flex-row items-center justify-center gap-2"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenDetails(item)
                  }}
                  title="Detalhes"
                >
                  <Eye className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-xs font-bold">Detalhes</span>
                </Button>

                {(item.status === 'Agendado' || item.status === 'Confirmada') && (
                  <>
                    <Button
                      asChild
                      variant="outline"
                      className="flex-1 sm:flex-none h-10 sm:h-9 px-2 sm:px-3 flex flex-row items-center justify-center gap-2"
                      title="Reagendar"
                    >
                      <Link href={`/portal/reagendar?id=${encodeURIComponent(item.id)}`}>
                        <Edit2 className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline text-xs font-bold">Reagendar</span>
                      </Link>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex-1 sm:flex-none h-10 sm:h-9 px-2 sm:px-3 rounded-integrallys text-[var(--app-danger-text)] border-transparent app-status-danger/30 dark:border-transparent dark:bg-transparent flex flex-row items-center justify-center gap-2"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleOpenCancel(item)
                      }}
                      title="Cancelar"
                    >
                      <X className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline text-xs font-bold">Cancelar</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {visibleAppointments.length === 0 && (
            <div className="rounded-integrallys-lg p-6 border border-app-border dark:border-app-border-dark bg-app-card dark:bg-app-card-dark text-center text-sm text-app-text-secondary dark:text-app-text-muted">
              Nenhuma consulta encontrada para este filtro.
            </div>
          )}
        </div>
      )}

      <DetalhesModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        consulta={selectedAppointment}
      />

      <CancelarModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}
