'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useAgendaPaciente } from './hooks/use-agenda-paciente'
import type { PatientAgendaItem } from './hooks/use-agenda-paciente'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
]

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ReagendarView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectId = searchParams.get('id')
  const { data, isLoading, rescheduleAgendamento } = useAgendaPaciente()

  const [selected, setSelected] = useState<PatientAgendaItem | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [preselectApplied, setPreselectApplied] = useState(false)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = new Date(year, month, 1).getDay()

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startDay; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  const isDateDisabled = (day: number) => {
    const d = new Date(year, month, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return d < today
  }

  const isDateSelected = (day: number) =>
    selectedDate?.getDate() === day &&
    selectedDate?.getMonth() === month &&
    selectedDate?.getFullYear() === year

  const eligible = data.filter((a) => a.status === 'Confirmada' || a.status === 'Agendado')

  useEffect(() => {
    if (preselectApplied || isLoading || !preselectId) return
    const match = eligible.find((item) => item.id === preselectId)
    if (match) setSelected(match)
    setPreselectApplied(true)
  }, [eligible, isLoading, preselectApplied, preselectId])

  const handleConfirm = async () => {
    if (!selected || !selectedDate || !selectedTime) return
    setIsSaving(true)
    try {
      await rescheduleAgendamento({
        id: selected.id,
        date: toIsoDate(selectedDate),
        time: selectedTime,
      })
      toast.success('Consulta reagendada.')
      router.push('/portal/agenda')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível reagendar.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="app-page space-y-6">
      <PageHeader
        title="Reagendar Consulta"
        description="Selecione uma consulta e escolha nova data e horario"
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="cursor-pointer">Inicio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/portal/agenda" className="cursor-pointer">Minha Agenda</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <Button asChild variant="outline" className="h-11 gap-2 rounded-integrallys px-4 whitespace-nowrap">
            <Link href="/portal/agenda" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-integrallys-lg border border-app-border dark:border-app-border-dark bg-app-bg-secondary dark:bg-app-card-dark p-4">
        <Info className="h-5 w-5 text-app-primary shrink-0 mt-0.5" />
        <p className="text-sm text-app-text-secondary dark:text-white/60">
          Escolha a consulta e um horário Disponível na grade do especialista. O horário antigo será liberado.
        </p>
      </div>

      {isLoading && <p className="text-app-text-secondary">Carregando agendamentos...</p>}

      {!isLoading && eligible.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-app-border dark:border-app-border-dark p-10 text-center">
          <Calendar className="h-6 w-6 text-app-primary" />
          <p className="text-base font-medium text-app-text-primary dark:text-white">Nenhuma consulta disponivel para reagendamento</p>
        </Card>
      )}

      {!isLoading && eligible.length > 0 && !selected && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {eligible.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer rounded-integrallys-lg border-app-border dark:border-app-border-dark p-5 hover:shadow-md transition-shadow"
              onClick={() => setSelected(item)}
            >
              <p className="font-semibold text-app-text-primary dark:text-white">{item.medico}</p>
              <p className="text-sm text-app-text-secondary dark:text-white/60">{item.especialidade}</p>
              <p className="mt-2 text-sm text-app-text-secondary dark:text-white/60">{item.data} - {item.local}</p>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <>
          <Card className="p-6 bg-app-card dark:bg-app-card-dark border-app-border dark:border-app-border-dark shadow-sm rounded-integrallys-lg">
            <h3 className="text-base font-semibold text-app-text-primary dark:text-white mb-4">Consulta Selecionada</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-12">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Medico</span>
                <p className="text-base font-medium text-app-text-primary dark:text-white">{selected.medico}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Especialidade</span>
                <p className="text-base font-medium text-app-text-primary dark:text-white">{selected.especialidade}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Atual</span>
                <p className="text-base font-medium text-app-text-primary dark:text-white">{selected.data}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Local</span>
                <p className="text-base font-medium text-app-text-primary dark:text-white">{selected.local}</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 bg-app-card dark:bg-app-card-dark border-app-border dark:border-app-border-dark shadow-sm rounded-integrallys-lg flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-6 px-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d) }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold capitalize text-app-text-primary dark:text-white">
                  {MONTH_NAMES[month]} {year}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d) }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="w-full grid grid-cols-7 gap-1 mb-2 text-center">
                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map((d) => (
                  <span key={d} className="text-xs text-app-text-muted">{d}</span>
                ))}
              </div>

              <div className="w-full grid grid-cols-7 gap-1 text-center">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} className="h-10" />
                  const disabled = isDateDisabled(day)
                  const sel = isDateSelected(day)
                  return (
                    <button
                      key={day}
                      disabled={disabled}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                      className={`h-10 w-10 mx-auto flex items-center justify-center rounded-lg text-sm transition-all ${
                        disabled
                          ? 'text-gray-300 dark:text-app-text-secondary cursor-not-allowed opacity-50'
                          : sel
                            ? 'bg-slate-900 text-white dark:bg-slate-700 font-medium shadow-md scale-105'
                            : 'text-app-text-secondary dark:text-white/60 hover:bg-app-bg-secondary dark:hover:bg-app-hover'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card className="p-6 bg-app-card dark:bg-app-card-dark border-app-border dark:border-app-border-dark shadow-sm rounded-integrallys-lg">
              <h3 className="text-base font-semibold text-app-text-primary dark:text-white mb-4">Horarios Disponiveis</h3>
              <div className="grid grid-cols-3 gap-3">
                {TIME_SLOTS.map((time) => {
                  const sel = selectedTime === time
                  const disabled = !selectedDate
                  return (
                    <button
                      key={time}
                      disabled={disabled}
                      onClick={() => setSelectedTime(time)}
                      className={`flex items-center justify-center gap-2 h-12 rounded-integrallys border whitespace-nowrap transition-all duration-200 ${
                        sel
                          ? 'border-gray-900 bg-app-bg-secondary text-gray-900 dark:border-white dark:bg-app-hover dark:text-white font-medium shadow-sm'
                          : 'border-app-border dark:border-app-border-dark text-app-text-secondary dark:text-white/70 hover:border-app-hover-strong dark:hover:border-app-hover-strong'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{time}</span>
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <Button
              variant="outline"
              className="h-12 px-8 rounded-integrallys"
              disabled={isSaving}
              onClick={() => { setSelected(null); setSelectedDate(null); setSelectedTime(null) }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!selectedDate || !selectedTime || isSaving}
              onClick={() => void handleConfirm()}
              className="h-11 px-6 bg-app-primary hover:bg-app-primary-hover text-white rounded-integrallys flex items-center gap-2 whitespace-nowrap"
            >
              <CheckCircle className="h-5 w-5 shrink-0" />
              {isSaving ? 'Reagendando...' : 'Confirmar Reagendamento'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
