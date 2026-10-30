import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapListaEsperaItem } from '@/lib/domain-mappers'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

async function listListaEspera(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const [
    { data, error },
    { data: especialistasData, error: especialistasError },
    { data: procedimentosData, error: procedimentosError },
    { data: vinculosData, error: vinculosError },
  ] = await Promise.all([
    supabase
      .from('lista_espera')
      .select('id,paciente_id,prioridade,especialista,procedimento,procedimento_id,especialista_id,preferencia_horario,entrada_em,observacoes')
      .eq('status', 'aguardando')
      .order('entrada_em', { ascending: true }),
    supabase
      .from('usuarios')
      .select('id,nome')
      .eq('perfil', 'especialista')
      .eq('status', 'Ativo')
      .order('nome', { ascending: true }),
    supabase
      .from('procedimentos')
      .select('id,nome,valor')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    // profissional_id em profissional_procedimentos referencia usuarios(id) (migration 079).
    // Não existe tabela `profissionais`.
    supabase.from('profissional_procedimentos').select('profissional_id,procedimento_id'),
  ])

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar lista de espera')
  }

  if (especialistasError) {
    return supabaseErrorResponse(especialistasError, 'Falha ao carregar especialistas da lista de espera')
  }

  if (procedimentosError) {
    return supabaseErrorResponse(procedimentosError, 'Falha ao carregar procedimentos da lista de espera')
  }

  if (vinculosError) {
    return supabaseErrorResponse(vinculosError, 'Falha ao carregar vínculos de procedimentos')
  }

  const especialistasRows = especialistasData ?? []
  const procedimentosRows = procedimentosData ?? []
  const vinculosRows = vinculosData ?? []

  const procedimentoIdsByProfissionalId = new Map<string, string[]>()
  for (const row of vinculosRows) {
    const profissionalId = String(row.profissional_id ?? '')
    const procedimentoId = String(row.procedimento_id ?? '')
    if (!profissionalId || !procedimentoId) continue
    const current = procedimentoIdsByProfissionalId.get(profissionalId) ?? []
    current.push(procedimentoId)
    procedimentoIdsByProfissionalId.set(profissionalId, current)
  }

  const specialists = Array.from(
    new Set(especialistasRows.map((row) => String(row.nome ?? '')).filter(Boolean)),
  )

  const procedures = Array.from(
    new Set(procedimentosRows.map((row) => String(row.nome ?? '')).filter(Boolean)),
  )

  const especialistasOptions = especialistasRows
    .filter((row) => row.id && row.nome)
    .map((row) => {
      const id = String(row.id)
      return {
        id,
        nome: String(row.nome),
        procedimentoIds: procedimentoIdsByProfissionalId.get(id) ?? [],
      }
    })

  const procedimentosOptions = procedimentosRows
    .filter((row) => row.id && row.nome)
    .map((row) => ({
      id: String(row.id),
      nome: String(row.nome),
      valor: row.valor != null ? Number(row.valor) : null,
    }))

  const especialistasNomeById = new Map(
    especialistasRows
      .filter((row) => row.id && row.nome)
      .map((row) => [String(row.id), String(row.nome)] as const),
  )

  const procedimentosById = new Map(
    procedimentosRows
      .filter((row) => row.id && row.nome)
      .map((row) => [
        String(row.id),
        { nome: String(row.nome), valor: row.valor != null ? Number(row.valor) : null },
      ] as const),
  )

  const { map, error: pacienteError } = await getEntityNameMap(
    supabase,
    'pacientes',
    (data ?? []).map((row) => String(row.paciente_id ?? '')),
  )

  if (pacienteError) {
    return supabaseErrorResponse(pacienteError, 'Falha ao carregar lista de espera')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const procedimentoEntry = row.procedimento_id
        ? procedimentosById.get(String(row.procedimento_id))
        : null
      const especialistaNome = row.especialista_id
        ? especialistasNomeById.get(String(row.especialista_id))
        : null
      return mapListaEsperaItem({
        ...row,
        paciente_nome: map[String(row.paciente_id ?? '')] ?? '',
        procedimento_nome: procedimentoEntry?.nome ?? row.procedimento ?? null,
        procedimento_valor: procedimentoEntry?.valor ?? null,
        especialista_nome: especialistaNome ?? row.especialista ?? null,
      })
    }),
    meta: {
      ...session,
      specialists,
      procedures,
      especialistasOptions,
      procedimentosOptions,
    },
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'lista-espera', 'read')
  if (denied) return denied

  return listListaEspera(session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'lista-espera', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.pacienteId || !body?.prioridade) {
    return serverErrorResponse('Item inválido', 'INVALID_WAITLIST_ITEM', 400)
  }

  const supabase = getAppSupabase()
  const { data: pacienteRow } = await supabase
    .from('pacientes')
    .select('unidade_id')
    .eq('id', String(body.pacienteId))
    .maybeSingle()

  const procedimentoId = body.procedimentoId ? String(body.procedimentoId) : null
  const especialistaId = body.especialistaId ? String(body.especialistaId) : null

  let procedimentoNome: string | null = body.procedimento ? String(body.procedimento) : null
  if (procedimentoId) {
    const { data: procRow } = await supabase
      .from('procedimentos')
      .select('nome')
      .eq('id', procedimentoId)
      .maybeSingle()
    procedimentoNome = procRow?.nome ? String(procRow.nome) : procedimentoNome
  }

  let especialistaNome: string | null = body.especialista ? String(body.especialista) : null
  if (especialistaId) {
    const { data: espRow } = await supabase
      .from('usuarios')
      .select('nome')
      .eq('id', especialistaId)
      .maybeSingle()
    especialistaNome = espRow?.nome ? String(espRow.nome) : especialistaNome
  }

  const { error } = await supabase.from('lista_espera').insert({
    paciente_id: String(body.pacienteId),
    unidade_id: pacienteRow?.unidade_id ? String(pacienteRow.unidade_id) : null,
    prioridade: String(body.prioridade),
    especialista: especialistaNome,
    especialista_id: especialistaId,
    procedimento: procedimentoNome,
    procedimento_id: procedimentoId,
    preferencia_horario: body.preferenciaHorario ? String(body.preferenciaHorario) : null,
    observacoes: body.observacoes ? String(body.observacoes) : null,
  })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao adicionar paciente à lista de espera')
  }

  return listListaEspera(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'lista-espera', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id || !body?.pacienteId || !body?.prioridade) {
    return serverErrorResponse('Item inválido', 'INVALID_WAITLIST_ITEM', 400)
  }

  const supabase = getAppSupabase()
  const { data: pacienteRow } = await supabase
    .from('pacientes')
    .select('unidade_id')
    .eq('id', String(body.pacienteId))
    .maybeSingle()

  const procedimentoId = body.procedimentoId ? String(body.procedimentoId) : null
  const especialistaId = body.especialistaId ? String(body.especialistaId) : null

  let procedimentoNome: string | null = body.procedimento ? String(body.procedimento) : null
  if (procedimentoId) {
    const { data: procRow } = await supabase
      .from('procedimentos')
      .select('nome')
      .eq('id', procedimentoId)
      .maybeSingle()
    procedimentoNome = procRow?.nome ? String(procRow.nome) : procedimentoNome
  }

  let especialistaNome: string | null = body.especialista ? String(body.especialista) : null
  if (especialistaId) {
    const { data: espRow } = await supabase
      .from('usuarios')
      .select('nome')
      .eq('id', especialistaId)
      .maybeSingle()
    especialistaNome = espRow?.nome ? String(espRow.nome) : especialistaNome
  }

  const { error } = await supabase
    .from('lista_espera')
    .update({
      paciente_id: String(body.pacienteId),
      unidade_id: pacienteRow?.unidade_id ? String(pacienteRow.unidade_id) : null,
      prioridade: String(body.prioridade),
      especialista: especialistaNome,
      especialista_id: especialistaId,
      procedimento: procedimentoNome,
      procedimento_id: procedimentoId,
      preferencia_horario: body.preferenciaHorario ? String(body.preferenciaHorario) : null,
      observacoes: body.observacoes ? String(body.observacoes) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar item da lista de espera')
  }

  return listListaEspera(session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'lista-espera', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Item inválido', 'INVALID_WAITLIST_ITEM', 400)
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('lista_espera').delete().eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao remover item da lista de espera')
  }

  return listListaEspera(session)
}

/** Tira o paciente da fila ao concluir o agendamento (status 'agendado'; o registro fica no histórico). */
export async function PATCH(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'lista-espera', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id || body.status !== 'agendado') {
    return serverErrorResponse('Item inválido', 'INVALID_WAITLIST_ITEM', 400)
  }

  const supabase = getAppSupabase()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('lista_espera')
    .update({ status: 'agendado', atendido_em: now, updated_at: now })
    .eq('id', String(body.id))
    .eq('status', 'aguardando')

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao tirar paciente da lista de espera')
  }

  return listListaEspera(session)
}
