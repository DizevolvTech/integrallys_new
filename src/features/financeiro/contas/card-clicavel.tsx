'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Card que abre o detalhamento ao clicar (também por teclado). */
export function CardClicavel({ onOpen, className, children, rotulo }: { onOpen: () => void; className?: string; children: ReactNode; rotulo?: string }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={rotulo ? `${rotulo}. Abrir detalhamento` : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/50',
        className,
      )}
    >
      {children}
    </Card>
  )
}
