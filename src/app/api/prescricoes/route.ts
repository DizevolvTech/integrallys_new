import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapPrescricaoItem } from '@/lib/domain-mappers'
import { estoqueAplicarMovimentacao } from '@/lib/estoque-movimentacao'
import { stripPrescricaoFinancialFields } from '@/lib/financial-sanitize'
import { calcularVenda, ehFormaComDesconto } from '@/lib/desconto-forma'
import { lerDescontosPorForma } from '@/lib/desconto-forma-server'
import { rotuloFormaPagamento } from '@/lib/recibo'
import { detalhesPagamentoCaixa, ehFormaVenda, formaCaixaDaVenda, validarPagamentoVenda } from '@/lib/venda-pagamento'
import { validadeOrcamentoValida } from '@/lib/prescricao-validade'
import { emLotes } from '@/lib/em-lotes'
import { margemDaPrescricao, margemDoItem, podeVerCustoMargem } from '@/lib/prescricao-margem'
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

interface PagamentoVenda {
  forma: string | null
  bandeira: string | null
  contaBancariaId: string | null
  numeroParcelas: number | null
}

const textoOuNulo = (valor: unknown) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null)

/** Forma de pagamento e detalhes (bandeira, conta do PIX, parcelas) enviados pela tela. */
function lerPagamento(body: Record<string, unknown>): PagamentoVenda {
  const forma = textoOuNulo(body.formaPagamento)
  const parcelas = Number(body.numeroParcelas)
  return {
    forma: ehFormaVenda(forma) ? forma : null,
    bandeira: textoOuNulo(body.bandeira),
    contaBancariaId: textoOuNulo(body.contaBancariaId),
    numeroParcelas: Number.isFinite(parcelas) ? Math.floor(parcelas) : null,
  }
}

/**
 * Grava a forma de pagamento da venda (base do filtro "Vendas por consumo" nos relatórios) e só os
 * detalhes que a forma usa: bandeira no cartão, parcelas no crédito, conta do PIX no PIX.
 */
function buildFormaPagamentoPayload(pagamento: PagamentoVenda) {
  if (!pagamento.forma) return {}
  const cartao = pagamento.forma === 'cartao_credito' || pagamento.forma === 'cartao_debito'
  return {
    forma_pagamento: pagamento.forma,
    bandeira: cartao ? pagamento.bandeira : null,
    conta_bancaria_id: pagamento.forma === 'pix' ? pagamento.contaBancariaId : null,
  }
}

