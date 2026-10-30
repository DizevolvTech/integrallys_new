import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { rotuloPrazoRetorno, SITUACOES_RETORNO_FILTRO, type SituacaoRetorno } from '@/lib/retorno-prazo'
import { authErrorResponse, getRequestAuth, getScopedUnitId, type RequestAuth } from '@/lib/request-auth'
import { hojeIsoSaoPaulo, registrarRetorno } from '@/lib/retornos-server'
import type { RetornoItem } from '@/types/retorno'

const MAX_PAGE_SIZE = 50
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const SELECT_VIEW =
  'id,paciente_id,profissional_id,unidade_id,procedimento_id,origem,prazo_tipo,prazo_dias,data_base,data_prevista,situacao'

type Supabase = ReturnType<typeof getAppSupabase>
interface Filtravel {
  eq(column: string, value: string): Filtravel
}

function formatBR(iso: unknown) {
  if (typeof iso !== 'string' || !ISO_DATE.test(iso.slice(0, 10))) return ''
  return iso.slice(0, 10).split('-').reverse().join('/')
}

/** Escopo do chamador: especialista vê só os próprios; demais ficam na própria unidade (master/admin: todas). */
async function resolverEscopo(session: RequestAuth) {
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return { error: scoped.error, unidadeId: null, profissionalId: null }
  return {
    error: null,
    unidadeId: scoped.unidadeId,
    profissionalId: session.role === 'especialista' ? session.userId : null,
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'retornos', 'read')
  if (denied) return denied

  const params = request.nextUrl.searchParams
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20),
  )
  const situacao = params.get('situacao') ?? ''
  if (situacao && !SITUACOES_RETORNO_FILTRO.includes(situacao as SituacaoRetorno)) {
    return serverErrorResponse('Situação inválida', 'INVALID_SITUACAO', 400)
  }
  const de = params.get('de') ?? ''
  const ate = params.get('ate') ?? ''
  if ((de && !ISO_DATE.test(de)) || (ate && !ISO_DATE.test(ate))) {
    return serverErrorResponse('Período inválido', 'INVALID_PERIODO', 400)
  }
  const busca = (params.get('q') ?? '').replace(/[%_,()]/g, ' ').trim()
  const profissionalFiltro = params.get('profissionalId') ?? ''
  const procedimentoFiltro = params.get('procedimentoId') ?? ''

  const supabase = getAppSupabase()
  const escopo = await resolverEscopo(session)
  if (escopo.error) return supabaseErrorResponse(escopo.error, 'Falha ao carregar retornos')

  // Cliente: resolve os ids pelo nome (no máximo 150) antes de filtrar a view.
  let pacienteIds: string[] | null = null
  if (busca.length >= 2) {
    let q = supabase.from('pacientes').select('id').ilike('nome', `%${busca}%`).limit(150)
    if (escopo.unidadeId) q = q.eq('unidade_id', escopo.unidadeId)
    const { data, error } = await q
    if (error) return supabaseErrorResponse(error, 'Falha ao carregar retornos')
    pacienteIds = (data ?? []).map((row) => String(row.id))
    if (pacienteIds.length === 0) return respostaVazia(page, pageSize)
  }

  const aplicarEscopo = <T,>(query: T): T => {
    let out = query as unknown as Filtravel
    if (escopo.unidadeId) out = out.eq('unidade_id', escopo.unidadeId)
    if (escopo.profissionalId) out = out.eq('profissional_id', escopo.profissionalId)
    return out as unknown as T
  }

  const filtrado = () => {
    let q = aplicarEscopo(
      supabase.from('retornos_em_aberto').select(SELECT_VIEW, { count: 'exact' }),
    )
    if (profissionalFiltro && !escopo.profissionalId) q = q.eq('profissional_id', profissionalFiltro)
    if (procedimentoFiltro) q = q.eq('procedimento_id', procedimentoFiltro)
    if (de) q = q.gte('data_base', de)
    if (ate) q = q.lte('data_base', ate)
    if (pacienteIds) q = q.in('paciente_id', pacienteIds)
    return q
  }
  const contar = (s: SituacaoRetorno) =>
    aplicarEscopo(
      supabase.from('retornos_em_aberto').select('id', { count: 'exact', head: true }),
    ).eq('situacao', s)

  const from = (page - 1) * pageSize
  const [lista, noPrazo, limite, vencido] = await Promise.all([
    (situacao ? filtrado().eq('situacao', situacao) : filtrado())
      .order('data_prevista', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1),
    contar('no_prazo'),
    contar('limite'),
    contar('vencido'),
  ])
  if (lista.error) return supabaseErrorResponse(lista.error, 'Falha ao carregar retornos')
  const contagemErro = [noPrazo, limite, vencido].find((r) => r.error)?.error
  if (contagemErro) return supabaseErrorResponse(contagemErro, 'Falha ao carregar retornos')

  const rows = lista.data ?? []
  const idsPacientes = rows.map((r) => String(r.paciente_id))
  const [pacientes, usuarios, ultimos] = await Promise.all([
    nomes(supabase, 'pacientes', idsPacientes),
    nomes(supabase, 'usuarios', rows.map((r) => String(r.profissional_id ?? ''))),
    idsPacientes.length > 0
      ? supabase.rpc('retornos_ultimos_procedimentos', { p_paciente_ids: idsPacientes })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (ultimos.error) return supabaseErrorResponse(ultimos.error, 'Falha ao carregar retornos')

  const procsPorPaciente = new Map<string, Array<{ data: string; nome: string }>>()
  for (const row of (ultimos.data ?? []) as Array<Record<string, unknown>>) {
    const key = String(row.paciente_id)
    const lista3 = procsPorPaciente.get(key) ?? []
    lista3.push({ data: formatBR(row.data_agendamento), nome: String(row.procedimento_nome ?? '') })
    procsPorPaciente.set(key, lista3)
  }

  const data: RetornoItem[] = rows.map((row) => ({
    id: String(row.id),
    pacienteId: String(row.paciente_id),
    paciente: pacientes[String(row.paciente_id)] ?? '',
    data: formatBR(row.data_base),
    ultimosProcedimentos: procsPorPaciente.get(String(row.paciente_id)) ?? [],
    especialistaId: row.profissional_id ? String(row.profissional_id) : null,
    especialista: usuarios[String(row.profissional_id ?? '')] ?? '',
    dataPrevista: formatBR(row.data_prevista),
    prazo: rotuloPrazoRetorno(String(row.prazo_tipo), row.prazo_dias != null ? Number(row.prazo_dias) : null),
    situacao: row.situacao as SituacaoRetorno,
    origem: row.origem === 'prescricao' ? 'prescricao' : 'atendimento',
  }))

  return NextResponse.json({
    data,
    meta: {
      total: lista.count ?? 0,
      page,
      pageSize,
      contagem: {
        no_prazo: noPrazo.count ?? 0,
        limite: limite.count ?? 0,
        vencido: vencido.count ?? 0,
      },
    },
  })
}

function respostaVazia(page: number, pageSize: number) {
  return NextResponse.json({
    data: [],
    meta: { total: 0, page, pageSize, contagem: { no_prazo: 0, limite: 0, vencido: 0 } },
  })
}

async function nomes(supabase: Supabase, table: 'pacientes' | 'usuarios', ids: string[]) {
  const unicos = Array.from(new Set(ids.filter(Boolean)))
  if (unicos.length === 0) return {} as Record<string, string>
  const { data } = await supabase.from(table).select('id,nome').in('id', unicos)
  return Object.fromEntries((data ?? []).map((row) => [String(row.id), String(row.nome ?? '')]))
}

interface PostBody {
  pacienteId?: unknown
  origem?: unknown
  agendamentoId?: unknown
  prescricaoId?: unknown
  prazo?: { tipo?: unknown; dias?: unknown } | null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')

/**
 * POST /api/retornos
 *  - origem "atendimento": { pacienteId, agendamentoId?, prazo: { tipo, dias? } } ao finalizar o atendimento
 *  - origem "prescricao":  { pacienteId, prescricaoId? } — "Mais tarde" após a venda
 */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'retornos', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as PostBody | null
  if (!body) return serverErrorResponse('Corpo inválido', 'INVALID_BODY', 400)
  const origem = body.origem === 'prescricao' ? 'prescricao' : body.origem === 'atendimento' ? 'atendimento' : null
  const pacienteId = str(body.pacienteId)
  if (!origem || !pacienteId) return serverErrorResponse('Paciente e origem são obrigatórios', 'INVALID_PARAMS', 400)
  if (origem === 'atendimento' && session.role === 'recepcao') {
    return serverErrorResponse('Apenas o especialista define o prazo de retorno', 'FORBIDDEN', 403)
  }

  const supabase = getAppSupabase()
  const escopo = await resolverEscopo(session)
  if (escopo.error) return supabaseErrorResponse(escopo.error, 'Falha ao registrar retorno')

  const { data: paciente, error: pacienteError } = await supabase
    .from('pacientes')
    .select('id,unidade_id')
    .eq('id', pacienteId)
    .maybeSingle()
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao registrar retorno')
  if (!paciente) return serverErrorResponse('Paciente não encontrado', 'PACIENTE_NOT_FOUND', 404)
  if (escopo.unidadeId && paciente.unidade_id && String(paciente.unidade_id) !== escopo.unidadeId) {
    return serverErrorResponse('Paciente fora do escopo da unidade', 'PACIENTE_UNIT_FORBIDDEN', 403)
  }

  let profissionalId: string | null = session.role === 'especialista' ? session.userId : null
  let procedimentoId: string | null = null
  let dataBase = hojeIsoSaoPaulo()
  const agendamentoId = str(body.agendamentoId)
  if (agendamentoId) {
    const { data: ag } = await supabase
      .from('agendamentos')
      .select('profissional_id,procedimento_id,data_agendamento,paciente_id')
      .eq('id', agendamentoId)
      .maybeSingle()
    if (ag && String(ag.paciente_id) === pacienteId) {
      profissionalId = profissionalId ?? (ag.profissional_id ? String(ag.profissional_id) : null)
      procedimentoId = ag.procedimento_id ? String(ag.procedimento_id) : null
      if (origem === 'atendimento' && ag.data_agendamento) dataBase = String(ag.data_agendamento)
    }
  }

  const result = await registrarRetorno(supabase, {
    pacienteId,
    origem,
    criadoPorId: session.userId,
    profissionalId,
    agendamentoId: agendamentoId || null,
    procedimentoId,
    prescricaoId: str(body.prescricaoId) || null,
    unidadeId: paciente.unidade_id ? String(paciente.unidade_id) : null,
    dataBase,
    prazoTipo: str(body.prazo?.tipo),
    prazoDiasCustom: body.prazo?.dias != null ? Number(body.prazo.dias) : null,
  })
  if (!result.ok) return serverErrorResponse(result.message, result.code, result.status)
  return NextResponse.json({ data: { id: result.id, criado: result.criado } }, { status: result.criado ? 201 : 200 })
}
