import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

type Session = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

const PRIVILEGED_ROLES = ['master', 'admin', 'gestor']

/** Usuário comum só mexe em subtarefas de tarefas próprias (responsável ou criador). */
async function canTouchTarefa(session: Session, tarefaId: string) {
  if (PRIVILEGED_ROLES.includes(String(session.role))) return true
  const supabase = getAppSupabase()
  const { data } = await supabase
    .from('tarefas')
    .select('id,responsavel_id,created_by_id')
    .eq('id', tarefaId)
    .maybeSingle()
  if (!data) return false
  return data.responsavel_id === session.userId || data.created_by_id === session.userId
}

async function tarefaIdOfSubtarefa(id: string) {
  const supabase = getAppSupabase()
  const { data } = await supabase.from('tarefa_subtarefas').select('tarefa_id').eq('id', id).maybeSingle()
  return data?.tarefa_id ? String(data.tarefa_id) : null
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'tarefas', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const tarefaId = String(body?.tarefaId ?? '')
  const titulo = String(body?.titulo ?? '').trim()
  if (!tarefaId || !titulo) {
    return serverErrorResponse('Subtarefa inválida', 'INVALID_SUBTASK_INPUT', 400)
  }
  if (!(await canTouchTarefa(session, tarefaId))) {
    return serverErrorResponse('Tarefa não encontrada', 'TASK_NOT_FOUND', 404)
  }

  const supabase = getAppSupabase()
  const { count } = await supabase
    .from('tarefa_subtarefas')
    .select('id', { count: 'exact', head: true })
    .eq('tarefa_id', tarefaId)
  const { error } = await supabase
    .from('tarefa_subtarefas')
    .insert({ tarefa_id: tarefaId, titulo, posicao: count ?? 0 })
  if (error) return supabaseErrorResponse(error, 'Falha ao criar subtarefa')
  return NextResponse.json({ ok: true })
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'tarefas', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = String(body?.id ?? '')
  if (!id) return serverErrorResponse('Subtarefa inválida', 'INVALID_SUBTASK_INPUT', 400)
  const tarefaId = await tarefaIdOfSubtarefa(id)
  if (!tarefaId || !(await canTouchTarefa(session, tarefaId))) {
    return serverErrorResponse('Subtarefa não encontrada', 'SUBTASK_NOT_FOUND', 404)
  }

  const update: Record<string, unknown> = {}
  if (typeof body?.concluida === 'boolean') update.concluida = body.concluida
  if (typeof body?.titulo === 'string' && body.titulo.trim()) update.titulo = body.titulo.trim()
  if (Object.keys(update).length === 0) {
    return serverErrorResponse('Nada para atualizar', 'INVALID_SUBTASK_INPUT', 400)
  }
  const supabase = getAppSupabase()
  const { error } = await supabase.from('tarefa_subtarefas').update(update).eq('id', id)
  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar subtarefa')
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'tarefas', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = String(body?.id ?? '')
  if (!id) return serverErrorResponse('Subtarefa inválida', 'INVALID_SUBTASK_INPUT', 400)
  const tarefaId = await tarefaIdOfSubtarefa(id)
  if (!tarefaId || !(await canTouchTarefa(session, tarefaId))) {
    return serverErrorResponse('Subtarefa não encontrada', 'SUBTASK_NOT_FOUND', 404)
  }
  const supabase = getAppSupabase()
  const { error } = await supabase.from('tarefa_subtarefas').delete().eq('id', id)
  if (error) return supabaseErrorResponse(error, 'Falha ao excluir subtarefa')
  return NextResponse.json({ ok: true })
}
