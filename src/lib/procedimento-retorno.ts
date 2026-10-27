export const STATUS_CONTAM_PARA_RETORNO = ['Check-out', 'Concluído', 'Em Atendimento'] as const

export function isTipoRetorno(tipo: unknown): boolean {
  if (typeof tipo !== 'string') return false
  return tipo.trim().toLowerCase() === 'retorno'
}

/** Procedimento "de retorno" genérico (ex.: "Retorno (até 30 dias)"): identificado pelo nome. */
export function isProcedimentoRetornoNome(nome: unknown): boolean {
  return typeof nome === 'string' && /^\s*retorno\b/i.test(nome)
}

/** Prazo em dias escrito no nome do procedimento de retorno ("até 30 dias"); null se não houver. */
export function prazoDiasDoNomeRetorno(nome: unknown): number | null {
  if (typeof nome !== 'string') return null
  const match = /(\d{1,3})\s*dias?/i.exec(nome)
  const dias = match ? Number(match[1]) : NaN
  return Number.isInteger(dias) && dias > 0 ? dias : null
}

/** Diferença em dias civis (dataAlvo - dataBase), ignorando horário. */
export function diffDiasCivis(dataBaseIso: string, dataAlvoIso: string): number | null {
  const base = parseLocalDate(dataBaseIso)
  const alvo = parseLocalDate(dataAlvoIso)
  if (!base || !alvo) return null
  const ms = alvo.getTime() - base.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function parseLocalDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function addDaysIso(isoDate: string, days: number): string | null {
  const date = parseLocalDate(isoDate)
  if (!date) return null
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type RetornoValidation =
  | { ok: true; valor: number | null }
  | { ok: false; code: string; message: string }

/**
 * Valida agendamento de retorno e devolve o valor a cobrar.
 * prazoDias: do cadastro (padrão 35).
 * ultimaDataAtendimento: YYYY-MM-DD do último atendimento válido.
 */
export function validateRetornoAgendamento(params: {
  temRetorno: boolean
  prazoDias: number | null
  valorRetorno: number | null
  valorConsulta: number | null
  dataAgendamento: string
  ultimaDataAtendimento: string | null
}): RetornoValidation {
  if (!params.temRetorno) {
    return {
      ok: false,
      code: 'RETORNO_NAO_CONFIGURADO',
      message: 'Este procedimento não possui retorno cadastrado. Agende como consulta.',
    }
  }

  if (!params.ultimaDataAtendimento) {
    return {
      ok: false,
      code: 'RETORNO_SEM_ATENDIMENTO_PREVIO',
      message:
        'Este paciente não tem atendimento anterior concluído deste procedimento. Marque como 1ª consulta ou escolha um paciente com atendimento anterior.',
    }
  }

  const prazo = params.prazoDias != null && params.prazoDias > 0 ? params.prazoDias : 35
  const dias = diffDiasCivis(params.ultimaDataAtendimento, params.dataAgendamento)
  if (dias == null) {
    return { ok: false, code: 'RETORNO_DATA_INVALIDA', message: 'Data do agendamento inválida.' }
  }
  if (dias < 0) {
    return {
      ok: false,
      code: 'RETORNO_DATA_ANTERIOR',
      message: 'A data do retorno não pode ser anterior ao último atendimento.',
    }
  }
  if (dias > prazo) {
    return {
      ok: false,
      code: 'RETORNO_FORA_PRAZO',
      message: `O prazo de retorno é de ${prazo} dias. Já se passaram ${dias} dias — agende como consulta nova.`,
    }
  }

  const valor =
    params.valorRetorno != null && Number.isFinite(params.valorRetorno)
      ? params.valorRetorno
      : params.valorConsulta

  return { ok: true, valor: valor != null && Number.isFinite(valor) ? valor : null }
}
