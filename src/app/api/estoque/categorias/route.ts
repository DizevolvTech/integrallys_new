import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

interface CategoriaRow {
  id: string
  unidade_id: string | null
  nome: string
  ativo: boolean
  created_at: string
  updated_at: string
}

function mapCategoria(row: CategoriaRow) {
  return {
    id: row.id,
    unidadeId: row.unidade_id,
    nome: row.nome,
    ativo: Boolean(row.ativo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar categorias')

  let query = supabase
    .from('estoque_categorias')
    .select('id,unidade_id,nome,ativo,created_at,updated_at')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (scoped.unidadeId) {
    query = query.eq('unidade_id', scoped.unidadeId)
  }

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar categorias')

  return NextResponse.json({
    data: (data ?? []).map((row) => mapCategoria(row as CategoriaRow)),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as { nome?: string } | null
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  if (!nome) return serverErrorResponse('Nome da categoria é obrigatório', 'INVALID_CATEGORIA', 400)

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao criar categoria')

  const { data, error } = await supabase
    .from('estoque_categorias')
    .insert({
      nome,
      unidade_id: scoped.unidadeId ?? null,
      ativo: true,
    })
    .select('id,unidade_id,nome,ativo,created_at,updated_at')
    .single()

  if (error) return supabaseErrorResponse(error, 'Falha ao criar categoria')

  return NextResponse.json({ data: mapCategoria(data as CategoriaRow), meta: session }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as {
    id?: string
    nome?: string
    ativo?: boolean
  } | null
  if (!body?.id) return serverErrorResponse('ID inválido', 'INVALID_CATEGORIA', 400)
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  if (!nome) return serverErrorResponse('Nome da categoria é obrigatório', 'INVALID_CATEGORIA', 400)

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao atualizar categoria')

  let updateQuery = supabase
    .from('estoque_categorias')
    .update({
      nome,
      ativo: body.ativo !== false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
  if (scoped.unidadeId) {
    updateQuery = updateQuery.eq('unidade_id', scoped.unidadeId)
  }

  const { data, error } = await updateQuery
    .select('id,unidade_id,nome,ativo,created_at,updated_at')
    .maybeSingle()

  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar categoria')
  if (!data) return serverErrorResponse('Categoria não encontrada', 'NOT_FOUND', 404)

  return NextResponse.json({ data: mapCategoria(data as CategoriaRow), meta: session })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as { id?: string } | null
  if (!body?.id) return serverErrorResponse('ID inválido', 'INVALID_CATEGORIA', 400)

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao remover categoria')

  // Soft-delete para não quebrar produtos que ainda usam o nome.
  let delQuery = supabase
    .from('estoque_categorias')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', body.id)
  if (scoped.unidadeId) {
    delQuery = delQuery.eq('unidade_id', scoped.unidadeId)
  }
  const { data, error } = await delQuery.select('id').maybeSingle()

  if (error) return supabaseErrorResponse(error, 'Falha ao remover categoria')
  if (!data) return serverErrorResponse('Categoria não encontrada', 'NOT_FOUND', 404)

  return NextResponse.json({ data: { id: body.id }, meta: session })
}
