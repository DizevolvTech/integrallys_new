import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapFinanceiroItem } from '@/lib/domain-mappers'
import { authErrorResponse, getRequestAuth, getScopedUnitId, isScopedRole } from '@/lib/request-auth'
import { hojeClinica } from '@/lib/recebimento-agendamento'
import { isIsoDate } from '@/lib/financeiro-parcelas'
import { situacaoLancamento } from '@/lib/financeiro-situacao'
import { criarContas } from './criar-contas'

// Item 9b — campos novos do lançamento (catálogo/conta/beneficiário/parcelas).
// Aditivo: não substitui `metodo` (texto livre), que segue sendo persistido.
function buildPaymentFields(body: Record<string, unknown>) {
  return {
    forma_pagamento_id:
      typeof body.formaPagamentoId === 'string' && body.formaPagamentoId
        ? body.formaPagamentoId
        : null,
    conta_bancaria_id:
      typeof body.contaBancariaId === 'string' && body.contaBancariaId
        ? body.contaBancariaId
        : null,
    beneficiario:
      typeof body.beneficiario === 'string' && body.beneficiario.trim()
        ? body.beneficiario.trim()
        : null,
    parcelas:
      typeof body.parcelas === 'number' && body.parcelas >= 1 ? Math.round(body.parcelas) : 1,
  }
}

async function listFinanceiro(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao carregar financeiro')
  }

  let query = supabase
    .from('financeiro_lancamentos')
    .select(
      'id,descricao,categoria,valor,tipo,data_lancamento,metodo,status,observacoes,created_at,unidade_id,forma_pagamento_id,conta_bancaria_id,beneficiario,parcelas,parcela_atual,centro_custo_id',
    )
    .order('data_lancamento', { ascending: false })

  if (scopedUnit.unidadeId) {
    query = query.eq('unidade_id', scopedUnit.unidadeId)
  }

  const { data, error } = await query

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar financeiro')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => mapFinanceiroItem(row)),
    meta: session,
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  return listFinanceiro(session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (body?.contas === true) return criarContas(session, body)
  if (!body?.descricao || !body?.categoria || typeof body.valor !== 'number' || !body?.tipo) {
    return serverErrorResponse('Lançamento inválido', 'INVALID_FINANCEIRO_INPUT', 400)
  }

  if (body.valor <= 0) {
    return serverErrorResponse('Valor inválido para lançamento', 'INVALID_FINANCEIRO_VALUE', 400)
  }

  const tipo = body.tipo === 'despesa' ? 'despesa' : 'receita'
  const dataLancamento =
    typeof body.data === 'string' && body.data.trim() !== ''
      ? new Date(body.data).toISOString()
      : new Date().toISOString()
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao salvar lançamento financeiro')
  }
  if (isScopedRole(session.role) && !scopedUnit.unidadeId) {
    return serverErrorResponse(
      'Usuário sem unidade vinculada',
      'UNIT_REQUIRED',
      403,
    )
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('financeiro_lancamentos').insert({
    unidade_id: isScopedRole(session.role)
      ? scopedUnit.unidadeId
      : (scopedUnit.unidadeId ?? (typeof body.unidadeId === 'string' ? body.unidadeId : null)),
    usuario_id: session.userId,
    descricao: body.descricao,
    categoria: body.categoria,
    valor: body.valor,
    tipo,
    data_lancamento: dataLancamento,
    competencia: dataLancamento.slice(0, 10),
    metodo: body.metodo ?? null,
    status: 'Pendente',
    observacoes: body.observacoes ?? null,
    centro_custo_id:
      typeof body.centroCustoId === 'string' && body.centroCustoId.trim()
        ? body.centroCustoId.trim()
        : null,
    ...buildPaymentFields(body),
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao salvar lançamento financeiro')
  }

  return listFinanceiro(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (
    !body?.id ||
    !body?.descricao ||
    !body?.categoria ||
    typeof body.valor !== 'number' ||
    !body?.tipo
  ) {
    return serverErrorResponse('Lançamento inválido', 'INVALID_FINANCEIRO_INPUT', 400)
  }

  if (body.valor <= 0) {
    return serverErrorResponse('Valor inválido para lançamento', 'INVALID_FINANCEIRO_VALUE', 400)
  }

  const tipo = body.tipo === 'despesa' ? 'despesa' : 'receita'
  const dataLancamento =
    typeof body.data === 'string' && body.data.trim() !== ''
      ? new Date(body.data).toISOString()
      : new Date().toISOString()
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao atualizar lançamento financeiro')
  }

  const supabase = getAppSupabase()
  const hoje = hojeClinica()
  const statusNovo = typeof body.status === 'string' ? body.status : 'Pendente'
  const liquidando =
    situacaoLancamento({ status: statusNovo, vencimento: hoje, hoje }) === 'liquidado'
  // Mantém a data em que já foi liquidado; só marca hoje na primeira liquidação.
  let dataLiquidacao: string | null = null
  if (liquidando) {
    const { data: atual } = await supabase
      .from('financeiro_lancamentos')
      .select('data_liquidacao')
      .eq('id', String(body.id))
      .maybeSingle()
    dataLiquidacao = atual?.data_liquidacao ? String(atual.data_liquidacao) : hoje
  }
  const vencimento =
    typeof body.vencimento === 'string' && isIsoDate(body.vencimento) ? body.vencimento : undefined
  const numeroDocumento =
    typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim().slice(0, 60) || null : undefined

  let updateQuery = supabase
    .from('financeiro_lancamentos')
    .update({
      data_liquidacao: dataLiquidacao,
      vencimento,
      numero_documento: numeroDocumento,
      unidade_id: scopedUnit.unidadeId ?? body.unidadeId ?? null,
      descricao: body.descricao,
      categoria: body.categoria,
      valor: body.valor,
      tipo,
      data_lancamento: dataLancamento,
      competencia: dataLancamento.slice(0, 10),
      metodo: body.metodo ?? null,
      status: body.status ?? 'Pendente',
      observacoes: body.observacoes ?? null,
      updated_at: new Date().toISOString(),
      centro_custo_id:
        typeof body.centroCustoId === 'string' && body.centroCustoId.trim()
          ? body.centroCustoId.trim()
          : body.centroCustoId === null
            ? null
            : undefined,
      ...buildPaymentFields(body),
    })
    .eq('id', String(body.id))

  if (scopedUnit.unidadeId) {
    updateQuery = updateQuery.eq('unidade_id', scopedUnit.unidadeId)
  }

  const { error } = await updateQuery

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar lançamento financeiro')
  }

  return listFinanceiro(session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Lançamento inválido', 'INVALID_FINANCEIRO_INPUT', 400)
  }

  const supabase = getAppSupabase()
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao excluir lançamento financeiro')
  }

  let deleteQuery = supabase.from('financeiro_lancamentos').delete().eq('id', String(body.id))
  if (scopedUnit.unidadeId) {
    deleteQuery = deleteQuery.eq('unidade_id', scopedUnit.unidadeId)
  }

  const { error } = await deleteQuery

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir lançamento financeiro')
  }

  return listFinanceiro(session)
}
