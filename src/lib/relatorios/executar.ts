import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId, isScopedRole } from '@/lib/request-auth'
import { removerCustoRelatorio } from '@/lib/estoque-custo'
import { montarFiltros } from '@/lib/relatorios/filtros'
import { lerConfigTaxas, calcularTaxa, somarDias, totalizarRecebimentos, type GrupoRecebimento } from '@/lib/relatorios/recebimentos-taxas'
import { perfilPodeVerRelatorio, type RelatorioTipo } from '@/lib/relatorios/registry'

const RPC_POR_TIPO: Record<RelatorioTipo, string> = {
  consultas: 'rel_consultas',
  agendamentos: 'rel_consultas',
  justificativas: 'rel_consultas',
  pacientes: 'rel_pacientes',
  vendas: 'rel_vendas',
  recebimentos: 'rel_recebimentos',
  'estoque-posicao': 'rel_estoque_posicao',
  'estoque-movimentacao': 'rel_estoque_movimentacao',
  repasse: 'rel_repasse_atendimentos',
  financeiro: 'rel_financeiro',
  comissoes: 'rel_comissoes',
  tarefas: 'rel_tarefas',
  aniversariantes: 'rel_aniversariantes',
  desempenho: 'rel_desempenho',
}

interface ResultadoRpc {
  total?: number
  totais?: Record<string, unknown>
  rows?: Array<Record<string, unknown>>
  grupos?: GrupoRecebimento[]
}

async function carregarConfigTaxas() {
  const { data } = await getAppSupabase()
    .from('configuracoes')
    .select('chave,valor')
    .in('chave', ['pagamento.maquininha', 'pagamento.card_fees'])
  const valor = (chave: string) => {
    const item = (data ?? []).find((row) => row.chave === chave)
    return item?.valor ? String(item.valor) : null
  }
  return lerConfigTaxas({ maquininha: valor('pagamento.maquininha'), cardFees: valor('pagamento.card_fees') })
}

/** Aplica taxa de cartão, compensação e líquido às linhas e aos totais de Recebimentos. */
async function enriquecerRecebimentos(resultado: ResultadoRpc) {
  const cfg = await carregarConfigTaxas()
  const rows = (resultado.rows ?? []).map((row) => {
    const bruto = Number(row.bruto ?? 0)
    const taxa = calcularTaxa(String(row.forma), Number(row.parcelas ?? 1), bruto, cfg)
    const compensacao =
      taxa.diasCompensacao > 0 ? somarDias(String(row.data), taxa.diasCompensacao) : String(row.data)
    return { ...row, taxaPct: taxa.taxaPct, desconto: taxa.desconto, liquido: taxa.liquido, compensacao }
  })
  const totais = totalizarRecebimentos(
    (resultado.grupos ?? []).map((g) => ({ ...g, parcelas: Number(g.parcelas), bruto: Number(g.bruto) })),
    cfg,
  )
  return { rows, totais }
}

/** Chamada comum de todos os relatórios: perfil, escopo no servidor, RPC paginada e totais no banco. */
export async function executarRelatorio(request: NextRequest, tipo: RelatorioTipo) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  if (!perfilPodeVerRelatorio(session.role, tipo)) {
    return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)
  }
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar relatório')

  const query = new URL(request.url).searchParams
  const filtros = montarFiltros(tipo, query, {
    perfil: session.role,
    userId: session.userId,
    unidadeId: scoped.unidadeId,
    perfilRestritoPorUnidade: isScopedRole(session.role),
  })
  if (tipo === 'justificativas') filtros.situacao = 'justificativas'
  if (tipo === 'agendamentos' && !filtros.situacao) filtros.situacao = 'agendados'

  const { data, error } = await getAppSupabase().rpc(RPC_POR_TIPO[tipo], { p: filtros })
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar relatório')

  const resultado = (data ?? {}) as ResultadoRpc
  const porPagina = Number(filtros.limit)
  const pagina = Math.floor(Number(filtros.offset) / porPagina) + 1
  const total = Number(resultado.total ?? 0)

  let rows = resultado.rows ?? []
  let totais: Record<string, unknown> = resultado.totais ?? {}
  if (tipo === 'recebimentos') {
    const enriquecido = await enriquecerRecebimentos(resultado)
    rows = enriquecido.rows
    totais = { ...enriquecido.totais }
  }

  let custoOculto = false
  if (tipo === 'estoque-posicao' || tipo === 'estoque-movimentacao') {
    const semCusto = removerCustoRelatorio(rows, totais, session.role)
    rows = semCusto.rows
    totais = semCusto.totais
    custoOculto = semCusto.custoOculto
  }

  return NextResponse.json({
    data: rows,
    meta: { total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), totais, custoOculto },
  })
}
