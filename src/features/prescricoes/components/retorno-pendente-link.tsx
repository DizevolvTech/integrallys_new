'use client'

import { RetornoPendenteBadge } from '@/features/retornos/retorno-pendente-badge'
import type { RetornoPendenteDetalhe } from '@/features/retornos/hooks/use-retornos'

/** Retorno em aberto do paciente: o ligado a ESSA prescrição; senão o mais recente (a lista já vem do mais novo ao mais velho). */
export function escolherRetornoPendente(
  itens: RetornoPendenteDetalhe[],
  pacienteId: string,
  prescricaoId?: string | null,
): RetornoPendenteDetalhe | null {
  const doPaciente = itens.filter((item) => item.pacienteId === pacienteId)
  return doPaciente.find((item) => prescricaoId && item.prescricaoId === prescricaoId) ?? doPaciente[0] ?? null
}

/** Novo agendamento de retorno com paciente, especialista e procedimento pré-preenchidos (editáveis na agenda). */
export function rotaDoRetorno(
  pacienteId: string,
  retorno?: Pick<RetornoPendenteDetalhe, 'profissionalId' | 'procedimentoId'> | null,
): string {
  const params = new URLSearchParams({ modal: 'novo', tipo: 'retorno', patientId: pacienteId })
  if (retorno?.profissionalId) params.set('profissionalId', retorno.profissionalId)
  if (retorno?.procedimentoId) params.set('procedimentoId', retorno.procedimentoId)
  return `/agenda?${params.toString()}`
}

interface RetornoPendenteLinkProps {
  pacienteId: string
  retorno?: Pick<RetornoPendenteDetalhe, 'profissionalId' | 'procedimentoId'> | null
  onAbrir: (rota: string) => void
}

/** Selo "Retorno pendente" clicável: sempre abre o Novo agendamento de retorno já preenchido. */
export function RetornoPendenteLink({ pacienteId, retorno, onAbrir }: RetornoPendenteLinkProps) {
  return (
    <button
      type="button"
      title="Agendar retorno"
      aria-label="Agendar retorno"
      onClick={() => onAbrir(rotaDoRetorno(pacienteId, retorno))}
      className="w-fit cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <RetornoPendenteBadge />
    </button>
  )
}
