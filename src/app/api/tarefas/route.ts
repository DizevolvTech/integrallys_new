import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapTarefaItem } from '@/lib/domain-mappers'
import { validarCancelamento } from '@/lib/tarefa-status'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import {
  nextVencimentoForRecorrencia,
  normalizeDiasSemana,
  normalizeTarefaRecorrencia,
  type TarefaRecorrencia,
} from '@/lib/tarefa-recorrencia'

const TAREFA_SELECT =
  'id,titulo,descricao,responsavel_id,status,vencimento_em,recorrencia,dias_semana,alerta,prioridade,categoria,motivo_cancelamento,created_at'

async function listTarefas(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  // Item 1 — lista de tarefas é individual: cada usuário vê só as tarefas em que é
  // o responsável. Gestor, administrador e master enxergam todas (base do relatório de tarefas).
  let query = supabase
    .from('tarefas')
    .select(TAREFA_SELECT)
    .order('created_at', { ascending: false })
  if (session && !['master', 'admin', 'gestor'].includes(String(session.role))) {
    query = query.eq('responsavel_id', session.userId)
  }
  const { data, error } = await query

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar tarefas')
  }

  const { map, error: responsaveisError } = await getEntityNameMap(
    supabase,
    'usuarios',
    (data ?? []).map((row) => String(row.responsavel_id ?? '')),
  )

  if (responsaveisError) {
    return supabaseErrorResponse(responsaveisError, 'Falha ao carregar tarefas')
  }

  const ids = (data ?? []).map((row) => String(row.id))
  const { data: subRows } = ids.length
    ? await supabase
        .from('tarefa_subtarefas')
        .select('id,tarefa_id,titulo,concluida,posicao')
        .in('tarefa_id', ids)
        .order('posicao', { ascending: true })
    : { data: [] as Array<Record<string, unknown>> }
  const subsByTarefa = new Map<string, Array<Record<string, unknown>>>()
  for (const sub of subRows ?? []) {
    const key = String(sub.tarefa_id)
    subsByTarefa.set(key, [...(subsByTarefa.get(key) ?? []), sub])
  }

  return NextResponse.json({
    data: (data ?? []).map((row) =>
      mapTarefaItem({
        ...row,
        responsavel_nome: map[String(row.responsavel_id ?? '')] ?? '',
        subtarefas: subsByTarefa.get(String(row.id)) ?? [],
      }),
    ),
    meta: session,
  })
}

const ROLES_VEEM_TODAS = ['master', 'admin', 'gestor']

/** Perfis comuns só alteram/excluem tarefas das quais são responsáveis. */
async function podeAlterarTarefa(
  supabase: ReturnType<typeof getAppSupabase>,
  session: { userId: string; role?: unknown },
  taskId: string,
) {
  if (ROLES_VEEM_TODAS.includes(String(session.role))) return true
  const { data } = await supabase
    .from('tarefas')
    .select('responsavel_id')
    .eq('id', taskId)
    .maybeSingle()
  return Boolean(data) && String(data?.responsavel_id ?? '') === session.userId
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'tarefas', 'read')
  if (denied) return denied
  return listTarefas(session)
}

async function resolveResponsavelId(
  supabase: ReturnType<typeof getAppSupabase>,
  responsavelId: unknown,
  responsavelNome: unknown,
) {
  if (typeof responsavelId === 'string' && responsavelId.trim()) {
    return responsavelId
  }

  if (typeof responsavelNome === 'string' && responsavelNome.trim()) {
    const { data } = await supabase
      .from('usuarios')
      .select('id')
      .eq('nome', responsavelNome.trim())
      .maybeSingle()

    return data?.id ?? null
  }

  return null
}

