import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import type { AgendamentoStatus } from '@/types/agenda'
import { carregarCaixasPorUnidade, type CaixaUnidade } from './caixas'
import { calcularPerformance, classificarFaturamento, type TipoFaturamento } from './performance'
import { agendamentoConta, contarSituacoes } from './retornos'
import { descreverPedidosNf, resumirPedidosNf } from '@/lib/pedidos-nf'
import { formatarDataHoraClinica } from '@/lib/fuso-clinica'

type DashboardVariant = 'admin' | 'gestor' | 'recepcao' | 'especialista' | 'master'

// Cobertura completa dos status do enum `agendamento_status` (migrations
// 002 + 046) + derivados UI vindos de `normalizeAgendaStatus`
// (`src/features/agenda/agenda.utils.ts`). Mantemos `.includes` por
// robustez a variações de case/grafia no fluxo de chamadores — por isso
// o retorno é `AgendamentoStatus | string` (string cobre os derivados UI
// como 'Em espera', 'Atrasado', 'Pendente' que não existem no enum).
const statusLabel = (status: string): AgendamentoStatus | string => {
  const normalized = status.toLowerCase()
  if (normalized.includes('confirm')) return 'Confirmado'
  if (normalized.includes('check-in')) return 'Check-in'
  if (normalized.includes('atendimento')) return 'Em atendimento'
  if (normalized.includes('espera') || normalized.includes('aguard')) return 'Em espera'
  if (normalized.includes('atras')) return 'Atrasado'
  if (normalized.includes('check-out') || normalized.includes('concl')) return 'Concluído'
  if (normalized.includes('cancel')) return 'Cancelado'
  if (normalized.includes('faltou')) return 'Faltou'
  if (normalized.includes('adiad')) return 'Adiado'
  if (normalized.includes('bloque')) return 'Bloqueado'
  if (normalized.includes('dispon')) return 'Disponível'
  if (normalized.includes('agend')) return 'Agendado'
  return status || 'Pendente'
}

interface FinanceiroUnidade {
  unidadeId: string | null
  unidade: string
  entradas: number
  saidas: number
  saldo: number
  faturamento: Record<TipoFaturamento, number>
}

// Todo card do início é atalho (pedido da cliente, item 41).
const CARD_HREF: Record<string, string> = {
  'agenda-hoje': '/agenda',
  confirmados: '/agenda',
  'em-espera': '/agenda',
  atrasados: '/agenda',
  concluidas: '/agenda',
  entradas: '/financeiro',
  saidas: '/financeiro',
  saldo: '/financeiro',
  receita: '/financeiro',
  'lista-espera': '/lista-espera',
  'pendentes-retorno': '/retornos?situacao=limite',
  'pendentes-presc': '/prescricoes',
  notas: '/notas-fiscais',
  unidades: '/unidades',
  usuarios: '/usuarios',
}

