import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapEstoqueItem } from '@/lib/domain-mappers'
import { buildAutoSku, resolveEstoqueStatus } from '@/lib/estoque-status'
import {
  estoqueAplicarMovimentacao,
  estoqueEstornarMovimentacao,
  estoqueRegistrarEntrada,
  estoqueRpcHttpStatus,
} from '@/lib/estoque-movimentacao'
import { stripEstoquePrices } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { montarEntrada } from './entrada-input'

// SCOPED UNIT — `getScopedUnitId` agora vem centralizado de `request-auth.ts`
// (Agente 20, 2026-05-21). Substitui a convenção anterior "helper por rota"
// registrada em CR-ESTQ-01 (2026-05-19): após o CR-AUTH-01 embarcar
// `unidadeId` no JWT, o helper local virou pura duplicação. A versão
// centralizada usa caminho rápido via JWT + fallback à query para tokens
// antigos. Outros endpoints (`getScopedAgendaContext` em agenda/route.ts)
// continuam locais porque retornam mais que `unidadeId`.

// Item 14 — parsing dos campos opcionais do cadastro de produto.
function parseNumeric(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

async function listEstoque(request: NextRequest, session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao carregar estoque')
  }

  let query = supabase
    .from('produtos_estoque')
    .select('id,nome,categoria,sku,quantidade,estoque_minimo,lote,validade,preco_custo,preco_venda,unidade_medida,status,unidade_id')
    .order('nome', { ascending: true })

  if (scopedUnit.unidadeId) {
    query = query.eq('unidade_id', scopedUnit.unidadeId)
  } else if (session && ['master', 'admin'].includes(session.role)) {
    const filtroUnidade = new URL(request.url).searchParams.get('unidade_id')
    if (filtroUnidade && filtroUnidade.trim() !== '') {
      query = query.eq('unidade_id', filtroUnidade.trim())
    }
  }

  const { data, error } = await query

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar estoque')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => stripEstoquePrices(mapEstoqueItem(row), session?.role)),
    meta: session,
  })
}

// PostgREST devolve a relação embarcada ora como objeto (FK 1:1 com unique)
// ora como array (multi-row). `pickJoinedName` cobre os dois — `JoinedName`
// é o alias usado nos campos joinados pra não duplicar o union em cada row.
type JoinedName = { nome: string | null } | { nome: string | null }[] | null

type MovimentacaoRow = {
  id: string
  produto_id: string
  usuario_id: string | null
  tipo: string
  tipo_movimentacao: string | null
  quantidade: number | null
  observacoes: string | null
  vinculo_tipo: string | null
  vinculo_nome: string | null
  created_at: string | null
  estornada: boolean | null
  produtos_estoque?: JoinedName
  usuarios?: JoinedName
}

function pickJoinedName(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) {
    const first = value[0] as { nome?: string | null } | undefined
    return first?.nome ? String(first.nome) : ''
  }
  const obj = value as { nome?: string | null }
  return obj?.nome ? String(obj.nome) : ''
}

