'use client'

import { AlertTriangle, Clock, Layers3, type LucideIcon } from 'lucide-react'
import type { CardTarefa } from '../planner-utils'

interface TarefaResumoCardsProps {
  pendentes: number
  fazendo: number
  alerta: number
  ativo: CardTarefa | null
  /** Clicar no card ativo de novo volta (null) à lista completa. */
  onChange: (card: CardTarefa | null) => void
}

const CARDS: Array<{ card: CardTarefa; label: string; icon: LucideIcon; iconClass: string }> = [
  { card: 'pendentes', label: 'Pendentes', icon: Clock, iconClass: 'text-amber-500' },
  { card: 'fazendo', label: 'Fazendo', icon: Layers3, iconClass: 'text-[var(--app-primary)]' },
  { card: 'alerta', label: 'Com alerta', icon: AlertTriangle, iconClass: 'text-amber-500' },
]

export function TarefaResumoCards({ pendentes, fazendo, alerta, ativo, onChange }: TarefaResumoCardsProps) {
  const totais: Record<CardTarefa, number> = { pendentes, fazendo, alerta }
  return (
    <div className="grid grid-cols-1 gap-3 px-6 pt-5 md:grid-cols-3">
      {CARDS.map(({ card, label, icon: Icon, iconClass }) => {
        const selecionado = ativo === card
        return (
          <button
            key={card}
            type="button"
            aria-pressed={selecionado}
            onClick={() => onChange(selecionado ? null : card)}
            className={`rounded-[18px] border p-4 text-left shadow-sm transition hover:shadow-md dark:bg-app-bg-dark/30 ${
              selecionado
                ? 'border-app-primary bg-[#eaf2ff] ring-2 ring-app-primary/40 dark:bg-[#10213e]'
                : 'border-app-border/70 bg-white dark:border-app-border-dark/70'
            }`}
          >
            <span className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-app-text-muted">{label}</span>
              <Icon className={`h-4 w-4 ${iconClass}`} />
            </span>
            <span className="mt-3 block text-3xl font-normal text-app-text-primary dark:text-white">{totais[card]}</span>
          </button>
        )
      })}
    </div>
  )
}
