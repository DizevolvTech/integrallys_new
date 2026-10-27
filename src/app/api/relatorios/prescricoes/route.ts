import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { stripRelatorioPrescricaoValor } from '@/lib/financial-sanitize'
import { classificarPrescricao, type ClassePrescricao } from '@/lib/prescricao-status'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

export type PrescricaoSituacao = 'no_prazo' | 'limite_prazo' | 'vencido' | 'sem_validade'

export interface PrescricaoRelatorioItem {
  id: string
  numero: string
  status: string
  tipo: string
  valorTotal: number
  dataPrescricao: string | null
  validade: string | null
  situacao: PrescricaoSituacao
  /** Regra única dos cards (ativa/vencida/concluída), igual à tela Prescrição/Vendas. */
  classe: ClassePrescricao
  pacienteId: string | null
  pacienteNome: string
  profissionalId: string | null
  profissionalNome: string
}

export interface PrescricoesMeta {
  total: number
  noPrazo: number
  limitePrazo: number
  vencido: number
  semValidade: number
  valorTotal: number
  valorNoPrazo: number
  valorLimitePrazo: number
  valorVencido: number
  ativas: number
  valorAtivas: number
  ativasLimitePrazo: number
  valorAtivasLimitePrazo: number
  vencidas: number
  valorVencidas: number
}

interface PrescricaoRow {
  id: string
  numero: string | null
  status: string | null
  tipo: string | null
  valor_total: number | string | null
  data_prescricao: string | null
  validade: string | null
  paciente_id: string | null
  profissional_id: string | null
}

