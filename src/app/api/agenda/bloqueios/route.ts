import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

const TIPO_BLOQUEIO_REGEX = /^[\p{L}\p{N}\s\-_+/]{1,80}$/u

interface BloqueioInput {
  profissionalId?: string | null
  unidadeId?: string | null
  dataInicio?: string
  dataFim?: string
  horarioInicio?: string | null
  horarioFim?: string | null
  diaInteiro?: boolean
  tipo?: string
  justificativa?: string | null
}

interface BloqueioRow {
  id: string
  profissional_id: string | null
  unidade_id: string | null
  data_inicio: string
  data_fim: string
  horario_inicio: string | null
  horario_fim: string | null
  dia_inteiro: boolean
  tipo: string
  justificativa: string | null
  created_by: string | null
  created_at: string
}

function mapRow(row: BloqueioRow) {
  return {
    id: row.id,
    profissionalId: row.profissional_id,
    unidadeId: row.unidade_id,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    horarioInicio: row.horario_inicio,
    horarioFim: row.horario_fim,
    diaInteiro: Boolean(row.dia_inteiro),
    tipo: row.tipo,
    justificativa: row.justificativa,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'read')
  if (denied) return denied

  const url = new URL(request.url)
  const inicio = url.searchParams.get('inicio')
  const fim = url.searchParams.get('fim')
  const profissionalId = url.searchParams.get('profissionalId')

  const supabase = getAppSupabase()
  let query = supabase
    .from('agenda_bloqueios')
    .select(
      'id,profissional_id,unidade_id,data_inicio,data_fim,horario_inicio,horario_fim,dia_inteiro,tipo,justificativa,created_by,created_at',
    )
    .order('data_inicio', { ascending: true })

  if (inicio) query = query.gte('data_fim', inicio)
  if (fim) query = query.lte('data_inicio', fim)
  if (profissionalId) query = query.eq('profissional_id', profissionalId)

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar bloqueios')

  return NextResponse.json({
    data: (data ?? []).map((row) => mapRow(row as BloqueioRow)),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as BloqueioInput | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)

  if (!body.dataInicio || !body.dataFim) {
    return serverErrorResponse('Datas de início e fim são obrigatórias', 'INVALID_DATES', 400)
  }
  if (body.dataFim < body.dataInicio) {
    return serverErrorResponse('Data fim anterior à data início', 'INVALID_RANGE', 400)
  }
  if (!body.tipo || !TIPO_BLOQUEIO_REGEX.test(body.tipo)) {
    return serverErrorResponse('Tipo de bloqueio inválido', 'INVALID_TIPO', 400)
  }

  const diaInteiro = Boolean(body.diaInteiro)
  const horaInicio = !diaInteiro && body.horarioInicio ? body.horarioInicio : null
  const horaFim = !diaInteiro && body.horarioFim ? body.horarioFim : null

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('agenda_bloqueios')
    .insert({
      profissional_id: body.profissionalId || null,
      unidade_id: body.unidadeId || null,
      data_inicio: body.dataInicio,
      data_fim: body.dataFim,
      horario_inicio: horaInicio,
      horario_fim: horaFim,
      dia_inteiro: diaInteiro,
      tipo: body.tipo,
      justificativa: body.justificativa || null,
      created_by: session.userId,
    })
    .select(
      'id,profissional_id,unidade_id,data_inicio,data_fim,horario_inicio,horario_fim,dia_inteiro,tipo,justificativa,created_by,created_at',
    )
    .single()

  if (error) return supabaseErrorResponse(error, 'Falha ao salvar bloqueio')

  return NextResponse.json({ data: mapRow(data as BloqueioRow), meta: session }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'delete')
  if (denied) return denied

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return serverErrorResponse('ID do bloqueio é obrigatório', 'MISSING_ID', 400)

  const supabase = getAppSupabase()
  const { error } = await supabase.from('agenda_bloqueios').delete().eq('id', id)
  if (error) return supabaseErrorResponse(error, 'Falha ao remover bloqueio')

  return NextResponse.json({ data: { id }, meta: session })
}
