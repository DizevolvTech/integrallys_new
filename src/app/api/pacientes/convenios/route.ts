import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { listarConveniosEmUso } from '@/lib/convenios'

/** GET /api/pacientes/convenios — convênios/planos já usados nos cadastros (sugestões do campo). */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar convênios')

  let query = getAppSupabase().from('pacientes').select('convenio').not('convenio', 'is', null).neq('convenio', '').limit(2000)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar convênios')

  return NextResponse.json({ data: listarConveniosEmUso((data ?? []).map((r) => String(r.convenio))) })
}
