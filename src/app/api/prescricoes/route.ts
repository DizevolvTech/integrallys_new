import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapPrescricaoItem } from '@/lib/domain-mappers'
import { estoqueAplicarMovimentacao } from '@/lib/estoque-movimentacao'
import { stripPrescricaoFinancialFields } from '@/lib/financial-sanitize'
import { isPrescriptionImmutable } from '@/lib/prescricao-immutability'
import { authErrorResponse, forbiddenResponse, getRequestAuth } from '@/lib/request-auth'
import { serverErrorResponse } from '@/lib/app-api'

type SupabaseClient = ReturnType<typeof getAppSupabase>

interface ItemPayload {
  productId?: string | null
  descricao: string
  quantidade: number
  valorUnitario?: number | null
  posologia?: string | null
}

function getTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function resolveUnitId(
  supabase: SupabaseClient,
  userId: string,
  requested?: string | null,
) {
  if (requested && requested.trim() !== '') {
    return { unitId: requested, error: null as unknown as null }
  }

  const userResult = await supabase
    .from('usuarios')
    .select('unidade_id')
    .eq('id', userId)
    .maybeSingle()
  if (userResult.error) {
    return { unitId: null, error: userResult.error }
  }
  if (userResult.data?.unidade_id) {
    return { unitId: String(userResult.data.unidade_id), error: null }
  }

  const firstUnitResult = await supabase
    .from('unidades')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (firstUnitResult.error) {
    return { unitId: null, error: firstUnitResult.error }
  }

  return {
    unitId: firstUnitResult.data?.id ? String(firstUnitResult.data.id) : null,
    error: null,
  }
}

const FORMAS_PAGAMENTO_VALIDAS = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'consumo']

/** Grava a forma de pagamento da venda (base do filtro "Vendas por consumo" nos relatórios). */
function buildFormaPagamentoPayload(body: Record<string, unknown>) {
  const forma = typeof body.formaPagamento === 'string' ? body.formaPagamento.trim() : ''
  return FORMAS_PAGAMENTO_VALIDAS.includes(forma) ? { forma_pagamento: forma } : {}
}

function paymentMethodLabel(method: string | undefined | null) {
  switch (method) {
    case 'pix':
      return 'Pix'
    case 'dinheiro':
      return 'Dinheiro'
    case 'cartao_credito':
      return 'Cartão de Crédito'
    case 'cartao_debito':
      return 'Cartão de Débito'
    case 'consumo':
      return 'Consumo'
    default:
      return method ? String(method) : 'Não informado'
  }
}

function paymentMethodToCaixaForma(method: string | undefined | null) {
  switch (method) {
    case 'pix':
      return 'pix'
    case 'dinheiro':
      return 'dinheiro'
    case 'cartao_credito':
      return 'credito'
    case 'cartao_debito':
      return 'debito'
    default:
      return 'dinheiro'
  }
}

function normalizeItemsPayload(raw: unknown): ItemPayload[] {
  if (!Array.isArray(raw)) return []
  const result: ItemPayload[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const it = entry as Record<string, unknown>
    const descricao = typeof it.descricao === 'string' ? it.descricao.trim() : ''
    const quantidade = Number(it.quantidade)
    if (!descricao || !Number.isFinite(quantidade) || quantidade <= 0) continue
    result.push({
      productId:
        typeof it.productId === 'string' && it.productId.trim() !== '' ? it.productId : null,
      descricao,
      quantidade: Math.floor(quantidade),
      valorUnitario:
        it.valorUnitario == null || it.valorUnitario === '' ? null : Number(it.valorUnitario),
      posologia:
        typeof it.posologia === 'string' && it.posologia.trim() !== ''
          ? it.posologia.trim()
          : null,
    })
  }
  return result
}

type MappedPrescricao = ReturnType<typeof mapPrescricaoItem>

// CR-SEC-01 · item 2.2: o especialista NUNCA deve receber valores monetários
// da prescrição pela API. Ver `stripPrescricaoFinancialFields`.
function sanitizeForRole(item: MappedPrescricao, role?: string) {
  return stripPrescricaoFinancialFields(item, role)
}

