// Regra única dos retornos (item 41 do feedback), a mesma da tela /retornos:
//   retorno previsto = data do último atendimento + prazo de retorno gravado;
//   limite  = faltam de 0 a 10 dias para o previsto;
//   vencido = o previsto já passou e o paciente não tem agendamento futuro;
//   no_prazo = faltam mais de 10 dias.

export type SituacaoRetorno = 'no_prazo' | 'limite' | 'vencido'

export const DIAS_LIMITE_RETORNO = 10
const DIA_MS = 24 * 60 * 60 * 1000

// Status que NÃO representam um atendimento marcado de verdade.
const STATUS_SEM_AGENDAMENTO = ['cancel', 'faltou', 'dispon', 'bloque', 'adiad']

export interface EvolucaoRetorno {
  paciente_id: string | null
  data_evolucao: string | null
  retorno_recepcao: string | null
}

/** Dias do prazo gravado ("35 dias", "6 meses"); `null` = retorno liberado, sem prazo. */
export function parseDiasRetorno(texto: string): number | null {
  const dias = /(\d+)\s*dias?/i.exec(texto)
  if (dias) return Number.parseInt(dias[1] ?? '0', 10)
  const meses = /(\d+)\s*mes/i.exec(texto)
  if (meses) return Number.parseInt(meses[1] ?? '0', 10) * 30
  if (/liberado/i.test(texto)) return null
  return 30
}

const diaUtc = (iso: string) => {
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

/** Dias que faltam para o retorno previsto (negativo = já passou). */
export function diasParaRetorno(dataAtendimento: string, dias: number, hojeIso: string): number | null {
  const base = diaUtc(dataAtendimento)
  const hoje = diaUtc(hojeIso)
  if (base === null || hoje === null) return null
  return Math.round((base + dias * DIA_MS - hoje) / DIA_MS)
}

export function classificarRetorno(faltam: number, temAgendamentoFuturo: boolean): SituacaoRetorno | null {
  if (faltam < 0) return temAgendamentoFuturo ? null : 'vencido'
  return faltam <= DIAS_LIMITE_RETORNO ? 'limite' : 'no_prazo'
}

export function agendamentoConta(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return !STATUS_SEM_AGENDAMENTO.some((parte) => s.includes(parte))
}

export interface ContagemRetornos {
  noPrazo: number
  limitePrazo: number
  vencidos: number
}

/**
 * Conta os retornos por paciente: só o último atendimento com prazo gravado vale.
 * `pacienteVisivel` aplica o escopo de unidade (null = sem filtro).
 */
export function contarRetornos(params: {
  evolucoes: EvolucaoRetorno[]
  pacientesComAgendamentoFuturo: ReadonlySet<string>
  hojeIso: string
  pacienteVisivel?: ((pacienteId: string) => boolean) | null
}): ContagemRetornos {
  const ultimoPorPaciente = new Map<string, EvolucaoRetorno>()
  for (const row of params.evolucoes) {
    if (!row.paciente_id || !row.data_evolucao || !row.retorno_recepcao) continue
    if (params.pacienteVisivel && !params.pacienteVisivel(row.paciente_id)) continue
    const atual = ultimoPorPaciente.get(row.paciente_id)
    if (!atual || String(atual.data_evolucao) < row.data_evolucao) ultimoPorPaciente.set(row.paciente_id, row)
  }

  const total: ContagemRetornos = { noPrazo: 0, limitePrazo: 0, vencidos: 0 }
  for (const [pacienteId, row] of ultimoPorPaciente) {
    const dias = parseDiasRetorno(String(row.retorno_recepcao))
    if (dias === null) continue
    const faltam = diasParaRetorno(String(row.data_evolucao), dias, params.hojeIso)
    if (faltam === null) continue
    const situacao = classificarRetorno(faltam, params.pacientesComAgendamentoFuturo.has(pacienteId))
    if (situacao === 'vencido') total.vencidos += 1
    else if (situacao === 'limite') total.limitePrazo += 1
    else if (situacao === 'no_prazo') total.noPrazo += 1
  }
  return total
}
