import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { estoqueRpcHttpStatus } from '@/lib/estoque-movimentacao'
import { isFinanciallyRestrictedRole } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { mapSuprimento, suprimentoAplicarMovimentacao, SUPRIMENTO_COLUNAS } from '@/lib/suprimentos'

type Session = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const texto = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const numero = (v: unknown) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function listar(request: NextRequest, session: Session) {
  const supabase = getAppSupabase()
  const escopo = await getScopedUnitId(session)
  if (escopo.error) return supabaseErrorResponse(escopo.error, 'Falha ao carregar suprimentos')
  let query = supabase.from('suprimentos').select(SUPRIMENTO_COLUNAS).eq('ativo', true).order('nome', { ascending: true })
  if (escopo.unidadeId) query = query.eq('unidade_id', escopo.unidadeId)
  else if (['master', 'admin'].includes(session.role)) {
    const filtro = new URL(request.url).searchParams.get('unidade_id')
    if (filtro?.trim()) query = query.eq('unidade_id', filtro.trim())
  }
  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar suprimentos')
  const restrito = isFinanciallyRestrictedRole(session.role)
  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const item = mapSuprimento(row)
      return restrito ? { ...item, precoCusto: undefined } : item
    }),
    meta: session,
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'read')
  if (denied) return denied
  return listar(request, session)
}

function camposCadastro(body: Record<string, unknown>) {
  const validade = texto(body.validade, 10)
  if (validade && !DATA_ISO.test(validade)) return { error: 'Validade inválida' }
  const custo = numero(body.precoCusto)
  if (custo != null && (custo < 0 || custo > 9_999_999)) return { error: 'Preço de custo inválido' }
  const minimo = numero(body.estoqueMinimo) ?? 0
  if (minimo < 0 || !Number.isInteger(minimo)) return { error: 'Estoque mínimo inválido' }
  return {
    campos: {
      categoria: texto(body.categoria) ?? 'Suprimento',
      sku: texto(body.sku, 60),
      estoque_minimo: minimo,
      lote: texto(body.lote, 60),
      validade,
      preco_custo: custo != null ? Math.round(custo * 100) / 100 : null,
      unidade_medida: texto(body.unidadeMedida, 20),
    },
  }
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Requisição inválida', 'INVALID_BODY', 400)
  const supabase = getAppSupabase()
  const action = texto(body.action, 20)

  if (action === 'entrada' || action === 'saida' || action === 'ajuste') {
    const suprimentoId = texto(body.suprimentoId, 40)
    if (!suprimentoId) return serverErrorResponse('Suprimento inválido', 'INVALID_SUPRIMENTO', 400)
    const quantidade = Number(body.quantidade)
    const motivo = texto(body.motivo, 300)
    if (!Number.isInteger(quantidade) || quantidade < (action === 'ajuste' ? 0 : 1)) {
      return serverErrorResponse('Quantidade inválida', 'INVALID_QUANTITY', 400)
    }
    if ((action === 'saida' || action === 'ajuste') && (motivo?.length ?? 0) < 5) {
      return serverErrorResponse('Informe a justificativa (mín. 5 caracteres)', 'JUSTIFICATIVA_REQUIRED', 400)
    }
    const validade = texto(body.validade, 10)
    if (validade && !DATA_ISO.test(validade)) return serverErrorResponse('Validade inválida', 'INVALID_VALIDADE', 400)
    const custo = numero(body.precoCusto)
    if (custo != null && custo < 0) return serverErrorResponse('Preço de custo inválido', 'INVALID_CUSTO', 400)

    const result = await suprimentoAplicarMovimentacao(supabase, {
      suprimentoId,
      usuarioId: session.userId,
      tipo: action === 'ajuste' ? undefined : action,
      quantidade: action === 'ajuste' ? 0 : quantidade,
      quantidadeAlvo: action === 'ajuste' ? quantidade : null,
      motivo,
      lote: action === 'entrada' ? texto(body.lote, 60) : null,
      validade: action === 'entrada' ? validade : null,
      precoCusto: action === 'entrada' ? custo : null,
    })
    if (!result.ok) return serverErrorResponse(result.message, result.code, estoqueRpcHttpStatus(result.code))
    return listar(request, session)
  }

  const nome = texto(body.nome)
  if (!nome) return serverErrorResponse('Informe o nome do suprimento', 'INVALID_SUPRIMENTO', 400)
  const cadastro = camposCadastro(body)
  if ('error' in cadastro) return serverErrorResponse(cadastro.error as string, 'INVALID_SUPRIMENTO', 400)
  const escopo = await getScopedUnitId(session)
  if (escopo.error) return supabaseErrorResponse(escopo.error, 'Falha ao cadastrar suprimento')
  const quantidade = numero(body.quantidade) ?? 0
  if (!Number.isInteger(quantidade) || quantidade < 0) return serverErrorResponse('Quantidade inválida', 'INVALID_QUANTITY', 400)

  const { data: criado, error } = await supabase
    .from('suprimentos')
    .insert({
      nome,
      ...cadastro.campos,
      quantidade,
      status: quantidade <= 0 ? 'Indisponível' : 'Disponível',
      unidade_id: escopo.unidadeId ?? texto(body.unidadeId, 40),
    })
    .select('id')
    .single()
  if (error?.code === '23505') return serverErrorResponse('Já existe um suprimento com este nome', 'SUPRIMENTO_DUPLICADO', 409)
  if (error || !criado) return supabaseErrorResponse(error ?? { message: 'Falha' }, 'Falha ao cadastrar suprimento')
  if (quantidade > 0) {
    // Saldo inicial entra no livro de movimentações (o relatório fecha com o saldo).
    await supabase.from('suprimentos_movimentacoes').insert({
      suprimento_id: criado.id,
      usuario_id: session.userId,
      tipo: 'entrada',
      origem: 'manual',
      quantidade,
      saldo_apos: quantidade,
      motivo: 'Saldo inicial do cadastro',
      lote: cadastro.campos.lote,
      validade: cadastro.campos.validade,
      preco_custo: cadastro.campos.preco_custo,
    })
  }
  return listar(request, session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = texto(body?.id, 40)
  const nome = texto(body?.nome)
  if (!body || !id || !nome) return serverErrorResponse('Suprimento inválido', 'INVALID_SUPRIMENTO', 400)
  const cadastro = camposCadastro(body)
  if ('error' in cadastro) return serverErrorResponse(cadastro.error as string, 'INVALID_SUPRIMENTO', 400)

  const supabase = getAppSupabase()
  const { error } = await supabase
    .from('suprimentos')
    .update({ nome, ...cadastro.campos, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error?.code === '23505') return serverErrorResponse('Já existe um suprimento com este nome', 'SUPRIMENTO_DUPLICADO', 409)
  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar suprimento')
  return listar(request, session)
}

/** Exclusão lógica: o histórico de movimentações continua no relatório. */
export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'delete')
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { id?: string } | null
  if (!body?.id) return serverErrorResponse('Suprimento inválido', 'INVALID_SUPRIMENTO', 400)
  const supabase = getAppSupabase()
  const { error } = await supabase.from('suprimentos').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', body.id)
  if (error) return supabaseErrorResponse(error, 'Falha ao excluir suprimento')
  return listar(request, session)
}