async function listPrescricoes(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('prescricoes')
    .select(
      'id,paciente_id,numero,valor_total,valor_bruto,numero_parcelas,valor_parcela,desconto_tipo,desconto_percentual,desconto_valor,justificativa_desconto,vendedor_id,status,data_prescricao,tipo,validade,observacoes',
    )
    // CR-M05-D · ordenação padrão por data da prescrição (mais recente primeiro);
    // created_at como tiebreaker para casos onde data_prescricao é null/igual.
    .order('data_prescricao', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar prescrições')
  }

  const rows = data ?? []

  const { map, error: pacienteError } = await getEntityNameMap(
    supabase,
    'pacientes',
    rows.map((row) => String(row.paciente_id ?? '')),
  )

  if (pacienteError) {
    return supabaseErrorResponse(pacienteError, 'Falha ao carregar prescrições')
  }

  const prescricaoIds = rows.map((row) => String(row.id))
  const itemsByPrescricao = new Map<string, Array<Record<string, unknown>>>()

  if (prescricaoIds.length > 0) {
    const itemsQuery = await supabase
      .from('prescricao_itens')
      .select('prescricao_id,produto_id,descricao,quantidade,valor_unitario,posologia')
      .in('prescricao_id', prescricaoIds)

    if (itemsQuery.error) {
      return supabaseErrorResponse(itemsQuery.error, 'Falha ao carregar itens da prescrição')
    }

    for (const raw of itemsQuery.data ?? []) {
      const key = String(raw.prescricao_id)
      const existing = itemsByPrescricao.get(key) ?? []
      const quantity = Number(raw.quantidade ?? 0)
      const unitPrice = raw.valor_unitario != null ? Number(raw.valor_unitario) : 0
      existing.push({
        productId: raw.produto_id ? String(raw.produto_id) : undefined,
        productName: String(raw.descricao ?? ''),
        quantity,
        posology: raw.posologia ? String(raw.posologia) : undefined,
        unitPrice,
        total: unitPrice * quantity,
      })
      itemsByPrescricao.set(key, existing)
    }
  }

  return NextResponse.json({
    data: rows.map((row) =>
      sanitizeForRole(
        mapPrescricaoItem({
          ...row,
          paciente_nome: map[String(row.paciente_id ?? '')] ?? '',
          items: itemsByPrescricao.get(String(row.id)) ?? [],
        }),
        session?.role,
      ),
    ),
    meta: session,
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'prescricoes', 'read')
  if (denied) return denied
  return listPrescricoes(session)
}

function generateNumero() {
  return `PRESC-${Date.now().toString().slice(-8)}`
}

function buildParcelamentoPayload(body: Record<string, unknown>) {
  const rawParcelas = body.numeroParcelas
  const parsedParcelas =
    rawParcelas == null || rawParcelas === '' ? null : Number(rawParcelas)
  const numeroParcelas =
    parsedParcelas != null && Number.isFinite(parsedParcelas) && parsedParcelas >= 1 && parsedParcelas <= 12
      ? Math.floor(parsedParcelas)
      : null
  const rawValorParcela = body.valorParcela
  const parsedValorParcela =
    rawValorParcela == null || rawValorParcela === '' ? null : Number(rawValorParcela)
  const valorParcela =
    parsedValorParcela != null && Number.isFinite(parsedValorParcela) && parsedValorParcela >= 0
      ? parsedValorParcela
      : null
  return {
    numero_parcelas: numeroParcelas,
    valor_parcela: valorParcela,
  }
}

function buildDescontoPayload(body: Record<string, unknown>) {
  const rawTipo = body.descontoTipo
  const descontoTipo =
    rawTipo === 'value' || rawTipo === 'percent' ? rawTipo : null
  const descontoPercentual =
    body.descontoPercentual == null || body.descontoPercentual === ''
      ? null
      : Number(body.descontoPercentual)
  const descontoValor =
    body.descontoValor == null || body.descontoValor === ''
      ? null
      : Number(body.descontoValor)
  const valorBruto =
    body.valorBruto == null || body.valorBruto === '' ? null : Number(body.valorBruto)
  const justificativa =
    typeof body.justificativaDesconto === 'string' && body.justificativaDesconto.trim().length > 0
      ? body.justificativaDesconto.trim()
      : null
  return {
    valor_bruto: valorBruto,
    desconto_tipo: descontoTipo,
    desconto_percentual: descontoPercentual,
    desconto_valor: descontoValor,
    justificativa_desconto: justificativa,
    vendedor_id: body.vendedorId ? String(body.vendedorId) : null,
  }
}

async function ensureCaixaAberto(
  supabase: SupabaseClient,
  unitId: string,
) {
  const todayKey = getTodayKey()
  const sessionQuery = await supabase
    .from('caixa_sessoes')
    .select('id,status')
    .eq('data_operacao', todayKey)
    .eq('unidade_id', unitId)
    .order('aberto_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionQuery.error) {
    return { sessionId: null, error: sessionQuery.error }
  }

  const data = sessionQuery.data
  if (!data || data.status !== 'aberto' || !data.id) {
    return { sessionId: null, error: null }
  }
  return { sessionId: String(data.id), error: null }
}

async function applyItemsAndEstoque(
  supabase: SupabaseClient,
  prescricaoId: string,
  items: ItemPayload[],
  session: Awaited<ReturnType<typeof getRequestAuth>>,
  decrementStock: boolean,
  prescricaoNumero: string,
) {
  if (items.length === 0) return { error: null as unknown as null }

  const insertRows = items.map((it) => ({
    prescricao_id: prescricaoId,
    produto_id: it.productId ?? null,
    descricao: it.descricao,
    quantidade: it.quantidade,
    valor_unitario: it.valorUnitario ?? null,
    posologia: it.posologia ?? null,
  }))

  const { error: insertError } = await supabase.from('prescricao_itens').insert(insertRows)
  if (insertError) {
    return { error: insertError }
  }

  if (!decrementStock) {
    return { error: null }
  }

  for (const it of items) {
    if (!it.productId) continue

    const result = await estoqueAplicarMovimentacao(supabase, {
      produtoId: it.productId,
      usuarioId: session!.userId,
      tipo: 'saida',
      quantidade: it.quantidade,
      tipoMovimentacao: 'saida',
      observacoes: `Saída por venda de prescrição ${prescricaoNumero}`,
    })

    if (!result.ok) {
      return {
        error: {
          message: result.message,
          code: result.code === 'INSUFFICIENT_STOCK' ? 'STOCK_INSUFFICIENT' : result.code,
        } as never,
      }
    }
  }

  return { error: null }
}

async function restoreStockFromItems(
  supabase: SupabaseClient,
  items: Array<{ productId?: string | null; quantidade: number; descricao?: string }>,
  session: Awaited<ReturnType<typeof getRequestAuth>>,
  prescricaoNumero: string,
) {
  for (const it of items) {
    if (!it.productId) continue
    await estoqueAplicarMovimentacao(supabase, {
      produtoId: it.productId,
      usuarioId: session!.userId,
      tipo: 'entrada',
      quantidade: it.quantidade,
      tipoMovimentacao: 'entrada',
      observacoes: `Estorno automático — falha no caixa da venda ${prescricaoNumero}`,
    })
  }
}

async function lancarCaixa(
  supabase: SupabaseClient,
  params: {
    session: Awaited<ReturnType<typeof getRequestAuth>>
    unitId: string
    sessaoId: string
    valor: number
    descricao: string
    formaPagamento: string | null
  },
) {
  const { error } = await supabase.from('caixa_movimentos').insert({
    unidade_id: params.unitId,
    usuario_id: params.session!.userId,
    sessao_id: params.sessaoId,
    descricao: params.descricao,
    tipo: 'entrada',
    valor: params.valor,
    forma: paymentMethodToCaixaForma(params.formaPagamento),
    origem: 'prescricao',
    operador_nome: params.session!.user?.name || null,
    data_movimento: new Date().toISOString(),
  })
  return { error }
}

async function fetchPacienteNome(supabase: SupabaseClient, pacienteId: string) {
  const { data } = await supabase
    .from('pacientes')
    .select('nome')
    .eq('id', pacienteId)
    .maybeSingle()
  return String(data?.nome ?? 'Cliente')
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'prescricoes', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.pacienteId || body?.valorTotal == null || !body?.status) {
    return serverErrorResponse('Prescrição inválida', 'INVALID_PRESCRIPTION', 400)
  }

  const items = normalizeItemsPayload(body.items)
  const formaPagamento =
    typeof body.formaPagamento === 'string' && body.formaPagamento.trim() !== ''
      ? String(body.formaPagamento)
      : null
  const isConvertida = String(body.status) === 'Convertida'
  const precisaCaixa = isConvertida && formaPagamento !== null && formaPagamento !== 'consumo'
  const valorTotal = Number(body.valorTotal)

  const supabase = getAppSupabase()

  let unitId: string | null = null
  let sessaoCaixaId: string | null = null

  if (precisaCaixa) {
    const resolved = await resolveUnitId(
      supabase,
      session.userId,
      typeof body.unidadeId === 'string' ? body.unidadeId : null,
    )
    if (resolved.error) {
      return supabaseErrorResponse(resolved.error, 'Falha ao resolver unidade da venda')
    }
    if (!resolved.unitId) {
      return serverErrorResponse(
        'Nenhuma unidade disponível para registrar a venda',
        'UNIT_REQUIRED',
        400,
      )
    }
    unitId = resolved.unitId

    const caixa = await ensureCaixaAberto(supabase, unitId)
    if (caixa.error) {
      return supabaseErrorResponse(caixa.error, 'Falha ao verificar caixa aberto')
    }
    if (!caixa.sessionId) {
      return serverErrorResponse(
        'Caixa não aberto — abra o caixa do dia antes de finalizar a venda',
        'CAIXA_NOT_OPEN',
        409,
      )
    }
    sessaoCaixaId = caixa.sessionId
  }

  const numero = body.numero ? String(body.numero) : generateNumero()

  const assinaturaRaw =
    typeof body.assinaturaBase64 === 'string' && body.assinaturaBase64.trim().length > 0
      ? body.assinaturaBase64.trim()
      : null

  const inserted = await supabase
    .from('prescricoes')
    .insert({
      paciente_id: String(body.pacienteId),
      profissional_id: session.userId,
      numero,
      valor_total: valorTotal,
      status: String(body.status),
      tipo: body.tipo ? String(body.tipo) : null,
      data_prescricao: body.data ? String(body.data) : null,
      validade: body.validade ? String(body.validade) : null,
      observacoes: body.observacoes ? String(body.observacoes) : null,
      assinatura_base64: assinaturaRaw,
      assinado_em: assinaturaRaw ? new Date().toISOString() : null,
      ...buildDescontoPayload(body),
      ...buildParcelamentoPayload(body),
      ...buildFormaPagamentoPayload(body),
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data?.id) {
    return supabaseErrorResponse(
      (inserted.error ?? { message: 'Falha ao salvar prescrição' }) as never,
      'Falha ao salvar prescrição',
    )
  }

  const prescricaoId = String(inserted.data.id)

  const itemsResult = await applyItemsAndEstoque(
    supabase,
    prescricaoId,
    items,
    session,
    isConvertida,
    numero,
  )

  if (itemsResult.error) {
    await supabase.from('prescricoes').delete().eq('id', prescricaoId)
    return supabaseErrorResponse(
      itemsResult.error,
      'Falha ao registrar itens da venda — prescrição revertida',
    )
  }

  if (precisaCaixa && unitId && sessaoCaixaId) {
    const pacienteNome = await fetchPacienteNome(supabase, String(body.pacienteId))
    const descricao = `Venda ${numero} - ${pacienteNome} (${paymentMethodLabel(formaPagamento)})`
    const caixaResult = await lancarCaixa(supabase, {
      session,
      unitId,
      sessaoId: sessaoCaixaId,
      valor: valorTotal,
      descricao,
      formaPagamento,
    })
    if (caixaResult.error) {
      await restoreStockFromItems(supabase, items, session, numero)
      await supabase.from('prescricao_itens').delete().eq('prescricao_id', prescricaoId)
      await supabase.from('prescricoes').delete().eq('id', prescricaoId)
      return supabaseErrorResponse(
        caixaResult.error,
        'Falha ao lançar venda no caixa — venda revertida (estoque restaurado)',
      )
    }
  }

  return listPrescricoes(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'prescricoes', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id || !body?.pacienteId || body?.valorTotal == null || !body?.status) {
    return serverErrorResponse('Prescrição inválida', 'INVALID_PRESCRIPTION', 400)
  }

  const supabase = getAppSupabase()

  const currentQuery = await supabase
    .from('prescricoes')
    .select('status,numero,profissional_id')
    .eq('id', String(body.id))
    .maybeSingle()

  if (currentQuery.error) {
    return supabaseErrorResponse(currentQuery.error, 'Falha ao carregar prescrição para atualização')
  }

  // CR-SEC-01 · item 2.5: um especialista não pode editar a prescrição em
  // Rascunho de outro profissional. Desvio (Regra #7): o schema não tem
  // `criado_por`; a coluna de posse real é `profissional_id` (gravada com
  // session.userId no POST). Demais perfis (gestor/admin/recepção/master)
  // seguem inalterados — a permissão `prescricoes.update` continua valendo.
  const ownerId = currentQuery.data?.profissional_id
    ? String(currentQuery.data.profissional_id)
    : null
  if (
    session.role === 'especialista' &&
    String(currentQuery.data?.status ?? '') === 'Rascunho' &&
    ownerId !== null &&
    ownerId !== session.userId
  ) {
    return forbiddenResponse()
  }

  const previousStatus = currentQuery.data?.status ? String(currentQuery.data.status) : ''
  if (isPrescriptionImmutable(previousStatus)) {
    return serverErrorResponse(
      'Prescrição finalizada não pode ser alterada',
      'PRESCRIPTION_IMMUTABLE',
      409,
    )
  }
  const nextStatus = String(body.status)
  const transitionToConvertida =
    previousStatus !== 'Convertida' && nextStatus === 'Convertida'

  // Baixa de estoque ANTES de gravar Convertida — evita status final sem estoque.
  if (transitionToConvertida) {
    const itensQuery = await supabase
      .from('prescricao_itens')
      .select('produto_id,quantidade,descricao')
      .eq('prescricao_id', String(body.id))

    if (itensQuery.error) {
      return supabaseErrorResponse(
        itensQuery.error,
        'Falha ao carregar itens para baixa de estoque',
      )
    }

    const numero = currentQuery.data?.numero ? String(currentQuery.data.numero) : 'N/A'

    for (const raw of itensQuery.data ?? []) {
      if (!raw.produto_id) continue
      const produtoId = String(raw.produto_id)
      const quantidade = Number(raw.quantidade ?? 0)
      if (quantidade <= 0) continue

      const result = await estoqueAplicarMovimentacao(supabase, {
        produtoId,
        usuarioId: session.userId,
        tipo: 'saida',
        quantidade,
        tipoMovimentacao: 'saida',
        observacoes: `Saída por conversão de prescrição ${numero}`,
      })

      if (!result.ok) {
        if (result.code === 'INSUFFICIENT_STOCK') {
          return serverErrorResponse(
            `Estoque insuficiente para ${String(raw.descricao ?? produtoId)}`,
            'STOCK_INSUFFICIENT',
            409,
          )
        }
        return serverErrorResponse(result.message, result.code, 500)
      }
    }
  }

  const { error } = await supabase
    .from('prescricoes')
    .update({
      paciente_id: String(body.pacienteId),
      numero: body.numero ? String(body.numero) : generateNumero(),
      valor_total: Number(body.valorTotal),
      status: nextStatus,
      tipo: body.tipo ? String(body.tipo) : null,
      data_prescricao: body.data ? String(body.data) : null,
      validade: body.validade ? String(body.validade) : null,
      observacoes: body.observacoes ? String(body.observacoes) : null,
      ...buildDescontoPayload(body),
      ...buildParcelamentoPayload(body),
      ...buildFormaPagamentoPayload(body),
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar prescrição')
  }

  return listPrescricoes(session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'prescricoes', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Prescrição inválida', 'INVALID_PRESCRIPTION', 400)
  }

  const supabase = getAppSupabase()
  const currentQuery = await supabase
    .from('prescricoes')
    .select('status')
    .eq('id', String(body.id))
    .maybeSingle()

  if (currentQuery.error) {
    return supabaseErrorResponse(currentQuery.error, 'Falha ao carregar prescrição para exclusão')
  }

  const status = currentQuery.data?.status ? String(currentQuery.data.status) : ''
  if (isPrescriptionImmutable(status)) {
    return serverErrorResponse(
      'Prescrição finalizada não pode ser excluída',
      'PRESCRIPTION_IMMUTABLE',
      409,
    )
  }

  const { error } = await supabase.from('prescricoes').delete().eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir prescrição')
  }

  return listPrescricoes(session)
}
