import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { isFinanciallyRestrictedRole } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

function getTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Relatório caixa do gestor (Onda 6): movimentos do dia + saldos bancos + cofre.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const deniedFin = await requirePermission(session.userId, 'financeiro', 'read')
  if (deniedFin) {
    const deniedRel = await requirePermission(session.userId, 'relatorios', 'read')
    if (deniedRel) return deniedRel
  }

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar caixa gestor')

  const todayKey = getTodayKey()
  const hidePrices = isFinanciallyRestrictedRole(session.role)

  let sessaoQuery = supabase
    .from('caixa_sessoes')
    .select(
      'id,status,saldo_inicial,saldo_final,valor_transferido,saldo_restante,aberto_em,fechado_em,unidade_id,data_operacao',
    )
    .eq('data_operacao', todayKey)
    .order('aberto_em', { ascending: false })
    .limit(5)

  if (scoped.unidadeId) {
    sessaoQuery = sessaoQuery.eq('unidade_id', scoped.unidadeId)
  }

  const { data: sessoes, error: sessaoError } = await sessaoQuery
  if (sessaoError) return supabaseErrorResponse(sessaoError, 'Falha ao carregar sessões de caixa')

  const sessaoIds = (sessoes ?? []).map((s) => String(s.id))
  let movimentos: Array<{
    id: string
    tipo: string
    valor: number
    forma: string | null
    descricao: string | null
    createdAt: string
  }> = []

  if (sessaoIds.length > 0) {
    const { data: movRows, error: movError } = await supabase
      .from('caixa_movimentos')
      .select('id,tipo,valor,forma,descricao,data_movimento,sessao_id')
      .in('sessao_id', sessaoIds)
      .order('data_movimento', { ascending: false })
      .limit(500)

    if (movError) return supabaseErrorResponse(movError, 'Falha ao carregar movimentos do caixa')
    movimentos = (movRows ?? []).map((row) => ({
      id: String(row.id),
      tipo: String(row.tipo ?? ''),
      valor: hidePrices ? 0 : Number(row.valor ?? 0),
      forma: row.forma ? String(row.forma) : null,
      descricao: row.descricao ? String(row.descricao) : null,
      createdAt: row.data_movimento ? String(row.data_movimento) : '',
    }))
  }

  let contasQuery = supabase
    .from('contas_bancarias')
    .select('id,nome,banco,tipo,saldo_inicial,ativo,unidade_id')
    .eq('ativo', true)
    .order('nome')

  if (scoped.unidadeId) {
    contasQuery = contasQuery.eq('unidade_id', scoped.unidadeId)
  }

  const { data: contas, error: contasError } = await contasQuery
  if (contasError) return supabaseErrorResponse(contasError, 'Falha ao carregar contas')

  const contaIds = (contas ?? []).map((c) => String(c.id))
  const movTotal = new Map<string, number>()
  if (contaIds.length > 0) {
    const { data: ofx, error: ofxError } = await supabase
      .from('conciliacao_ofx')
      .select('conta_id,tipo,valor')
      .in('conta_id', contaIds)

    if (!ofxError) {
      for (const row of ofx ?? []) {
        const id = String(row.conta_id ?? '')
        if (!id) continue
        const valor = Math.abs(Number(row.valor ?? 0))
        const delta = String(row.tipo ?? '').toUpperCase() === 'DEBIT' ? -valor : valor
        movTotal.set(id, (movTotal.get(id) ?? 0) + delta)
      }
    }
  }

  const bancos = (contas ?? [])
    .filter((c) => String(c.tipo) !== 'dinheiro')
    .map((c) => {
      const id = String(c.id)
      const saldoInicial = Number(c.saldo_inicial ?? 0)
      const saldoAtual = Number((saldoInicial + (movTotal.get(id) ?? 0)).toFixed(2))
      return {
        id,
        nome: String(c.nome ?? ''),
        banco: c.banco ? String(c.banco) : null,
        tipo: String(c.tipo ?? ''),
        saldoAtual: hidePrices ? 0 : saldoAtual,
      }
    })

  const cofres = (contas ?? [])
    .filter((c) => String(c.tipo) === 'dinheiro')
    .map((c) => {
      const id = String(c.id)
      const saldoInicial = Number(c.saldo_inicial ?? 0)
      const saldoAtual = Number((saldoInicial + (movTotal.get(id) ?? 0)).toFixed(2))
      return {
        id,
        nome: String(c.nome ?? 'Cofre'),
        saldoAtual: hidePrices ? 0 : saldoAtual,
      }
    })

  const totalEntradas = movimentos
    .filter((m) => m.tipo.toLowerCase() === 'entrada')
    .reduce((sum, m) => sum + m.valor, 0)
  const totalSaidas = movimentos
    .filter((m) => m.tipo.toLowerCase() !== 'entrada')
    .reduce((sum, m) => sum + m.valor, 0)

  return NextResponse.json({
    data: {
      data: todayKey,
      sessoes: (sessoes ?? []).map((s) => ({
        id: String(s.id),
        status: String(s.status ?? ''),
        saldoInicial: hidePrices ? 0 : Number(s.saldo_inicial ?? 0),
        saldoFinal: hidePrices ? 0 : Number(s.saldo_final ?? 0),
        valorTransferido: hidePrices ? 0 : Number(s.valor_transferido ?? 0),
        abertoEm: s.aberto_em ? String(s.aberto_em) : null,
        fechadoEm: s.fechado_em ? String(s.fechado_em) : null,
      })),
      movimentos,
      totais: {
        entradas: totalEntradas,
        saidas: totalSaidas,
        liquido: totalEntradas - totalSaidas,
      },
      bancos,
      cofres,
      saldoBancos: hidePrices ? 0 : bancos.reduce((s, b) => s + b.saldoAtual, 0),
      saldoCofres: hidePrices ? 0 : cofres.reduce((s, c) => s + c.saldoAtual, 0),
    },
    meta: { valoresVisiveis: !hidePrices, ...session },
  })
}
