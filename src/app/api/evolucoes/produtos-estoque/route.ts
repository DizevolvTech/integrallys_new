import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const LIMITE = 30

/** Produtos do Estoque para escolher em Evoluções: busca por nome/categoria no servidor, no máximo 30, sem preços. */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'evolucoes', 'update')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar produtos')

  // Sem vírgula, parênteses, % e _ para não quebrar o filtro .or do PostgREST.
  const termo = (new URL(request.url).searchParams.get('q') ?? '')
    .replace(/[,()%_*\\]/g, ' ')
    .trim()
    .slice(0, 60)
  let query = getAppSupabase()
    .from('produtos_estoque')
    .select('id,nome,categoria')
    .order('nome', { ascending: true })
    .limit(LIMITE)
  if (scoped.unidadeId) query = query.eq('unidade_id', scoped.unidadeId)
  if (termo) query = query.or(`nome.ilike.%${termo}%,categoria.ilike.%${termo}%`)

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar produtos')
  return NextResponse.json({
    data: (data ?? []).map((p) => ({
      id: String(p.id),
      nome: String(p.nome),
      categoria: String(p.categoria ?? ''),
    })),
    limite: LIMITE,
  })
}
