import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import { fornecedorInsertRow, mapFornecedorRow, validateFornecedorInput } from './fornecedor-input'

const SELECT_COLS = 'id,nome,telefone,email,status,unidade_id,fornecedor_dados'

async function listFornecedores(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('pacientes')
    .select(SELECT_COLS)
    .contains('vinculo_tipos', ['fornecedor'])
    .order('nome', { ascending: true })

  if (error) return supabaseErrorResponse(error, 'Falha ao carregar fornecedores')

  return NextResponse.json({
    data: (data ?? []).map((row) => mapFornecedorRow(row as Record<string, unknown>)),
    meta: session,
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'fornecedores', 'read')
  if (denied) return denied

  return listFornecedores(session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'fornecedores', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)

  const validated = validateFornecedorInput(body)
  if (!validated.ok) return serverErrorResponse(validated.error, validated.code, 400)
  const f = validated.value

  const supabase = getAppSupabase()
  // Fornecedor é clínica-wide (espelha Profissionais/079): sem unidade. Leitura,
  // edição e exclusão também são globais — modelo coerente para um cadastro de
  // fornecedores compartilhado entre as unidades.
  const { error } = await supabase.from('pacientes').insert(fornecedorInsertRow(f))

  if (error) return supabaseErrorResponse(error, 'Falha ao criar fornecedor')

  return listFornecedores(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'fornecedores', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!id) return serverErrorResponse('Fornecedor não informado', 'FORNECEDOR_ID_REQUIRED', 400)

  const validated = validateFornecedorInput(body ?? {})
  if (!validated.ok) return serverErrorResponse(validated.error, validated.code, 400)
  const f = validated.value

  const supabase = getAppSupabase()
  // Escopo por vinculo_tipos.contains('fornecedor'): este endpoint não edita clientes. O
  // .select('id') confirma que algo foi alterado — id de não-fornecedor → 404
  // (em vez de 200 silencioso).
  const { data: updated, error } = await supabase
    .from('pacientes')
    .update({
      nome: f.nome,
      telefone: f.telefone,
      email: f.email,
      status: f.status,
      fornecedor_dados: f.fornecedorDados,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .contains('vinculo_tipos', ['fornecedor'])
    .select('id')

  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar fornecedor')
  if (!updated || updated.length === 0) {
    return serverErrorResponse('Fornecedor não encontrado', 'FORNECEDOR_NOT_FOUND', 404)
  }

  return listFornecedores(session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'fornecedores', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!id) return serverErrorResponse('Fornecedor não informado', 'FORNECEDOR_ID_REQUIRED', 400)

  const supabase = getAppSupabase()
  // Soft-delete (status Inativo) — não apaga a linha de pacientes. Escopo a
  // vinculo_tipos contém 'fornecedor'; id de não-fornecedor → 404 (sem 200 silencioso).
  const { data: deleted, error } = await supabase
    .from('pacientes')
    .update({ status: 'Inativo', updated_at: new Date().toISOString() })
    .eq('id', id)
    .contains('vinculo_tipos', ['fornecedor'])
    .select('id')

  if (error) return supabaseErrorResponse(error, 'Falha ao excluir fornecedor')
  if (!deleted || deleted.length === 0) {
    return serverErrorResponse('Fornecedor não encontrado', 'FORNECEDOR_NOT_FOUND', 404)
  }

  return listFornecedores(session)
}
