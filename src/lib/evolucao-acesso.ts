import type { NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { assertPacienteInUnitScope, authErrorResponse, getRequestAuth } from '@/lib/request-auth'

const UUID = /^[0-9a-f-]{36}$/i

type Sessao = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

/** Confere login, permissão em Evoluções e unidade do paciente; devolve a evolução ou a resposta de erro. */
export async function acessoEvolucao(
  request: NextRequest,
  evolucaoId: string,
  acao: 'read' | 'update',
) {
  const session = await getRequestAuth(request)
  if (!session) return { erro: authErrorResponse() }
  const denied = await requirePermission(session.userId, 'evolucoes', acao)
  if (denied) return { erro: denied }
  if (!UUID.test(evolucaoId))
    return { erro: serverErrorResponse('Evolução inválida', 'INVALID_ID', 400) }

  const supabase = getAppSupabase()
  const { data: evolucao } = await supabase
    .from('evolucoes')
    .select('id,paciente_id,data_evolucao,docs_count')
    .eq('id', evolucaoId)
    .maybeSingle()
  if (!evolucao) return { erro: serverErrorResponse('Evolução não encontrada', 'NOT_FOUND', 404) }
  const fora = await assertPacienteInUnitScope({
    session,
    pacienteId: String(evolucao.paciente_id),
  })
  if (fora) return { erro: fora }
  return { session: session as Sessao, supabase, evolucao }
}
