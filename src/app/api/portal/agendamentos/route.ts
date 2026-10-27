import { formatarMoeda } from '@/lib/moeda'
import { NextResponse, type NextRequest } from 'next/server'
import { buildOccupyUpdate, ocuparSlotDisponivel } from '@/app/api/agenda/agenda-slot'
import { getAppSupabase, getEntityNameMap, getPacienteIdByUserId, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { authErrorResponse, getRequestAuth, requirePatientRole } from '@/lib/request-auth'

function mapAppointmentStatus(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('confirm')) return 'Confirmada'
  if (normalized.includes('check-out') || normalized.includes('concl')) return 'Concluído'
  if (normalized.includes('cancel')) return 'Cancelado'
  return 'Agendado'
}

function toSortableTimestamp(date: string, time: string) {
  return new Date(`${date}T${time || '00:00:00'}`).getTime()
}

function formatAgendaDate(date: string, time: string) {
  const [year, month, day] = date.split('-')
  const formattedDate = year && month && day ? `${day}/${month}/${year}` : date
  return `${formattedDate} às ${String(time ?? '').slice(0, 5)}`
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = requirePatientRole(session)
  if (denied) return denied

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao carregar agenda')
  if (!pacienteId) return NextResponse.json({ data: [], meta: session })

  const { data, error } = await supabase
    .from('agendamentos')
    .select(
      'id,data_agendamento,horario_inicio,status,profissional_id,unidade_id,modalidade_atendimento,plataforma_online,url_online',
    )
    .eq('paciente_id', pacienteId)
    .order('data_agendamento', { ascending: true })

  if (error) return supabaseErrorResponse(error, 'Falha ao carregar agenda')

  const { map: profissionais } = await getEntityNameMap(
    supabase,
    'usuarios',
    (data ?? []).map((row) => String(row.profissional_id ?? '')),
  )
  const unidadeIds = Array.from(new Set((data ?? []).map((row) => String(row.unidade_id ?? '')).filter(Boolean)))
  const { data: unidadesData, error: unidadesError } =
    unidadeIds.length === 0
      ? { data: [], error: null }
      : await supabase.from('unidades').select('id,nome').in('id', unidadeIds)

  if (unidadesError) return supabaseErrorResponse(unidadesError, 'Falha ao carregar agenda')
  const unidades = (unidadesData ?? []).reduce<Record<string, string>>((acc, row) => {
    acc[String(row.id)] = String(row.nome ?? '')
    return acc
  }, {})

  const mapped = (data ?? []).map((row) => ({
      id: String(row.id ?? ''),
      medico: profissionais[String(row.profissional_id ?? '')] ?? 'Especialista',
      especialidade: 'Consulta',
      data: formatAgendaDate(String(row.data_agendamento ?? ''), String(row.horario_inicio ?? '')),
      local: unidades[String(row.unidade_id ?? '')] ?? 'Clínica',
      status: mapAppointmentStatus(String(row.status ?? 'Agendado')),
      modalidade: row.modalidade_atendimento ? String(row.modalidade_atendimento) : null,
      plataformaOnline: row.plataforma_online ? String(row.plataforma_online) : null,
      urlOnline: row.url_online ? String(row.url_online) : null,
      _sortDate: String(row.data_agendamento ?? ''),
      _sortTime: String(row.horario_inicio ?? ''),
    }))
    .sort((a, b) => {
      const aIsActive = a.status === 'Agendado' || a.status === 'Confirmada'
      const bIsActive = b.status === 'Agendado' || b.status === 'Confirmada'

      if (aIsActive !== bIsActive) {
        return aIsActive ? -1 : 1
      }

      const aTimestamp = toSortableTimestamp(a._sortDate, a._sortTime)
      const bTimestamp = toSortableTimestamp(b._sortDate, b._sortTime)

      if (aIsActive) {
        return aTimestamp - bTimestamp
      }

      return bTimestamp - aTimestamp
    })
    .map((item) => ({
      id: item.id,
      medico: item.medico,
      especialidade: item.especialidade,
      data: item.data,
      local: item.local,
      status: item.status,
      modalidade: item.modalidade,
      plataformaOnline: item.plataformaOnline,
      urlOnline: item.urlOnline,
    }))

  return NextResponse.json({
    data: mapped,
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = requirePatientRole(session)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const date = body?.date ?? body?.data
  const time = body?.time ?? body?.horario
  const specialistId = body?.specialistId ?? body?.profissional
  const procedureName = body?.procedureName
  const procedurePrice = Number(body?.procedurePrice ?? 0)

  if (!date || !time) {
    return serverErrorResponse('Agendamento inválido', 'INVALID_APPOINTMENT', 400)
  }

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao criar agendamento')
  if (!pacienteId) return serverErrorResponse('Paciente não encontrado', 'PATIENT_NOT_FOUND', 404)

  const { data: pacienteData, error: pacienteDataError } = await supabase
    .from('pacientes')
    .select('id,unidade_id')
    .eq('id', pacienteId)
    .maybeSingle()

  if (pacienteDataError) {
    return supabaseErrorResponse(pacienteDataError, 'Falha ao criar agendamento')
  }

  const profissionalId = specialistId ? String(specialistId) : ''
  if (!profissionalId) {
    return serverErrorResponse('Especialista obrigatório', 'SPECIALIST_REQUIRED', 400)
  }

  const occupyBody: Record<string, unknown> = {
    tipo: procedureName ? String(procedureName) : 'Consulta',
    observacoes: procedureName
      ? `${String(procedureName)}${procedurePrice > 0 ? ` • ${formatarMoeda(procedurePrice)}` : ''}`
      : null,
    valorProcedimento: procedurePrice > 0 ? procedurePrice : null,
    modalidade: 'Presencial',
  }

  const occupy = await ocuparSlotDisponivel(supabase, {
    profissionalId,
    data: String(date),
    horario: String(time),
    update: buildOccupyUpdate(occupyBody, pacienteId),
  })

  if (occupy.kind === 'occupied') {
    return NextResponse.json({ data: [{ id: occupy.id }], meta: session })
  }
  if (occupy.kind === 'error') {
    return supabaseErrorResponse(occupy.error, 'Falha ao criar agendamento')
  }

  // Sem slot Disponível: cria encaixe (não double-book paralelo).
  const { error } = await supabase.from('agendamentos').insert({
    unidade_id: pacienteData?.unidade_id ?? null,
    paciente_id: pacienteId,
    profissional_id: profissionalId,
    criado_por_id: session.userId,
    data_agendamento: date,
    horario_inicio: time,
    status: 'Agendado',
    fora_janela: true,
    motivo_encaixe: 'Portal do paciente — sem slot Disponível',
    observacoes: occupyBody.observacoes,
    valor_procedimento: occupyBody.valorProcedimento,
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao criar agendamento')
  }

  return NextResponse.json({ data: [], meta: session })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = requirePatientRole(session)
  if (denied) return denied

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return serverErrorResponse('Agendamento inválido', 'INVALID_APPOINTMENT', 400)
  }

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao cancelar agendamento')
  if (!pacienteId) return serverErrorResponse('Paciente não encontrado', 'PATIENT_NOT_FOUND', 404)

  const { data: current, error: currentError } = await supabase
    .from('agendamentos')
    .select('id,status')
    .eq('id', id)
    .eq('paciente_id', pacienteId)
    .maybeSingle()
  if (currentError) return supabaseErrorResponse(currentError, 'Falha ao cancelar agendamento')
  if (!current) return serverErrorResponse('Agendamento não encontrado', 'NOT_FOUND', 404)

  const status = String(current.status ?? '')
  if (['Check-out', 'Concluído', 'Cancelado', 'Disponível'].includes(status)) {
    return serverErrorResponse('Agendamento não pode ser cancelado', 'CANCEL_NOT_ALLOWED', 409)
  }

  const { error } = await supabase
    .from('agendamentos')
    .update({
      status: 'Disponível',
      paciente_id: null,
      tipo: null,
      valor_procedimento: null,
      procedimento_id: null,
      observacoes: 'Cancelado pelo paciente — horário liberado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('paciente_id', pacienteId)

  if (error) return supabaseErrorResponse(error, 'Falha ao cancelar agendamento')

  return NextResponse.json({ data: [], meta: session })
}

/** Reagenda: ocupa novo slot Disponível e libera o antigo. */
export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = requirePatientRole(session)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = body?.id ? String(body.id) : ''
  const date = body?.date ?? body?.data
  const time = body?.time ?? body?.horario
  if (!id || !date || !time) {
    return serverErrorResponse('Reagendamento inválido', 'INVALID_RESCHEDULE', 400)
  }

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao reagendar')
  if (!pacienteId) return serverErrorResponse('Paciente não encontrado', 'PATIENT_NOT_FOUND', 404)

  const { data: current, error: currentError } = await supabase
    .from('agendamentos')
    .select(
      'id,status,profissional_id,tipo,observacoes,valor_procedimento,procedimento_id,modalidade_atendimento,plataforma_online,url_online',
    )
    .eq('id', id)
    .eq('paciente_id', pacienteId)
    .maybeSingle()

  if (currentError) return supabaseErrorResponse(currentError, 'Falha ao reagendar')
  if (!current) return serverErrorResponse('Agendamento não encontrado', 'NOT_FOUND', 404)

  const status = String(current.status ?? '')
  if (!/^(Agendado|Confirmado|Confirmada)$/i.test(status)) {
    return serverErrorResponse('Agendamento não pode ser reagendado', 'RESCHEDULE_NOT_ALLOWED', 409)
  }

  const profissionalId = current.profissional_id ? String(current.profissional_id) : ''
  if (!profissionalId) {
    return serverErrorResponse('Agendamento sem profissional', 'SPECIALIST_REQUIRED', 400)
  }

  const occupyBody: Record<string, unknown> = {
    tipo: current.tipo ?? 'Consulta',
    observacoes: current.observacoes
      ? `${String(current.observacoes)} • Reagendado pelo paciente`
      : 'Reagendado pelo paciente',
    valorProcedimento: current.valor_procedimento,
    procedimentoId: current.procedimento_id,
    modalidade: current.modalidade_atendimento ?? 'Presencial',
    plataformaOnline: current.plataforma_online,
    urlOnline: current.url_online,
  }

  const occupy = await ocuparSlotDisponivel(supabase, {
    profissionalId,
    data: String(date),
    horario: String(time),
    update: buildOccupyUpdate(occupyBody, pacienteId),
  })

  if (occupy.kind === 'error') {
    return supabaseErrorResponse(occupy.error, 'Falha ao reagendar')
  }
  if (occupy.kind === 'indisponivel') {
    return serverErrorResponse(
      'Horário indisponível para reagendamento',
      'SLOT_UNAVAILABLE',
      409,
    )
  }

  // Libera o slot antigo (não o novo).
  const { error: liberarError } = await supabase
    .from('agendamentos')
    .update({
      status: 'Disponível',
      paciente_id: null,
      tipo: null,
      valor_procedimento: null,
      procedimento_id: null,
      observacoes: 'Liberado após reagendamento pelo paciente',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('paciente_id', pacienteId)

  if (liberarError) {
    return supabaseErrorResponse(liberarError, 'Novo horário ocupado, mas falha ao liberar o anterior')
  }

  return NextResponse.json({ data: [{ id: occupy.id }], meta: session })
}
