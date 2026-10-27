import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { type ContaTipo, normalizeContaTipo, validateContaInput } from './conta-input'

interface ContaBancaria {
  id: string
  unidadeId: string | null
  nome: string
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo: ContaTipo
  saldoInicial: number
  ativo: boolean
  createdAt: string
}

type Row = {
  id: string
  unidade_id: string | null
  nome: string
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo: string
  saldo_inicial: number | string | null
  ativo: boolean
  created_at: string
}

function mapRow(row: Row): ContaBancaria {
  const tipo = normalizeContaTipo(row.tipo)
  return {
    id: String(row.id),
    unidadeId: row.unidade_id ? String(row.unidade_id) : null,
    nome: String(row.nome ?? ''),
    banco: row.banco ?? null,
    agencia: row.agencia ?? null,
    conta: row.conta ?? null,
    tipo,
    saldoInicial: Number(row.saldo_inicial ?? 0),
    ativo: Boolean(row.ativo),
    createdAt: String(row.created_at ?? ''),
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'gestao-bancaria', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const { data: contas, error } = await supabase
    .from('contas_bancarias')
    .select('id,unidade_id,nome,banco,agencia,conta,tipo,saldo_inicial,ativo,created_at')
    .order('nome', { ascending: true })

  if (error) return supabaseErrorResponse(error, 'Falha ao carregar contas bancárias')

  // Saldo = saldo_inicial + soma dos movimentos do extrato bancário.
  // O vínculo conta↔movimento vive em conciliacao_ofx (coluna conta_id), NÃO em
  // financeiro_lancamentos (que não possui conta_bancaria_id). O valor é
  // sinalizado por tipo (CREDIT +, DEBIT −); usamos abs()+tipo para ficar
  // robusto a ambas as convenções de sinal. Calculamos dois saldos:
  //   - saldoAtual:      TODOS os movimentos importados (conciliados ou não) =
  //                      saldo real do extrato.
  //   - saldoConciliado: só os movimentos já conciliados (conferidos).
  // A diferença entre eles é o que ainda falta conciliar. Também contamos os
  // movimentos (total / conciliados) para a barra de progresso na UI.
  const ids = (contas ?? []).map((row) => String(row.id))
  const movTotal = new Map<string, number>()
  const movConciliado = new Map<string, number>()
  const qtdTotal = new Map<string, number>()
  const qtdConciliado = new Map<string, number>()

  if (ids.length > 0) {
    const { data: ofx, error: ofxError } = await supabase
      .from('conciliacao_ofx')
      .select('conta_id,tipo,valor,conciliado')
      .in('conta_id', ids)
    if (ofxError) return supabaseErrorResponse(ofxError, 'Falha ao carregar movimentos bancários')
    for (const row of ofx ?? []) {
      const contaId = String(row.conta_id ?? '')
      if (!contaId) continue
      const valor = Math.abs(Number(row.valor ?? 0))
      const delta = String(row.tipo ?? '').toUpperCase() === 'DEBIT' ? -valor : valor
      movTotal.set(contaId, (movTotal.get(contaId) ?? 0) + delta)
      qtdTotal.set(contaId, (qtdTotal.get(contaId) ?? 0) + 1)
      if (row.conciliado === true) {
        movConciliado.set(contaId, (movConciliado.get(contaId) ?? 0) + delta)
        qtdConciliado.set(contaId, (qtdConciliado.get(contaId) ?? 0) + 1)
      }
    }
  }

  const data = (contas ?? []).map((row) => {
    const conta = mapRow(row as Row)
    const saldoMov = movTotal.get(conta.id) ?? 0
    const saldoMovConc = movConciliado.get(conta.id) ?? 0
    return {
      ...conta,
      saldoAtual: Number((conta.saldoInicial + saldoMov).toFixed(2)),
      saldoConciliado: Number((conta.saldoInicial + saldoMovConc).toFixed(2)),
      movimentosTotal: qtdTotal.get(conta.id) ?? 0,
      movimentosConciliados: qtdConciliado.get(conta.id) ?? 0,
    }
  })

  return NextResponse.json({ data, meta: session })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'gestao-bancaria', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)

  const validated = validateContaInput(body)
  if (!validated.ok) return serverErrorResponse(validated.error, validated.code, 400)
  const conta = validated.value

  const supabase = getAppSupabase()

  const scopedUnit = await getScopedUnitId(session)
  const unidadeId = scopedUnit.error ? null : scopedUnit.unidadeId

  // Banco do cadastro: grava o vínculo e mantém o nome na conta (usado nas telas e no OFX).
  let bancoNome = conta.banco
  if (conta.bancoId) {
    const { data: banco } = await supabase.from('bancos').select('nome').eq('id', conta.bancoId).maybeSingle()
    if (!banco) return serverErrorResponse('Banco não encontrado no cadastro', 'BANCO_NOT_FOUND', 400)
    bancoNome = String(banco.nome)
  }

  const { data, error } = await supabase
    .from('contas_bancarias')
    .insert({
      unidade_id: unidadeId,
      nome: conta.nome,
      banco: bancoNome,
      banco_id: conta.bancoId ?? null,
      agencia: conta.agencia,
      conta: conta.conta,
      tipo: conta.tipo,
      saldo_inicial: conta.saldoInicial,
      ativo: conta.ativo,
    })
    .select('id,unidade_id,nome,banco,agencia,conta,tipo,saldo_inicial,ativo,created_at')
    .single()

  if (error) return supabaseErrorResponse(error, 'Falha ao criar conta bancária')

  return NextResponse.json({ data: mapRow(data as Row), meta: session }, { status: 201 })
}
