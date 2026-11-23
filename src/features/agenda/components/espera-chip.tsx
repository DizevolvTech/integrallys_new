import { Timer } from 'lucide-react'
import {
  esperaDesdeCheckin,
  esperaEntre,
  formatarCronometro,
  formatarMinutos,
} from '@/lib/tempo-espera'
import type { AgendaSlot } from '../agenda.types'
import { normalizeAgendaStatus } from '../agenda.utils'

interface EsperaChipProps {
  slot: Pick<AgendaSlot, 'status' | 'checkinEm' | 'atendimentoInicioEm'>
  /** Agora (ms) já corrigido pelo relógio do servidor; vem do relógio único da tela. */
  agoraMs: number
}

/** "Aguardando 05:09" enquanto o paciente está em check-in; "Esperou 8 min" depois que o atendimento começou. */
export function EsperaChip({ slot, agoraMs }: EsperaChipProps) {
  if (!slot.checkinEm) return null
  const status = normalizeAgendaStatus(slot.status)

  if (status === 'Check-in') {
    const ms = esperaDesdeCheckin(slot.checkinEm, agoraMs)
    if (ms === null) return null
    return (
      <span
        role="timer"
        aria-label={`Aguardando há ${formatarCronometro(ms)}`}
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap tabular-nums dark:bg-amber-900/40 dark:text-amber-200"
      >
        <Timer className="h-3 w-3" />
        Aguardando {formatarCronometro(ms)}
      </span>
    )
  }

  const espera = esperaEntre(slot.checkinEm, slot.atendimentoInicioEm)
  if (espera === null) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap dark:bg-slate-800 dark:text-slate-200">
      <Timer className="h-3 w-3" />
      Esperou {formatarMinutos(espera / 60000)}
    </span>
  )
}
