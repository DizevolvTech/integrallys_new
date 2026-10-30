import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { resolvePagamentoAgendamentoInput, validarValorContraSaldo } from '@/lib/agendamento-pagamento'
import { registrarRecebimentoAgendamento } from '@/lib/recebimento-agendamento'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'agenda', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const agendamentoId =
    typeof body?.agendamentoId === 'string' && body.agendamentoId.trim().length > 0
      ? body.agendamentoId.trim()
      : ''

  const resolved = resolvePagamentoAgendamentoInput({
    agendamentoId,
    valor: body?.valor,
    metodo: body?.metodo,
    bandeira: body?.bandeira,
    parcelas: body?.parcelas,
    contaBancariaId: body?.contaBancariaId,
    observacoes: body?.observacoes,
  })
  if (!resolved.ok) {
    return serverErrorResponse(resolved.message, resolved.code, 400)
  }

  const supabase = getAppSupabase()
  const { data: agendamento, error: agError } = await supabase
    .from('v_agendamento_pagamento_resumo')
    .select('agendamento_id,valor_devido,total_pago')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle()

  if (agError) {
    return supabaseErrorResponse(agError, 'Falha ao validar agendamento')
  }
  if (!agendamento?.agendamento_id) {
    return serverErrorResponse('Agendamento não encontrado', 'AGENDAMENTO_NOT_FOUND', 404)
  }

  const limite = validarValorContraSaldo({
    valorDevido: Number(agendamento.valor_devido ?? 0),
    totalPago: Number(agendamento.total_pago ?? 0),
    valor: resolved.data.valor,
  })
  if (!limite.ok) return serverErrorResponse(limite.message, limite.code, 400)

  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : '')
  const { error, caixaRegistrado } = await registrarRecebimentoAgendamento(supabase, session, {
    agendamentoId,
    resolved: resolved.data,
    descricao: texto(body?.descricao) || 'Recebimento de atendimento',
    beneficiario: texto(body?.beneficiario) || null,
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao registrar pagamento')
  }

  return NextResponse.json({
    ok: true,
    data: {
      agendamentoId,
      valor: resolved.data.valor,
      metodo: resolved.data.metodo,
      bandeira: resolved.data.bandeira,
      parcelas: resolved.data.parcelas,
      contaBancariaId: resolved.data.contaBancariaId,
      caixaRegistrado,
    },
  })
}
