import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { proximaDataAgendaPorPaciente, type AgendamentoFuturoRow } from '@/lib/prescricao-retorno-agenda'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/**
 * GET /api/prescricoes/retorno-agenda — para cada paciente com agendamento futuro (hoje em diante, não cancelado),
 * a data (aaaa-mm-dd) do mais próximo: o de retorno (tipo Retorno ou procedimento "Retorno…") e, sem retorno,
 * o de qualquer tipo: { data: { [pacienteId]: data } }.
 * Uma consulta só para a lista inteira; usado pelo selo "Retorno pendente" (abre a agenda nesse dia).
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'prescricoes', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao consultar os retornos da agenda')

  let query = getAppSupabase()
    .from('agendamentos')
    .select('paciente_id,data_agendamento,tipo,procedimentos(nome)')
    .not('paciente_id', 'is', null)
    .neq('status', 'Cancelado')
    .gte('data_agendamento', hojeSaoPaulo())
    .order('data_agendamento', { ascending: true })
    .order('horario_inicio', { ascending: true })
    .limit(2000)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao consultar os retornos da agenda')

  return NextResponse.json({ data: proximaDataAgendaPorPaciente((data ?? []) as unknown as AgendamentoFuturoRow[]) })
}
