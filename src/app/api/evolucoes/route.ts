import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapEvolucaoItem } from '@/lib/domain-mappers'
import { authErrorResponse, assertPacienteInUnitScope, getRequestAuth } from '@/lib/request-auth'

const LOTE = 150

async function contarDocumentosAnexados(supabase: ReturnType<typeof getAppSupabase>, ids: string[]) {
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE))
  const respostas = await Promise.all(
    lotes.map((lote) => supabase.from('evolucao_documentos').select('evolucao_id').in('evolucao_id', lote)),
  )
  const porEvolucao: Record<string, number> = {}
  for (const r of respostas) for (const d of r.data ?? []) porEvolucao[String(d.evolucao_id)] = (porEvolucao[String(d.evolucao_id)] ?? 0) + 1
  return { porEvolucao, error: respostas.find((r) => r.error)?.error ?? null }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'evolucoes', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('evolucoes')
    .select('id,paciente_id,data_evolucao,tipo,resumo,retorno_recepcao,docs_count')
    .order('data_evolucao', { ascending: false })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar evoluções')
  }

  const { map, error: pacienteError } = await getEntityNameMap(
    supabase,
    'pacientes',
    (data ?? []).map((row) => String(row.paciente_id ?? '')),
  )

  if (pacienteError) {
    return supabaseErrorResponse(pacienteError, 'Falha ao carregar evoluções')
  }

  const anexados = await contarDocumentosAnexados(supabase, (data ?? []).map((row) => String(row.id)))
  if (anexados.error) {
    return supabaseErrorResponse(anexados.error, 'Falha ao carregar evoluções')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) =>
      mapEvolucaoItem({
        ...row,
        // Contagem da coluna DOCS = registros antigos sem arquivo (docs_count) + documentos anexados de verdade.
        docs_count: Number(row.docs_count ?? 0) + (anexados.porEvolucao[String(row.id)] ?? 0),
        paciente_nome: map[String(row.paciente_id ?? '')] ?? '',
      }),
    ),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'evolucoes', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const pacienteId = body?.pacienteId ?? body?.paciente
  if (!pacienteId || !body?.data || !body?.tipo || !body?.resumo) {
    return serverErrorResponse('Evolução inválida', 'INVALID_EVOLUTION', 400)
  }

  const scopeDenied = await assertPacienteInUnitScope({
    session,
    pacienteId: String(pacienteId),
  })
  if (scopeDenied) return scopeDenied

  const supabase = getAppSupabase()
  const { error } = await supabase.from('evolucoes').insert({
    paciente_id: pacienteId,
    profissional_id: session.userId,
    data_evolucao: body.data,
    tipo: body.tipo,
    resumo: body.resumo,
    retorno_recepcao: body.retornoRecepcao ?? null,
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao salvar evolução')
  }

  return GET(request)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'evolucoes', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const pacienteId = body?.pacienteId ?? body?.paciente
  if (!body?.id || !pacienteId || !body?.data || !body?.tipo || !body?.resumo) {
    return serverErrorResponse('Evolução inválida', 'INVALID_EVOLUTION', 400)
  }

  const supabase = getAppSupabase()
  const { data: existing, error: existingError } = await supabase
    .from('evolucoes')
    .select('paciente_id')
    .eq('id', String(body.id))
    .maybeSingle()
  if (existingError) return supabaseErrorResponse(existingError, 'Falha ao carregar evolução')
  if (!existing) return serverErrorResponse('Evolução não encontrada', 'EVOLUTION_NOT_FOUND', 404)

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
    .from('evolucoes')
    .update({
      paciente_id: pacienteId,
      data_evolucao: body.data,
      tipo: body.tipo,
      resumo: body.resumo,
      retorno_recepcao: body.retornoRecepcao ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))
    .eq('paciente_id', String(existing.paciente_id ?? ''))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar evolução')
  }

  return GET(request)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'evolucoes', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Evolução inválida', 'INVALID_EVOLUTION', 400)
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('evolucoes').delete().eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir evolução')
  }

  return GET(request)
}
