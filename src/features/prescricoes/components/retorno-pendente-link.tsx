'use client'

import { RetornoPendenteBadge } from '@/features/retornos/retorno-pendente-badge'

/** Rota que o selo abre: a agenda no dia do retorno já marcado, ou o novo agendamento de retorno do paciente. */
export function rotaDoRetorno(pacienteId: string, dataRetornoMarcado?: string | null): string {
  return dataRetornoMarcado
    ? `/agenda?data=${encodeURIComponent(dataRetornoMarcado)}`
    : `/agenda?modal=novo&tipo=retorno&patientId=${encodeURIComponent(pacienteId)}`
}

interface RetornoPendenteLinkProps {
  pacienteId: string
  dataRetornoMarcado?: string | null
  onAbrir: (rota: string) => void
}

/** Selo "Retorno pendente" clicável: ver o retorno na agenda ou agendar um novo. */
export function RetornoPendenteLink({ pacienteId, dataRetornoMarcado, onAbrir }: RetornoPendenteLinkProps) {
  const titulo = dataRetornoMarcado ? 'Ver retorno na agenda' : 'Agendar retorno'
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={() => onAbrir(rotaDoRetorno(pacienteId, dataRetornoMarcado))}
      className="w-fit cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <RetornoPendenteBadge />
    </button>
  )
}
