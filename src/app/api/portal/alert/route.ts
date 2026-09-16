import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, forbidPatientRole, getRequestAuth } from '@/lib/request-auth'

const ALERT_TITLE_KEY = 'clinic_patient_alert_title'
const ALERT_MESSAGE_KEY = 'clinic_patient_alert_message'
const ALERT_CATEGORY = 'portal_paciente'
const DEFAULT_ALERT_TITLE = 'Importante: Retornos com Desconto'
const DEFAULT_ALERT_MESSAGE =
  'Retornos de Bioressonancia Quantica tem 50% de desconto se agendados dentro de 35 dias corridos apos a ultima consulta. Apos esse prazo, o valor sera integral.'

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave,valor')
    .in('chave', [ALERT_TITLE_KEY, ALERT_MESSAGE_KEY])

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar mensagem do portal')
  }

  const byKey = new Map((data ?? []).map((item) => [String(item.chave), String(item.valor ?? '')]))

  return NextResponse.json({
    data: {
      title: byKey.get(ALERT_TITLE_KEY) ?? DEFAULT_ALERT_TITLE,
      message: byKey.get(ALERT_MESSAGE_KEY) ?? DEFAULT_ALERT_MESSAGE,
    },
    meta: session,
  })
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'configuracoes', 'update')
  if (denied) return denied
  const patientDenied = forbidPatientRole(session)
  if (patientDenied) return patientDenied

  const body = (await request.json().catch(() => null)) as { title?: string; message?: string } | null
  if (!body || typeof body.title !== 'string' || typeof body.message !== 'string') {
    return serverErrorResponse('Conteúdo inválido', 'INVALID_ALERT_CONFIG', 400)
  }

  const supabase = getAppSupabase()
  const payload = [
    { chave: ALERT_TITLE_KEY, valor: body.title, categoria: ALERT_CATEGORY },
    { chave: ALERT_MESSAGE_KEY, valor: body.message, categoria: ALERT_CATEGORY },
  ]

  for (const item of payload) {
    const { data: existing, error: existingError } = await supabase
      .from('configuracoes')
      .select('id')
      .eq('chave', item.chave)
      .maybeSingle()

    if (existingError) {
      return supabaseErrorResponse(existingError, 'Falha ao salvar mensagem do portal')
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('configuracoes')
        .update({ valor: item.valor, categoria: item.categoria })
        .eq('id', existing.id)

      if (updateError) {
        return supabaseErrorResponse(updateError, 'Falha ao salvar mensagem do portal')
      }
    } else {
      const { error: insertError } = await supabase.from('configuracoes').insert(item)
      if (insertError) {
        return supabaseErrorResponse(insertError, 'Falha ao salvar mensagem do portal')
      }
    }
  }

  return NextResponse.json({
    data: {
      title: body.title,
      message: body.message,
    },
    meta: session,
  })
}
