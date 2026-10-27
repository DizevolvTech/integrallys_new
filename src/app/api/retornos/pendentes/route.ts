import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/** GET /api/retornos/pendentes — ids dos pacientes com retorno em aberto (tag "Retorno pendente"). */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'retornos', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar retornos pendentes')

  let query = getAppSupabase().from('retornos_em_aberto').select('paciente_id').limit(2000)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar retornos pendentes')
  return NextResponse.json({ data: Array.from(new Set((data ?? []).map((r) => String(r.paciente_id)))) })
}
