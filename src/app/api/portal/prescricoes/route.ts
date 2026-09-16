import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, getPacienteIdByUserId, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { authErrorResponse, getRequestAuth, requirePatientRole } from '@/lib/request-auth'

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = requirePatientRole(session)
  if (denied) return denied

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao carregar prescrições')
  if (!pacienteId) return NextResponse.json({ data: [], meta: session })

  const { data, error } = await supabase
    .from('prescricoes')
    .select('id,profissional_id,data_prescricao,tipo,validade,status')
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })

  if (error) return supabaseErrorResponse(error, 'Falha ao carregar prescrições')

  const { map: profissionais, error: profissionaisError } = await getEntityNameMap(
    supabase,
    'usuarios',
    (data ?? []).map((row) => String(row.profissional_id ?? '')),
  )

  if (profissionaisError) return supabaseErrorResponse(profissionaisError, 'Falha ao carregar prescrições')

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      id: String(row.id ?? ''),
      profissional: profissionais[String(row.profissional_id ?? '')] ?? 'Especialista',
      data: formatDate(String(row.data_prescricao ?? '')),
      tipo: row.tipo ? String(row.tipo) : 'Prescrição',
      validade: formatDate(String(row.validade ?? '')),
      status: (() => {
        const s = String(row.status ?? 'Pendente')
        if (s === 'Pendente') return 'Pendente'
        if (/cancel|vencid|expir/i.test(s)) return 'Expirado'
        return 'Ativo'
      })(),
    })),
    meta: session,
  })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = requirePatientRole(session)
  if (denied) return denied

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return serverErrorResponse('Prescrição inválida', 'INVALID_PRESCRIPTION', 400)

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao excluir prescrição')
  if (!pacienteId) return serverErrorResponse('Paciente não encontrado', 'PATIENT_NOT_FOUND', 404)

  const current = await supabase
    .from('prescricoes')
    .select('status')
    .eq('id', id)
    .eq('paciente_id', pacienteId)
    .maybeSingle()

  if (current.error) return supabaseErrorResponse(current.error, 'Falha ao excluir prescrição')
  if (!current.data) return serverErrorResponse('Prescrição não encontrada', 'PRESCRIPTION_NOT_FOUND', 404)

  const status = String(current.data.status ?? '')
  if (status !== 'Rascunho' && status !== 'Pendente') {
    return serverErrorResponse(
      'Somente rascunhos/pendentes podem ser excluídos pelo portal',
      'PRESCRIPTION_IMMUTABLE',
      409,
    )
  }

  const { error } = await supabase.from('prescricoes').delete().eq('id', id).eq('paciente_id', pacienteId)
  if (error) return supabaseErrorResponse(error, 'Falha ao excluir prescrição')

  return NextResponse.json({ data: [], meta: session })
}
