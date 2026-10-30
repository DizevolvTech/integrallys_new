import { NextResponse, type NextRequest } from 'next/server'
import { fornecedorInsertRow, validateFornecedorInput } from '@/app/api/fornecedores/fornecedor-input'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

/**
 * GET /api/estoque/fornecedores — lista mínima (id e nome) para escolher o fornecedor na entrada de estoque.
 * Quem lança entrada nem sempre pode abrir o cadastro de fornecedores; aqui só sai o necessário.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'create')
  if (denied) return denied

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('pacientes')
    .select('id,nome')
    .contains('vinculo_tipos', ['fornecedor'])
    .neq('status', 'Inativo')
    .order('nome', { ascending: true })
    .limit(500)
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar fornecedores')
  return NextResponse.json({ data: (data ?? []).map((f) => ({ id: String(f.id), nome: String(f.nome ?? '') })) })
}

/**
 * POST /api/estoque/fornecedores — cadastro rápido de fornecedor a partir da entrada de estoque.
 * Quem pode dar entrada (recepção) pode cadastrar o fornecedor ali mesmo, mesmo sem abrir a tela de fornecedores.
 */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)
  const validated = validateFornecedorInput(body)
  if (!validated.ok) return serverErrorResponse(validated.error, validated.code, 400)

  const { data, error } = await getAppSupabase()
    .from('pacientes')
    .insert(fornecedorInsertRow(validated.value))
    .select('id,nome')
    .single()
  if (error) return supabaseErrorResponse(error, 'Falha ao criar fornecedor')
  return NextResponse.json({ data: { id: String(data.id), nome: String(data.nome ?? '') } }, { status: 201 })
}
