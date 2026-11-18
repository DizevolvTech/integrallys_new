import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { assertPacienteInUnitScope, authErrorResponse, getRequestAuth } from '@/lib/request-auth'

const PERFIS_QUE_ATENDEM = ['especialista', 'gestor', 'admin', 'master']
const RECURSOS_GRAVADOS = ['anamnese', 'prontuarios', 'evolucoes', 'prescricoes']

/**
 * POST /api/atendimento/finalizar
 * Grava anamnese, prontuário, evolução, prescrição (+ itens) e documentos do atendimento numa transação
 * (função SQL atendimento_finalizar). Idempotente por agendamento: reenviar devolve os mesmos registros.
 */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  if (!PERFIS_QUE_ATENDEM.includes(session.role)) {
    return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  }
  for (const recurso of RECURSOS_GRAVADOS) {
    const denied = await requirePermission(session.userId, recurso, 'create')
    if (denied) return denied
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const agendamentoId = typeof body?.agendamentoId === 'string' ? body.agendamentoId : ''
  if (!agendamentoId || !body?.anamnese || typeof body.anamnese !== 'object') {
    return serverErrorResponse('Atendimento inválido', 'INVALID_ATENDIMENTO', 400)
  }

  const supabase = getAppSupabase()
  const { data: agendamento, error: agendamentoError } = await supabase
    .from('agendamentos')
    .select('id,paciente_id,profissional_id')
    .eq('id', agendamentoId)
    .maybeSingle()
  if (agendamentoError) return supabaseErrorResponse(agendamentoError, 'Falha ao carregar agendamento')
  if (!agendamento?.paciente_id) {
    return serverErrorResponse('Agendamento não encontrado', 'AGENDAMENTO_NOT_FOUND', 404)
  }
  if (session.role === 'especialista' && agendamento.profissional_id && String(agendamento.profissional_id) !== session.userId) {
    return serverErrorResponse('Este agendamento é de outro profissional', 'AGENDAMENTO_OUTRO_PROFISSIONAL', 403)
  }

  const scopeDenied = await assertPacienteInUnitScope({ session, pacienteId: String(agendamento.paciente_id) })
  if (scopeDenied) return scopeDenied

  const { data, error } = await supabase.rpc('atendimento_finalizar', {
    p_agendamento_id: agendamentoId,
    p_profissional_id: session.userId,
    p_payload: {
      anamnese: body.anamnese,
      evolucao: body.evolucao ?? '',
      prontuario: body.prontuario ?? {},
      prescricao: body.prescricao ?? {},
      documentos: Array.isArray(body.documentos) ? body.documentos : [],
    },
  })
  if (error) return supabaseErrorResponse(error, 'Falha ao gravar o atendimento')

  const resultado = data as { ok?: boolean; code?: string; message?: string } | null
  if (!resultado?.ok) {
    return serverErrorResponse(resultado?.message ?? 'Falha ao gravar o atendimento', resultado?.code ?? 'ATENDIMENTO_FALHOU', 400)
  }
  return NextResponse.json({ data: resultado, meta: session })
}
