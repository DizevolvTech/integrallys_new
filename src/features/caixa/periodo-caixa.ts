// Período consultado no caixa. O servidor roda em UTC; o dia da clínica é America/Sao_Paulo (UTC-3, sem horário de verão).

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 92

export interface PeriodoCaixa {
  de: string
  ate: string
  /** Mais de um dia. */
  multiplo: boolean
  /** Qualquer coisa diferente de "hoje": só leitura. */
  consulta: boolean
  /** Início do primeiro dia (inclusive) e início do dia seguinte ao último (exclusivo), em ISO UTC. */
  inicioIso: string
  fimIso: string
}

export function diaValido(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !DIA_RE.test(valor)) return false
  const d = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor
}

export function hojeClinicaChave(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Meia-noite de Brasília daquele dia, em ISO UTC (03:00Z). */
export function inicioDoDiaIso(dia: string): string {
  return new Date(`${dia}T03:00:00Z`).toISOString()
}

export function resolverPeriodo(
  params: { data?: string | null; de?: string | null; ate?: string | null },
  hoje: string = hojeClinicaChave(),
): { ok: true; periodo: PeriodoCaixa } | { ok: false; error: string; code: string } {
  const data = params.data || null
  const de = params.de || data || params.ate || hoje
  const ate = params.ate || data || params.de || hoje
  if (!diaValido(de) || !diaValido(ate)) return { ok: false, error: 'Data inválida', code: 'CAIXA_PERIODO_INVALIDO' }
  if (ate < de) return { ok: false, error: 'A data final não pode ser anterior à inicial', code: 'CAIXA_PERIODO_INVALIDO' }
  if (de > hoje || ate > hoje) return { ok: false, error: 'Não há movimentações em datas futuras', code: 'CAIXA_PERIODO_FUTURO' }
  const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1
  if (dias > MAX_DIAS) return { ok: false, error: `Escolha um período de até ${MAX_DIAS} dias`, code: 'CAIXA_PERIODO_LONGO' }
  return {
    ok: true,
    periodo: {
      de,
      ate,
      multiplo: de !== ate,
      consulta: !(de === hoje && ate === hoje),
      inicioIso: inicioDoDiaIso(de),
      fimIso: inicioDoDiaIso(somarDias(ate, 1)),
    },
  }
}

/** 'dd/mm/aaaa' a partir de 'aaaa-mm-dd'. */
export function diaParaExibicao(dia: string): string {
  const [ano, mes, d] = dia.split('-')
  return `${d}/${mes}/${ano}`
}
