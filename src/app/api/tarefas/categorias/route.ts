import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import { categoriaNomeErro, normalizeCategoriaNome } from '@/lib/tarefa-categorias'

type Supabase = ReturnType<typeof getAppSupabase>

async function listarAtivas(supabase: Supabase) {
  const { data, error } = await supabase
    .from('tarefa_categorias')
    .select('id,nome')
    .eq('ativa', true)
    .order('nome', { ascending: true })
  return { error, data: (data ?? []).map((row) => ({ id: String(row.id), nome: String(row.nome) })) }
}

async function responderLista(supabase: Supabase) {
  const { data, error } = await listarAtivas(supabase)
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar categorias')
  return NextResponse.json({ data, meta: {} })
}

async function autorizar(request: NextRequest, action: 'read' | 'create' | 'update') {
  const session = await getRequestAuth(request)
  if (!session) return { response: authErrorResponse() }
  const denied = await requirePermission(session.userId, 'tarefas', action)
  return { response: denied }
}

/** Categoria (ativa ou não) com o mesmo nome, ignorando maiúsculas; `exceptId` ignora a própria. */
async function acharPorNome(supabase: Supabase, nome: string, exceptId?: string) {
  const { data } = await supabase
    .from('tarefa_categorias')
    .select('id,nome,ativa')
    .ilike('nome', nome.replace(/[\\%_]/g, '\\$&'))
  return (data ?? []).find((row) => String(row.id) !== exceptId) ?? null
}

export async function GET(request: NextRequest) {
  const { response } = await autorizar(request, 'read')
  if (response) return response
  return responderLista(getAppSupabase())
}

export async function POST(request: NextRequest) {
  const { response } = await autorizar(request, 'update')
  if (response) return response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const nome = normalizeCategoriaNome(body?.nome)
  const invalido = categoriaNomeErro(nome)
  if (invalido) return serverErrorResponse(invalido, 'INVALID_CATEGORY_INPUT', 400)

  const supabase = getAppSupabase()
  const existente = await acharPorNome(supabase, nome)
  if (existente?.ativa) return serverErrorResponse('Já existe uma categoria com esse nome.', 'CATEGORY_EXISTS', 409)
  const { error } = existente
    ? await supabase.from('tarefa_categorias').update({ nome, ativa: true, updated_at: new Date().toISOString() }).eq('id', existente.id)
    : await supabase.from('tarefa_categorias').insert({ nome })
  if (error) return supabaseErrorResponse(error, 'Falha ao criar categoria')
  return responderLista(supabase)
}

export async function PUT(request: NextRequest) {
  const { response } = await autorizar(request, 'update')
  if (response) return response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = String(body?.id ?? '')
  const nome = normalizeCategoriaNome(body?.nome)
  const invalido = id ? categoriaNomeErro(nome) : 'Categoria inválida.'
  if (invalido) return serverErrorResponse(invalido, 'INVALID_CATEGORY_INPUT', 400)

  const supabase = getAppSupabase()
  const { data: atual } = await supabase.from('tarefa_categorias').select('id,nome').eq('id', id).eq('ativa', true).maybeSingle()
  if (!atual) return serverErrorResponse('Categoria não encontrada.', 'CATEGORY_NOT_FOUND', 404)
  if (await acharPorNome(supabase, nome, id)) {
    return serverErrorResponse('Já existe uma categoria com esse nome.', 'CATEGORY_EXISTS', 409)
  }
  const { error } = await supabase.from('tarefa_categorias').update({ nome, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return supabaseErrorResponse(error, 'Falha ao editar categoria')
  // Tarefas guardam o nome: acompanham a renomeação.
  if (atual.nome !== nome) {
    const { error: tarefasError } = await supabase.from('tarefas').update({ categoria: nome }).eq('categoria', atual.nome)
    if (tarefasError) return supabaseErrorResponse(tarefasError, 'Categoria editada, mas falhou ao atualizar as tarefas')
  }
  return responderLista(supabase)
}

/** "Remover" = desativar: as tarefas que usam a categoria continuam com o valor. */
export async function DELETE(request: NextRequest) {
  const { response } = await autorizar(request, 'update')
  if (response) return response
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = String(body?.id ?? '')
  if (!id) return serverErrorResponse('Categoria inválida.', 'INVALID_CATEGORY_INPUT', 400)

  const supabase = getAppSupabase()
  const { error } = await supabase
    .from('tarefa_categorias')
    .update({ ativa: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return supabaseErrorResponse(error, 'Falha ao remover categoria')
  return responderLista(supabase)
}
