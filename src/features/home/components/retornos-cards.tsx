import Link from 'next/link'
import { CalendarCheck, Clock, AlertTriangle } from 'lucide-react'

interface RetornosCardsProps {
  retornos: { noPrazo?: number; limitePrazo: number; vencidos: number }
}

/** Retornos no limite do prazo e vencidos: cada card abre a lista /retornos já filtrada. */
export function RetornosCards({ retornos }: RetornosCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Link
        href="/retornos?situacao=no_prazo"
        className="group rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900/40 dark:bg-emerald-950/20"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Retornos no prazo</p>
            <h3 className="text-3xl font-medium text-emerald-700 dark:text-emerald-300">{retornos.noPrazo ?? 0}</h3>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/70">Ainda dentro do prazo · ver lista</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
            <CalendarCheck size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </Link>
      <Link
        href="/retornos?situacao=limite"
        className="group rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900/40 dark:bg-amber-950/20"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Retornos no limite do prazo</p>
            <h3 className="text-3xl font-medium text-amber-700 dark:text-amber-300">{retornos.limitePrazo}</h3>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/70">Vencem nos próximos 10 dias · ver lista</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <Clock size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </Link>
      <Link
        href="/retornos?situacao=vencido"
        className="group rounded-[24px] border border-red-200 bg-red-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-red-900/40 dark:bg-red-950/20"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Retornos vencidos</p>
            <h3 className="text-3xl font-medium text-red-700 dark:text-red-300">{retornos.vencidos}</h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/70">Prazo expirado, sem agendamento · ver lista</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
            <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
          </div>
        </div>
      </Link>
    </div>
  )
}
