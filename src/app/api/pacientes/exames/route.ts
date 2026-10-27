import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { caminhoDoExame, EXAMES_BUCKET, urlDeAberturaExame } from '@/lib/exames-storage'
import { authErrorResponse, assertPacienteInUnitScope, getRequestAuth } from '@/lib/request-auth'

export interface PacienteExameItem {
  id: string
  pacienteId: string
  nome: string
  tipo: string | null
  url: string
  uploadedBy: string | null
  uploadedPeloPaciente: boolean
  createdAt: string
}

type Row = {
  id: string
  paciente_id: string
  nome: string
  tipo: string | null
  url: string
  uploaded_by: string | null
  uploaded_pelo_paciente: boolean
  created_at: string
}

function mapRow(row: Row): PacienteExameItem {
  return {
    id: String(row.id),
    pacienteId: String(row.paciente_id),
    nome: String(row.nome),
    tipo: row.tipo,
    url: String(row.url),
    uploadedBy: row.uploaded_by ?? null,
    uploadedPeloPaciente: Boolean(row.uploaded_pelo_paciente),
    createdAt: String(row.created_at),
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const url = new URL(request.url)
  const pacienteId = url.searchParams.get('pacienteId') ?? ''
  if (!pacienteId) {
    return serverErrorResponse('pacienteId obrigatório', 'PACIENTE_REQUIRED', 400)
  }

  // Paciente só vê os próprios exames
  const supabase = getAppSupabase()
  if (session.role === 'paciente') {
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id')
      .eq('usuario_id', session.userId)
      .maybeSingle()
    if (!pac || String(pac.id) !== pacienteId) {
      return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
    }
  } else {
    const denied = await requirePermission(session.userId, 'pacientes', 'read')
    if (denied) return denied
    const fora = await assertPacienteInUnitScope({ session, pacienteId })
    if (fora) return fora
  }

  const { data, error } = await supabase
    .from('paciente_exames')
    .select('id,paciente_id,nome,tipo,url,uploaded_by,uploaded_pelo_paciente,created_at')
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })

  if (error) return supabaseErrorResponse(error, 'Falha ao carregar exames do paciente')

  return NextResponse.json({
    data: (data ?? []).map((row) => urlDeAberturaExame(mapRow(row as Row))),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)

  const pacienteId = String(body.pacienteId ?? '').trim()
  const nome = String(body.nome ?? '').trim()
  const url = String(body.url ?? '').trim()

  if (!pacienteId || !nome || !url) {
    return serverErrorResponse(
      'pacienteId, nome e url são obrigatórios',
      'INVALID_FIELDS',
      400,
    )
  }

  const supabase = getAppSupabase()

  let uploadedPeloPaciente = false
  if (session.role === 'paciente') {
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id')
      .eq('usuario_id', session.userId)
      .maybeSingle()
    if (!pac || String(pac.id) !== pacienteId) {
      return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
    }
    uploadedPeloPaciente = true
  } else {
    const denied = await requirePermission(session.userId, 'pacientes', 'update')
    if (denied) return denied
  }

  const { data, error } = await supabase
    .from('paciente_exames')
    .insert({
      paciente_id: pacienteId,
      nome,
      tipo: body.tipo ? String(body.tipo) : null,
      url,
      uploaded_by: session.userId,
      uploaded_pelo_paciente: uploadedPeloPaciente,
    })
    .select('id,paciente_id,nome,tipo,url,uploaded_by,uploaded_pelo_paciente,created_at')
    .single()

  if (error) return supabaseErrorResponse(error, 'Falha ao salvar exame')

  return NextResponse.json({ data: mapRow(data as Row), meta: session }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as { id?: string } | null
  if (!body?.id) return serverErrorResponse('id obrigatório', 'INVALID_ID', 400)

  const supabase = getAppSupabase()
  const { data: exame, error: exameError } = await supabase
    .from('paciente_exames')
    .select('id,paciente_id,url')
    .eq('id', body.id)
    .maybeSingle()
  if (exameError) return supabaseErrorResponse(exameError, 'Falha ao excluir exame')
  if (!exame) return serverErrorResponse('Exame não encontrado', 'NOT_FOUND', 404)

  const scopeDenied = await assertPacienteInUnitScope({
    session,
    pacienteId: String(exame.paciente_id),
  })
  if (scopeDenied) return scopeDenied

  const { error } = await supabase.from('paciente_exames').delete().eq('id', body.id)
  if (error) return supabaseErrorResponse(error, 'Falha ao excluir exame')
  const caminho = caminhoDoExame(String(exame.url ?? ''))
  if (caminho) await supabase.storage.from(EXAMES_BUCKET).remove([caminho])

  return NextResponse.json({ data: { id: body.id }, meta: session })
}