function isoDay(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function calcularSituacao(
  validade: string | null,
  hojeIso: string,
  limiteIso: string,
): PrescricaoSituacao {
  if (!validade) return 'sem_validade'
  if (validade < hojeIso) return 'vencido'
  if (validade <= limiteIso) return 'limite_prazo'
  return 'no_prazo'
}

function emptyMeta(): PrescricoesMeta {
  return {
    total: 0,
    noPrazo: 0,
    limitePrazo: 0,
    vencido: 0,
    semValidade: 0,
    valorTotal: 0,
    valorNoPrazo: 0,
    valorLimitePrazo: 0,
    valorVencido: 0,
    ativas: 0,
    valorAtivas: 0,
    ativasLimitePrazo: 0,
    valorAtivasLimitePrazo: 0,
    vencidas: 0,
    valorVencidas: 0,
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'relatorios', 'read')
  if (denied) return denied

  const url = new URL(request.url)
  const situacaoFilter = url.searchParams.get('situacao') ?? 'todos'
  const clienteIdFilter = url.searchParams.get('clienteId') ?? ''
  const profissionalIdFilter = url.searchParams.get('profissionalId') ?? ''
  const unidadeIdFilter = url.searchParams.get('unidadeId') ?? ''
  const desde = url.searchParams.get('desde') ?? ''
  const ate = url.searchParams.get('ate') ?? ''

  const supabase = getAppSupabase()

  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao carregar prescrições')
  }
  const userUnidadeId = scopedUnit.unidadeId

  let scopedUnitUserIds: string[] | null = null
  if (session.role !== 'especialista' && userUnidadeId) {
    const { data: unitUsers, error: unitUsersError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('unidade_id', userUnidadeId)

    if (unitUsersError) {
      return supabaseErrorResponse(unitUsersError, 'Falha ao carregar prescrições')
    }
    scopedUnitUserIds = (unitUsers ?? []).map((row) => String(row.id))
  }

  let query = supabase
    .from('prescricoes')
    .select(
      'id,numero,status,tipo,valor_total,data_prescricao,validade,paciente_id,profissional_id',
    )
    .order('data_prescricao', { ascending: false })
    .limit(500)

  if (session.role === 'especialista') {
    query = query.eq('profissional_id', session.userId)
  } else if (scopedUnitUserIds && scopedUnitUserIds.length > 0) {
    query = query.in('profissional_id', scopedUnitUserIds)
  }

  if (clienteIdFilter) query = query.eq('paciente_id', clienteIdFilter)
  if (profissionalIdFilter && session.role !== 'especialista') {
    query = query.eq('profissional_id', profissionalIdFilter)
  }
  if (desde) query = query.gte('data_prescricao', desde)
  if (ate) query = query.lte('data_prescricao', ate)

  if (unidadeIdFilter && session.role !== 'especialista') {
    const { data: unidadeUsers, error: unidadeUsersError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('unidade_id', unidadeIdFilter)
    if (unidadeUsersError) {
      return supabaseErrorResponse(unidadeUsersError, 'Falha ao carregar prescrições')
    }
    const ids = (unidadeUsers ?? []).map((row) => String(row.id))
    if (ids.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { ...session, ...emptyMeta() },
      })
    }
    query = query.in('profissional_id', ids)
  }

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar prescrições')

  const rows = (data ?? []) as PrescricaoRow[]

  const [pacientesResult, profissionaisResult] = await Promise.all([
    getEntityNameMap(
      supabase,
      'pacientes',
      rows.map((row) => String(row.paciente_id ?? '')),
    ),
    getEntityNameMap(
      supabase,
      'usuarios',
      rows.map((row) => String(row.profissional_id ?? '')),
    ),
  ])

  if (pacientesResult.error) {
    return supabaseErrorResponse(pacientesResult.error, 'Falha ao carregar prescrições')
  }
  if (profissionaisResult.error) {
    return supabaseErrorResponse(profissionaisResult.error, 'Falha ao carregar prescrições')
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limite = new Date(hoje.getTime())
  limite.setDate(limite.getDate() + 10)
  const hojeIso = isoDay(hoje)
  const limiteIso = isoDay(limite)

  const itens: PrescricaoRelatorioItem[] = rows.map((row) => {
    const validade = row.validade ?? null
    return {
      id: String(row.id),
      numero: String(row.numero ?? ''),
      status: String(row.status ?? ''),
      tipo: String(row.tipo ?? ''),
      valorTotal: stripRelatorioPrescricaoValor(Number(row.valor_total ?? 0), session.role),
      dataPrescricao: row.data_prescricao ?? null,
      validade,
      situacao: calcularSituacao(validade, hojeIso, limiteIso),
      classe: classificarPrescricao(row.status, validade, hojeIso),
      pacienteId: row.paciente_id ?? null,
      pacienteNome: pacientesResult.map[String(row.paciente_id ?? '')] ?? '',
      profissionalId: row.profissional_id ?? null,
      profissionalNome: profissionaisResult.map[String(row.profissional_id ?? '')] ?? '',
    }
  })

  const ativas = itens.filter((i) => i.classe === 'ativa')
  const ativasLimite = ativas.filter((i) => i.situacao === 'limite_prazo')
  const vencidas = itens.filter((i) => i.classe === 'vencida')
  const soma = (lista: PrescricaoRelatorioItem[]) => lista.reduce((sum, i) => sum + i.valorTotal, 0)

  // Filtros dos cards usam a mesma regra (classe); os demais filtram pela validade da linha.
  const filteredBySituacao = (() => {
    if (situacaoFilter === 'ativa') return ativas
    if (situacaoFilter === 'limite_prazo') return ativasLimite
    if (situacaoFilter === 'vencido') return vencidas
    if (situacaoFilter === 'no_prazo' || situacaoFilter === 'sem_validade') {
      return itens.filter((item) => item.situacao === situacaoFilter)
    }
    return itens
  })()

  const meta: PrescricoesMeta = {
    total: itens.length,
    noPrazo: itens.filter((i) => i.situacao === 'no_prazo').length,
    limitePrazo: itens.filter((i) => i.situacao === 'limite_prazo').length,
    vencido: itens.filter((i) => i.situacao === 'vencido').length,
    semValidade: itens.filter((i) => i.situacao === 'sem_validade').length,
    valorTotal: itens.reduce((sum, i) => sum + i.valorTotal, 0),
    valorNoPrazo: itens
      .filter((i) => i.situacao === 'no_prazo' || i.situacao === 'sem_validade')
      .reduce((sum, i) => sum + i.valorTotal, 0),
    valorLimitePrazo: itens
      .filter((i) => i.situacao === 'limite_prazo')
      .reduce((sum, i) => sum + i.valorTotal, 0),
    valorVencido: itens
      .filter((i) => i.situacao === 'vencido')
      .reduce((sum, i) => sum + i.valorTotal, 0),
    ativas: ativas.length,
    valorAtivas: soma(ativas),
    ativasLimitePrazo: ativasLimite.length,
    valorAtivasLimitePrazo: soma(ativasLimite),
    vencidas: vencidas.length,
    valorVencidas: soma(vencidas),
  }

  return NextResponse.json({
    data: filteredBySituacao,
    meta: { ...session, ...meta },
  })
}
