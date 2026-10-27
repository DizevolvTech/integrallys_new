'use client'

import { Bell, Calendar, ChevronDown, Clock, DollarSign, ExternalLink, Lock, MoreVertical, Play, Plus, Undo2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AgendaSlot } from '../agenda.types'
import {
  formatSlotDuration,
  getPagamentoButtonTone,
  getPagamentoIconTone,
  getStatusBadgeTone,
  getStatusButtonTone,
  getStatusCardTone,
  AGENDA_STATUS_DROPDOWN,
  isHorarioPassado,
  normalizeAgendaStatus,
  resolvePagamentoSituacao,
} from '../agenda.utils'
import { bloqueiosDoDia, corDoTipoBloqueio, isoDateLocal } from '../bloqueios.utils'
import type { AgendaBloqueio } from '../hooks/use-agenda-bloqueios'

interface AgendaDayViewProps {
  dayFilteredItems: AgendaSlot[]
  bloqueios?: AgendaBloqueio[]
  bloqueiosProfissionais?: Array<{ id: string; nome: string }>
  currentDate?: Date
  selectedProfessional: string
  /** Filtro atual é "todos"/"agendamentos" — decide o texto do estado vazio. */
  showDaySlots: boolean
  onOpenSlotModal: (modal: 'remarcar' | 'cancelar' | 'detalhes' | 'visualizar' | 'ficha-paciente', slot: AgendaSlot) => void
  onOpenCharge: (slot: AgendaSlot) => void
  /** Item 28: recibo ou NF — só aparece com a consulta quitada. */
  onOpenRecibo?: (slot: AgendaSlot) => void
  onCallSpecialist: (slot: AgendaSlot) => void
  onStatusChange: (slot: AgendaSlot, status: string) => void
  onOpenAvailableSlot?: (slot: AgendaSlot) => void
  onStartAtendimento?: (slot: AgendaSlot) => void
  /** Reabre o atendimento já em andamento (sem mudar o status). */
  onContinueAtendimento?: (slot: AgendaSlot) => void
  onRemoveBloqueio?: (bloqueio: AgendaBloqueio) => void
}

