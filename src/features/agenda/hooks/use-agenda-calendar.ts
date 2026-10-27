'use client'

import { useMemo, useState } from 'react'
import type { ViewMode, AgendaSlot } from '../agenda.types'
import {
  buildWeekDays,
  buildMonthDays,
  deslocarPeriodo,
  filterAgendaItemsByStatus,
  normalizeAgendaStatus,
} from '../agenda.utils'

export function useAgendaCalendar(agendaSlots: AgendaSlot[]) {
  const [viewMode, setViewMode] = useState<ViewMode>('dia')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedFilter, setSelectedFilter] = useState('todos')

  const formattedCurrentDate = useMemo(
    () =>
      currentDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [currentDate],
  )

  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate])
  const monthDays = useMemo(() => buildMonthDays(currentDate), [currentDate])

  const dayAgendaSlots = useMemo(
    () => agendaSlots.filter((item) => !item.data || item.data === formattedCurrentDate),
    [agendaSlots, formattedCurrentDate],
  )

  const dayFilteredItems = useMemo(
    () => filterAgendaItemsByStatus(dayAgendaSlots, selectedFilter),
    [dayAgendaSlots, selectedFilter],
  )

  const weekAgendaGroups = useMemo(
    () =>
      weekDays.map((weekDay) => {
        const formattedDay = weekDay.date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        const items = agendaSlots.filter((item) => !item.data || item.data === formattedDay)
        return { ...weekDay, formattedDay, items: filterAgendaItemsByStatus(items, selectedFilter) }
      }),
    [agendaSlots, selectedFilter, weekDays],
  )

  const monthAgendaSummary = useMemo(
    () =>
      monthDays.map((cell) => {
        if (!cell.date) {
          return {
            ...cell,
            formattedDay: '',
            count: 0,
            confirmed: 0,
            pending: 0,
            canceled: 0,
            professionals: [] as string[],
          }
        }

        const formattedDay = cell.date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        const items = agendaSlots.filter((item) => !item.data || item.data === formattedDay)
        return {
          ...cell,
          formattedDay,
          count: items.length,
          confirmed: items.filter((i) => normalizeAgendaStatus(i.status) === 'Confirmado').length,
          pending: items.filter((i) => normalizeAgendaStatus(i.status) === 'Aguardando').length,
          canceled: items.filter((i) => normalizeAgendaStatus(i.status) === 'Cancelado').length,
          professionals: Array.from(new Set(items.map((i) => i.profissional).filter(Boolean))).slice(0, 2),
        }
      }),
    [agendaSlots, monthDays],
  )

  const goPrev = () => setCurrentDate(deslocarPeriodo(currentDate, viewMode, -1))
  const goNext = () => setCurrentDate(deslocarPeriodo(currentDate, viewMode, 1))

  return {
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    selectedFilter,
    setSelectedFilter,
    formattedCurrentDate,
    weekDays,
    monthDays,
    dayAgendaSlots,
    dayFilteredItems,
    weekAgendaGroups,
    monthAgendaSummary,
    goPrev,
    goNext,
  }
}
