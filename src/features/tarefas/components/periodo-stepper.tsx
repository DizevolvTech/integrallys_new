'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PeriodoStepperProps {
  de: string
  ate: string
  onChange: (de: string, ate: string) => void
  /** Move o período em dias (-1/+1); a regra fica em `shiftPeriodo`. */
  onShift: (direction: -1 | 1) => void
  /** Rótulo extra à direita (ex.: "Ver todas"). */
  children?: React.ReactNode
}

/** Filtro De/Até com setas para voltar/avançar um dia. */
export function PeriodoStepper({ de, ate, onChange, onShift, children }: PeriodoStepperProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Button type="button" variant="outline" size="icon" aria-label="Dia anterior" onClick={() => onShift(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="flex items-center gap-2">
        De
        <Input type="date" value={de} onChange={(event) => onChange(event.target.value, ate)} className="h-10 w-[150px]" aria-label="Data inicial" />
      </span>
      <span className="flex items-center gap-2">
        Até
        <Input type="date" value={ate} onChange={(event) => onChange(de, event.target.value)} className="h-10 w-[150px]" aria-label="Data final" />
      </span>
      <Button type="button" variant="outline" size="icon" aria-label="Próximo dia" onClick={() => onShift(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {children}
    </div>
  )
}
