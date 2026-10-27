'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, CreditCard, Info, QrCode } from 'lucide-react'
import { useAgendamento } from './hooks/use-agendamento'
import { useOpcoesAgendamento } from './hooks/use-opcoes-agendamento'
import { PageHeader } from '@/components/shared/page-header'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarMoeda } from '@/lib/moeda'

export function NovoAgendamentoView() {
  const router = useRouter()
  const { createAgendamento } = useAgendamento()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const selectedDateValue = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : undefined
  const { data: options, isLoading, error } = useOpcoesAgendamento(selectedDateValue)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [specialist, setSpecialist] = useState<string>('')
  const [procedure, setProcedure] = useState<string>('')
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'pix' | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const days = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    return { days, firstDay }
  }

  const { days: daysInMonth, firstDay: startDayOfWeek } = getDaysInMonth(currentDate)

  const handlePrevMonth = () => {
    const next = new Date(currentDate)
    next.setMonth(next.getMonth() - 1)
    setCurrentDate(next)
  }

  const handleNextMonth = () => {
    const next = new Date(currentDate)
    next.setMonth(next.getMonth() + 1)
    setCurrentDate(next)
  }

  const isDateDisabled = (day: number) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  const isDateSelected = (day: number) => {
    if (!selectedDate) return false
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentDate.getMonth() &&
      selectedDate.getFullYear() === currentDate.getFullYear()
    )
  }

  const handleDateClick = (day: number) => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(nextDate)
    setSelectedTime(null)
  }

  const calendarDays = []
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  const calculatePreviewValue = () => {
    const raw = procedure.split('R$')[1] || '0'
    const normalized = Number(raw.replace(',', '.'))
    return (normalized / 2).toFixed(2).replace('.', ',')
  }

  const canAdvanceStepOne = Boolean(selectedDate && selectedTime && specialist && procedure)
  const canFinish = true

  return (
    <div className="app-page">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Novo Agendamento"
          description={
            step === 1
              ? 'Selecione o especialista, procedimento, data e horário'
              : step === 2
                ? 'Revise os detalhes do seu agendamento'
                : 'Realize o pagamento antecipado de 50%'
          }
          breadcrumb={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Início</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/portal/agenda">Minha Agenda</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
        />

        <div className="flex items-center justify-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= 1 ? 'bg-app-primary text-white' : 'bg-app-bg-tertiary text-app-text-secondary dark:bg-app-card-dark dark:text-white/60'}`}>
            {step > 1 ? <Check className="h-5 w-5" /> : '1'}
          </div>
          <div className={`h-[2px] w-12 ${step >= 2 ? 'bg-app-primary' : 'bg-app-bg-tertiary dark:bg-app-hover'}`} />
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= 2 ? 'bg-app-primary text-white' : 'bg-app-bg-tertiary text-app-text-secondary dark:bg-app-card-dark dark:text-white/60'}`}>
            {step > 2 ? <Check className="h-5 w-5" /> : '2'}
          </div>
          <div className={`h-[2px] w-12 ${step >= 3 ? 'bg-app-primary' : 'bg-app-bg-tertiary dark:bg-app-hover'}`} />
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${step >= 3 ? 'bg-app-primary text-white' : 'bg-app-bg-tertiary text-app-text-secondary dark:bg-app-card-dark dark:text-white/60'}`}>
            3
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      {isLoading && <p className="text-app-text-secondary">Carregando opções de agendamento...</p>}

      {!isLoading && step === 1 ? (
        <>
          <Card className="rounded-integrallys-lg border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
            <h3 className="mb-6 text-base font-semibold text-gray-800 dark:text-white">Informações da Consulta</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Especialista</label>
                <Select onValueChange={setSpecialist} value={specialist}>
                  <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-app-bg-secondary dark:border-app-border-dark dark:bg-app-hover">
                    <SelectValue placeholder="Selecione o especialista" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.specialists.map((item) => (
                      <SelectItem key={item.id} value={`${item.id}::${item.name} (${item.specialty})`}>
                        {item.name} ({item.specialty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {options.specialists.length === 0 && (
                  <p className="text-xs text-app-text-muted">Nenhum especialista disponível para agendamento no momento.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-app-text-primary dark:text-white/70">Procedimento</label>
                <Select onValueChange={setProcedure} value={procedure}>
                  <SelectTrigger className="h-11 rounded-integrallys border-app-border bg-app-bg-secondary dark:border-app-border-dark dark:bg-app-hover">
                    <SelectValue placeholder="Selecione o procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.procedures.map((item) => (
                      <SelectItem key={item.id} value={`${item.id}::${item.name} - R$${item.price.toFixed(2).replace('.', ',')}`}>
                        {item.name} - {formatarMoeda(item.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {options.procedures.length === 0 && (
                  <p className="text-xs text-app-text-muted">Nenhum procedimento foi cadastrado para esta unidade.</p>
                )}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="flex flex-col items-center rounded-integrallys-lg border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
              <div className="mb-6 flex w-full items-center justify-between px-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold capitalize text-gray-800 dark:text-white">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-2 grid w-full grid-cols-7 gap-1 text-center">
                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map((day) => (
                  <span key={day} className="text-xs text-app-text-muted">{day}</span>
                ))}
              </div>

              <div className="grid w-full grid-cols-7 gap-1 text-center">
                {calendarDays.map((day, index) => {
                  if (day === null) return <div key={`empty-${index}`} className="h-10" />

                  const disabled = isDateDisabled(day)
                  const selected = isDateSelected(day)

                  return (
                    <button
                      key={day}
                      disabled={disabled}
                      onClick={() => handleDateClick(day)}
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-all ${
                        disabled
                          ? 'cursor-not-allowed text-gray-300 opacity-50 dark:text-app-text-secondary'
                          : selected
                            ? 'scale-105 bg-slate-900 font-medium text-white shadow-md dark:bg-slate-700'
                            : 'text-app-text-secondary hover:bg-app-bg-secondary dark:text-white/60 dark:hover:bg-app-hover'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card className="rounded-integrallys-lg border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
              <div className="grid grid-cols-3 gap-3">
                {options.timeSlots.map((time) => {
                  const selected = selectedTime === time
                  const disabled = !selectedDate

                  return (
                    <button
                      key={time}
                      disabled={disabled}
                      onClick={() => setSelectedTime(time)}
                      className={`flex h-12 flex-row items-center justify-center gap-2 whitespace-nowrap rounded-integrallys border transition-all duration-200 ${
                        selected
                          ? 'border-[var(--app-primary)] bg-app-primary/5 font-medium text-[var(--app-primary)] ring-1 ring-[var(--app-primary)] shadow-sm dark:border-[var(--app-primary)] dark:app-status-info dark:text-white'
                          : 'border-app-border text-app-text-secondary hover:border-app-hover-strong dark:border-app-border-dark dark:text-white/70 dark:hover:border-app-hover-strong'
                      } ${disabled ? 'cursor-not-allowed bg-app-bg-secondary opacity-40 dark:bg-app-card-dark/50' : 'cursor-pointer'}`}
                    >
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{time}</span>
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      ) : !isLoading && step === 2 ? (
        <div className="animate-in slide-in-from-right-4 space-y-6 duration-500 fade-in">
          <Card className="rounded-integrallys-lg border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
            <h3 className="mb-6 text-base font-semibold text-gray-800 dark:text-white">Resumo do Agendamento</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 border-b border-app-border pb-4 dark:border-app-border-dark sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-app-text-secondary dark:text-white/60">Especialista</p>
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">{specialist.split('::')[1] ?? specialist}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-app-text-secondary dark:text-white/60">Procedimento</p>
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">{(procedure.split('::')[1] ?? procedure).split('-')[0]?.trim()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-app-text-secondary dark:text-white/60">Data</p>
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">{selectedDate?.toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-app-text-secondary dark:text-white/60">Horário</p>
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">{selectedTime}</p>
                </div>
              </div>

              <div className="flex flex-col items-start justify-between gap-2 pt-2 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wider text-app-text-secondary dark:text-white/60">Valor Total</p>
                  <p className="text-xl font-bold text-app-text-primary dark:text-white">R$ {procedure.split('R$')[1] || '0,00'}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium uppercase tracking-wider text-[var(--app-success-text)] dark:text-[var(--app-success-text)]">Sinal sugerido (50%)</p>
                  <p className="text-xl font-bold text-[var(--app-success-text)] dark:text-[var(--app-success-text)]">R$ {calculatePreviewValue()}</p>
                  <p className="mt-1 text-xs text-app-text-secondary">Cobrança confirmada na clínica / recepção</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 rounded-integrallys border-l-4 border-blue-500 p-4 app-status-info/50 dark:bg-transparent">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-app-text-muted" />
            <p className="text-sm text-app-text-primary dark:text-[var(--app-info-text)]">
              <strong>Importante:</strong> Para confirmar seu agendamento, é necessário realizar o pagamento antecipado de 50% do valor. O restante pode ser pago no dia da consulta.
            </p>
          </div>
        </div>
      ) : !isLoading ? (
        <div className="animate-in slide-in-from-right-4 space-y-6 duration-500 fade-in">
          <Card className="rounded-integrallys-lg border-app-border bg-app-card p-6 shadow-sm dark:border-app-border-dark dark:bg-app-card-dark md:p-8">
            <h3 className="mb-6 text-base font-bold text-app-text-primary dark:text-white">Pagamento Antecipado</h3>

            <div className="mb-8 flex items-center justify-between border-b border-app-border pb-8 dark:border-app-border-dark">
              <span className="font-medium text-app-text-secondary dark:text-white/60">Valor a Pagar:</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">R$ {calculatePreviewValue()}</span>
            </div>

            <div className="space-y-4">
              <h4 className="mb-4 font-bold text-app-text-primary dark:text-white">Escolha a Forma de Pagamento</h4>

              <div className="grid gap-4">
                <div
                  className={`relative cursor-pointer rounded-integrallys border p-4 transition-all duration-200 ${
                    paymentMethod === 'credit'
                      ? 'border-[var(--app-primary)] bg-app-primary/5 ring-1 ring-[var(--app-primary)]'
                      : 'border-app-border bg-app-card hover:border-[var(--app-primary)] dark:border-app-border-dark dark:bg-app-card-dark'
                  }`}
                  onClick={() => setPaymentMethod('credit')}
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-app-bg-secondary p-2 text-app-text-secondary dark:bg-app-card-dark dark:text-white/70">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-app-text-primary dark:text-white">Cartão de Crédito</p>
                      <p className="text-sm text-app-text-muted">Pagamento instantâneo</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`relative cursor-pointer rounded-integrallys border p-4 transition-all duration-200 ${
                    paymentMethod === 'pix'
                      ? 'border-[var(--app-primary)] bg-app-primary/5 ring-1 ring-[var(--app-primary)]'
                      : 'border-app-border bg-app-card hover:border-[var(--app-primary)] dark:border-app-border-dark dark:bg-app-card-dark'
                  }`}
                  onClick={() => setPaymentMethod('pix')}
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-app-bg-secondary p-2 text-app-text-secondary dark:bg-app-card-dark dark:text-white/70">
                      <QrCode className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-app-text-primary dark:text-white">PIX</p>
                      <p className="text-sm text-app-text-muted">Confirmação em até 5 minutos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <div className={`flex pt-2 ${step === 1 ? 'justify-end' : 'justify-between'}`}>
        {step > 1 && (
          <Button
            variant="outline"
            className="flex h-11 items-center gap-2 rounded-integrallys border-app-border px-6 shadow-sm hover:bg-app-bg-secondary dark:border-app-border-dark dark:hover:bg-app-hover"
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Button>
        )}

        <Button
          className={`flex h-11 items-center gap-2 rounded-integrallys px-6 shadow-sm transition-all active:scale-95 ${
            (step === 1 && !canAdvanceStepOne) || (step === 3 && !canFinish)
              ? 'cursor-not-allowed bg-app-bg-secondary0 opacity-50 grayscale'
              : 'bg-app-primary text-white hover:bg-app-primary-hover'
          }`}
          disabled={isSaving || (step === 1 && !canAdvanceStepOne) || (step === 3 && !canFinish)}
          onClick={async () => {
            if (step === 1) {
              setStep(2)
              return
            }
            if (step === 2) {
              setStep(3)
              return
            }
            if (!selectedDate || !selectedTime) return

            setIsSaving(true)
            try {
              const specialistId = specialist.split('::')[0] ?? ''
              const procedureLabel = procedure.split('::')[1] ?? procedure
              const procedurePrice = Number((procedureLabel.split('R$')[1] || '0').replace(',', '.')) || 0
              await createAgendamento({
                specialistId,
                procedureName: procedureLabel.split('-')[0].trim(),
                procedurePrice,
                date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
                time: selectedTime,
              })
              toast.success('Agendamento solicitado com sucesso. O pagamento será confirmado na clínica.')
              router.push('/portal/agenda')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o agendamento.')
            } finally {
              setIsSaving(false)
            }
          }}
        >
          <span>
            {isSaving
              ? 'Processando...'
              : step === 1
                ? 'Continuar'
                : step === 2
                  ? 'Ir para Pagamento'
                  : 'Solicitar agendamento'}
          </span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
