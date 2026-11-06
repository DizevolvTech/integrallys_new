import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/**
 * GET /api/prescricoes/retorno-agenda — para cada paciente com retorno já marcado na agenda (hoje em diante,
 * não cancelado), a data (aaaa-mm-dd) do mais próximo: { data: { [pacienteId]: data } }.
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
    .select('paciente_id,data_agendamento')
    .not('paciente_id', 'is', null)
    .ilike('tipo', 'retorno')
    .neq('status', 'Cancelado')
    .gte('data_agendamento', hojeSaoPaulo())
    .order('data_agendamento', { ascending: true })
    .limit(2000)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao consultar os retornos da agenda')

  const proximos: Record<string, string> = {}
  for (const row of data ?? []) {
    const id = String(row.paciente_id)
    if (!proximos[id]) proximos[id] = String(row.data_agendamento).slice(0, 10)
  }
  return NextResponse.json({ data: proximos })
}
