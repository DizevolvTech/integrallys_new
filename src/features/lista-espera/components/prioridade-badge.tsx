import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ESTILOS: Record<string, string> = {
  urgente: 'bg-red-600 text-white ring-2 ring-red-300 font-semibold shadow-md dark:bg-red-600 dark:text-white dark:ring-red-900',
  alta: 'bg-orange-500 text-white dark:bg-orange-600 dark:text-white',
  média: 'bg-yellow-300 text-yellow-950 dark:bg-yellow-400 dark:text-yellow-950',
  baixa: 'bg-app-bg-secondary text-app-text-secondary dark:bg-app-hover dark:text-white/70',
}

export function PrioridadeBadge({ prioridade, className }: { prioridade: string; className?: string }) {
  const estilo = ESTILOS[prioridade.trim().toLowerCase()]
  return (
    <Badge
      variant={estilo ? undefined : 'outline'}
      className={cn('rounded-full border-none px-3 py-0.5 text-xs font-normal', estilo, className)}
    >
      {prioridade || '-'}
    </Badge>
  )
}
