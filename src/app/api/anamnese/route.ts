import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapAnamneseItem } from '@/lib/domain-mappers'
import { authErrorResponse, assertPacienteInUnitScope, getRequestAuth } from '@/lib/request-auth'

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'anamnese', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('anamneses')
    .select('id,paciente_id,data_anamnese,tipo,queixa,imc,peso,gordura,altura,massa_muscular,gordura_visceral,massa_ossea,agua_corporal,campos_extras')
    .order('data_anamnese', { ascending: false })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar anamnese')
  }

  const { map, error: pacienteError } = await getEntityNameMap(
    supabase,
    'pacientes',
    (data ?? []).map((row) => String(row.paciente_id ?? '')),
  )

  if (pacienteError) {
    return supabaseErrorResponse(pacienteError, 'Falha ao carregar anamnese')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => mapAnamneseItem({ ...row, paciente_nome: map[String(row.paciente_id ?? '')] ?? '' })),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'anamnese', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const pacienteId = body?.pacienteId ?? body?.paciente
  if (!pacienteId || !body?.data || !body?.tipo || !body?.queixa) {
    return serverErrorResponse('Anamnese inválida', 'INVALID_ANAMNESE', 400)
  }

  const scopeDenied = await assertPacienteInUnitScope({
    session,
    pacienteId: String(pacienteId),
  })
  if (scopeDenied) return scopeDenied

  const supabase = getAppSupabase()
  const { error } = await supabase.from('anamneses').insert({
    paciente_id: pacienteId,
    profissional_id: session.userId,
    data_anamnese: body.data,
    tipo: body.tipo,
    queixa: body.queixa,
    imc: body.imc,
    peso: body.peso,
    gordura: body.gordura,
    altura: body.altura,
    massa_muscular: body.massaMuscular,
    gordura_visceral: body.gorduraVisceral,
    massa_ossea: body.massaOssea,
    agua_corporal: body.aguaCorporal,
    campos_extras:
      body.camposExtras && typeof body.camposExtras === 'object' && !Array.isArray(body.camposExtras)
        ? body.camposExtras
        : {},
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao salvar anamnese')
  }

  return GET(request)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'anamnese', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const pacienteId = body?.pacienteId ?? body?.paciente
  if (!body?.id || !pacienteId || !body?.data || !body?.tipo || !body?.queixa) {
    return serverErrorResponse('Anamnese inválida', 'INVALID_ANAMNESE', 400)
  }

  const supabase = getAppSupabase()
  const { data: existing, error: existingError } = await supabase
    .from('anamneses')
    .select('paciente_id')
    .eq('id', String(body.id))
    .maybeSingle()
  if (existingError) return supabaseErrorResponse(existingError, 'Falha ao carregar anamnese')
  if (!existing) return serverErrorResponse('Anamnese não encontrada', 'ANAMNESE_NOT_FOUND', 404)

  const scopeExisting = await assertPacienteInUnitScope({
    session,
    pacienteId: String(existing.paciente_id ?? ''),
  })
  if (scopeExisting) return scopeExisting

  const scopeNext = await assertPacienteInUnitScope({
    session,
    pacienteId: String(pacienteId),
  })
  if (scopeNext) return scopeNext

  const { error } = await supabase
    .from('anamneses')
    .update({
      paciente_id: pacienteId,
      data_anamnese: body.data,
      tipo: body.tipo,
      queixa: body.queixa,
      imc: body.imc,
      peso: body.peso,
      gordura: body.gordura,
      altura: body.altura,
      massa_muscular: body.massaMuscular,
      gordura_visceral: body.gorduraVisceral,
      massa_ossea: body.massaOssea,
      agua_corporal: body.aguaCorporal,
      campos_extras:
        body.camposExtras && typeof body.camposExtras === 'object' && !Array.isArray(body.camposExtras)
          ? body.camposExtras
          : {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))
    .eq('paciente_id', String(existing.paciente_id ?? ''))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar anamnese')
  }

  return GET(request)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'anamnese', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Anamnese inválida', 'INVALID_ANAMNESE', 400)
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('anamneses').delete().eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir anamnese')
  }

  return GET(request)
}
