'use client'

import { StatCard } from '@/components/shared/stat-card'
import type { useFinanceiroStats } from '../hooks/use-financeiro-stats'

interface Props {
  cards: ReturnType<typeof useFinanceiroStats>['cards']
  onSelect: (index: number) => void
}

export function FinanceiroStatsCards({ cards, onSelect }: Props) {
  return (
    <div className="app-grid-stats md:grid-cols-4">
      {cards.map((stat, index) => (
        <StatCard
          key={stat.title}
          role="button"
          tabIndex={0}
          aria-label={`${stat.title}: ${stat.value}. Abrir detalhamento`}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(index)
            }
          }}
          className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/50"
          label={stat.title}
          value={stat.value}
          sub={stat.subtitle}
          icon={stat.icon}
        />
      ))}
    </div>
  )
}