/** Filtro por data é o dia de Brasília (UTC-3), não o dia UTC. */
const inicioDoDia = (dia: string) => (/^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia}T00:00:00-03:00` : dia)
const fimDoDia = (dia: string) => `${dia.slice(0, 10)}T23:59:59.999-03:00`

async function listMovimentacoes(
  request: NextRequest,
  session: Awaited<ReturnType<typeof getRequestAuth>>,
) {
  const url = new URL(request.url)
  const tipo = url.searchParams.get('tipo')
  const produtoId = url.searchParams.get('produto_id')
  const de = url.searchParams.get('de')
  const ate = url.searchParams.get('ate')
  const limitParam = Number(url.searchParams.get('limit') ?? '100')
  const offsetParam = Number(url.searchParams.get('offset') ?? '0')
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 500 ? Math.floor(limitParam) : 100
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0

  const supabase = getAppSupabase()

  let countQuery = supabase
    .from('movimentacoes_estoque')
    .select('id', { count: 'exact', head: true })
  if (tipo === 'entrada' || tipo === 'saida') countQuery = countQuery.eq('tipo', tipo)
  if (tipo === 'consumo_interno') countQuery = countQuery.eq('tipo_movimentacao', 'consumo_interno')
  if (produtoId) countQuery = countQuery.eq('produto_id', produtoId)
  if (de) countQuery = countQuery.gte('created_at', inicioDoDia(de))
  if (ate) countQuery = countQuery.lte('created_at', fimDoDia(ate))
  const countResult = await countQuery

  if (countResult.error) {
    return supabaseErrorResponse(countResult.error, 'Falha ao contar movimentações')
  }

  let query = supabase
    .from('movimentacoes_estoque')
    .select(
      'id,produto_id,usuario_id,tipo,tipo_movimentacao,quantidade,observacoes,vinculo_tipo,vinculo_nome,created_at,estornada,produtos_estoque(nome),usuarios!usuario_id(nome)',
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tipo === 'entrada' || tipo === 'saida') query = query.eq('tipo', tipo)
  if (tipo === 'consumo_interno') query = query.eq('tipo_movimentacao', 'consumo_interno')
  if (produtoId) query = query.eq('produto_id', produtoId)
  if (de) query = query.gte('created_at', inicioDoDia(de))
  if (ate) query = query.lte('created_at', fimDoDia(ate))

  const { data, error } = await query

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar movimentações')
  }

  const items = ((data ?? []) as MovimentacaoRow[]).map((row) => ({
    id: String(row.id),
    produtoId: String(row.produto_id ?? ''),
    produtoNome: pickJoinedName(row.produtos_estoque),
    operadorNome: pickJoinedName(row.usuarios),
    tipo: row.tipo === 'entrada' ? 'entrada' : 'saida',
    tipoMovimentacao: String(row.tipo_movimentacao ?? row.tipo ?? 'saida'),
    quantidade: Number(row.quantidade ?? 0),
    observacoes: row.observacoes ? String(row.observacoes) : null,
    vinculoTipo: row.vinculo_tipo ? String(row.vinculo_tipo) : null,
    vinculoNome: row.vinculo_nome ? String(row.vinculo_nome) : null,
    criadoEm: row.created_at ? String(row.created_at) : '',
    estornada: Boolean(row.estornada),
  }))

  return NextResponse.json({
    data: items,
    meta: {
      total: countResult.count ?? 0,
      limit,
      offset,
      filtros: { tipo, produtoId, de, ate },
    },
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'estoque', 'read')
  if (denied) return denied

  const url = new URL(request.url)
  if (url.searchParams.get('view') === 'movimentacoes') {
    return listMovimentacoes(request, session)
  }

  return listEstoque(request, session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'estoque', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = body?.action ? String(body.action) : null
  const supabase = getAppSupabase()

  if (action === 'estornar') {
    const movimentacaoId = typeof body?.movimentacaoId === 'string' ? body.movimentacaoId : null
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
    if (!movimentacaoId) {
      return serverErrorResponse('Movimentação inválida', 'INVALID_MOV_ID', 400)
    }
    if (motivo.length < 10) {
      return serverErrorResponse('Motivo do estorno deve ter ao menos 10 caracteres', 'INVALID_ESTORNO_MOTIVO', 400)
    }

    const result = await estoqueEstornarMovimentacao(supabase, {
      movimentacaoId,
      usuarioId: session.userId,
      motivo,
    })
    if (!result.ok) {
      return serverErrorResponse(result.message, result.code, estoqueRpcHttpStatus(result.code))
    }

    return listEstoque(request, session)
  }

  if (action === 'ajuste') {
    if (!body?.produtoId) {
      return serverErrorResponse('Produto inválido', 'INVALID_STOCK_ADJUSTMENT', 400)
    }
    const quantidadeAlvo = Number(body.quantidade)
    if (!Number.isFinite(quantidadeAlvo) || quantidadeAlvo < 0) {
      return serverErrorResponse('Quantidade inválida', 'INVALID_STOCK_ADJUSTMENT', 400)
    }
    const justificativa =
      typeof body.justificativa === 'string' ? body.justificativa.trim() : ''
    if (justificativa.length < 5) {
      return serverErrorResponse(
        'Informe a justificativa do ajuste (mín. 5 caracteres)',
        'INVALID_STOCK_ADJUSTMENT',
        400,
      )
    }

    const result = await estoqueAplicarMovimentacao(supabase, {
      produtoId: String(body.produtoId),
      usuarioId: session.userId,
      tipo: 'entrada',
      quantidade: 0,
      tipoMovimentacao: 'ajuste',
      observacoes: justificativa,
      quantidadeAlvo,
    })
    if (!result.ok) {
      return serverErrorResponse(result.message, result.code, estoqueRpcHttpStatus(result.code))
    }

    return listEstoque(request, session)
  }

  if (action === 'entrada' || action === 'saida') {
    if (!body?.produtoId || !body?.quantidade) {
      return serverErrorResponse('Movimentação inválida', 'INVALID_STOCK_MOVEMENT', 400)
    }

    const quantidade = Number(body.quantidade)
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return serverErrorResponse('Quantidade inválida', 'INVALID_STOCK_MOVEMENT', 400)
    }

    const allowedVinculoTipos = ['cliente', 'especialista', 'fornecedor'] as const
    const vinculoTipoRaw = typeof body.vinculoTipo === 'string' ? body.vinculoTipo : null
    const vinculoTipo = allowedVinculoTipos.includes(vinculoTipoRaw as (typeof allowedVinculoTipos)[number])
      ? vinculoTipoRaw
      : null
    const vinculoId =
      vinculoTipo && vinculoTipo !== 'fornecedor' && typeof body.vinculoId === 'string' && body.vinculoId.trim().length > 0
        ? body.vinculoId.trim()
        : null
    const vinculoNome =
      vinculoTipo && typeof body.vinculoNome === 'string' && body.vinculoNome.trim().length > 0
        ? body.vinculoNome.trim()
        : null

    const tipoMovimentacaoRaw =
      typeof body.tipoMovimentacao === 'string' ? body.tipoMovimentacao : null
    const tipoMovimentacao =
      action === 'entrada'
        ? 'entrada'
        : tipoMovimentacaoRaw === 'consumo_interno'
          ? 'consumo_interno'
          : 'saida'

    const numeroNf =
      action === 'entrada' && typeof body.numeroNf === 'string' ? body.numeroNf.trim() || null : null
    const cnpjEmitente =
      action === 'entrada' && typeof body.cnpjEmitente === 'string'
        ? body.cnpjEmitente.replace(/\D/g, '') || null
        : null
    const force = body.force === true

    if (action === 'entrada') {
      const entrada = await montarEntrada(supabase, body, {
        produtoId: String(body.produtoId),
        usuarioId: session.userId,
        quantidade,
        numeroNf,
        cnpjEmitente,
        forceNf: force,
      })
      if (!entrada.ok) return serverErrorResponse(entrada.error, entrada.code, 400)
      const result = await estoqueRegistrarEntrada(supabase, entrada.params)
      if (!result.ok) {
        return serverErrorResponse(result.message, result.code, estoqueRpcHttpStatus(result.code))
      }
      return listEstoque(request, session)
    }

    const result = await estoqueAplicarMovimentacao(supabase, {
      produtoId: String(body.produtoId),
      usuarioId: session.userId,
      tipo: action,
      quantidade,
      tipoMovimentacao,
      observacoes: typeof body.observacoes === 'string' ? body.observacoes : null,
      vinculoTipo,
      vinculoId,
      vinculoNome,
      numeroNf,
      cnpjEmitente,
      forceNf: force,
    })
    if (!result.ok) {
      return serverErrorResponse(result.message, result.code, estoqueRpcHttpStatus(result.code))
    }

    return listEstoque(request, session)
  }

  if (!body?.produto || !body?.categoria) {
    return serverErrorResponse('Produto inválido', 'INVALID_STOCK_ITEM', 400)
  }

  const scopedUnitCreate = await getScopedUnitId(session)
  if (scopedUnitCreate.error) {
    return supabaseErrorResponse(scopedUnitCreate.error, 'Falha ao cadastrar produto')
  }

  const quantidadeCreate = Number(body.quantidade ?? 0)
  let sku = parseText(body.sku)
  if (!sku) {
    let countQuery = supabase
      .from('produtos_estoque')
      .select('id', { count: 'exact', head: true })
    if (scopedUnitCreate.unidadeId) {
      countQuery = countQuery.eq('unidade_id', scopedUnitCreate.unidadeId)
    }
    const { count } = await countQuery
    sku = buildAutoSku({
      unidadeId: scopedUnitCreate.unidadeId,
      sequence: (count ?? 0) + 1,
    })
  }

  const { error } = await supabase.from('produtos_estoque').insert({
    nome: body.produto,
    categoria: body.categoria,
    sku,
    quantidade: quantidadeCreate,
    estoque_minimo: parseNumeric(body.estoqueMinimo) ?? 0,
    lote: parseText(body.lote),
    validade: parseText(body.validade),
    preco_custo: parseNumeric(body.precoCusto),
    preco_venda: parseNumeric(body.precoVenda),
    unidade_medida: parseText(body.unidadeMedida),
    status: resolveEstoqueStatus(quantidadeCreate, parseNumeric(body.estoqueMinimo) ?? 0),
    unidade_id: scopedUnitCreate.unidadeId ?? body.unidadeId ?? null,
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao cadastrar produto')
  }

  return listEstoque(request, session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'estoque', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id || !body?.produto || !body?.categoria) {
    return serverErrorResponse('Produto inválido', 'INVALID_STOCK_ITEM', 400)
  }

  const supabase = getAppSupabase()
  const scopedUnitUpdate = await getScopedUnitId(session)
  if (scopedUnitUpdate.error) {
    return supabaseErrorResponse(scopedUnitUpdate.error, 'Falha ao atualizar produto')
  }

  const quantidadeUpdate = Number(body.quantidade ?? 0)
  const estoqueMinimoUpdate = parseNumeric(body.estoqueMinimo) ?? 0

  const { error } = await supabase
    .from('produtos_estoque')
    .update({
      nome: body.produto,
      categoria: body.categoria,
      sku: parseText(body.sku),
      quantidade: quantidadeUpdate,
      estoque_minimo: estoqueMinimoUpdate,
      lote: parseText(body.lote),
      validade: parseText(body.validade),
      preco_custo: parseNumeric(body.precoCusto),
      preco_venda: parseNumeric(body.precoVenda),
      unidade_medida: parseText(body.unidadeMedida),
      status: resolveEstoqueStatus(quantidadeUpdate, estoqueMinimoUpdate),
      unidade_id: scopedUnitUpdate.unidadeId ?? body.unidadeId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar produto')
  }

  return listEstoque(request, session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'estoque', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Produto inválido', 'INVALID_STOCK_ITEM', 400)
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('produtos_estoque').delete().eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir produto')
  }

  return listEstoque(request, session)
}