function resolveVencimentoEm(body: Record<string, unknown>) {
  if (typeof body.vencimentoEm === 'string' && body.vencimentoEm.trim()) {
    const d = new Date(body.vencimentoEm)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const data = typeof body.data === 'string' ? body.data.trim() : ''
  const horario = typeof body.horario === 'string' && body.horario.trim() ? body.horario.trim() : '09:00'
  if (data) {
    const d = new Date(`${data}T${horario}:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return null
}

function resolveAlerta(body: Record<string, unknown>) {
  if (typeof body.alerta === 'boolean') return body.alerta
  if (body.alerta === 'true' || body.alerta === 1) return true
  if (body.alerta === 'false' || body.alerta === 0) return false
  return false
}

function buildTarefaRow(
  body: Record<string, unknown>,
  responsavelId: string | null,
  sessionUserId: string,
  includeCreatedBy: boolean,
) {
  const recorrencia = normalizeTarefaRecorrencia(body.recorrencia)
  const diasSemana =
    recorrencia === 'dias_especificos' ? normalizeDiasSemana(body.diasSemana) : []

  const row: Record<string, unknown> = {
    titulo: String(body.titulo),
    descricao: typeof body.descricao === 'string' && body.descricao.trim() ? body.descricao : null,
    responsavel_id: responsavelId,
    status: typeof body.status === 'string' && body.status.trim() ? body.status : 'Pendente',
    vencimento_em: resolveVencimentoEm(body),
    recorrencia,
    dias_semana: diasSemana.length > 0 ? diasSemana : null,
    alerta: resolveAlerta(body),
    prioridade: typeof body.prioridade === 'string' && body.prioridade.trim() ? body.prioridade : null,
    categoria: typeof body.categoria === 'string' && body.categoria.trim() ? body.categoria : null,
    motivo_cancelamento:
      body.status === 'Cancelada' && typeof body.motivoCancelamento === 'string'
        ? body.motivoCancelamento.trim() || null
        : null,
  }
  if (includeCreatedBy) {
    row.created_by_id = sessionUserId
  } else {
    row.updated_at = new Date().toISOString()
  }
  return row
}

async function spawnNextOccurrence(
  supabase: ReturnType<typeof getAppSupabase>,
  current: {
    titulo: string
    descricao: string | null
    responsavel_id: string | null
    vencimento_em: string | null
    recorrencia: TarefaRecorrencia
    dias_semana: number[]
    alerta: boolean
    prioridade: string | null
    categoria: string | null
  },
  createdById: string,
) {
  if (current.recorrencia === 'nenhuma') return null

  const nextDate = nextVencimentoForRecorrencia(
    current.recorrencia,
    current.vencimento_em,
    current.dias_semana,
  )
  if (!nextDate) return null

  const { error } = await supabase.from('tarefas').insert({
    titulo: current.titulo,
    descricao: current.descricao,
    responsavel_id: current.responsavel_id,
    status: 'Pendente',
    vencimento_em: nextDate.toISOString(),
    recorrencia: current.recorrencia,
    dias_semana: current.dias_semana.length > 0 ? current.dias_semana : null,
    alerta: current.alerta,
    prioridade: current.prioridade,
    categoria: current.categoria,
    created_by_id: createdById,
  })

  return error
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'tarefas', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.titulo) {
    return serverErrorResponse('Tarefa inválida', 'INVALID_TASK_INPUT', 400)
  }

  const recorrencia = normalizeTarefaRecorrencia(body.recorrencia)
  if (recorrencia === 'dias_especificos' && normalizeDiasSemana(body.diasSemana).length === 0) {
    return serverErrorResponse(
      'Selecione ao menos um dia da semana para recorrência específica.',
      'INVALID_TASK_DAYS',
      400,
    )
  }

  const motivoErro = validarCancelamento(body.status, body.motivoCancelamento)
  if (motivoErro) return serverErrorResponse(motivoErro, 'MOTIVO_OBRIGATORIO', 400)

  const supabase = getAppSupabase()
  // Sem responsável informado, a tarefa é de quem a criou (senão ninguém, nem o criador, a veria).
  const responsavelId =
    (await resolveResponsavelId(supabase, body.responsavelId, body.responsavelNome)) ?? session.userId
  const { error } = await supabase
    .from('tarefas')
    .insert(buildTarefaRow(body, responsavelId, session.userId, true))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao criar tarefa')
  }

  return listTarefas(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'tarefas', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id || !body?.titulo) {
    return serverErrorResponse('Tarefa inválida', 'INVALID_TASK_INPUT', 400)
  }

  const supabase = getAppSupabase()
  const taskId = String(body.id)

  if (!(await podeAlterarTarefa(supabase, session, taskId))) {
    return serverErrorResponse('Tarefa não encontrada', 'TASK_NOT_FOUND', 404)
  }

  const { data: before, error: beforeError } = await supabase
    .from('tarefas')
    .select(TAREFA_SELECT)
    .eq('id', taskId)
    .maybeSingle()

  if (beforeError) {
    return supabaseErrorResponse(beforeError, 'Falha ao atualizar tarefa')
  }
  if (!before) {
    return serverErrorResponse('Tarefa não encontrada', 'TASK_NOT_FOUND', 404)
  }

  const responsavelId = await resolveResponsavelId(supabase, body.responsavelId, body.responsavelNome)
  const nextStatus =
    typeof body.status === 'string' && body.status.trim() ? body.status : String(before.status)
  const motivoAtual =
    body.motivoCancelamento !== undefined
      ? body.motivoCancelamento
      : (before as Record<string, unknown>).motivo_cancelamento
  const motivoErro = validarCancelamento(nextStatus, motivoAtual)
  if (motivoErro) return serverErrorResponse(motivoErro, 'MOTIVO_OBRIGATORIO', 400)

  const recorrencia = normalizeTarefaRecorrencia(
    body.recorrencia !== undefined ? body.recorrencia : before.recorrencia,
  )
  const diasSemana =
    body.diasSemana !== undefined
      ? normalizeDiasSemana(body.diasSemana)
      : normalizeDiasSemana(before.dias_semana)

  if (recorrencia === 'dias_especificos' && diasSemana.length === 0) {
    return serverErrorResponse(
      'Selecione ao menos um dia da semana para recorrência específica.',
      'INVALID_TASK_DAYS',
      400,
    )
  }

  const { error } = await supabase
    .from('tarefas')
    .update(
      buildTarefaRow(
        { ...body, status: nextStatus, motivoCancelamento: motivoAtual, recorrencia, diasSemana },
        responsavelId,
        session.userId,
        false,
      ),
    )
    .eq('id', taskId)

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar tarefa')
  }

  const wasOpen = String(before.status) !== 'Concluída'
  const nowDone = nextStatus === 'Concluída'

  if (wasOpen && nowDone && recorrencia !== 'nenhuma') {
    const spawnError = await spawnNextOccurrence(
      supabase,
      {
        titulo: String(body.titulo),
        descricao:
          typeof body.descricao === 'string' && body.descricao.trim()
            ? body.descricao
            : before.descricao
              ? String(before.descricao)
              : null,
        responsavel_id: responsavelId ?? (before.responsavel_id ? String(before.responsavel_id) : null),
        vencimento_em: resolveVencimentoEm(body) ?? (before.vencimento_em ? String(before.vencimento_em) : null),
        recorrencia,
        dias_semana: diasSemana,
        alerta:
          typeof body.alerta === 'boolean'
            ? body.alerta
            : Boolean(before.alerta),
        prioridade:
          typeof body.prioridade === 'string' && body.prioridade.trim()
            ? body.prioridade
            : before.prioridade
              ? String(before.prioridade)
              : null,
        categoria:
          typeof body.categoria === 'string' && body.categoria.trim()
            ? body.categoria
            : before.categoria
              ? String(before.categoria)
              : null,
      },
      session.userId,
    )

    if (spawnError) {
      return supabaseErrorResponse(spawnError, 'Tarefa concluída, mas falhou ao gerar a próxima ocorrência')
    }
  }

  return listTarefas(session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'tarefas', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Tarefa inválida', 'INVALID_TASK_INPUT', 400)
  }

  const supabase = getAppSupabase()
  if (!(await podeAlterarTarefa(supabase, session, String(body.id)))) {
    return serverErrorResponse('Tarefa não encontrada', 'TASK_NOT_FOUND', 404)
  }
  const { error } = await supabase.from('tarefas').delete().eq('id', String(body.id))

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir tarefa')
  }

  return listTarefas(session)
}
