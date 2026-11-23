import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { can } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

/**
 * GET /api/documentos/emitidos
 *
 * Lista central de documentos emitidos pela clínica. Serve a aba "Emitidos"
 * de /documentacao para recepção e gestor. Escopo por unidade do usuário
 * logado — puxa paciente_nome e template_nome em linha para a UI.
 *
 * Query params opcionais:
 *   - paciente_id: filtra por paciente
 *   - template_id: filtra por template
 *   - desde:       ISO date — gerado_em >= desde
 *   - ate:         ISO date — gerado_em <= ate
 *   - limit:       default 100
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  // Documentação lê tudo; quem só tem Pacientes (recepção) lê os documentos emitidos de UM paciente.
  const podeDocs = await can(session.userId, 'documentacao', 'read')
  const pacienteDoFiltro = new URL(request.url).searchParams.get('paciente_id')
  if (!podeDocs && !(pacienteDoFiltro && (await can(session.userId, 'pacientes', 'read')))) {
    return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  }

  const scopedUnit = await getScopedUnitId(session)
  const unidadeId = scopedUnit.error ? null : scopedUnit.unidadeId
  if (!unidadeId) {
    return serverErrorResponse('Usuário sem unidade vinculada', 'NO_UNIT', 400)
  }

  const url = new URL(request.url)
  const pacienteIdFilter = url.searchParams.get('paciente_id')
  const templateIdFilter = url.searchParams.get('template_id')
  const desde = url.searchParams.get('desde')
  const ate = url.searchParams.get('ate')
  const limitRaw = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 100

  const supabase = getAppSupabase()

  // Filtramos por templates da unidade do usuário — documentos_gerados não
  // tem unidade_id direto, mas template_id referencia documento_templates
  // que é por unidade.
  const { data: templatesDaUnidade, error: tplError } = await supabase
    .from('documento_templates')
    .select('id,nome,tipo,slug')
    .eq('unidade_id', unidadeId)

  if (tplError) return supabaseErrorResponse(tplError, 'Falha ao carregar templates')

  const templateIds = (templatesDaUnidade ?? []).map((row) => String(row.id))
  if (templateIds.length === 0) {
    return NextResponse.json({ data: [], templates: [], meta: session })
  }

  let query = supabase
    .from('documentos_gerados')
    .select(
      'id,template_id,paciente_id,profissional_id,agendamento_id,gerado_em,disponivel_no_portal,pdf_url',
    )
    .in('template_id', templateIds)
    .order('gerado_em', { ascending: false })
    .limit(limit)

  if (templateIdFilter) query = query.eq('template_id', templateIdFilter)
  if (pacienteIdFilter) query = query.eq('paciente_id', pacienteIdFilter)
  if (desde) query = query.gte('gerado_em', desde)
  if (ate) query = query.lte('gerado_em', ate)

  const { data: documentos, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar documentos emitidos')

  const templateMap = new Map<string, { nome: string; tipo: string; slug: string }>(
    (templatesDaUnidade ?? []).map((row) => [
      String(row.id),
      {
        nome: String(row.nome ?? ''),
        tipo: String(row.tipo ?? ''),
        slug: String(row.slug ?? ''),
      },
    ]),
  )

  const pacienteIds = Array.from(
    new Set((documentos ?? []).map((row) => row.paciente_id).filter(Boolean)),
  ) as string[]
  const profIds = Array.from(
    new Set((documentos ?? []).map((row) => row.profissional_id).filter(Boolean)),
  ) as string[]

  const [{ data: pacientes }, { data: profissionais }] = await Promise.all([
    pacienteIds.length > 0
      ? supabase.from('pacientes').select('id,nome').in('id', pacienteIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
    profIds.length > 0
      ? supabase.from('usuarios').select('id,nome').in('id', profIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
  ])

  const pacienteMap = new Map<string, string>(
    (pacientes ?? []).map((row) => [String(row.id), String(row.nome ?? '')]),
  )
  const profMap = new Map<string, string>(
    (profissionais ?? []).map((row) => [String(row.id), String(row.nome ?? '')]),
  )

  const payload = (documentos ?? []).map((doc) => ({
    id: doc.id,
    template_id: doc.template_id,
    template_nome: templateMap.get(String(doc.template_id))?.nome ?? 'Documento',
    template_tipo: templateMap.get(String(doc.template_id))?.tipo ?? '',
    paciente_id: doc.paciente_id,
    paciente_nome: doc.paciente_id ? pacienteMap.get(String(doc.paciente_id)) ?? '—' : '—',
    profissional_id: doc.profissional_id,
    profissional_nome: doc.profissional_id
      ? profMap.get(String(doc.profissional_id)) ?? '—'
      : '—',
    agendamento_id: doc.agendamento_id,
    gerado_em: doc.gerado_em,
    disponivel_no_portal: doc.disponivel_no_portal,
    pdf_url: doc.pdf_url,
  }))

  const templatesList = (templatesDaUnidade ?? []).map((row) => ({
    id: String(row.id),
    nome: String(row.nome ?? ''),
    tipo: String(row.tipo ?? ''),
  }))

  return NextResponse.json({ data: payload, templates: podeDocs ? templatesList : [], meta: session })
}
