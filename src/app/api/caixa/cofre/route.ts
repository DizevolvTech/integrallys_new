import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { resolverUnidadeCaixa } from '@/lib/recebimento-agendamento'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

/**
 * GET /api/caixa/cofre — saldo do cofre da unidade e as últimas movimentações
 * (transferências feitas no fechamento do caixa). Só para quem vê o financeiro
 * (gestor/administração); a recepção opera o caixa, mas não consulta o cofre.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  const { unitId, error: unitError } = await resolverUnidadeCaixa(session, request.nextUrl.searchParams.get('unitId'))
  if (unitError) return supabaseErrorResponse(unitError as never, 'Falha ao resolver unidade do cofre')
  if (!unitId) return serverErrorResponse('Nenhuma unidade disponível', 'COFRE_UNIT_REQUIRED', 400)

  const supabase = getAppSupabase()
  const [lista, totais] = await Promise.all([
    supabase
      .from('cofre_movimentos')
      .select('id,tipo,valor,descricao,operador_nome,data_movimento')
      .eq('unidade_id', unitId)
      .order('data_movimento', { ascending: false })
      .limit(30),
    supabase.from('cofre_movimentos').select('tipo,valor').eq('unidade_id', unitId),
  ])
  if (lista.error) return supabaseErrorResponse(lista.error, 'Falha ao carregar o cofre')
  if (totais.error) return supabaseErrorResponse(totais.error, 'Falha ao carregar o cofre')

  const saldo = (totais.data ?? []).reduce(
    (acc, row) => acc + (row.tipo === 'saida' ? -1 : 1) * Number(row.valor ?? 0),
    0,
  )
  return NextResponse.json({
    data: (lista.data ?? []).map((row) => ({
      id: String(row.id),
      tipo: row.tipo === 'saida' ? 'saida' : 'entrada',
      valor: Number(row.valor ?? 0),
      descricao: String(row.descricao ?? ''),
      operador: row.operador_nome ? String(row.operador_nome) : '',
      dataMovimento: String(row.data_movimento ?? ''),
    })),
    meta: { saldo: Math.round(saldo * 100) / 100, unitId },
  })
}
