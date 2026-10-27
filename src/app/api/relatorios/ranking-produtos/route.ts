import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { margemPercentual } from '@/lib/relatorios/margem'
import { isFinanciallyRestrictedRole } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/**
 * Ranking de produtos mais vendidos e mais lucrativos (cláusula 3 · Módulo 7).
 * Base: itens de prescricões Convertida no período.
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

  let prescricoesQuery = supabase
    .from('prescricoes')
    .select('id,status,data_prescricao,profissional_id')
    .eq('status', 'Convertida')
    .gte('data_prescricao', sinceIso)
    .limit(2000)

  if (session.role === 'especialista') {
    prescricoesQuery = prescricoesQuery.eq('profissional_id', session.userId)
  } else if (scoped.unidadeId) {
    const { data: users } = await supabase.from('usuarios').select('id').eq('unidade_id', scoped.unidadeId)
    const ids = (users ?? []).map((u) => String(u.id))
    if (ids.length === 0) {
      return NextResponse.json({ data: { vendidos: [], lucrativos: [] }, meta: { dias, ...session } })
    }
    prescricoesQuery = prescricoesQuery.in('profissional_id', ids)
  }

  const { data: prescricoes, error: prescError } = await prescricoesQuery
  if (prescError) return supabaseErrorResponse(prescError, 'Falha ao carregar ranking')

  const prescIds = (prescricoes ?? []).map((p) => String(p.id))
  if (prescIds.length === 0) {
    return NextResponse.json({ data: { vendidos: [], lucrativos: [] }, meta: { dias, ...session } })
  }

  const { data: itens, error: itensError } = await supabase
    .from('prescricao_itens')
    .select('produto_id,descricao,quantidade,valor_unitario')
    .in('prescricao_id', prescIds)

  if (itensError) return supabaseErrorResponse(itensError, 'Falha ao carregar itens do ranking')

  const produtoIds = Array.from(
    new Set((itens ?? []).map((i) => (i.produto_id ? String(i.produto_id) : '')).filter(Boolean)),
  )

  const custoByProduto = new Map<string, number>()
  if (produtoIds.length > 0) {
    const { data: produtos } = await supabase
      .from('produtos_estoque')
      .select('id,preco_custo')
      .in('id', produtoIds)
    for (const p of produtos ?? []) {
      custoByProduto.set(String(p.id), Number(p.preco_custo ?? 0))
    }
  }

  const hidePrices = isFinanciallyRestrictedRole(session.role)
  type Agg = { produtoId: string | null; nome: string; quantidade: number; receita: number; custo: number }
  const byKey = new Map<string, Agg>()

  for (const row of itens ?? []) {
    const produtoId = row.produto_id ? String(row.produto_id) : null
    const nome = String(row.descricao ?? 'Produto')
    const key = produtoId ?? `nome:${nome}`
    const qty = Number(row.quantidade ?? 0) || 0
    const unit = Number(row.valor_unitario ?? 0) || 0
    const custoUnit = produtoId ? (custoByProduto.get(produtoId) ?? 0) : 0
    const prev = byKey.get(key) ?? { produtoId, nome, quantidade: 0, receita: 0, custo: 0 }
    prev.quantidade += qty
    prev.receita += qty * unit
    prev.custo += qty * custoUnit
    byKey.set(key, prev)
  }

  const rows = Array.from(byKey.values()).map((r) => ({
    produtoId: r.produtoId,
    nome: r.nome,
    quantidade: r.quantidade,
    receita: hidePrices ? 0 : r.receita,
    margem: hidePrices ? 0 : r.receita - r.custo,
    margemPct: hidePrices ? null : margemPercentual(r.receita, r.custo),
  }))
  const receitaTotal = Array.from(byKey.values()).reduce((acc, r) => acc + r.receita, 0)
  const custoTotal = Array.from(byKey.values()).reduce((acc, r) => acc + r.custo, 0)
  const totais = {
    receita: hidePrices ? 0 : receitaTotal,
    margem: hidePrices ? 0 : receitaTotal - custoTotal,
    margemPct: hidePrices ? null : margemPercentual(receitaTotal, custoTotal),
  }

  const vendidos = [...rows].sort((a, b) => b.quantidade - a.quantidade).slice(0, 20)
  const lucrativos = [...rows].sort((a, b) => b.margem - a.margem).slice(0, 20)

  return NextResponse.json({
    data: { vendidos, lucrativos, totais },
    meta: { dias, valoresVisiveis: !hidePrices, ...session },
  })
}
