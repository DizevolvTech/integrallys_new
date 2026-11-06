export interface AgendamentoFuturoRow {
  paciente_id: string | null
  data_agendamento: string
  tipo?: string | null
  procedimentos?: { nome?: string | null } | { nome?: string | null }[] | null
}

function nomeProcedimento(row: AgendamentoFuturoRow): string {
  const proc = Array.isArray(row.procedimentos) ? row.procedimentos[0] : row.procedimentos
  return proc?.nome ?? ''
}

/** Agendamento "de retorno": tipo Retorno ou procedimento cujo nome contém "Retorno". */
export function ehAgendamentoDeRetorno(row: AgendamentoFuturoRow): boolean {
  return (row.tipo ?? '').trim().toLowerCase() === 'retorno' || /retorno/i.test(nomeProcedimento(row))
}

/**
 * Por paciente, a data (aaaa-mm-dd) do próximo agendamento futuro não cancelado: o de retorno mais próximo;
 * sem retorno, o mais próximo de qualquer tipo. `linhas` já vem ordenado por data/hora crescente.
 */
export function proximaDataAgendaPorPaciente(linhas: AgendamentoFuturoRow[]): Record<string, string> {
  const retorno: Record<string, string> = {}
  const qualquer: Record<string, string> = {}
  for (const row of linhas) {
    if (!row.paciente_id) continue
    const id = String(row.paciente_id)
    const data = String(row.data_agendamento).slice(0, 10)
    if (!qualquer[id]) qualquer[id] = data
    if (!retorno[id] && ehAgendamentoDeRetorno(row)) retorno[id] = data
  }
  return { ...qualquer, ...retorno }
}
