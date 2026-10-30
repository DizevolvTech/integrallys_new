import { minutesToHHMM, timeToMinutes } from './agenda-duracao'

/** Regras puras do compromisso pessoal (bloqueio de agenda por duração e participantes). */

export const DURACAO_PADRAO_MIN = 30
export const DURACAO_MAX_MIN = 12 * 60

export type IntervaloCompromisso = { inicioMin: number; fimMin: number; horarioInicio: string; horarioFim: string }

/**
 * Intervalo [início, fim) do compromisso. O fim vem de `horarioFim` ou, sem ele, de `duracaoMin`
 * (padrão 30). Fim <= início ou passando da meia-noite é inválido.
 */
export function resolverIntervaloCompromisso(params: {
  horario: unknown
  horarioFim?: unknown
  duracaoMin?: unknown
}): { ok: true; intervalo: IntervaloCompromisso } | { ok: false; message: string } {
  const inicioMin = timeToMinutes(params.horario)
  if (inicioMin === null) return { ok: false, message: 'Horário inválido.' }
  let fimMin = timeToMinutes(params.horarioFim)
  if (fimMin === null) {
    const duracao = Number(params.duracaoMin)
    fimMin = inicioMin + (Number.isFinite(duracao) && duracao > 0 ? Math.trunc(duracao) : DURACAO_PADRAO_MIN)
  }
  if (fimMin <= inicioMin) return { ok: false, message: 'O horário final deve ser depois do inicial.' }
  if (fimMin > 24 * 60 - 1 || fimMin - inicioMin > DURACAO_MAX_MIN) {
    return { ok: false, message: 'O compromisso precisa terminar no mesmo dia (até 23:59) e durar no máximo 12 horas.' }
  }
  return {
    ok: true,
    intervalo: { inicioMin, fimMin, horarioInicio: minutesToHHMM(inicioMin), horarioFim: minutesToHHMM(fimMin) },
  }
}

export type BloqueioLike = {
  profissional_id: string | null
  unidade_id?: string | null
  data_inicio: string
  data_fim: string
  horario_inicio: string | null
  horario_fim: string | null
  dia_inteiro: boolean
}

/** O bloqueio cobre [inicio, fim) do profissional na data? (profissional nulo = todos). */
export function bloqueioSobrepoe(
  bloqueio: BloqueioLike,
  alvo: { profissionalId: string; dataIso: string; inicioMin: number; fimMin: number },
): boolean {
  if (bloqueio.profissional_id && bloqueio.profissional_id !== alvo.profissionalId) return false
  if (alvo.dataIso < bloqueio.data_inicio.slice(0, 10) || alvo.dataIso > bloqueio.data_fim.slice(0, 10)) return false
  if (bloqueio.dia_inteiro) return true
  const ini = timeToMinutes(bloqueio.horario_inicio)
  const fim = timeToMinutes(bloqueio.horario_fim)
  if (ini === null) return true
  return ini < alvo.fimMin && (fim ?? ini + 1) > alvo.inicioMin
}

/** Ids únicos e válidos (uuid) vindos do corpo da requisição. */
export function normalizarParticipanteIds(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return [...new Set(valor.filter((v): v is string => typeof v === 'string' && uuid.test(v)).map((v) => v.toLowerCase()))]
}
