import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapRelatorioItem } from '@/lib/domain-mappers'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const REPORT_TABS = [
  'Consultas',
  'Cancelamentos',
  'Retornos',
  'Prescrição/Vendas',
  'Estoque',
  'Pacientes',
  'Performance',
  'Tarefas',
  'Ranking',
  'Caixa Gestor',
  'Comparativo',
] as const

function buildRelatorio(
  id: string,
  categoria: (typeof REPORT_TABS)[number],
  descricao: string,
  atualizadoEm: string,
) {
  return mapRelatorioItem({
    id,
    nome: categoria,
    categoria,
    descricao,
    atualizado_em: atualizadoEm,
  })
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()

  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao carregar relatórios')
  }
  const unidadeId = scopedUnit.unidadeId

  let unitUserIds: string[] = []
  if (unidadeId && session.role !== 'especialista') {
    const { data: unitUsers, error: unitUsersError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('unidade_id', unidadeId)

    if (unitUsersError) {
      return supabaseErrorResponse(unitUsersError, 'Falha ao carregar relatórios')
    }

    unitUserIds = (unitUsers ?? []).map((item) => String(item.id))
  }

  let agendamentosQuery = supabase
    .from('agendamentos')
    .select('id,status,data_agendamento,observacoes')
    .order('data_agendamento', { ascending: false })
    .limit(100)

  let pacientesQuery = supabase.from('pacientes').select('id', { count: 'exact', head: true })

  let financeiroQuery = supabase
    .from('financeiro_lancamentos')
    .select('id,tipo,status,valor,data_lancamento')
    .order('data_lancamento', { ascending: false })
    .limit(100)

  let prescricoesQuery = supabase
    .from('prescricoes')
    .select('id,status,data_prescricao,profissional_id')
    .order('data_prescricao', { ascending: false })
    .limit(100)

  let repassesQuery = supabase
    .from('repasses')
    .select('id,status,valor,periodo_fim,profissional_id,unidade_id')
    .order('periodo_fim', { ascending: false })
    .limit(100)

  let tarefasQuery = supabase
    .from('tarefas')
    .select('id,status,created_at,responsavel_id,created_by_id')
    .order('created_at', { ascending: false })
    .limit(100)

  let estoqueQuery = supabase
    .from('produtos_estoque')
    .select('id,status,updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .limit(100)

  if (session.role === 'especialista') {
    agendamentosQuery = agendamentosQuery.eq('profissional_id', session.userId)
    prescricoesQuery = prescricoesQuery.eq('profissional_id', session.userId)
    repassesQuery = repassesQuery.eq('profissional_id', session.userId)
    tarefasQuery = tarefasQuery.or(`responsavel_id.eq.${session.userId},created_by_id.eq.${session.userId}`)
  } else if (unidadeId) {
    agendamentosQuery = agendamentosQuery.eq('unidade_id', unidadeId)
    pacientesQuery = pacientesQuery.eq('unidade_id', unidadeId)
    financeiroQuery = financeiroQuery.eq('unidade_id', unidadeId)
    repassesQuery = repassesQuery.eq('unidade_id', unidadeId)
    estoqueQuery = estoqueQuery.eq('unidade_id', unidadeId)

    if (unitUserIds.length > 0) {
      prescricoesQuery = prescricoesQuery.in('profissional_id', unitUserIds)
    }
  }

  const [
    agendamentosResult,
    pacientesResult,
    financeiroResult,
    prescricoesResult,
    repassesResult,
    tarefasResult,
    estoqueResult,
  ] = await Promise.all([
    agendamentosQuery,
    pacientesQuery,
    financeiroQuery,
    prescricoesQuery,
    repassesQuery,
    tarefasQuery,
    estoqueQuery,
  ])

  const errors = [
    agendamentosResult.error,
    pacientesResult.error,
    financeiroResult.error,
    prescricoesResult.error,
    repassesResult.error,
    tarefasResult.error,
    estoqueResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    return supabaseErrorResponse(errors[0]!, 'Falha ao carregar relatórios')
  }

  const agendamentos = agendamentosResult.data ?? []
  const financeiro = financeiroResult.data ?? []
  const prescricoes = prescricoesResult.data ?? []
  const repasses = repassesResult.data ?? []
  const tarefas = tarefasResult.data ?? []
  const estoque = estoqueResult.data ?? []

  const cancelados = agendamentos.filter((row) =>
    String(row.status ?? '').toLowerCase().includes('cancel'),
  ).length
  const concluidos = agendamentos.filter((row) =>
    String(row.status ?? '').toLowerCase().includes('concl'),
  ).length
  const retornos = agendamentos.filter((row) =>
    String(row.observacoes ?? '').toLowerCase().includes('retorno'),
  ).length
  const receitas = financeiro.reduce((acc, row) => {
    return String(row.tipo ?? '').toLowerCase() === 'receita' ? acc + Number(row.valor ?? 0) : acc
  }, 0)
  const despesas = financeiro.reduce((acc, row) => {
    return String(row.tipo ?? '').toLowerCase() === 'despesa' ? acc + Number(row.valor ?? 0) : acc
  }, 0)
  const tarefasPendentes = tarefas.filter((row) =>
    String(row.status ?? '').toLowerCase().includes('pend'),
  ).length
  const saldo = receitas - despesas
  const performanceDescricao =
    agendamentos.length > 0
      ? `${concluidos} de ${agendamentos.length} consultas concluídas no período (${Math.round((concluidos / agendamentos.length) * 100)}% de conclusão)`
      : 'Nenhuma consulta registrada para calcular a performance do período'

  const updatedAt = String(
    agendamentos[0]?.data_agendamento ??
      financeiro[0]?.data_lancamento ??
      prescricoes[0]?.data_prescricao ??
      repasses[0]?.periodo_fim ??
      tarefas[0]?.created_at ??
      estoque[0]?.updated_at ??
      new Date().toISOString(),
  )

  return NextResponse.json({
    data: [
      buildRelatorio(
        'relatorio-consultas',
        'Consultas',
        `${agendamentos.length} consultas no recorte atual, com ${concluidos} concluídas`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-cancelamentos',
        'Cancelamentos',
        `${cancelados} cancelamentos identificados no período`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-retornos',
        'Retornos',
        `${retornos} registros marcados como retorno nas agendas atuais`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-prescricoes',
        'Prescrição/Vendas',
        `${prescricoes.length} prescrições ou vendas registradas no contexto atual`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-estoque',
        'Estoque',
        `${estoqueResult.count ?? estoque.length} itens de estoque no contexto atual`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-pacientes',
        'Pacientes',
        `${pacientesResult.count ?? 0} pacientes vinculados ao contexto atual`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-performance',
        'Performance',
        `${performanceDescricao}. Saldo financeiro do período: ${saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-tarefas',
        'Tarefas',
        `${tarefas.length} tarefas registradas, com ${tarefasPendentes} pendentes de conclusão`,
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-ranking',
        'Ranking',
        'Produtos e procedimentos mais realizados/lucrativos',
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-caixa-gestor',
        'Caixa Gestor',
        'Movimentos do dia + saldos de bancos e cofre',
        updatedAt,
      ),
      buildRelatorio(
        'relatorio-comparativo',
        'Comparativo',
        'Comparativo lado a lado entre unidades (agendamentos, receita e ticket)',
        updatedAt,
      ),
    ],
    meta: {
      ...session,
      tabs: [...REPORT_TABS],
    },
  })
}
