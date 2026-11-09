import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { ehUuid } from '@/lib/relatorios/filtros'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/retornos/resumo — pendentes, agendados e concluídos (Relatórios > Retornos).
 * Mesmo escopo e mesmos filtros da lista: especialista só vê os próprios, demais ficam na própria unidade.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'retornos', 'read')
  if (denied) return denied

  const params = request.nextUrl.searchParams
  const de = params.get('de') ?? ''
  const ate = params.get('ate') ?? ''
  if ((de && !ISO_DATE.test(de)) || (ate && !ISO_DATE.test(ate))) {
    return serverErrorResponse('Período inválido', 'INVALID_PERIODO', 400)
  }
  const profissionalId = params.get('profissionalId') ?? ''
  const procedimentoId = params.get('procedimentoId') ?? ''
  if ((profissionalId && !ehUuid(profissionalId)) || (procedimentoId && !ehUuid(procedimentoId))) {
    return serverErrorResponse('Filtro inválido', 'INVALID_FILTER', 400)
  }
  const busca = (params.get('q') ?? '').replace(/[%_,()]/g, ' ').trim()

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar o resumo de retornos')

  const filtros: Record<string, string> = {}
  if (scoped.unidadeId) filtros.unidade_id = scoped.unidadeId
  if (session.role === 'especialista') filtros.profissional_id = session.userId
  else if (profissionalId) filtros.profissional_id = profissionalId
  if (procedimentoId) filtros.procedimento_id = procedimentoId
  if (de) filtros.de = de
  if (ate) filtros.ate = ate
  if (busca.length >= 2) filtros.q = busca

  const { data, error } = await getAppSupabase().rpc('rel_retornos_resumo', { p: filtros })
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar o resumo de retornos')
  const r = (data ?? {}) as Record<string, unknown>
  return NextResponse.json({
    pendentes: Number(r.pendentes ?? 0),
    agendados: Number(r.agendados ?? 0),
    concluidos: Number(r.concluidos ?? 0),
  })
}
