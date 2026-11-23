import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/**
 * GET /api/documentos/profissionais
 * Especialistas ativos da unidade (id e nome), para campos de documento como
 * "Profissional recomendado" do Encaminhamento (vídeo 23/11). Só nome: sem dado pessoal.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  const unidadeId = scoped.error ? null : scoped.unidadeId
  if (!unidadeId) return serverErrorResponse('Usuário sem unidade vinculada', 'NO_UNIT', 400)

  const { data, error } = await getAppSupabase()
    .from('usuarios')
    .select('id,nome')
    .eq('perfil', 'especialista')
    .eq('status', 'Ativo')
    .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`)
    .order('nome', { ascending: true })
    .limit(300)
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar profissionais')

  return NextResponse.json({
    data: (data ?? [])
      .map((row) => ({ id: String(row.id), nome: String(row.nome ?? '') }))
      .filter((p) => p.nome),
  })
}
