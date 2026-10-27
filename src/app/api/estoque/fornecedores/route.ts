import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
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
