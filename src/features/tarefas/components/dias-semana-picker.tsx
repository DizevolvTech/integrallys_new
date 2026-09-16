'use client'

import { DIAS_SEMANA_OPTIONS } from '@/lib/tarefa-recorrencia'
import { cn } from '@/lib/utils'

interface DiasSemanaPickerProps {
  value: number[]
  onChange: (next: number[]) => void
  className?: string
}

export function DiasSemanaPicker({ value, onChange, className }: DiasSemanaPickerProps) {
  const selected = new Set(value)

  const toggle = (day: number) => {
    const next = new Set(selected)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    onChange([...next].sort((a, b) => a - b))
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {DIAS_SEMANA_OPTIONS.map((day) => {
        const active = selected.has(day.value)
        return (
          <button
            key={day.value}
            type="button"
            title={day.full}
            onClick={() => toggle(day.value)}
            className={cn(
              'h-9 min-w-11 rounded-[10px] border px-2 text-xs transition-colors',
              active
                ? 'border-[var(--app-primary)] bg-[var(--app-primary)] text-white'
                : 'border-app-border/70 bg-white text-app-text-secondary hover:bg-app-bg-secondary dark:border-app-border-dark/70 dark:bg-app-bg-dark/60 dark:text-white/75',
            )}
          >
            {day.label}
          </button>
        )
      })}
    </div>
  )
}
