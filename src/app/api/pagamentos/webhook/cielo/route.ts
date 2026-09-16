import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase } from '@/lib/app-api'
import {
  consultarPagamentoCielo,
  consultarPedidoLinkCielo,
  getCieloConfig,
} from '@/lib/gateways/cielo.service'

/**
 * Webhook (postback) do Link de Pagamento Cielo (TAREFA-FIN-01).
 * Se `CIELO_WEBHOOK_TOKEN` estiver definido, exige header `x-webhook-token`
 * ou query `?token=` igual ao valor. O status do payload NÃO é confiável —
 * resolvemos consultando a Cielo. Responde SEMPRE HTTP 200 quando autenticado
 * (a Cielo reenfileira em qualquer não-2xx).
 */

// PaymentIds de venda 3.0 (e ids de agendamento/lançamento) são UUID. Validar
// antes de tocar o banco — colunas uuid geram erro de tipo no Postgres com
// valores não-UUID. Hardening de TAREFA-CR-SEC-01 preservado.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Primeiro valor não vazio dentre as chaves candidatas. */
function pickFirst(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return ''
}

/**
 * Aceita JSON ou application/x-www-form-urlencoded (Link de Pagamento costuma
 * mandar form-urlencoded). Sem content-type confiável, tenta JSON e cai para
 * URLSearchParams. Devolve objeto plano ou null em erro de parse.
 */
async function parseBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  try {
    if (contentType.includes('application/json')) {
      return (await request.json()) as Record<string, unknown>
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(await request.text()))
    }
    const text = await request.text()
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return Object.fromEntries(new URLSearchParams(text))
    }
  } catch {
    return null
  }
}

/** Localiza a linha em `pagamentos_online` por productId ou por referência UUID. */
async function localizarPagamento(
  supabase: ReturnType<typeof getAppSupabase>,
  productId: string,
  orderRef: string,
) {
  if (productId) {
    const { data } = await supabase
      .from('pagamentos_online')
      .select('id,gateway_id,lancamento_id,status')
      .eq('gateway', 'cielo')
      .eq('gateway_id', productId)
      .maybeSingle()
    if (data) return data
  }

  // Fallback por referência: SOMENTE se for UUID (agendamento_id/lancamento_id
  // são colunas uuid — consultar com não-UUID gera erro de tipo no Postgres).
  if (orderRef && UUID_REGEX.test(orderRef)) {
    const { data } = await supabase
      .from('pagamentos_online')
      .select('id,gateway_id,lancamento_id,status')
      .eq('gateway', 'cielo')
      .or(`agendamento_id.eq.${orderRef},lancamento_id.eq.${orderRef}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  return null
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.CIELO_WEBHOOK_TOKEN?.trim()
  if (expectedToken) {
    const provided =
      request.headers.get('x-webhook-token') ??
      request.nextUrl.searchParams.get('token') ??
      ''
    if (provided !== expectedToken) {
      return NextResponse.json(
        { error: 'Token inválido', code: 'WEBHOOK_UNAUTHORIZED' },
        { status: 401 },
      )
    }
  }

  const payload = await parseBody(request)
  if (!payload) return NextResponse.json({ ok: true })

  // ⚠️ VERIFICAR nomes dos campos do postback do Link de Pagamento.
  const productId = pickFirst(payload, ['product_id', 'productId', 'id', 'Id'])
  const orderRef = pickFirst(payload, [
    'order_number',
    'orderNumber',
    'sku',
    'reference',
    'MerchantOrderId',
  ])
  const paymentId = pickFirst(payload, ['payment_id', 'paymentId', 'tid', 'Tid', 'PaymentId'])
  const statusRaw = pickFirst(payload, ['payment_status', 'paymentStatus', 'status', 'Status'])

  const supabase = getAppSupabase()
  const row = await localizarPagamento(supabase, productId, orderRef)
  if (!row) {
    console.warn('[webhook/cielo] pagamento não localizado:', {
      productId: productId ? `${productId.slice(0, 8)}…` : '',
      orderRef: orderRef ? `${orderRef.slice(0, 8)}…` : '',
    })
    return NextResponse.json({ ok: true })
  }

  // Auditoria: grava sempre o payload bruto.
  await supabase
    .from('pagamentos_online')
    .update({ webhook_payload: payload, updated_at: new Date().toISOString() })
    .eq('id', row.id)

  // Status AUTORITATIVO — não confiar no payload. Sem consulta outbound, não marca pago.
  const config = await getCieloConfig()
  let resolved: { status: string; pago: boolean } | null = null
  if (config && paymentId && UUID_REGEX.test(paymentId)) {
    resolved = await consultarPagamentoCielo(config, paymentId)
  } else if (config && row.gateway_id) {
    resolved = await consultarPedidoLinkCielo(config, row.gateway_id)
  }
  if (!resolved) {
    console.warn('[webhook/cielo] consulta Cielo indisponível — status do payload ignorado', {
      paymentIdPresent: Boolean(paymentId),
      statusRawPresent: Boolean(statusRaw),
    })
    return NextResponse.json({ ok: true })
  }

  if (resolved.pago) {
    const agora = new Date().toISOString()
    const onlineUp = await supabase
      .from('pagamentos_online')
      .update({ status: 'capturado', pago_em: agora, updated_at: agora })
      .eq('id', row.id)
    if (onlineUp.error) {
      return NextResponse.json({ error: 'Falha ao atualizar pagamento', code: 'WEBHOOK_UPDATE_FAILED' }, { status: 500 })
    }
    if (row.lancamento_id) {
      const finUp = await supabase
        .from('financeiro_lancamentos')
        .update({ status: 'Pago', updated_at: agora })
        .eq('id', row.lancamento_id)
      if (finUp.error) {
        return NextResponse.json({ error: 'Falha ao atualizar lançamento', code: 'WEBHOOK_UPDATE_FAILED' }, { status: 500 })
      }
    }
  } else {
    await supabase
      .from('pagamentos_online')
      .update({ status: resolved.status, updated_at: new Date().toISOString() })
      .eq('id', row.id)
  }

  return NextResponse.json({ ok: true })
}