export function AgendaDayView({
  dayFilteredItems,
  bloqueios = [],
  bloqueiosProfissionais = [],
  currentDate,
  selectedProfessional,
  showDaySlots,
  onOpenSlotModal,
  onOpenCharge,
  onOpenRecibo,
  onCallSpecialist,
  onStatusChange,
  onOpenAvailableSlot,
  onStartAtendimento,
  onContinueAtendimento,
  onRemoveBloqueio,
}: AgendaDayViewProps) {
  const router = useRouter()

  const todayIso = currentDate ? isoDateLocal(currentDate) : ''
  const profIdToNome = new Map(bloqueiosProfissionais.map((p) => [p.id, p.nome]))
  // Bloqueios do dia (filtrados por profissional quando um está selecionado).
  // Antes eram renderizados por linha do grid estático (repetindo o mesmo bloqueio
  // em cada faixa de 30min); agora saem uma vez cada, numa seção no topo do dia.
  const bloqueiosDoDiaAtual = bloqueiosDoDia(bloqueios, todayIso, selectedProfessional, profIdToNome)

  // Item 11a+b — as linhas do dia derivam dos horários REALMENTE presentes nos
  // agendamentos/slots do dia, não mais de um grid fixo 08:00–17:30 de 30 em 30.
  // Resolve os dois sintomas de uma vez: (a) sem nada gerado não há linha nenhuma
  // → cai no EmptyState em vez de placeholders falsos; (b) um slot real de
  // qualquer duração/horário (ex.: 08:40 numa grade de 40min, ou um encaixe às
  // 18:10) aparece, porque a linha nasce do próprio horário do item — antes,
  // qualquer horário fora de {:00,:30} não casava com nenhuma linha e sumia.
  const rowTimes = Array.from(new Set(dayFilteredItems.map((item) => item.hora))).sort()

  const temConteudo = dayFilteredItems.length > 0 || bloqueiosDoDiaAtual.length > 0
  // Bloqueios e horários dividem a mesma linha do tempo: `order` (CSS) ordena por hora de início.
  const toMinutes = (value?: string | null) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        {bloqueiosDoDiaAtual.map((b) => {
          const profissionalNome = b.profissionalId ? profIdToNome.get(b.profissionalId) : null
          const cor = corDoTipoBloqueio(b.tipo)
          return (
            <div
              key={`bloq-${b.id}`}
              style={{ order: b.diaInteiro ? -1 : toMinutes(b.horarioInicio) }}
              className={`rounded-integrallys border p-4 ${cor.card}`}
              title={b.justificativa ?? undefined}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-shrink-0 w-[60px]">
                  <p className="text-xl font-normal text-red-700 dark:text-red-300 leading-[30px]">
                    {b.diaInteiro ? '—' : (b.horarioInicio?.slice(0, 5) ?? '')}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Lock className="h-3 w-3 text-red-700 dark:text-red-300" />
                    <span className="text-xs font-normal text-red-700/80 dark:text-red-300/80">
                      {b.diaInteiro ? 'Dia inteiro' : `${b.horarioInicio?.slice(0, 5) ?? ''}–${b.horarioFim?.slice(0, 5) ?? ''}`}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cor.chip}`}>
                      {b.tipo}
                    </span>
                    <span className="text-sm font-normal text-red-900 dark:text-red-100">
                      {profissionalNome ?? 'Todos profissionais'}
                    </span>
                  </div>
                  {b.justificativa && (
                    <p className="text-xs text-red-800/80 dark:text-red-200/80 mt-1 truncate">
                      {b.justificativa}
                    </p>
                  )}
                </div>
                {onRemoveBloqueio && (
                  <button
                    type="button"
                    onClick={() => onRemoveBloqueio(b)}
                    className="h-9 px-3 inline-flex items-center gap-1.5 rounded-integrallys border border-red-300 bg-white text-sm text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/40"
                    title="Desfazer bloqueio"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Desfazer
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {rowTimes.map((time) => {
          const allItemsInSlot = dayFilteredItems.filter((item) => item.hora === time)
          const itemsInSlot = allItemsInSlot.filter((item) => item.status !== 'Disponível')
          const activeItemsInSlot = itemsInSlot.filter((item) => normalizeAgendaStatus(item.status) !== 'Cancelado')
          const availableItemsInSlot =
            activeItemsInSlot.length > 0
              ? []
              : allItemsInSlot.filter((item) => item.status === 'Disponível')

          return (
            <div key={time} className="space-y-2" style={{ order: toMinutes(time) }}>
              {itemsInSlot.map((item) => {
                const currentStatus = normalizeAgendaStatus(item.status)
                const duracao = formatSlotDuration(item.hora, item.horaFim)
                const pagamentoSituacao = resolvePagamentoSituacao({
                  pagamento: item.pagamento,
                  valorProcedimento: item.valorProcedimento,
                  totalPago: item.totalPago,
                })

                return (
                  <div
                    key={item.id}
                    className={`${getStatusCardTone(item.status)} rounded-integrallys p-4 transition-colors duration-300`}
                  >
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 sm:gap-0">
                      <div className="flex-shrink-0 w-[60px]">
                        <p className="text-xl font-normal text-app-text-primary dark:text-white leading-[30px]">
                          {item.hora}
                        </p>
                        {duracao && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-app-text-secondary dark:text-app-text-muted" />
                            <span className="text-xs font-normal text-app-text-secondary dark:text-app-text-muted">
                              {duracao}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 w-full sm:w-auto ml-0 sm:ml-4 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-base font-normal text-app-text-primary dark:text-white truncate">
                            {item.paciente}
                          </p>
                          <span className="app-status-neutral px-2 py-0.5 rounded text-xs font-normal whitespace-nowrap">
                            {item.procedimento ?? item.tipo ?? 'Consulta'}
                          </span>
                          {item.foraJanela && (
                            <span
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap"
                              title={item.motivoEncaixe ?? 'Encaixe manual fora da janela de atendimento'}
                            >
                              Encaixe
                            </span>
                          )}
                          {item.urlOnline && (
                            <a
                              href={item.urlOnline}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-200 whitespace-nowrap"
                              title={item.urlOnline}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Online
                            </a>
                          )}
                        </div>
                        <p className="text-sm font-normal text-app-text-secondary dark:text-app-text-muted leading-[21px] truncate">
                          {item.profissional}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-0 sm:ml-4 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                        {onStartAtendimento &&
                          !['Em Atendimento', 'Check-out', 'Cancelado'].includes(currentStatus) && (
                            <Button
                              onClick={() => onStartAtendimento(item)}
                              className="bg-app-primary hover:bg-app-primary-hover text-white h-9 px-3 sm:px-4 rounded-integrallys font-normal flex items-center gap-2 shadow-sm transition-all active:scale-95 flex-1 sm:flex-initial justify-center"
                            >
                              <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                              <span className="text-sm">Iniciar Atendimento</span>
                            </Button>
                          )}

                        {onContinueAtendimento && item.paciente && currentStatus === 'Em Atendimento' && (
                          <Button
                            onClick={() => onContinueAtendimento(item)}
                            className="bg-app-primary hover:bg-app-primary-hover text-white h-9 px-3 sm:px-4 rounded-integrallys font-normal flex items-center gap-2 shadow-sm transition-all active:scale-95 flex-1 sm:flex-initial justify-center"
                          >
                            <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                            <span className="text-sm">Continuar atendimento</span>
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Status: ${currentStatus} — alterar`}
                              className={`${getStatusButtonTone(item.status)} text-white px-4 py-1.5 rounded-[8px] text-sm font-normal flex items-center gap-2 min-w-[120px] justify-center transition-colors shadow-sm`}
                            >
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeTone(item.status)}`}>
                            {currentStatus}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-app-card dark:bg-app-bg-dark border-app-border dark:border-app-border-dark text-app-text-primary dark:text-white z-[9999] shadow-lg"
                          >
                            {AGENDA_STATUS_DROPDOWN.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => onStatusChange(item, status)}
                                className="hover:bg-app-bg-secondary dark:hover:bg-app-hover cursor-pointer"
                              >
                                {status}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <button
                          type="button"
                          onClick={() => onOpenCharge(item)}
                          aria-label={`Pagamento: ${pagamentoSituacao} — emitir cobrança`}
                          title={`Pagamento: ${pagamentoSituacao}`}
                          className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${getPagamentoButtonTone(pagamentoSituacao)}`}
                        >
                          <DollarSign className={`h-4 w-4 ${getPagamentoIconTone(pagamentoSituacao)}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallSpecialist(item)}
                          aria-label="Chamar especialista"
                          className="h-8 w-8 flex items-center justify-center hover:bg-app-card/50 dark:hover:bg-app-hover rounded-lg transition-colors"
                        >
                          <Bell className="h-4 w-4 text-app-primary dark:text-white" />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" aria-label="Mais ações" className="h-8 w-8 flex items-center justify-center hover:bg-app-card/50 dark:hover:bg-app-hover rounded-lg transition-colors">
                              <MoreVertical className="h-4 w-4 text-app-text-secondary dark:text-white/80" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenSlotModal('visualizar', item)}>Visualizar detalhes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenSlotModal('ficha-paciente', item)}>Ficha do paciente</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenSlotModal('detalhes', item)}>Dados do agendamento</DropdownMenuItem>
                            {normalizeAgendaStatus(item.status) !== 'Cancelado' && (
                              <DropdownMenuItem onClick={() => onOpenSlotModal('remarcar', item)}>Reagendar</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onOpenCharge(item)}>Emitir nova cobrança</DropdownMenuItem>
                            {onOpenRecibo && pagamentoSituacao === 'Pago' && item.pacienteId && (
                              <DropdownMenuItem onClick={() => onOpenRecibo(item)}>Emissão de recibo ou NF</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onCallSpecialist(item)}>Chamar especialista</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/financeiro')}>Abrir financeiro</DropdownMenuItem>
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
              })}

              {availableItemsInSlot.map((item) => {
                const dataIso = item.data?.includes('/')
                  ? (() => {
                      const [dd, mm, yyyy] = item.data!.split('/')
                      return `${yyyy}-${mm}-${dd}`
                    })()
                  : (item.data ?? todayIso)
                const passado = Boolean(dataIso && isHorarioPassado(dataIso, item.hora))

                if (passado) {
                  return (
                    <div
                      key={`disponivel-passado-${item.id}`}
                      className="w-full rounded-integrallys border border-slate-200 bg-slate-100/80 p-4 flex items-center gap-4 opacity-60 dark:border-slate-700 dark:bg-slate-900/40"
                      title="Horário já passou — não é possível agendar retroativamente"
                    >
                      <div className="flex-shrink-0 w-[60px] text-left">
                        <p className="text-xl font-normal text-slate-500 leading-[30px]">{item.hora}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span className="text-xs font-normal text-slate-500">Passado</span>
                        </div>
                      </div>
                      <div className="flex-1 text-left">
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Indisponível
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          Horário passado — agende um horário futuro
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                <button
                  key={`disponivel-${item.id}`}
                  type="button"
                  onClick={() => onOpenAvailableSlot?.(item)}
                  className="w-full rounded-integrallys border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 p-4 flex items-center gap-4 transition-colors group"
                  title="Slot livre — clique para criar um agendamento"
                >
                  <div className="flex-shrink-0 w-[60px] text-left">
                    <p className="text-xl font-normal text-emerald-700 dark:text-emerald-300 leading-[30px]">
                      {item.hora}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-emerald-700/80 dark:text-emerald-300/80" />
                      <span className="text-xs font-normal text-emerald-700/80 dark:text-emerald-300/80">
                        Livre
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                        Disponível
                      </span>
                      <span className="text-sm font-normal text-emerald-900 dark:text-emerald-100">
                        {item.profissional || 'Especialista'}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                      Disponível — clique para agendar
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                </button>
                )
              })}
            </div>
          )
        })}

        {!temConteudo && (
          <EmptyState
            icon={Calendar}
            title={showDaySlots ? 'Nenhuma agenda gerada para este dia' : 'Nenhum agendamento encontrado'}
            description={
              showDaySlots
                ? 'Gere a agenda deste profissional (ou selecione outro dia) para ver os horários disponíveis.'
                : 'Não há consultas agendadas para o período selecionado.'
            }
          />
        )}
      </div>
    </div>
  )
}
