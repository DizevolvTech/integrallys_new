import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { margemPercentual } from '@/lib/relatorios/margem'
import { isFinanciallyRestrictedRole } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/**
 * Relatório comparativo lado a lado entre unidades (cláusula 3 · Módulo 7).
 * Onda 6: agregação em memória (sem N+1 por unidade).
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  const url = request.nextUrl
  const dias = Math.min(365, Math.max(1, Number(url.searchParams.get('dias') ?? '30') || 30))
  const since = new Date()
  since.setDate(since.getDate() - dias)
  const sinceIso = since.toISOString().slice(0, 10)
  const todayIso = new Date().toISOString().slice(0, 10)

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar comparativo')

  let unidadesQuery = supabase.from('unidades').select('id,nome').eq('status', 'Ativa').order('nome')
  if (scoped.unidadeId && !['master', 'admin'].includes(session.role)) {
    unidadesQuery = unidadesQuery.eq('id', scoped.unidadeId)
  }

  const { data: unidades, error: unidadesError } = await unidadesQuery
  if (unidadesError) return supabaseErrorResponse(unidadesError, 'Falha ao carregar unidades')

  const unidadeIds = (unidades ?? []).map((u) => String(u.id))
  if (unidadeIds.length === 0) {
    return NextResponse.json({ data: [], meta: { dias, valoresVisiveis: true, ...session } })
  }

  const hidePrices = isFinanciallyRestrictedRole(session.role)

  const [agResult, finResult] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('unidade_id')
      .in('unidade_id', unidadeIds)
      .gte('data_agendamento', sinceIso)
      .lte('data_agendamento', todayIso),
    supabase
      .from('financeiro_lancamentos')
      .select('unidade_id,tipo,valor')
      .in('unidade_id', unidadeIds)
      .gte('data_lancamento', `${sinceIso}T00:00:00.000Z`)
      .lte('data_lancamento', `${todayIso}T23:59:59.999Z`),
  ])

  if (agResult.error) return supabaseErrorResponse(agResult.error, 'Falha ao agregar agendamentos')
  if (finResult.error) return supabaseErrorResponse(finResult.error, 'Falha ao agregar financeiro')

  const agCount = new Map<string, number>()
  for (const row of agResult.data ?? []) {
    const id = row.unidade_id ? String(row.unidade_id) : ''
    if (!id) continue
    agCount.set(id, (agCount.get(id) ?? 0) + 1)
  }

  const finByUnit = new Map<string, { receita: number; despesa: number }>()
  for (const row of finResult.data ?? []) {
    const id = row.unidade_id ? String(row.unidade_id) : ''
    if (!id) continue
    const entry = finByUnit.get(id) ?? { receita: 0, despesa: 0 }
    const valor = Number(row.valor ?? 0)
    if (String(row.tipo).toLowerCase() === 'receita') entry.receita += valor
    else entry.despesa += valor
    finByUnit.set(id, entry)
  }

  const rows = (unidades ?? []).map((unidade) => {
    const unidadeId = String(unidade.id)
    const fin = finByUnit.get(unidadeId) ?? { receita: 0, despesa: 0 }
    const agendamentos = agCount.get(unidadeId) ?? 0
    const receita = hidePrices ? 0 : fin.receita
    const despesa = hidePrices ? 0 : fin.despesa
    return {
      unidadeId,
      unidadeNome: String(unidade.nome ?? 'Unidade'),
      agendamentos,
      receita,
      despesa,
      ticketMedio: hidePrices || agendamentos === 0 ? 0 : receita / agendamentos,
      margem: receita - despesa,
      margemPct: hidePrices ? null : margemPercentual(receita, despesa),
    }
  })

  return NextResponse.json({
    data: rows,
    meta: { dias, valoresVisiveis: !hidePrices, ...session },
  })
}
