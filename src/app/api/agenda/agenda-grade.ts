import type { getAppSupabase } from '@/lib/app-api'
import { type BloqueioLike, bloqueioSobrepoe } from './compromisso-regras'
import { type AgendaRowIntervalo, minutesToHHMM, planejarOcupacao, timeToMinutes, vagasDaGradeNoIntervalo } from './agenda-duracao'

/**
 * Devolve à agenda as vagas da GRADE do profissional (dia da semana) que cobriam o intervalo liberado,
 * em vez de copiar o horário da consulta (que pode estar fora da grade). Sem grade, recria o próprio intervalo.
 */
export async function liberarIntervaloNaGrade(
  supabase: ReturnType<typeof getAppSupabase>,
  params: {
    profissionalId: string
    unidadeId: unknown
    dataIso: string
    horarioInicio: unknown
    horarioFim: unknown
    ignorarId: string
    userId: string
    /** Compromisso: só devolve vagas que existem na grade (não cria vaga em horário fora dela). */
    somenteGrade?: boolean
  },
) {
  const ini = timeToMinutes(params.horarioInicio)
  if (ini === null) return
  const fim = timeToMinutes(params.horarioFim) ?? ini + 30
  const dow = new Date(`${params.dataIso}T12:00:00Z`).getUTCDay()
  const { data: regras } = await supabase
    .from('profissional_horarios')
    .select('hora_inicio,hora_fim,duracao_min')
    .eq('profissional_id', params.profissionalId)
    .eq('dia_semana', dow)
    .eq('ativo', true)
  let vagas = vagasDaGradeNoIntervalo(
    (regras ?? []) as Array<{ hora_inicio: string; hora_fim: string; duracao_min: number }>,
    ini,
    fim,
  )
  if (vagas.length === 0 && params.somenteGrade) return
  if (vagas.length === 0) vagas = [{ inicio: ini, fim }]
  const { rows } = await getLinhasDoDia(supabase, params.profissionalId, params.dataIso, [
    params.ignorarId,
  ])
  for (const vaga of vagas) {
    const plano = planejarOcupacao({
      inicioMin: vaga.inicio,
      fimMin: vaga.fim,
      outros: rows as unknown as AgendaRowIntervalo[],
    })
    // sobrepõe item ativo, ou já existe vaga livre: não duplica
    if (!plano.ok || plano.liberarSlotIds.length > 0) continue
    const { error } = await supabase.from('agendamentos').insert({
      profissional_id: params.profissionalId,
      unidade_id: params.unidadeId,
      data_agendamento: params.dataIso,
      horario_inicio: minutesToHHMM(vaga.inicio),
      horario_fim: minutesToHHMM(vaga.fim),
      status: 'Disponível',
      paciente_id: null,
      criado_por_id: params.userId,
    })
    if (error) console.error('[agenda] falha ao recriar vaga da grade', error)
  }
}

export async function getLinhasDoDia(
  supabase: ReturnType<typeof getAppSupabase>,
  profissionalId: string,
  dataIso: string,
  ignorarIds: string[],
) {
  const { data, error } = await supabase
    .from('agendamentos')
    .select('id,status,horario_inicio,horario_fim,unidade_id,profissional_id,data_agendamento')
    .eq('profissional_id', profissionalId)
    .eq('data_agendamento', dataIso)
  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter(
    (row) => !ignorarIds.includes(String(row.id)),
  )
  return { rows, error }
}

/** Bloqueio da agenda (compromisso, férias, folga...) que cobre o intervalo do profissional; null = livre. */
export async function bloqueioNoIntervalo(
  supabase: ReturnType<typeof getAppSupabase>,
  params: { profissionalId: string; dataIso: string; inicioMin: number; fimMin: number },
) {
  const { data } = await supabase
    .from('agenda_bloqueios')
    .select('profissional_id,unidade_id,data_inicio,data_fim,horario_inicio,horario_fim,dia_inteiro,tipo,justificativa')
    .lte('data_inicio', params.dataIso)
    .gte('data_fim', params.dataIso)
    .or(`profissional_id.eq.${params.profissionalId},profissional_id.is.null`)
  const lista = (data ?? []) as Array<BloqueioLike & { tipo: string; justificativa: string | null }>
  return lista.find((b) => bloqueioSobrepoe(b, params)) ?? null
}

export function mensagemBloqueio(b: { tipo: string; justificativa: string | null }) {
  return `Esse horário está bloqueado na agenda do especialista (${b.tipo}${b.justificativa ? `: ${b.justificativa}` : ''}). Escolha outro horário.`
}
