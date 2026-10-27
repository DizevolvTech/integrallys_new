import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getPacienteIdByUserId, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { authErrorResponse, getRequestAuth, type RequestAuth } from '@/lib/request-auth'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

interface NotificationItem {
  id: string
  title: string
  description: string
  date: string
  timestamp: string
  href: string
  kind: 'agenda' | 'financeiro' | 'lista_espera' | 'pagamento' | 'prescricao'
  read: boolean
}

interface NotificationDraft {
  sourceKey: string
  title: string
  description: string
  date: string
  timestamp: string
  href: string
  kind: 'agenda' | 'financeiro' | 'lista_espera' | 'pagamento' | 'prescricao'
  sourceTable: string
  sourceId: string | null
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ''
  return formatarDataHoraClinica(value)
}

function normalizeTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }
  return date.toISOString()
}

async function syncNotifications(userId: string, drafts: NotificationDraft[]) {
  const supabase = getAppSupabase()
  if (drafts.length === 0) return null

  const rows = drafts.map((item) => ({
    usuario_id: userId,
    titulo: item.title,
    descricao: item.description,
    href: item.href,
    kind: item.kind,
    ocorrido_em: normalizeTimestamp(item.timestamp),
    source_key: item.sourceKey,
    source_table: item.sourceTable,
    source_id: item.sourceId,
  }))

  const { error } = await supabase.from('notificacoes').upsert(rows, {
    onConflict: 'usuario_id,source_key',
    ignoreDuplicates: false,
  })

  return error
}

async function loadPersistedNotifications(userId: string) {
  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('notificacoes')
    .select('id,titulo,descricao,href,kind,lida,ocorrido_em')
    .eq('usuario_id', userId)
    .order('ocorrido_em', { ascending: false })
    .limit(20)

  if (error) {
    return { data: null, error }
  }

  return {
    data: (data ?? []).map<NotificationItem>((item) => ({
      id: String(item.id),
      title: String(item.titulo ?? ''),
      description: String(item.descricao ?? ''),
      date: formatDateTime(String(item.ocorrido_em ?? '')),
      timestamp: String(item.ocorrido_em ?? ''),
      href: String(item.href ?? '/'),
      kind: item.kind as NotificationItem['kind'],
      read: Boolean(item.lida),
    })),
    error: null,
  }
}

async function buildInternalNotifications(session: RequestAuth) {
  const supabase = getAppSupabase()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  const [agendaResult, waitlistResult, financeiroResult] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id,data_agendamento,horario_inicio,status')
      .gte('data_agendamento', todayIso)
      .order('data_agendamento', { ascending: true })
      .order('horario_inicio', { ascending: true })
      .limit(3),
    supabase
      .from('lista_espera')
      .select('id,created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('financeiro_lancamentos')
      .select('id,descricao,status,data_lancamento')
      .eq('status', 'Pendente')
      .order('data_lancamento', { ascending: false })
      .limit(3),
  ])

  if (agendaResult.error) return supabaseErrorResponse(agendaResult.error, 'Falha ao carregar notificações')
  if (waitlistResult.error) return supabaseErrorResponse(waitlistResult.error, 'Falha ao carregar notificações')
  if (financeiroResult.error) return supabaseErrorResponse(financeiroResult.error, 'Falha ao carregar notificações')

  const notifications: NotificationDraft[] = []

  if ((agendaResult.data ?? []).length > 0) {
    for (const item of agendaResult.data ?? []) {
      notifications.push({
        sourceKey: `agenda-${item.id}`,
        title: 'Consulta agendada',
        description: `${item.status} para ${String(item.data_agendamento ?? '')} às ${String(item.horario_inicio ?? '').slice(0, 5)}`,
        date: formatDateTime(`${item.data_agendamento}T${String(item.horario_inicio ?? '00:00:00')}`),
        timestamp: `${item.data_agendamento}T${String(item.horario_inicio ?? '00:00:00')}`,
        href: '/agenda',
        kind: 'agenda',
        sourceTable: 'agendamentos',
        sourceId: String(item.id),
      })
    }
  }

  for (const item of financeiroResult.data ?? []) {
    notifications.push({
      sourceKey: `financeiro-${item.id}`,
      title: 'Lançamento pendente',
      description: String(item.descricao ?? 'Lançamento aguardando baixa'),
      date: formatDateTime(item.data_lancamento ? String(item.data_lancamento) : ''),
      timestamp: item.data_lancamento ? `${String(item.data_lancamento)}T00:00:00` : '',
      href: '/financeiro',
      kind: 'financeiro',
      sourceTable: 'financeiro_lancamentos',
      sourceId: String(item.id),
    })
  }

  if ((waitlistResult.data ?? []).length > 0) {
    notifications.push({
      sourceKey: 'lista-espera-resumo',
      title: 'Pacientes na lista de espera',
      description: `${waitlistResult.data.length} paciente(s) aguardando encaixe.`,
      date: formatDateTime(waitlistResult.data[0]?.created_at),
      timestamp: String(waitlistResult.data[0]?.created_at ?? ''),
      href: '/lista-espera',
      kind: 'lista_espera',
      sourceTable: 'lista_espera',
      sourceId: String(waitlistResult.data[0]?.id ?? ''),
    })
  }

  const syncError = await syncNotifications(session.userId, notifications)
  if (syncError) return supabaseErrorResponse(syncError, 'Falha ao sincronizar notificações')

  const persisted = await loadPersistedNotifications(session.userId)
  if (persisted.error) return supabaseErrorResponse(persisted.error, 'Falha ao carregar notificações')

  return NextResponse.json({ data: persisted.data ?? [], meta: session })
}

