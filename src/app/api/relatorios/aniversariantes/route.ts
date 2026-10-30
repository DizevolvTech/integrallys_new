import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { executarRelatorio } from '@/lib/relatorios/executar'
import { ehUuid } from '@/lib/relatorios/filtros'
import { perfilPodeVerRelatorio } from '@/lib/relatorios/registry'
import { anoValidoParaMarcar } from '@/lib/aniversario-envio'
import { assertPacienteInUnitScope, authErrorResponse, getRequestAuth } from '@/lib/request-auth'

export async function GET(request: NextRequest) {
  return executarRelatorio(request, 'aniversariantes')
}

/** Marca/desmarca o "ok, mensagem enviada" do aniversário do paciente no ano informado. */
export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  if (!perfilPodeVerRelatorio(session.role, 'aniversariantes')) {
    return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  }
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as {
    pacienteId?: unknown
    ano?: unknown
    enviado?: unknown
  } | null
  const pacienteId = typeof body?.pacienteId === 'string' ? body.pacienteId : ''
  const ano = Number(body?.ano)
  if (!ehUuid(pacienteId) || !anoValidoParaMarcar(ano) || typeof body?.enviado !== 'boolean') {
    return serverErrorResponse('Dados inválidos para marcar a mensagem', 'INVALID_PAYLOAD', 400)
  }

  const escopo = await assertPacienteInUnitScope({ session, pacienteId })
  if (escopo) return escopo

  const supabase = getAppSupabase()
  const { error } = body.enviado
    ? await supabase
        .from('aniversario_mensagens')
        .upsert(
          { paciente_id: pacienteId, ano, enviado_por: session.userId, enviado_em: new Date().toISOString() },
          { onConflict: 'paciente_id,ano' },
        )
    : await supabase.from('aniversario_mensagens').delete().eq('paciente_id', pacienteId).eq('ano', ano)
  if (error) return supabaseErrorResponse(error, 'Falha ao gravar o envio da mensagem')

  return NextResponse.json({ data: { pacienteId, ano, enviado: body.enviado } })
}
