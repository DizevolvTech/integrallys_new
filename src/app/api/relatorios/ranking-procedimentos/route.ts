import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { isFinanciallyRestrictedRole } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/**
 * Ranking de procedimentos mais realizados e com maior receita (Onda 6 · Call 09/09).
 * Espelha ranking-produtos, usando agendamentos + pagamentos no período.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  const url = request.nextUrl
  const dias = Math.min(365, Math.max(7, Number(url.searchParams.get('dias') ?? '90') || 90))
  const since = new Date()
  since.setDate(since.getDate() - dias)
  const sinceIso = since.toISOString().slice(0, 10)

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar ranking')

  let query = supabase
    .from('agendamentos')
    .select(
      'id,procedimento_id,valor_procedimento,status,data_agendamento,unidade_id,procedimentos(nome)',
    )
    .gte('data_agendamento', sinceIso)
    .not('status', 'eq', 'Cancelado')
    .not('status', 'eq', 'Disponível')
    .limit(5000)

  if (scoped.unidadeId) {
    query = query.eq('unidade_id', scoped.unidadeId)
  } else if (session.role === 'especialista') {
    query = query.eq('profissional_id', session.userId)
  }

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar ranking de procedimentos')

  const hidePrices = isFinanciallyRestrictedRole(session.role)
  type Agg = { procedimentoId: string | null; nome: string; quantidade: number; receita: number }
  const byKey = new Map<string, Agg>()

  for (const row of data ?? []) {
    const procedimentoId = row.procedimento_id ? String(row.procedimento_id) : null
    const joined = row.procedimentos as { nome?: string } | { nome?: string }[] | null
    const joinedNome = Array.isArray(joined)
      ? joined[0]?.nome
      : joined?.nome
    const nome = joinedNome ? String(joinedNome) : 'Sem procedimento'
    const key = procedimentoId ?? `nome:${nome}`
    const prev = byKey.get(key) ?? { procedimentoId, nome, quantidade: 0, receita: 0 }
    prev.quantidade += 1
    prev.receita += Number(row.valor_procedimento ?? 0) || 0
    byKey.set(key, prev)
  }

  const rows = Array.from(byKey.values()).map((r) => ({
    procedimentoId: r.procedimentoId,
    nome: r.nome,
    quantidade: r.quantidade,
    receita: hidePrices ? 0 : r.receita,
  }))

  const realizados = [...rows].sort((a, b) => b.quantidade - a.quantidade).slice(0, 20)
  const receita = [...rows].sort((a, b) => b.receita - a.receita).slice(0, 20)

  return NextResponse.json({
    data: { realizados, receita },
    meta: { dias, valoresVisiveis: !hidePrices, ...session },
  })
}
