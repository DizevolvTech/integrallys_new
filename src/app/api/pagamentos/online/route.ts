import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapPagamentoOnlineItem } from '@/lib/domain-mappers'
import {
  consultarPedidoLinkCielo,
  criarCobrancaCielo,
  getCieloConfig,
} from '@/lib/gateways/cielo.service'
import {
  consultarPix,
  criarCobrancaPix,
  getSicrediConfig,
  testarSicrediToken,
} from '@/lib/gateways/sicredi.service'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

type GatewayRow = {
  id: string
  gateway: string
  gateway_id: string | null
  lancamento_id: string | null
  status: string
}

async function marcarPago(
  supabase: ReturnType<typeof getAppSupabase>,
  row: GatewayRow,
  pagoEm: string,
) {
  const onlineUpdate = await supabase
    .from('pagamentos_online')
    .update({ status: 'capturado', pago_em: pagoEm, updated_at: new Date().toISOString() })
    .eq('id', row.id)
  if (onlineUpdate.error) return onlineUpdate.error

  if (row.lancamento_id) {
    const finUpdate = await supabase
      .from('financeiro_lancamentos')
      .update({ status: 'Pago', updated_at: new Date().toISOString() })
      .eq('id', row.lancamento_id)
    if (finUpdate.error) return finUpdate.error
  }
  return null
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')

  if (action === 'teste_cielo') {
    const config = await getCieloConfig()
    return NextResponse.json({
      ok: !!config,
      error: config ? undefined : 'Cielo inativo ou credenciais ausentes.',
    })
  }

  if (action === 'teste_sicredi') {
    const config = await getSicrediConfig()
    if (!config) {
      return NextResponse.json({ ok: false, error: 'Sicredi inativo ou credenciais ausentes.' })
    }
    return NextResponse.json(await testarSicrediToken(config))
  }

  const supabase = getAppSupabase()
  let query = supabase
    .from('pagamentos_online')
    .select(
      'id,agendamento_id,lancamento_id,gateway,gateway_id,tipo,valor,status,qr_code,qr_code_copia_cola,link_pagamento,pago_em,created_at',
    )
    .order('created_at', { ascending: false })

  const agendamentoId = searchParams.get('agendamento_id')
  const lancamentoId = searchParams.get('lancamento_id')
  if (agendamentoId) query = query.eq('agendamento_id', agendamentoId)
  if (lancamentoId) query = query.eq('lancamento_id', lancamentoId)

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar pagamentos')

  return NextResponse.json({
    data: (data ?? []).map((row) => mapPagamentoOnlineItem(row)),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.action) return serverErrorResponse('action obrigatória', 'INVALID_PAYLOAD', 400)
  const action = String(body.action)

  const supabase = getAppSupabase()

  if (action === 'gerar_cobranca') {
    const denied = await requirePermission(session.userId, 'financeiro', 'create')
    if (denied) return denied

    const gateway = String(body.gateway ?? '')
    const tipo = String(body.tipo ?? '')
    const valor = Number(body.valor)
    const agendamentoId = body.agendamentoId ? String(body.agendamentoId) : null
    const lancamentoId = body.lancamentoId ? String(body.lancamentoId) : null
    const descricao =
      typeof body.descricao === 'string' && body.descricao.trim()
        ? body.descricao.trim()
        : 'Cobrança Integrallys'

    if (!Number.isFinite(valor) || valor <= 0) {
      return serverErrorResponse('Valor inválido', 'INVALID_PAYLOAD', 400)
    }

    if (gateway === 'cielo') {
      const config = await getCieloConfig()
      if (!config) return serverErrorResponse('Cielo não configurado', 'GATEWAY_NOT_CONFIGURED', 400)
      const result = await criarCobrancaCielo(config, {
        valor,
        descricao,
        referencia: agendamentoId ?? lancamentoId ?? `ref-${Date.now()}`,
        parcelas: body.parcelas ? Number(body.parcelas) : 1,
      })
      if (!result)
        return serverErrorResponse('Falha ao gerar cobrança Cielo', 'GATEWAY_CHARGE_FAILED', 502)

      const { data, error } = await supabase
        .from('pagamentos_online')
        .insert({
          agendamento_id: agendamentoId,
          lancamento_id: lancamentoId,
          gateway: 'cielo',
          gateway_id: result.paymentId,
          tipo: tipo || 'cartao_credito',
          valor,
          status: result.status,
          link_pagamento: result.linkPagamento,
          payload_gateway: result,
        })
        .select('id')
        .maybeSingle()
      if (error) return supabaseErrorResponse(error, 'Falha ao registrar pagamento')

      return NextResponse.json({
        pagamentoId: data?.id ?? null,
        linkPagamento: result.linkPagamento,
        status: result.status,
      })
    }

    if (gateway === 'sicredi') {
      const config = await getSicrediConfig()
      if (!config) return serverErrorResponse('Sicredi não configurado', 'GATEWAY_NOT_CONFIGURED', 400)
      const result = await criarCobrancaPix(config, { valor, descricao })
      if (!result)
        return serverErrorResponse('Falha ao gerar cobrança Pix', 'GATEWAY_CHARGE_FAILED', 502)

      const { data, error } = await supabase
        .from('pagamentos_online')
        .insert({
          agendamento_id: agendamentoId,
          lancamento_id: lancamentoId,
          gateway: 'sicredi',
          gateway_id: result.txid,
          tipo: 'pix',
          valor,
          status: 'pendente',
          qr_code: result.qrCode || null,
          qr_code_copia_cola: result.qrCodeCopiaECola || null,
          payload_gateway: result,
        })
        .select('id')
        .maybeSingle()
      if (error) return supabaseErrorResponse(error, 'Falha ao registrar pagamento')

      return NextResponse.json({
        pagamentoId: data?.id ?? null,
        qrCode: result.qrCode,
        qrCodeCopiaECola: result.qrCodeCopiaECola,
      })
    }

    return serverErrorResponse('Gateway inválido', 'INVALID_PAYLOAD', 400)
  }

  if (action === 'consultar') {
    const denied = await requirePermission(session.userId, 'financeiro', 'read')
    if (denied) return denied

    const pagamentoOnlineId = String(body.pagamentoOnlineId ?? '')
    if (!pagamentoOnlineId)
      return serverErrorResponse('pagamentoOnlineId obrigatório', 'INVALID_PAYLOAD', 400)

    const { data: row, error } = await supabase
      .from('pagamentos_online')
      .select('id,gateway,gateway_id,lancamento_id,status')
      .eq('id', pagamentoOnlineId)
      .maybeSingle()
    if (error) return supabaseErrorResponse(error, 'Falha ao consultar pagamento')
    if (!row) return serverErrorResponse('Pagamento não encontrado', 'PAYMENT_NOT_FOUND', 404)

    const typedRow = row as GatewayRow
    if (!typedRow.gateway_id) return NextResponse.json({ status: typedRow.status })

    if (typedRow.gateway === 'cielo') {
      const config = await getCieloConfig()
      // gateway_id da Cielo é o ID DO LINK — consulta via endpoint de pedidos.
      const consulta = config ? await consultarPedidoLinkCielo(config, typedRow.gateway_id) : null
      if (consulta) {
        if (consulta.pago) {
          const markError = await marcarPago(supabase, typedRow, new Date().toISOString())
          if (markError) return supabaseErrorResponse(markError, 'Falha ao marcar pagamento')
          return NextResponse.json({ status: 'capturado' })
        }
        await supabase
          .from('pagamentos_online')
          .update({ status: consulta.status, updated_at: new Date().toISOString() })
          .eq('id', typedRow.id)
        return NextResponse.json({ status: consulta.status })
      }
    }

    if (typedRow.gateway === 'sicredi') {
      const config = await getSicrediConfig()
      const consulta = config ? await consultarPix(config, typedRow.gateway_id) : null
      if (consulta) {
        if (consulta.pago) {
          const markError = await marcarPago(
            supabase,
            typedRow,
            consulta.pago_em ?? new Date().toISOString(),
          )
          if (markError) return supabaseErrorResponse(markError, 'Falha ao marcar pagamento')
          return NextResponse.json({ status: 'capturado' })
        }
        return NextResponse.json({ status: typedRow.status })
      }
    }

    return NextResponse.json({ status: typedRow.status })
  }

  if (action === 'cancelar') {
    const denied = await requirePermission(session.userId, 'financeiro', 'create')
    if (denied) return denied

    const pagamentoOnlineId = String(body.pagamentoOnlineId ?? '')
    if (!pagamentoOnlineId)
      return serverErrorResponse('pagamentoOnlineId obrigatório', 'INVALID_PAYLOAD', 400)

    const { error } = await supabase
      .from('pagamentos_online')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', pagamentoOnlineId)
    if (error) return supabaseErrorResponse(error, 'Falha ao cancelar pagamento')
    return NextResponse.json({ ok: true })
  }

  return serverErrorResponse('action inválida', 'INVALID_PAYLOAD', 400)
}