const endOfMonthIso = (monthStart: string) => {
  const lastDay = new Date(Date.UTC(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0)).getUTCDate()
  return `${monthStart.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
}

const toVariant = (role: string): DashboardVariant => {
  if (role === 'master') return 'master'
  if (role === 'admin') return 'admin'
  if (role === 'gestor') return 'gestor'
  if (role === 'especialista') return 'especialista'
  return 'recepcao'
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'dashboard', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const monthStart = `${todayIso.slice(0, 7)}-01`
  const variant = toVariant(session.role)

  const url = new URL(request.url)
  const periodoParam = url.searchParams.get('periodo') ?? 'mes'
  const deParam = url.searchParams.get('de')
  const ateParam = url.searchParams.get('ate')
  const unidadeIdParam = url.searchParams.get('unidade_id')

  const computePeriod = (): { from: string; to: string; label: string } => {
    if (periodoParam === 'hoje') return { from: todayIso, to: todayIso, label: 'hoje' }
    if (periodoParam === '7d') {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { from: start.toISOString().slice(0, 10), to: todayIso, label: '7d' }
    }
    if (periodoParam === 'custom' && deParam && ateParam) {
      return { from: deParam, to: ateParam, label: 'custom' }
    }
    return { from: monthStart, to: todayIso, label: 'mes' }
  }
  const adminPeriod = variant === 'admin' ? computePeriod() : { from: monthStart, to: todayIso, label: 'mes' }
  const adminUnidadeId = variant === 'admin' && unidadeIdParam && unidadeIdParam !== 'all' ? unidadeIdParam : null

  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao carregar dashboard')
  }
  const unidadeId = scopedUnit.unidadeId

  let agendaCountQuery = supabase
    .from('agendamentos')
    .select('*', { count: 'exact', head: true })
    .eq('data_agendamento', todayIso)
    .not('paciente_id', 'is', null) // horários livres e bloqueios não são atendimento

  let agendaRowsQuery = supabase
    .from('agendamentos')
    .select('id,paciente_id,profissional_id,data_agendamento,horario_inicio,status,observacoes')
    .eq('data_agendamento', todayIso)
    .not('paciente_id', 'is', null) // horários livres e bloqueios não são atendimento
    .order('horario_inicio', { ascending: true })
    .limit(12)

  let pacientesCountQuery = supabase.from('pacientes').select('*', { count: 'exact', head: true })
  const tarefasCountQuery = supabase.from('tarefas').select('*', { count: 'exact', head: true }).eq('status', 'Pendente')
  const usuariosCountQuery = supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('status', 'Ativo')
  const notificacoesCountQuery = supabase.from('notificacoes').select('*', { count: 'exact', head: true }).eq('lida', false)
  const isAdmin = variant === 'admin'

  // Admin precisa de TODOS os lançamentos do período (sem limit) para agrupar por unidade.
  // Demais perfis seguem com limit(50) para ficar leve.
  const financeiroFrom = isAdmin ? adminPeriod.from : monthStart
  const financeiroTo = isAdmin ? adminPeriod.to : todayIso
  let financeiroQuery = supabase
    .from('financeiro_lancamentos')
    .select('id,descricao,categoria,valor,tipo,status,data_lancamento,unidade_id,vencimento')
    .gte('data_lancamento', financeiroFrom)
    .lte('data_lancamento', `${financeiroTo}T23:59:59.999Z`)
    .order('data_lancamento', { ascending: false })
    .limit(isAdmin ? 5000 : 50)

  if (variant === 'especialista') {
    agendaCountQuery = agendaCountQuery.eq('profissional_id', session.userId)
    agendaRowsQuery = agendaRowsQuery.eq('profissional_id', session.userId)
  } else if (unidadeId && (variant === 'recepcao' || variant === 'gestor')) {
    agendaCountQuery = agendaCountQuery.eq('unidade_id', unidadeId)
    agendaRowsQuery = agendaRowsQuery.eq('unidade_id', unidadeId)
    pacientesCountQuery = pacientesCountQuery.eq('unidade_id', unidadeId)
    financeiroQuery = financeiroQuery.eq('unidade_id', unidadeId)
  }

  if (isAdmin && adminUnidadeId) {
    financeiroQuery = financeiroQuery.eq('unidade_id', adminUnidadeId)
  }

  // Retornos em aberto: mesma fonte e regra da tela /retornos (view retornos_em_aberto).
  let retornosQuery = supabase
    .from('retornos_em_aberto')
    .select('situacao')
    .in('situacao', ['no_prazo', 'limite', 'vencido'])
    .limit(5000)
  if (variant === 'especialista') {
    retornosQuery = retornosQuery.eq('profissional_id', session.userId)
  } else if (isAdmin ? adminUnidadeId : unidadeId) {
    retornosQuery = retornosQuery.eq('unidade_id', String(isAdmin ? adminUnidadeId : unidadeId))
  }

  // Performance (especialista = só os próprios; admin = clínica/unidade no período).
  const isEspecialista = variant === 'especialista'
  const needsPerformance = isEspecialista || isAdmin
  const perfFrom = isEspecialista ? monthStart : adminPeriod.from
  const perfTo = isEspecialista ? endOfMonthIso(monthStart) : adminPeriod.to
  let perfAgendaQuery = supabase
    .from('agendamentos')
    .select('paciente_id,status,tipo,valor_procedimento')
    .gte('data_agendamento', perfFrom)
    .lte('data_agendamento', perfTo)
    .limit(10000)
  let perfPrescricoesQuery = supabase
    .from('prescricoes')
    .select('paciente_id,status,tipo,valor_total')
    .gte('data_prescricao', perfFrom)
    .lte('data_prescricao', perfTo)
    .limit(5000)
  if (isEspecialista) {
    perfAgendaQuery = perfAgendaQuery.eq('profissional_id', session.userId)
    perfPrescricoesQuery = perfPrescricoesQuery.eq('profissional_id', session.userId)
  } else if (adminUnidadeId) {
    perfAgendaQuery = perfAgendaQuery.eq('unidade_id', adminUnidadeId)
  }

  // Caixinha de troco / saldos de caixa (gestor e admin).
  const caixasUnidades = isAdmin ? (adminUnidadeId ? [adminUnidadeId] : null) : unidadeId ? [unidadeId] : null
  const caixasPromise =
    variant === 'gestor' || isAdmin
      ? carregarCaixasPorUnidade(supabase, caixasUnidades)
      : Promise.resolve({ caixas: [] as CaixaUnidade[], error: null })
  const emptyPerf = Promise.resolve({ data: [] as never[], error: null })
  // Pedidos de NF (recibo da venda/consulta): só o admin tem o card; a emissão da nota é feita fora do sistema.
  const pedidosNfPromise = isAdmin
    ? Promise.resolve(supabase.from('pedidos_nf').select('status,valor').in('status', ['pendente', 'emitida']).limit(1000))
    : emptyPerf

  const [
    agendaCountResult,
    agendaRowsResult,
    pacientesResult,
    tarefasResult,
    usuariosResult,
    notificacoesResult,
    financeiroResult,
    unidadesResult,
    especialistasResult,
    auditResult,
    birthdaysResult,
    retornosResult,
    perfAgendaResult,
    perfPrescricoesResult,
    caixasResult,
    pedidosNfResult,
  ] = await Promise.all([
    agendaCountQuery,
    agendaRowsQuery,
    pacientesCountQuery,
    tarefasCountQuery,
    usuariosCountQuery,
    notificacoesCountQuery,
    financeiroQuery,
    supabase.from('unidades').select('id,status,nome,cidade'),
    supabase
      .from('usuarios')
      .select('id')
      .eq('perfil', 'especialista')
      .eq('status', 'Ativo'),
    supabase.from('audit_log').select('acao,recurso,created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('pacientes').select('id,nome,data_nascimento,unidade_id'),
    retornosQuery,
    needsPerformance ? perfAgendaQuery : emptyPerf,
    needsPerformance ? perfPrescricoesQuery : emptyPerf,
    caixasPromise,
    pedidosNfPromise,
  ])

  const errors = [
    agendaCountResult.error,
    agendaRowsResult.error,
    pacientesResult.error,
    tarefasResult.error,
    usuariosResult.error,
    notificacoesResult.error,
    financeiroResult.error,
    unidadesResult.error,
    especialistasResult.error,
    auditResult.error,
    birthdaysResult.error,
    retornosResult.error,
    perfAgendaResult.error,
    perfPrescricoesResult.error,
    caixasResult.error,
    pedidosNfResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    return supabaseErrorResponse(errors[0]!, 'Falha ao carregar dashboard')
  }

  const agendaRows = agendaRowsResult.data ?? []
  const [pacienteMapResult, profissionalMapResult] = await Promise.all([
    getEntityNameMap(supabase, 'pacientes', agendaRows.map((row) => String(row.paciente_id ?? ''))),
    getEntityNameMap(supabase, 'usuarios', agendaRows.map((row) => String(row.profissional_id ?? ''))),
  ])

  const nameMapErrors = [pacienteMapResult.error, profissionalMapResult.error].filter(Boolean)
  if (nameMapErrors.length > 0) {
    return supabaseErrorResponse(nameMapErrors[0]!, 'Falha ao montar dashboard')
  }

  const appointments = agendaRows.map((row) => {
    const patient = pacienteMapResult.map[String(row.paciente_id ?? '')] || 'Paciente'
    const professional = profissionalMapResult.map[String(row.profissional_id ?? '')] || 'Especialista'
    const status = statusLabel(String(row.status ?? ''))
    return {
      id: String(row.id),
      patient,
      professional,
      procedure: String(row.observacoes ?? 'consulta'),
      status,
      time: String(row.horario_inicio ?? '--:--').slice(0, 5),
    }
  })

  const recentPatients = agendaRows.slice(0, 6).map((row) => {
    const patient = pacienteMapResult.map[String(row.paciente_id ?? '')] || 'Paciente'
    const rawStatus = String(row.status ?? '').toLowerCase()
    const initials =
      patient
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'PA'

    return {
      id: String(row.id),
      initials,
      name: patient,
      type: String(row.observacoes ?? 'consulta'),
      time: String(row.horario_inicio ?? '--:--').slice(0, 5),
      status: rawStatus.includes('check-out') || rawStatus.includes('concl') ? 'Concluída' : 'Pendente',
    }
  })

  const agendaConfirmados = appointments.filter((item) => {
    const normalized = item.status.toLowerCase()
    return normalized.includes('confirm') || normalized.includes('check') || normalized.includes('atendimento')
  }).length

  const agendaEspera = appointments.filter((item) => {
    const normalized = item.status.toLowerCase()
    return normalized.includes('espera') || normalized.includes('check-in')
  }).length
  const agendaAtrasados = appointments.filter((item) => item.status.toLowerCase().includes('atras')).length

  const financeiroRows = financeiroResult.data ?? []
  const recebimentosPendentes = financeiroRows.reduce((acc, row) => {
    const tipo = String(row.tipo ?? '').toLowerCase()
    const status = String(row.status ?? '').toLowerCase()
    if (tipo === 'receita' && !status.includes('pago') && !status.includes('quitado')) return acc + Number(row.valor ?? 0)
    return acc
  }, 0)

  const pagamentosPendentes = financeiroRows.reduce((acc, row) => {
    const tipo = String(row.tipo ?? '').toLowerCase()
    const status = String(row.status ?? '').toLowerCase()
    if (tipo === 'despesa' && !status.includes('pago') && !status.includes('quitado')) return acc + Number(row.valor ?? 0)
    return acc
  }, 0)

  const receitaMensal = financeiroRows.reduce((acc, row) => {
    const tipo = String(row.tipo ?? '').toLowerCase()
    if (tipo === 'receita') return acc + Number(row.valor ?? 0)
    return acc
  }, 0)

  const despesaMensal = financeiroRows.reduce((acc, row) => {
    const tipo = String(row.tipo ?? '').toLowerCase()
    if (tipo === 'despesa') return acc + Number(row.valor ?? 0)
    return acc
  }, 0)

  const saldoPrevisto = financeiroRows.reduce((acc, row) => {
    const tipo = String(row.tipo ?? '').toLowerCase()
    const valor = Number(row.valor ?? 0)
    return tipo === 'receita' ? acc + valor : acc - valor
  }, 0)

  const pacientesRows = (birthdaysResult.data ?? []).filter((row) => {
    const escopo = isAdmin ? adminUnidadeId : unidadeId
    return !escopo || !row.unidade_id || String(row.unidade_id) === escopo
  })
  const pacienteIdsVisiveis = new Set(pacientesRows.map((row) => String(row.id)))

  const birthdays = pacientesRows
    .filter((row) => {
      if (!row.data_nascimento) return false
      // date-only (YYYY-MM-DD): compare em meio-dia local para evitar deslocamento UTC→BRT
      const raw = String(row.data_nascimento).slice(0, 10)
      const date = new Date(`${raw}T12:00:00`)
      return date.getDate() === today.getDate() && date.getMonth() === today.getMonth()
    })
    .slice(0, 5)
    .map((row) => {
      const raw = String(row.data_nascimento).slice(0, 10)
      const date = new Date(`${raw}T12:00:00`)
      return {
        id: String(row.id),
        name: String(row.nome ?? 'Paciente'),
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }
    })

  const retornosContagem = contarSituacoes(retornosResult.data ?? [])
  const retornosLimitePrazo = retornosContagem.limitePrazo
  const retornosVencidos = retornosContagem.vencidos

  // Performance charts (especialista e admin) — últimas 4 semanas + distribuição por tipo
  let atendimentosPorSemana: { semana: string; total: number }[] = []
  let tiposConsulta: { tipo: string; total: number }[] = []
  if (variant === 'especialista' || isAdmin) {
    const fourWeeksAgo = new Date(today)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 27)
    const fourWeeksAgoIso = fourWeeksAgo.toISOString().slice(0, 10)
    let chartQuery = supabase
      .from('agendamentos')
      .select('data_agendamento,observacoes,status,paciente_id')
      .gte('data_agendamento', fourWeeksAgoIso)
      .lte('data_agendamento', todayIso)
    if (variant === 'especialista') {
      chartQuery = chartQuery.eq('profissional_id', session.userId)
    }
    const { data: chartRows, error: chartError } = await chartQuery

    if (chartError) {
      return supabaseErrorResponse(chartError, 'Falha ao carregar gráficos do dashboard')
    }

    const semanaBuckets: { label: string; start: Date; total: number }[] = []
    for (let i = 3; i >= 0; i--) {
      const start = new Date(today)
      start.setDate(start.getDate() - 7 * i - 6)
      semanaBuckets.push({ label: `Sem ${4 - i}`, start, total: 0 })
    }

    const tiposBuckets = new Map<string, number>()

    for (const row of chartRows ?? []) {
      if (!row.paciente_id || !agendamentoConta(row.status as string | null)) continue // slots livres e bloqueios não são atendimento
      const dataStr = row.data_agendamento ? String(row.data_agendamento) : null
      if (dataStr) {
        const date = new Date(dataStr)
        for (let i = semanaBuckets.length - 1; i >= 0; i--) {
          if (date.getTime() >= semanaBuckets[i].start.getTime()) {
            semanaBuckets[i].total++
            break
          }
        }
      }
      const rawTipo = String(row.observacoes ?? '').trim()
      const normalizedTipo = rawTipo
        ? rawTipo.charAt(0).toUpperCase() + rawTipo.slice(1).toLowerCase()
        : 'Consulta'
      tiposBuckets.set(normalizedTipo, (tiposBuckets.get(normalizedTipo) ?? 0) + 1)
    }

    atendimentosPorSemana = semanaBuckets.map(({ label, total }) => ({ semana: label, total }))
    tiposConsulta = Array.from(tiposBuckets.entries())
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total)
  }

  // Blocos exclusivos do AdminDashboard (CR-REV-J)
  const unidadesMap = new Map<string, string>()
  for (const u of unidadesResult.data ?? []) {
    unidadesMap.set(String(u.id), String(u.nome ?? 'Sem nome'))
  }
  const unidadeNome = (id: string | null | undefined) =>
    id ? unidadesMap.get(String(id)) ?? 'Sem unidade' : 'Sem unidade'

  let saldoCaixas: Array<{ id: string; unidadeId: string; unidade: string; status: string; saldo: number; troco: number; cofre: number }> = []
  let saldoBancos: { id: string; unidade: string; nome: string; banco: string; tipo: string; saldo: number }[] = []
  let financeiroPorUnidade: FinanceiroUnidade[] = []
  let prescricoesPendentes = { limitePrazo: 0, vencidos: 0 }
  let listaEsperaCount = 0
  let estoqueCritico: { count: number; itens: { id: string; nome: string; quantidade: number; estoqueMinimo: number }[] } = { count: 0, itens: [] }
  let topProcedimentos: { nome: string; total: number }[] = []
  let inadimplencia: { totalValor: number; totalLancamentos: number; link: string } = {
    totalValor: 0,
    totalLancamentos: 0,
    link: '/financeiro?status=pendente&vencido=true',
  }
  let noShowSemanal: {
    cancelados: number
    noShow: number
    total: number
    taxaCancelamento: string
    taxaNoShow: string
  } = { cancelados: 0, noShow: 0, total: 0, taxaCancelamento: '0%', taxaNoShow: '0%' }
  let aniversariantesSemana: Array<{
    id: string
    nome: string
    dataNascimento: string
    diaAniversario: string
  }> = []
  let unidadesComparativo: Array<{
    unidadeId: string | null
    unidadeNome: string
    agendamentos: number
    receita: number
  }> = []

  if (isAdmin) {
    const fourWeeksAgo = new Date(today)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 27)
    const fourWeeksAgoIso = fourWeeksAgo.toISOString().slice(0, 10)

    const [
      contasBancariasResult,
      prescricoesResult,
      listaEsperaResult,
      estoqueResult,
      agendamentosUltimos28DiasResult,
      agendamentosPorUnidadeResult,
    ] = await Promise.all([
      supabase
        .from('contas_bancarias')
        .select('id,unidade_id,nome,banco,tipo,saldo_inicial')
        .eq('ativo', true),
      supabase.from('prescricoes').select('id,paciente_id,validade').limit(2000),
      adminUnidadeId
        ? supabase.from('lista_espera').select('*', { count: 'exact', head: true }).eq('unidade_id', adminUnidadeId)
        : supabase.from('lista_espera').select('*', { count: 'exact', head: true }),
      supabase.from('produtos_estoque').select('id,nome,quantidade,estoque_minimo').eq('controla_estoque', true).limit(1000),
      supabase
        .from('agendamentos')
        .select('observacoes,paciente_id,status')
        .gte('data_agendamento', fourWeeksAgoIso)
        .lte('data_agendamento', todayIso),
      // Comparativo por unidade — 1 query agrupada em memória (padrão grupoUnidades:461),
      // não N+1 por unidade
      supabase
        .from('agendamentos')
        .select('unidade_id,paciente_id,status')
        .gte('data_agendamento', adminPeriod.from)
        .lte('data_agendamento', adminPeriod.to),
    ])

    const adminErrors = [
      contasBancariasResult.error,
      prescricoesResult.error,
      listaEsperaResult.error,
      estoqueResult.error,
      agendamentosUltimos28DiasResult.error,
      agendamentosPorUnidadeResult.error,
    ].filter(Boolean)

    if (adminErrors.length > 0) {
      return supabaseErrorResponse(adminErrors[0]!, 'Falha ao carregar blocos do admin')
    }

    saldoCaixas = caixasResult.caixas
      .filter((caixa) => !adminUnidadeId || caixa.unidadeId === adminUnidadeId)
      .map((caixa) => ({
        id: caixa.sessaoId,
        unidadeId: caixa.unidadeId,
        unidade: unidadeNome(caixa.unidadeId),
        status: caixa.status,
        saldo: caixa.saldoCaixa,
        troco: caixa.troco,
        cofre: caixa.cofre,
      }))

    const contasRows = contasBancariasResult.data ?? []
    const contaIds = contasRows.map((row) => String(row.id))
    const movTotal = new Map<string, number>()
    if (contaIds.length > 0) {
      const { data: ofx } = await supabase
        .from('conciliacao_ofx')
        .select('conta_id,tipo,valor')
        .in('conta_id', contaIds)
      for (const row of ofx ?? []) {
        const contaId = String(row.conta_id ?? '')
        if (!contaId) continue
        const valor = Math.abs(Number(row.valor ?? 0))
        const delta = String(row.tipo ?? '').toUpperCase() === 'DEBIT' ? -valor : valor
        movTotal.set(contaId, (movTotal.get(contaId) ?? 0) + delta)
      }
    }

    saldoBancos = contasRows.map((row) => {
      const id = String(row.id)
      const saldoInicial = Number(row.saldo_inicial ?? 0)
      return {
        id,
        unidade: unidadeNome(row.unidade_id ? String(row.unidade_id) : null),
        nome: String(row.nome ?? 'Conta'),
        banco: String(row.banco ?? ''),
        tipo: String(row.tipo ?? 'corrente'),
        saldo: Number((saldoInicial + (movTotal.get(id) ?? 0)).toFixed(2)),
      }
    })

    // Faturamento e saídas por unidade — usa todos os lançamentos do mês
    const grupoUnidades = new Map<string, { entradas: number; saidas: number; porTipo: Record<TipoFaturamento, number> }>()
    for (const row of financeiroRows) {
      const key = row.unidade_id ? String(row.unidade_id) : 'sem-unidade'
      if (!grupoUnidades.has(key)) grupoUnidades.set(key, { entradas: 0, saidas: 0, porTipo: { procedimentos: 0, consultas: 0, produtos: 0, outros: 0 } })
      const tipo = String(row.tipo ?? '').toLowerCase()
      const valor = Number(row.valor ?? 0)
      const entry = grupoUnidades.get(key)!
      if (tipo === 'receita') {
        entry.entradas += valor
        entry.porTipo[classificarFaturamento(row.categoria as string | null)] += valor
      }
      else if (tipo === 'despesa') entry.saidas += valor
    }
    financeiroPorUnidade = Array.from(grupoUnidades.entries())
      .map(([unidadeId, { entradas, saidas, porTipo }]) => ({
        unidadeId: unidadeId === 'sem-unidade' ? null : unidadeId,
        unidade: unidadeId === 'sem-unidade' ? 'Sem unidade' : unidadeNome(unidadeId),
        entradas,
        saidas,
        saldo: entradas - saidas,
        faturamento: porTipo,
      }))
      .sort((a, b) => b.entradas - a.entradas)

    // Comparativo de unidades: combina contagem de agendamentos por unidade
    // (1 query agrupada acima) com a receita já calculada em financeiroPorUnidade.
    // Mesmo pattern de grupoUnidades — sem N+1.
    const agendamentosPorUnidade = new Map<string, number>()
    for (const row of agendamentosPorUnidadeResult.data ?? []) {
      if (!row.paciente_id || !agendamentoConta(row.status as string | null)) continue
      const key = row.unidade_id ? String(row.unidade_id) : 'sem-unidade'
      agendamentosPorUnidade.set(key, (agendamentosPorUnidade.get(key) ?? 0) + 1)
    }
    const receitaPorUnidadeKey = new Map<string, number>()
    for (const item of financeiroPorUnidade) {
      const key = item.unidadeId ?? 'sem-unidade'
      receitaPorUnidadeKey.set(key, item.entradas)
    }
    const unidadeNomeByKey = new Map<string, string>()
    for (const item of financeiroPorUnidade) {
      unidadeNomeByKey.set(item.unidadeId ?? 'sem-unidade', item.unidade)
    }
    const comparativoKeys = new Set<string>([
      ...agendamentosPorUnidade.keys(),
      ...receitaPorUnidadeKey.keys(),
    ])
    unidadesComparativo = Array.from(comparativoKeys)
      .map((key) => ({
        unidadeId: key === 'sem-unidade' ? null : key,
        unidadeNome:
          unidadeNomeByKey.get(key) ??
          (key === 'sem-unidade' ? 'Sem unidade' : unidadeNome(key)),
        agendamentos: agendamentosPorUnidade.get(key) ?? 0,
        receita: receitaPorUnidadeKey.get(key) ?? 0,
      }))
      .sort((a, b) => b.receita - a.receita)

    // Prescrições limite/vencidas (mesma lógica de /api/relatorios/prescricoes)
    const limiteDate = new Date(today)
    limiteDate.setDate(limiteDate.getDate() + 10)
    const todayDateOnly = todayIso
    const limiteIso = limiteDate.toISOString().slice(0, 10)
    for (const row of prescricoesResult.data ?? []) {
      if (adminUnidadeId && row.paciente_id && !pacienteIdsVisiveis.has(String(row.paciente_id))) continue
      const validade = row.validade ? String(row.validade) : null
      if (!validade) continue
      if (validade < todayDateOnly) prescricoesPendentes.vencidos += 1
      else if (validade <= limiteIso) prescricoesPendentes.limitePrazo += 1
    }

    listaEsperaCount = Number(listaEsperaResult.count ?? 0)

    const itensCriticos = (estoqueResult.data ?? [])
      .filter((row) => Number(row.quantidade ?? 0) <= Number(row.estoque_minimo ?? 0))
      .map((row) => ({
        id: String(row.id),
        nome: String(row.nome ?? 'Produto'),
        quantidade: Number(row.quantidade ?? 0),
        estoqueMinimo: Number(row.estoque_minimo ?? 0),
      }))
    estoqueCritico = { count: itensCriticos.length, itens: itensCriticos.slice(0, 5) }

    // Top procedimentos do mês (aproximação por `observacoes` dos agendamentos
    // dos últimos 28 dias — não há FK para `procedimentos` no agendamento)
    const procBuckets = new Map<string, number>()
    for (const row of agendamentosUltimos28DiasResult.data ?? []) {
      if (!row.paciente_id || !agendamentoConta(row.status as string | null)) continue
      const raw = String(row.observacoes ?? '').trim()
      const nome = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : 'Consulta'
      procBuckets.set(nome, (procBuckets.get(nome) ?? 0) + 1)
    }
    topProcedimentos = Array.from(procBuckets.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Inadimplência: lançamentos de receita pendentes com vencimento < hoje
    let inadimplenciaQuery = supabase
      .from('financeiro_lancamentos')
      .select('id,valor,vencimento,status,tipo,unidade_id')
      .eq('tipo', 'receita')
      .not('vencimento', 'is', null)
      .lt('vencimento', todayIso)
      .neq('status', 'Pago')
      .neq('status', 'Quitado')
    if (adminUnidadeId) inadimplenciaQuery = inadimplenciaQuery.eq('unidade_id', adminUnidadeId)
    const inadimplenciaResult = await inadimplenciaQuery
    if (!inadimplenciaResult.error) {
      const rows = inadimplenciaResult.data ?? []
      inadimplencia = {
        totalValor: rows.reduce((sum, row) => sum + Number(row.valor ?? 0), 0),
        totalLancamentos: rows.length,
        link: '/financeiro?status=pendente&vencido=true',
      }
    }

    // No-show / cancelamentos da última semana
    const semanaAtras = new Date(today)
    semanaAtras.setDate(semanaAtras.getDate() - 6)
    const semanaAtrasIso = semanaAtras.toISOString().slice(0, 10)
    let agendaSemanaQuery = supabase
      .from('agendamentos')
      .select('id,paciente_id,status,unidade_id')
      .gte('data_agendamento', semanaAtrasIso)
      .lte('data_agendamento', todayIso)
    if (adminUnidadeId) agendaSemanaQuery = agendaSemanaQuery.eq('unidade_id', adminUnidadeId)
    const agendaSemanaResult = await agendaSemanaQuery
    if (!agendaSemanaResult.error) {
      // Só atendimentos de verdade: horários livres ("Disponível") e bloqueios não entram na conta.
      const rows = (agendaSemanaResult.data ?? []).filter((row) => row.paciente_id && !String(row.status ?? '').toLowerCase().includes('dispon'))
      const cancelados = rows.filter((row) => String(row.status ?? '').toLowerCase().includes('cancel')).length
      const noShow = rows.filter((row) => String(row.status ?? '').toLowerCase().includes('faltou')).length
      const total = rows.length
      const taxaCancelamento = total > 0 ? `${((cancelados / total) * 100).toFixed(1)}%` : '0%'
      const taxaNoShow = total > 0 ? `${((noShow / total) * 100).toFixed(1)}%` : '0%'
      noShowSemanal = { cancelados, noShow, total, taxaCancelamento, taxaNoShow }
    }

    // Aniversariantes dos próximos 7 dias
    const proxima7 = new Date(today)
    proxima7.setDate(proxima7.getDate() + 6)
    aniversariantesSemana = pacientesRows
      .map((row) => {
        if (!row.data_nascimento) return null
        const raw = String(row.data_nascimento).slice(0, 10)
        const date = new Date(`${raw}T12:00:00`)
        if (Number.isNaN(date.getTime())) return null
        const monthDay = date.getMonth() * 100 + date.getDate()
        const todayMd = today.getMonth() * 100 + today.getDate()
        const proxMd = proxima7.getMonth() * 100 + proxima7.getDate()
        const inRange = todayMd <= proxMd
          ? monthDay >= todayMd && monthDay <= proxMd
          : monthDay >= todayMd || monthDay <= proxMd
        if (!inRange) return null
        return {
          id: String(row.id),
          nome: String(row.nome ?? 'Paciente'),
          dataNascimento: String(row.data_nascimento),
          diaAniversario: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        }
      })
      .filter((item): item is { id: string; nome: string; dataNascimento: string; diaAniversario: string } => item !== null)
      .slice(0, 10)
  }

  const prescricoesPerf = ((perfPrescricoesResult.data ?? []) as Array<{ paciente_id: string | null; status: string | null; tipo: string | null; valor_total: number | null }>).filter(
    (row) => !isAdmin || !adminUnidadeId || (row.paciente_id && pacienteIdsVisiveis.has(String(row.paciente_id))),
  )
  const performance = needsPerformance
    ? {
        periodo: { de: perfFrom, ate: perfTo },
        ...calcularPerformance(perfAgendaResult.data ?? [], prescricoesPerf),
        retornos: { noPrazo: retornosContagem.noPrazo, limitePrazo: retornosLimitePrazo, vencidos: retornosVencidos },
      }
    : undefined

  const faturamentoTotal: Record<TipoFaturamento, number> = { procedimentos: 0, consultas: 0, produtos: 0, outros: 0 }
  for (const item of financeiroPorUnidade) {
    for (const tipo of Object.keys(faturamentoTotal) as TipoFaturamento[]) faturamentoTotal[tipo] += item.faturamento[tipo]
  }

  const pedidosNf = resumirPedidosNf((pedidosNfResult.data ?? []) as unknown as Array<{ status: string; valor: number | null }>)
  const caixaGestor = variant === 'gestor' ? caixasResult.caixas[0] : undefined
  const formatBrl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const response = {
    variant,
    cards:
      variant === 'admin'
        ? [
            { id: 'entradas', label: 'Faturamento total', value: receitaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'procedimentos, consultas e vendas' },
            { id: 'saidas', label: 'Total de saídas', value: despesaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'despesas do período' },
            { id: 'saldo', label: 'Saldo do período', value: saldoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'resultado consolidado' },
            { id: 'agenda-hoje', label: 'Atendimentos hoje', value: String(agendaCountResult.count ?? 0), description: 'consultas na agenda do dia' },
            {
              id: 'notas',
              label: 'Notas fiscais (pedidos)',
              value: String(pedidosNf.pendentes + pedidosNf.emitidas),
              description: descreverPedidosNf(pedidosNf),
            },
          ]
        : variant === 'master'
          ? [
              { id: 'unidades', label: 'Unidades na plataforma', value: String((unidadesResult.data ?? []).length), description: 'operações cadastradas' },
              { id: 'usuarios', label: 'Usuários ativos', value: String(usuariosResult.count ?? 0), description: 'contas habilitadas no ambiente' },
              { id: 'pendentes', label: 'Notificações abertas', value: String(notificacoesResult.count ?? 0), description: 'itens ainda não lidos' },
              { id: 'receita', label: 'Receita global', value: receitaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'lançamentos globais do mês' },
            ]
        : variant === 'gestor'
          ? [
              { id: 'entradas', label: 'Entradas do período', value: receitaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'receitas registradas no mês' },
              { id: 'saidas', label: 'Saídas do período', value: despesaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'despesas registradas no mês' },
              { id: 'saldo', label: 'Saldo do período', value: saldoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), description: 'resultado consolidado do mês' },
            ]
          : variant === 'especialista'
            ? [
                { id: 'agenda-hoje', label: 'Consultas hoje', value: String(agendaCountResult.count ?? 0), description: 'na agenda do dia' },
                { id: 'pendentes', label: 'Pendentes', value: String(agendaEspera), description: 'em espera ou check-in' },
                { id: 'concluidas', label: 'Concluídas', value: String(appointments.filter((item) => item.status.toLowerCase().includes('concl')).length), description: 'finalizadas hoje' },
              ]
            : [
                { id: 'agenda-hoje', label: 'Atendimentos hoje', value: String(agendaCountResult.count ?? 0), description: 'consultas na agenda do dia' },
                { id: 'confirmados', label: 'Confirmados', value: String(agendaConfirmados), description: 'atendimentos confirmados' },
                { id: 'em-espera', label: 'Em espera', value: String(agendaEspera), description: 'status aguardando atendimento' },
                { id: 'atrasados', label: 'Atrasados', value: String(agendaAtrasados), description: 'consultas fora do horário' },
              ],
    retornos: {
      noPrazo: retornosContagem.noPrazo,
      limitePrazo: retornosLimitePrazo,
      vencidos: retornosVencidos,
    },
    performance,
    especialistaCharts: variant === 'especialista'
      ? { atendimentosPorSemana, tiposConsulta }
      : undefined,
    adminCharts: isAdmin ? { atendimentosPorSemana, tiposConsulta } : undefined,
    appointments: appointments.slice(0, variant === 'gestor' ? 8 : 6),
    recentPatients,
    finance: {
      recebimentosPendentes: recebimentosPendentes.toFixed(2),
      pagamentosPendentes: pagamentosPendentes.toFixed(2),
      saldoPrevisto: saldoPrevisto.toFixed(2),
    },
    admin: {
      activities: (auditResult.data ?? []).map((row, index) => ({
        label: `${row.acao} em ${row.recurso}`,
        time: row.created_at ? formatarDataHoraClinica(row.created_at) : 'recentemente',
        color: index === 0 ? 'bg-app-primary' : index === 1 ? 'bg-[var(--app-success-text)]' : 'app-status-warning0',
      })),
      unitStatus: {
        ativas: (unidadesResult.data ?? []).filter((row) => String(row.status ?? '').toLowerCase() === 'ativa').length,
        manutencao: (unidadesResult.data ?? []).filter((row) => String(row.status ?? '').toLowerCase() !== 'ativa').length,
        agendamentosHoje: Number(agendaCountResult.count ?? 0),
      },
      birthdays,
      saldoCaixas,
      saldoBancos,
      financeiroPorUnidade,
      faturamentoTotal,
      notasEmitidas: { registrado: true, ...pedidosNf, aviso: '' },
      unidadesComparativo,
      prescricoesPendentes,
      retornosPendentes: { noPrazo: retornosContagem.noPrazo, limitePrazo: retornosLimitePrazo, vencidos: retornosVencidos },
      listaEsperaCount,
      estoqueCritico,
      topProcedimentos,
      inadimplencia,
      noShowSemanal,
      aniversariantesSemana,
    },
      gestor: {
        accounts: [
          {
            id: 'receber',
            type: 'Período',
            name: 'Entradas registradas',
            balance: receitaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            color: 'bg-emerald-500',
            href: '/financeiro',
          },
          {
            id: 'pagar',
            type: 'Período',
            name: 'Saídas registradas',
            balance: despesaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            color: 'bg-rose-500',
            href: '/financeiro',
          },
          {
            id: 'saldo',
            type: 'Consolidado',
            name: 'Saldo do período',
            balance: saldoPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            color: 'bg-app-primary',
            href: '/financeiro',
          },
          {
            id: 'caixinha-troco',
            type: caixaGestor
              ? `${unidadeNome(caixaGestor.unidadeId)} · ${caixaGestor.aberto ? 'caixa aberto' : 'caixa fechado'}`
              : 'Sem caixa aberto ainda',
            name: 'Caixinha de troco',
            balance: formatBrl(caixaGestor?.troco ?? 0),
            color: 'bg-amber-500',
            href: '/caixa',
          },
          {
            id: 'cofre',
            type: 'Operacional',
            name: 'Cofre',
            balance: formatBrl(caixaGestor?.cofre ?? 0),
            color: 'bg-slate-500',
            href: '/caixa',
          },
      ],
      paymentsDue: financeiroRows
        .filter((row) => String(row.tipo ?? '').toLowerCase() === 'despesa' && !String(row.status ?? '').toLowerCase().includes('pago'))
        .slice(0, 5)
        .map((row) => ({
          title: String(row.descricao ?? 'Despesa'),
          cat: String(row.categoria ?? 'Financeiro'),
          date: row.data_lancamento ? new Date(row.data_lancamento).toLocaleDateString('pt-BR') : '-',
          value: Number(row.valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        })),
      receivables: financeiroRows
        .filter((row) => String(row.tipo ?? '').toLowerCase() === 'receita' && !String(row.status ?? '').toLowerCase().includes('pago'))
        .slice(0, 5)
        .map((row) => ({
          title: String(row.descricao ?? 'Receita'),
          cat: String(row.categoria ?? 'Financeiro'),
          date: row.data_lancamento ? new Date(row.data_lancamento).toLocaleDateString('pt-BR') : '-',
          value: Number(row.valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        })),
    },
    meta: {
      unidades: (unidadesResult.data ?? []).map((row) => ({
        id: String(row.id),
        nome: String(row.nome ?? 'Sem nome'),
      })),
      periodo: { de: adminPeriod.from, ate: adminPeriod.to },
      filtros: { periodo: adminPeriod.label, unidadeId: adminUnidadeId },
    },
  }

  const cardHref = (card: { id: string }) => {
    if (card.id === 'pendentes') return variant === 'especialista' ? '/agenda' : undefined
    return CARD_HREF[card.id]
  }
  // Recepção e especialista não recebem dados financeiros do gestor (permissão decidida no servidor).
  const verFinanceiro = variant === 'gestor' || isAdmin || variant === 'master'
  const body = verFinanceiro
    ? response
    : {
        ...response,
        gestor: { accounts: [], paymentsDue: [], receivables: [] },
        finance: { recebimentosPendentes: '0', pagamentosPendentes: '0', saldoPrevisto: '0' },
      }
  return NextResponse.json({ ...body, cards: body.cards.map((card) => ({ ...card, href: cardHref(card) })) })
}
