/**
 * Regra de duração: um atendimento ocupa [início, início + duração). O próximo só pode
 * começar quando o anterior termina. A duração vem do procedimento (quando definida) ou
 * da grade do profissional (slot do dia/turno), que já varia por profissional e dia da semana.
 */
export type AgendaRowIntervalo = {
  id: string
  status: string
  horario_inicio: string | null
  horario_fim: string | null
}

export function timeToMinutes(value: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.min(total, 24 * 60 - 1))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export type PlanoOcupacao =
  | { ok: true; liberarSlotIds: string[] }
  | { ok: false; conflito: AgendaRowIntervalo }

/**
 * `outros` = demais linhas do profissional no dia (sem o próprio registro).
 * Slots 'Disponível' que se sobrepõem são consumidos; qualquer outro item ativo sobreposto bloqueia.
 */
export function planejarOcupacao(params: {
  inicioMin: number
  fimMin: number
  outros: AgendaRowIntervalo[]
}): PlanoOcupacao {
  const liberarSlotIds: string[] = []
  for (const row of params.outros) {
    if (row.status === 'Cancelado') continue
    const s = timeToMinutes(row.horario_inicio)
    if (s === null) continue
    const e = timeToMinutes(row.horario_fim) ?? s + 1
    const sobrepoe = s < params.fimMin && e > params.inicioMin
    if (!sobrepoe) continue
    if (row.status === 'Disponível') liberarSlotIds.push(row.id)
    else return { ok: false, conflito: row }
  }
  return { ok: true, liberarSlotIds }
}

export type RegraGrade = { hora_inicio: string; hora_fim: string; duracao_min: number }

/** Vagas da grade (do dia da semana) que tocam [inicioMin, fimMin). Vazio se não houver grade. */
export function vagasDaGradeNoIntervalo(
  regras: RegraGrade[],
  inicioMin: number,
  fimMin: number,
): Array<{ inicio: number; fim: number }> {
  const out: Array<{ inicio: number; fim: number }> = []
  for (const r of regras) {
    const ini = timeToMinutes(r.hora_inicio)
    const fim = timeToMinutes(r.hora_fim)
    if (ini === null || fim === null || !(r.duracao_min > 0)) continue
    for (let t = ini; t + r.duracao_min <= fim; t += r.duracao_min) {
      if (t < fimMin && t + r.duracao_min > inicioMin) out.push({ inicio: t, fim: t + r.duracao_min })
    }
  }
  return out
}
