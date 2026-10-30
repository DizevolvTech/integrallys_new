import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const ROTULO_PERFIL: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  recepcao: 'Recepção',
  especialista: 'Especialista',
}

/** Usuários que podem participar de um compromisso: ativos, não pacientes, da unidade de quem consulta. */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'create')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar participantes')

  let query = getAppSupabase()
    .from('usuarios')
    .select('id,nome,perfil,unidade_id')
    .eq('status', 'Ativo')
    .neq('perfil', 'paciente')
    .order('nome', { ascending: true })
    .limit(500)
  if (scoped.unidadeId) query = query.or(`unidade_id.eq.${scoped.unidadeId},unidade_id.is.null`)

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar participantes')

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      nome: String(row.nome ?? ''),
      perfil: String(row.perfil),
      perfilRotulo: ROTULO_PERFIL[String(row.perfil)] ?? String(row.perfil),
    })),
  })
}
