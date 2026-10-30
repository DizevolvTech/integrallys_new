import { timeToMinutes } from '@/app/api/agenda/agenda-duracao'
import { bloqueioSobrepoe } from '@/app/api/agenda/compromisso-regras'
import type { AgendaItem } from '@/hooks/use-agenda'
import type { AgendaBloqueio } from './hooks/use-agenda-bloqueios'

const DURACAO_SLOT_PADRAO_MIN = 30

/** DD/MM/AAAA (formato da agenda) ou AAAA-MM-DD → AAAA-MM-DD. */
function dataParaIso(valor: string | undefined): string {
  const [dia, mes, ano] = (valor ?? '').split('/')
  return dia && mes && ano ? `${ano}-${mes}-${dia}` : (valor ?? '')
}

/**
 * Remove os horários livres ('Disponível') cobertos por bloqueio da agenda (dia inteiro de vários dias
 * ou parcial por horário), com a MESMA regra que o servidor usa para recusar (bloqueioSobrepoe).
 */
export function removerSlotsBloqueados(itens: AgendaItem[], bloqueios: AgendaBloqueio[]): AgendaItem[] {
  if (bloqueios.length === 0) return itens
  const regras = bloqueios.map((b) => ({
    profissional_id: b.profissionalId,
    unidade_id: b.unidadeId,
    data_inicio: b.dataInicio,
    data_fim: b.dataFim,
    horario_inicio: b.horarioInicio,
    horario_fim: b.horarioFim,
    dia_inteiro: b.diaInteiro,
  }))
  return itens.filter((item) => {
    if (item.status !== 'Disponível' || !item.profissionalId) return true
    const inicioMin = timeToMinutes(item.horario)
    if (inicioMin === null) return true
    const fimMin = timeToMinutes(item.horarioFim) ?? inicioMin + DURACAO_SLOT_PADRAO_MIN
    const alvo = { profissionalId: item.profissionalId, dataIso: dataParaIso(item.data), inicioMin, fimMin }
    return !regras.some((regra) => bloqueioSobrepoe(regra, alvo))
  })
}
