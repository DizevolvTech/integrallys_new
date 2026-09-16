import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

type InadimplenciaRow = {
  id: string
  descricao: string
  valor: number
  vencimento: string | null
  status: string
  pacienteId: string | null
  pacienteNome: string
  situacao: 'vencido' | 'a_vencer' | 'pendente'
  linkFinanceiro: string
}

/**
 * Pacientes / receitas em aberto para CRM:
 * - vencidos (vencimento < hoje)
 * - a vencer (vencimento >= hoje)
 * - pendente sem vencimento
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar inadimplência')

  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from('financeiro_lancamentos')
    .select('id,descricao,valor,vencimento,status,unidade_id,beneficiario')
    .eq('tipo', 'receita')
    .neq('status', 'Pago')
    .order('vencimento', { ascending: true, nullsFirst: false })
    .limit(300)

  if (scoped.unidadeId) {
    query = query.eq('unidade_id', scoped.unidadeId)
  }

  const { data: lancamentos, error } = await query
  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar inadimplência')
  }

  const rows: InadimplenciaRow[] = (lancamentos ?? []).map((row) => {
    const vencimento = row.vencimento ? String(row.vencimento) : null
    let situacao: InadimplenciaRow['situacao'] = 'pendente'
    if (vencimento) {
      situacao = vencimento < today ? 'vencido' : 'a_vencer'
    }
    return {
      id: String(row.id),
      descricao: String(row.descricao ?? ''),
      valor: Number(row.valor ?? 0),
      vencimento,
      status: String(row.status ?? ''),
      pacienteId: null,
      pacienteNome: row.beneficiario ? String(row.beneficiario) : '—',
      situacao,
      linkFinanceiro:
        situacao === 'vencido'
          ? '/financeiro?status=pendente&vencido=true'
          : '/financeiro?status=pendente',
    }
  })

  const sortRows = (list: InadimplenciaRow[]) => {
    list.sort((a, b) => {
      const rank = { vencido: 0, a_vencer: 1, pendente: 2 }
      const bySit = rank[a.situacao] - rank[b.situacao]
      if (bySit !== 0) return bySit
      return String(a.vencimento ?? '').localeCompare(String(b.vencimento ?? ''))
    })
  }
  sortRows(rows)

  const nomeById = new Map<string, string>()

  // Inclui saldos em aberto de agendamentos (parcial/pendente), além do ledger.
  const { data: agendaResumo, error: agendaError } = await supabase
    .from('v_agendamento_pagamento_resumo')
    .select('agendamento_id,total_pago,valor_devido,situacao')
    .in('situacao', ['Pendente', 'Parcial'])
    .limit(300)

  if (!agendaError && agendaResumo && agendaResumo.length > 0) {
    const agIds = agendaResumo.map((r) => String(r.agendamento_id))
    let agQuery = supabase
      .from('agendamentos')
      .select('id,paciente_id,data_agendamento,unidade_id,status')
      .in('id', agIds)
      .not('status', 'eq', 'Cancelado')
      .not('status', 'eq', 'Disponível')
    if (scoped.unidadeId) agQuery = agQuery.eq('unidade_id', scoped.unidadeId)
    const { data: agRows } = await agQuery
    const pacienteIdsAgenda = Array.from(
      new Set((agRows ?? []).map((r) => (r.paciente_id ? String(r.paciente_id) : '')).filter(Boolean)),
    )
    if (pacienteIdsAgenda.length > 0) {
      const { data: pacientesAgenda } = await supabase
        .from('pacientes')
        .select('id,nome')
        .in('id', pacienteIdsAgenda)
      for (const p of pacientesAgenda ?? []) nomeById.set(String(p.id), String(p.nome ?? ''))
    }
    const agById = new Map((agRows ?? []).map((r) => [String(r.id), r] as const))
    for (const resumo of agendaResumo) {
      const ag = agById.get(String(resumo.agendamento_id))
      if (!ag) continue
      const devido = Number(resumo.valor_devido ?? 0)
      const pago = Number(resumo.total_pago ?? 0)
      const saldo = Math.max(0, devido - pago)
      if (saldo <= 0) continue
      const dataAg = ag.data_agendamento ? String(ag.data_agendamento) : null
      let situacao: InadimplenciaRow['situacao'] = 'pendente'
      if (dataAg) situacao = dataAg < today ? 'vencido' : 'a_vencer'
      const pacienteId = ag.paciente_id ? String(ag.paciente_id) : null
      rows.push({
        id: `agendamento:${resumo.agendamento_id}`,
        descricao: `Saldo de agendamento (${String(resumo.situacao ?? 'Pendente')})`,
        valor: saldo,
        vencimento: dataAg,
        status: String(resumo.situacao ?? 'Pendente'),
        pacienteId,
        pacienteNome: (pacienteId ? nomeById.get(pacienteId) : null) || '—',
        situacao,
        linkFinanceiro: '/agenda',
      })
    }
    sortRows(rows)
  }

  return NextResponse.json({ data: rows, meta: session })
}