async function buildPatientNotifications(session: RequestAuth) {
  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao carregar notificações')
  if (!pacienteId) return NextResponse.json({ data: [], meta: session })

  const todayIso = new Date().toISOString().slice(0, 10)
  const [agendaResult, pagamentosResult, prescricoesResult] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id,data_agendamento,horario_inicio,status,observacoes')
      .eq('paciente_id', pacienteId)
      .gte('data_agendamento', todayIso)
      .order('data_agendamento', { ascending: true })
      .order('horario_inicio', { ascending: true })
      .limit(3),
    supabase
      .from('pagamentos_paciente')
      .select('id,descricao,status,vencimento_em')
      .eq('paciente_id', pacienteId)
      .in('status', ['Pendente', 'Vencido'])
      .order('vencimento_em', { ascending: true })
      .limit(3),
    supabase
      .from('prescricoes')
      .select('id,numero,tipo,data_prescricao')
      .eq('paciente_id', pacienteId)
      .order('data_prescricao', { ascending: false })
      .limit(2),
  ])

  if (agendaResult.error) return supabaseErrorResponse(agendaResult.error, 'Falha ao carregar notificações')
  if (pagamentosResult.error) return supabaseErrorResponse(pagamentosResult.error, 'Falha ao carregar notificações')
  if (prescricoesResult.error) return supabaseErrorResponse(prescricoesResult.error, 'Falha ao carregar notificações')

  const notifications: NotificationDraft[] = []

  for (const item of agendaResult.data ?? []) {
    notifications.push({
      sourceKey: `portal-agenda-${item.id}`,
      title: 'Próxima consulta',
      description: `${String(item.observacoes ?? 'Consulta agendada')} em ${String(item.data_agendamento ?? '')} às ${String(item.horario_inicio ?? '').slice(0, 5)}`,
      date: formatDateTime(`${item.data_agendamento}T${String(item.horario_inicio ?? '00:00:00')}`),
      timestamp: `${item.data_agendamento}T${String(item.horario_inicio ?? '00:00:00')}`,
      href: '/agenda',
      kind: 'agenda',
      sourceTable: 'agendamentos',
      sourceId: String(item.id),
    })
  }

  for (const item of pagamentosResult.data ?? []) {
    notifications.push({
      sourceKey: `portal-pagamento-${item.id}`,
      title: item.status === 'Vencido' ? 'Pagamento vencido' : 'Pagamento pendente',
      description: String(item.descricao ?? 'Cobrança disponível no portal'),
      date: formatDateTime(item.vencimento_em ? `${item.vencimento_em}T00:00:00` : ''),
      timestamp: item.vencimento_em ? `${item.vencimento_em}T00:00:00` : '',
      href: '/pagamentos',
      kind: 'pagamento',
      sourceTable: 'pagamentos_paciente',
      sourceId: String(item.id),
    })
  }

  for (const item of prescricoesResult.data ?? []) {
    notifications.push({
      sourceKey: `portal-prescricao-${item.id}`,
      title: 'Nova prescrição disponível',
      description: `${String(item.tipo ?? 'Documento')} ${String(item.numero ?? '').trim()}`.trim(),
      date: formatDateTime(item.data_prescricao ? `${item.data_prescricao}T00:00:00` : ''),
      timestamp: item.data_prescricao ? `${item.data_prescricao}T00:00:00` : '',
      href: '/prescricoes',
      kind: 'prescricao',
      sourceTable: 'prescricoes',
      sourceId: String(item.id),
    })
  }

  const syncError = await syncNotifications(session.userId, notifications)
  if (syncError) return supabaseErrorResponse(syncError, 'Falha ao sincronizar notificações')

  const persisted = await loadPersistedNotifications(session.userId)
  if (persisted.error) return supabaseErrorResponse(persisted.error, 'Falha ao carregar notificações')

  return NextResponse.json({ data: persisted.data ?? [], meta: session })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  if (session.role === 'paciente') {
    return buildPatientNotifications(session)
  }

  return buildInternalNotifications(session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : typeof body?.id === 'string' && body.id
      ? [body.id]
      : []

  if (ids.length === 0) {
    return serverErrorResponse('Notificação inválida', 'INVALID_NOTIFICATION', 400)
  }

  const supabase = getAppSupabase()
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('usuario_id', session.userId)
    .in('id', ids)

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar notificação')
  }

  return NextResponse.json({ data: ids.map((id) => ({ id, read: true })), meta: session })
}
