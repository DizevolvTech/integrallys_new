import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { respostaErroEstorno, validarMotivoEstorno } from '@/lib/estorno-recebimento'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lista os recebimentos do agendamento que ainda podem ser estornados. */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'update')
  if (denied) return denied

  const agendamentoId = new URL(request.url).searchParams.get('agendamentoId') ?? ''
  if (!UUID.test(agendamentoId)) return serverErrorResponse('Agendamento inválido', 'INVALID_AGENDAMENTO', 400)

  const supabase = getAppSupabase()
  const escopo = await validarEscopoAgendamento(session, agendamentoId)
  if (escopo) return escopo

  const { data, error } = await supabase
    .from('agendamentos_pagamentos')
    .select('id,valor,metodo,bandeira,parcelas,pago_em')
    .eq('agendamento_id', agendamentoId)
    .eq('status', 'Pago')
    .is('estornado_em', null)
    .order('pago_em', { ascending: false })
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar recebimentos')

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      valor: Number(row.valor),
      metodo: row.metodo ? String(row.metodo) : '',
      bandeira: row.bandeira ? String(row.bandeira) : null,
      parcelas: row.parcelas != null ? Number(row.parcelas) : null,
      pagoEm: row.pago_em ? String(row.pago_em) : null,
    })),
  })
}

/** Estorna um recebimento: saída no caixa, lançamento financeiro estornado e saldo do agendamento em aberto. */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const pagamentoId = typeof body?.pagamentoId === 'string' ? body.pagamentoId : ''
  if (!UUID.test(pagamentoId)) return serverErrorResponse('Recebimento inválido', 'INVALID_PAGAMENTO', 400)
  const motivo = validarMotivoEstorno(body?.motivo)
  if (!motivo.ok) return serverErrorResponse(motivo.message, 'INVALID_ESTORNO_MOTIVO', 400)

  const supabase = getAppSupabase()
  const { data: pagamento, error: pagError } = await supabase
    .from('agendamentos_pagamentos')
    .select('agendamento_id')
    .eq('id', pagamentoId)
    .maybeSingle()
  if (pagError) return supabaseErrorResponse(pagError, 'Falha ao validar recebimento')
  if (!pagamento) return serverErrorResponse('Recebimento não encontrado.', 'PAGAMENTO_NOT_FOUND', 404)

  const escopo = await validarEscopoAgendamento(session, String(pagamento.agendamento_id))
  if (escopo) return escopo

  const { data, error } = await supabase.rpc('agendamento_estornar_pagamento', {
    p_pagamento_id: pagamentoId,
    p_usuario_id: session.userId,
    p_motivo: motivo.motivo,
    p_operador_nome: session.user?.name || null,
  })
  if (error) return supabaseErrorResponse(error, 'Falha ao estornar recebimento')

  const resultado = (data ?? {}) as Record<string, unknown>
  if (resultado.ok !== true) {
    const falha = respostaErroEstorno(resultado.code, resultado.message)
    return serverErrorResponse(falha.message, falha.code, falha.status)
  }
  return NextResponse.json({ ok: true, data: resultado })
}

/** Perfis com unidade só mexem em agendamentos da própria unidade. */
async function validarEscopoAgendamento(
  session: NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>,
  agendamentoId: string,
) {
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao validar unidade')
  const { data, error } = await getAppSupabase()
    .from('agendamentos')
    .select('unidade_id')
    .eq('id', agendamentoId)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao validar agendamento')
  if (!data) return serverErrorResponse('Agendamento não encontrado', 'AGENDAMENTO_NOT_FOUND', 404)
  if (scoped.unidadeId && data.unidade_id && String(data.unidade_id) !== scoped.unidadeId) {
    return serverErrorResponse('Agendamento fora da sua unidade', 'FORA_DA_UNIDADE', 403)
  }
  return null
}