/** Confere a regra de pagamento da venda concluída e se a conta do PIX existe. Devolve a resposta de erro, se houver. */
async function conferirPagamentoDaVenda(supabase: SupabaseClient, pagamento: PagamentoVenda) {
  const erro = validarPagamentoVenda(pagamento)
  if (erro) return serverErrorResponse(erro.message, erro.code, 400)
  if (pagamento.forma === 'pix' && pagamento.contaBancariaId) {
    const conta = await supabase.from('contas_bancarias').select('id').eq('id', pagamento.contaBancariaId).maybeSingle()
    if (conta.error) return supabaseErrorResponse(conta.error, 'Falha ao conferir a conta do PIX')
    if (!conta.data) return serverErrorResponse('Conta do PIX não encontrada', 'CONTA_PIX_INVALIDA', 400)
  }
  return null
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
      'id,paciente_id,numero,valor_total,valor_bruto,numero_parcelas,valor_parcela,desconto_tipo,desconto_percentual,desconto_valor,justificativa_desconto,vendedor_id,status,data_prescricao,tipo,validade,observacoes,forma_pagamento,bandeira,conta_bancaria_id',
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
  const verCusto = podeVerCustoMargem(session?.role)

  // Lotes de 150 ids em paralelo: `.in()` sem limite estoura a URL do PostgREST.
  const resultadosItens = await Promise.all(
    emLotes(prescricaoIds).map((lote) =>
      supabase
        .from('prescricao_itens')
        .select('prescricao_id,produto_id,descricao,quantidade,valor_unitario,posologia,custo_unitario')
        .in('prescricao_id', lote),
    ),
  )
  const itemRows: Array<Record<string, unknown>> = []
  for (const r of resultadosItens) {
    if (r.error) return supabaseErrorResponse(r.error, 'Falha ao carregar itens da prescrição')
    itemRows.push(...((r.data ?? []) as Array<Record<string, unknown>>))
  }

  // Custo atual do produto só como reserva para itens antigos, sem custo gravado (apenas gestor/admin/master).
  const custoAtual = new Map<string, number>()
  if (verCusto) {
    const semCusto = [
      ...new Set(itemRows.filter((r) => r.custo_unitario == null && r.produto_id).map((r) => String(r.produto_id))),
    ]
    const produtosLotes = await Promise.all(
      emLotes(semCusto).map((lote) => supabase.from('produtos_estoque').select('id,preco_custo').in('id', lote)),
    )
    for (const { data: produtos } of produtosLotes) {
      for (const p of produtos ?? []) {
        if (p.preco_custo != null) custoAtual.set(String(p.id), Number(p.preco_custo))
      }
    }
  }

  for (const raw of itemRows) {
    const key = String(raw.prescricao_id)
    const existing = itemsByPrescricao.get(key) ?? []
    const quantity = Number(raw.quantidade ?? 0)
    const unitPrice = raw.valor_unitario != null ? Number(raw.valor_unitario) : 0
    const custoUnitario = verCusto
      ? raw.custo_unitario != null
        ? Number(raw.custo_unitario)
        : raw.produto_id
          ? custoAtual.get(String(raw.produto_id)) ?? null
          : null
      : null
    existing.push({
      productId: raw.produto_id ? String(raw.produto_id) : undefined,
      productName: String(raw.descricao ?? ''),
      quantity,
      posology: raw.posologia ? String(raw.posologia) : undefined,
      unitPrice,
      total: unitPrice * quantity,
      ...(verCusto ? margemDoItem({ quantity, unitPrice, custoUnitario }) : {}),
    })
    itemsByPrescricao.set(key, existing)
  }

  return NextResponse.json({
    data: rows.map((row) => {
      const itens = (itemsByPrescricao.get(String(row.id)) ?? []) as Array<{ quantity: number; unitPrice: number; custoUnitario?: number }>
      const mapped = sanitizeForRole(
        mapPrescricaoItem({
          ...row,
          paciente_nome: map[String(row.paciente_id ?? '')] ?? '',
          items: itens,
        }),
        session?.role,
      )
      const comForma = {
        ...mapped,
        formaPagamento: row.forma_pagamento ? rotuloFormaPagamento(String(row.forma_pagamento)) : undefined,
        bandeira: row.bandeira ? String(row.bandeira) : undefined,
        contaBancariaId: row.conta_bancaria_id ? String(row.conta_bancaria_id) : undefined,
      }
      return verCusto ? { ...comForma, ...margemDaPrescricao(itens, mapped.valorTotal) } : comForma
    }),
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

function buildParcelamentoPayload(body: Record<string, unknown>, forma: string | null = null) {
  // Débito, PIX, dinheiro e consumo não têm parcelas (a venda concluída guarda só as do crédito).
  if (forma && forma !== 'cartao_credito') return { numero_parcelas: null, valor_parcela: null }
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

/** Vendedor e justificativa/convênio vêm da tela; o desconto em si nunca (ver `descontoDaVenda`). */
function buildVendaMetaPayload(body: Record<string, unknown>) {
  const justificativa =
    typeof body.justificativaDesconto === 'string' && body.justificativaDesconto.trim().length > 0
      ? body.justificativaDesconto.trim()
      : null
  return {
    justificativa_desconto: justificativa,
    vendedor_id: body.vendedorId ? String(body.vendedorId) : null,
  }
}

/**
 * Desconto travado pela forma de pagamento: o servidor recalcula pelo cadastro do gestor e confere o total
 * enviado. Qualquer desconto/valor bruto vindo da tela é ignorado; só vale Convertida + forma com desconto + itens.
 */
async function descontoDaVenda(
  supabase: SupabaseClient,
  params: { items: ItemPayload[]; forma: string | null; isConvertida: boolean; valorTotal: number },
) {
  const semDesconto = { valor_bruto: null, desconto_tipo: null, desconto_percentual: null, desconto_valor: null }
  if (!params.isConvertida || !ehFormaComDesconto(params.forma) || params.items.length === 0) {
    return { payload: semDesconto, error: null as Response | null }
  }
  const { descontos, error } = await lerDescontosPorForma(supabase)
  if (error || !descontos) {
    return {
      payload: semDesconto,
      error: serverErrorResponse('Falha ao ler descontos por forma', 'SUPABASE_QUERY_FAILED', 500),
    }
  }
  const venda = calcularVenda(params.items, params.forma, descontos)
  if (Math.abs(venda.total - params.valorTotal) > 0.01) {
    return {
      payload: semDesconto,
      error: serverErrorResponse(
        'O total não confere com o desconto cadastrado para essa forma de pagamento. Feche e abra a venda de novo.',
        'DESCONTO_FORMA_DIVERGENTE',
        422,
      ),
    }
  }
  if (venda.desconto <= 0) return { payload: semDesconto, error: null as Response | null }
  return {
    payload: {
      valor_bruto: venda.subtotal,
      desconto_tipo: 'percent',
      desconto_percentual: venda.percentual,
      desconto_valor: venda.desconto,
    },
    error: null as Response | null,
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

  // Grava o custo do produto no momento da venda: a margem do gestor não muda se o custo mudar depois.
  const produtoIds = [...new Set(items.map((it) => it.productId).filter((id): id is string => !!id))]
  const custos = new Map<string, number>()
  const custosLotes = await Promise.all(
    emLotes(produtoIds).map((lote) => supabase.from('produtos_estoque').select('id,preco_custo').in('id', lote)),
  )
  for (const { data } of custosLotes) {
    for (const p of data ?? []) if (p.preco_custo != null) custos.set(String(p.id), Number(p.preco_custo))
  }

  const insertRows = items.map((it) => ({
    prescricao_id: prescricaoId,
    produto_id: it.productId ?? null,
    descricao: it.descricao,
    quantidade: it.quantidade,
    valor_unitario: it.valorUnitario ?? null,
    posologia: it.posologia ?? null,
    custo_unitario: it.productId ? custos.get(it.productId) ?? null : null,
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
    pagamento: PagamentoVenda
    paciente: { id: string; nome: string }
  },
) {
  const { error } = await supabase.from('caixa_movimentos').insert({
    unidade_id: params.unitId,
    usuario_id: params.session!.userId,
    sessao_id: params.sessaoId,
    descricao: params.descricao,
    tipo: 'entrada',
    valor: params.valor,
    forma: formaCaixaDaVenda(params.pagamento.forma),
    ...detalhesPagamentoCaixa({ ...params.pagamento, valorTotal: params.valor }),
    vinculo_tipo: 'paciente',
    vinculo_id: params.paciente.id,
    vinculo_nome: params.paciente.nome,
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
  const pagamento = lerPagamento(body)
  const formaPagamento = pagamento.forma
  const isConvertida = String(body.status) === 'Convertida'
  const precisaCaixa = isConvertida && formaPagamento !== null && formaPagamento !== 'consumo'
  const valorTotal = Number(body.valorTotal)

  const supabase = getAppSupabase()

  // Venda concluída exige forma de pagamento (consumo vale) e os dados da forma; orçamento sem forma segue como Ativa.
  if (isConvertida) {
    const recusa = await conferirPagamentoDaVenda(supabase, pagamento)
    if (recusa) return recusa
  } else if (body.validade && !validadeOrcamentoValida(String(body.validade), getTodayKey())) {
    return serverErrorResponse('A validade não pode ser anterior a hoje', 'VALIDADE_INVALIDA', 400)
  }

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

  const desconto = await descontoDaVenda(supabase, { items, forma: formaPagamento, isConvertida, valorTotal })
  if (desconto.error) return desconto.error

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
      ...desconto.payload,
      ...buildVendaMetaPayload(body),
      ...buildParcelamentoPayload(body, isConvertida ? formaPagamento : null),
      ...buildFormaPagamentoPayload(pagamento),
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
    const pacienteId = String(body.pacienteId)
    const pacienteNome = await fetchPacienteNome(supabase, pacienteId)
    const descricao = `Venda ${numero} - ${pacienteNome} (${paymentMethodLabel(formaPagamento)})`
    const caixaResult = await lancarCaixa(supabase, {
      session,
      unitId,
      sessaoId: sessaoCaixaId,
      valor: valorTotal,
      descricao,
      pagamento,
      paciente: { id: pacienteId, nome: pacienteNome },
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

/** Desfaz uma conversão que falhou no meio: devolve o estoque e volta a prescrição ao estado anterior. */
async function reverterConversao(
  supabase: SupabaseClient,
  params: {
    id: string
    numero: string
    session: Awaited<ReturnType<typeof getRequestAuth>>
    itens: Array<{ productId: string | null; quantidade: number }>
    anterior: Record<string, unknown>
  },
) {
  await restoreStockFromItems(supabase, params.itens, params.session, params.numero)
  await supabase.from('prescricoes').update(params.anterior).eq('id', params.id)
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
    .select('status,numero,profissional_id,validade,valor_total,forma_pagamento,bandeira,conta_bancaria_id,numero_parcelas,valor_parcela,valor_bruto,desconto_tipo,desconto_percentual,desconto_valor')
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
  const numero = currentQuery.data?.numero ? String(currentQuery.data.numero) : 'N/A'
  const pacienteId = String(body.pacienteId)

  // Validade nova (diferente da gravada) não pode ficar no passado.
  const validadeNova = body.validade ? String(body.validade) : null
  const validadeAtual = currentQuery.data?.validade ? String(currentQuery.data.validade).slice(0, 10) : null
  if (!transitionToConvertida && validadeNova && validadeNova !== validadeAtual && !validadeOrcamentoValida(validadeNova, getTodayKey())) {
    return serverErrorResponse('A validade não pode ser anterior a hoje', 'VALIDADE_INVALIDA', 400)
  }

  if (!transitionToConvertida) {
    const { error } = await supabase
      .from('prescricoes')
      .update({
        paciente_id: pacienteId,
        numero: body.numero ? String(body.numero) : generateNumero(),
        valor_total: Number(body.valorTotal),
        status: nextStatus,
        tipo: body.tipo ? String(body.tipo) : null,
        data_prescricao: body.data ? String(body.data) : null,
        validade: validadeNova,
        observacoes: body.observacoes ? String(body.observacoes) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', String(body.id))
    if (error) {
      return supabaseErrorResponse(error, 'Falha ao atualizar prescrição')
    }
    return listPrescricoes(session)
  }

  // ---- Conversão em venda (mesma regra da nova venda): forma obrigatória, caixa aberto, desconto da forma,
  // baixa de estoque e lançamento no caixa. Estoque só baixa depois de tudo conferido e volta se algo falhar. ----
  const lido = lerPagamento(body)
  const pagamento: PagamentoVenda = lido.forma
    ? lido
    : { ...lido, forma: ehFormaVenda(currentQuery.data?.forma_pagamento) ? String(currentQuery.data?.forma_pagamento) : null }
  const recusa = await conferirPagamentoDaVenda(supabase, pagamento)
  if (recusa) return recusa

  const itensQuery = await supabase
    .from('prescricao_itens')
    .select('id,produto_id,quantidade,descricao,valor_unitario,custo_unitario')
    .eq('prescricao_id', String(body.id))
  if (itensQuery.error) {
    return supabaseErrorResponse(itensQuery.error, 'Falha ao carregar itens para baixa de estoque')
  }
  const itensDb = itensQuery.data ?? []
  const consumo = pagamento.forma === 'consumo'
  // Consumo: a venda vale pelo preço de custo gravado em cada item (recepção nunca vê o custo).
  const precoDoItem = (raw: (typeof itensDb)[number]) =>
    consumo && raw.custo_unitario != null ? Number(raw.custo_unitario) : raw.valor_unitario != null ? Number(raw.valor_unitario) : null
  const itensVenda: ItemPayload[] = itensDb.map((raw) => ({
    productId: raw.produto_id ? String(raw.produto_id) : null,
    descricao: String(raw.descricao ?? ''),
    quantidade: Number(raw.quantidade ?? 0),
    valorUnitario: precoDoItem(raw),
  }))
  const totalConsumo = itensVenda.reduce((soma, it) => soma + (it.valorUnitario ?? 0) * it.quantidade, 0)
  const valorTotal = consumo && itensVenda.length > 0 ? Math.round((totalConsumo + Number.EPSILON) * 100) / 100 : Number(body.valorTotal)

  let unitId: string | null = null
  let sessaoCaixaId: string | null = null
  if (!consumo) {
    const resolved = await resolveUnitId(supabase, session.userId, typeof body.unidadeId === 'string' ? body.unidadeId : null)
    if (resolved.error) return supabaseErrorResponse(resolved.error, 'Falha ao resolver unidade da venda')
    if (!resolved.unitId) {
      return serverErrorResponse('Nenhuma unidade disponível para registrar a venda', 'UNIT_REQUIRED', 400)
    }
    unitId = resolved.unitId
    const caixa = await ensureCaixaAberto(supabase, unitId)
    if (caixa.error) return supabaseErrorResponse(caixa.error, 'Falha ao verificar caixa aberto')
    if (!caixa.sessionId) {
      return serverErrorResponse(
        'Caixa não aberto — abra o caixa do dia antes de finalizar a venda',
        'CAIXA_NOT_OPEN',
        409,
      )
    }
    sessaoCaixaId = caixa.sessionId
  }

  const desconto = await descontoDaVenda(supabase, { items: itensVenda, forma: pagamento.forma, isConvertida: true, valorTotal })
  if (desconto.error) return desconto.error

  const baixas = itensVenda.filter((it) => it.productId && it.quantidade > 0)
  const baixados: Array<{ productId: string | null; quantidade: number }> = []
  for (const it of baixas) {
    const result = await estoqueAplicarMovimentacao(supabase, {
      produtoId: String(it.productId),
      usuarioId: session.userId,
      tipo: 'saida',
      quantidade: it.quantidade,
      tipoMovimentacao: 'saida',
      observacoes: `Saída por conversão de prescrição ${numero}`,
    })
    if (!result.ok) {
      await restoreStockFromItems(supabase, baixados, session, numero)
      if (result.code === 'INSUFFICIENT_STOCK') {
        return serverErrorResponse(`Estoque insuficiente para ${it.descricao || String(it.productId)}`, 'STOCK_INSUFFICIENT', 409)
      }
      return serverErrorResponse(result.message, result.code, 500)
    }
    baixados.push({ productId: it.productId ?? null, quantidade: it.quantidade })
  }

  const dadosAnteriores = currentQuery.data
  const anterior = {
    status: previousStatus,
    valor_total: dadosAnteriores?.valor_total ?? Number(body.valorTotal),
    forma_pagamento: dadosAnteriores?.forma_pagamento ?? null,
    bandeira: dadosAnteriores?.bandeira ?? null,
    conta_bancaria_id: dadosAnteriores?.conta_bancaria_id ?? null,
    numero_parcelas: dadosAnteriores?.numero_parcelas ?? null,
    valor_parcela: dadosAnteriores?.valor_parcela ?? null,
    valor_bruto: dadosAnteriores?.valor_bruto ?? null,
    desconto_tipo: dadosAnteriores?.desconto_tipo ?? null,
    desconto_percentual: dadosAnteriores?.desconto_percentual ?? null,
    desconto_valor: dadosAnteriores?.desconto_valor ?? null,
  }
  const reverter = () => reverterConversao(supabase, { id: String(body.id), numero, session, itens: baixados, anterior })

  const parcelamento = buildParcelamentoPayload(
    { numeroParcelas: pagamento.numeroParcelas, valorParcela: body.valorParcela ?? (pagamento.numeroParcelas ? valorTotal / pagamento.numeroParcelas : null) },
    pagamento.forma,
  )
  const justificativa = textoOuNulo(body.justificativaDesconto)
  const { error } = await supabase
    .from('prescricoes')
    .update({
      paciente_id: pacienteId,
      numero: body.numero ? String(body.numero) : generateNumero(),
      valor_total: valorTotal,
      status: nextStatus,
      tipo: body.tipo ? String(body.tipo) : null,
      data_prescricao: body.data ? String(body.data) : null,
      validade: validadeNova,
      observacoes: body.observacoes ? String(body.observacoes) : null,
      ...desconto.payload,
      ...parcelamento,
      ...buildFormaPagamentoPayload(pagamento),
      ...(body.vendedorId ? { vendedor_id: String(body.vendedorId) } : {}),
      ...(justificativa ? { justificativa_desconto: justificativa } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))
  if (error) {
    await restoreStockFromItems(supabase, baixados, session, numero)
    return supabaseErrorResponse(error, 'Falha ao atualizar prescrição')
  }

  if (consumo) {
    const regravar = await Promise.all(
      itensDb
        .filter((raw) => raw.custo_unitario != null)
        .map((raw) => supabase.from('prescricao_itens').update({ valor_unitario: Number(raw.custo_unitario) }).eq('id', raw.id)),
    )
    if (regravar.some((r) => r.error)) {
      await Promise.all(
        itensDb.map((raw) => supabase.from('prescricao_itens').update({ valor_unitario: raw.valor_unitario }).eq('id', raw.id)),
      )
      await reverter()
      return serverErrorResponse('Falha ao registrar os itens do consumo — conversão revertida', 'ITEMS_UPDATE_FAILED', 500)
    }
  }

  if (unitId && sessaoCaixaId) {
    const pacienteNome = await fetchPacienteNome(supabase, pacienteId)
    const caixaResult = await lancarCaixa(supabase, {
      session,
      unitId,
      sessaoId: sessaoCaixaId,
      valor: valorTotal,
      descricao: `Venda ${numero} - ${pacienteNome} (${paymentMethodLabel(pagamento.forma)})`,
      pagamento,
      paciente: { id: pacienteId, nome: pacienteNome },
    })
    if (caixaResult.error) {
      await reverter()
      return supabaseErrorResponse(
        caixaResult.error,
        'Falha ao lançar venda no caixa — conversão revertida (estoque restaurado)',
      )
    }
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
