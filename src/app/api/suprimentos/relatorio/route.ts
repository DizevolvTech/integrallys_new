import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { isFinanciallyRestrictedRole } from '@/lib/financial-sanitize'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { mapSuprimento, resumirMovimentos, SUPRIMENTO_COLUNAS } from '@/lib/suprimentos'

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i
const LIMITE_RESUMO = 10_000

/**
 * GET /api/suprimentos/relatorio?de=&ate=&suprimentoId=&origem=&limit=&offset=
 * Relatório de controle de suprimentos (recepção e gestor): saldo, entradas, saídas, baixas por
 * procedimento e custo consumido no período, mais o livro de movimentações paginado.
 */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'estoque', 'read')
  if (denied) return denied
  if (isFinanciallyRestrictedRole(session.role)) return serverErrorResponse('Acesso negado', 'FORBIDDEN', 403)

  const params = new URL(request.url).searchParams
  const de = params.get('de') ?? ''
  const ate = params.get('ate') ?? ''
  const suprimentoId = params.get('suprimentoId') ?? ''
  const origem = params.get('origem') ?? ''
  if ((de && !DATA_ISO.test(de)) || (ate && !DATA_ISO.test(ate)) || (suprimentoId && !UUID.test(suprimentoId))) {
    return serverErrorResponse('Filtro inválido', 'INVALID_FILTER', 400)
  }
  if (origem && !['manual', 'ajuste', 'procedimento'].includes(origem)) {
    return serverErrorResponse('Filtro inválido', 'INVALID_FILTER', 400)
  }
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? 20) || 20))
  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)

  const supabase = getAppSupabase()
  const escopo = await getScopedUnitId(session)
  if (escopo.error) return supabaseErrorResponse(escopo.error, 'Falha ao carregar o relatório')

  let suprimentosQuery = supabase.from('suprimentos').select(SUPRIMENTO_COLUNAS).order('nome', { ascending: true })
  if (escopo.unidadeId) suprimentosQuery = suprimentosQuery.eq('unidade_id', escopo.unidadeId)
  const { data: suprimentosRows, error: suprimentosError } = await suprimentosQuery
  if (suprimentosError) return supabaseErrorResponse(suprimentosError, 'Falha ao carregar o relatório')
  const suprimentos = (suprimentosRows ?? []).map(mapSuprimento)
  const idsEscopo = escopo.unidadeId ? suprimentos.map((s) => s.id) : null

  const filtrar = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; eq: (c: string, v: string) => T; in: (c: string, v: string[]) => T }>(q: T) => {
    let r = q
    if (de) r = r.gte('created_at', `${de}T00:00:00-03:00`)
    if (ate) r = r.lte('created_at', `${ate}T23:59:59.999-03:00`)
    if (suprimentoId) r = r.eq('suprimento_id', suprimentoId)
    if (origem) r = r.eq('origem', origem)
    if (idsEscopo) r = r.in('suprimento_id', idsEscopo.slice(0, 150))
    return r
  }

  const [resumoQuery, paginaQuery] = await Promise.all([
    filtrar(supabase.from('suprimentos_movimentacoes').select('suprimento_id,tipo,origem,quantidade,preco_custo').limit(LIMITE_RESUMO)),
    filtrar(
      supabase
        .from('suprimentos_movimentacoes')
        .select('id,suprimento_id,tipo,origem,quantidade,saldo_apos,motivo,created_at,usuario_id,agendamento_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ),
  ])
  if (resumoQuery.error) return supabaseErrorResponse(resumoQuery.error, 'Falha ao carregar o relatório')
  if (paginaQuery.error) return supabaseErrorResponse(paginaQuery.error, 'Falha ao carregar o relatório')

  const custoPorId = new Map(suprimentos.map((s) => [s.id, s.precoCusto ?? 0]))
  const { porSuprimento, totais } = resumirMovimentos(
    (resumoQuery.data ?? []).map((m) => ({
      suprimento_id: String(m.suprimento_id),
      tipo: String(m.tipo),
      origem: String(m.origem),
      quantidade: Number(m.quantidade),
      custo: m.preco_custo != null ? Number(m.preco_custo) : custoPorId.get(String(m.suprimento_id)) ?? 0,
    })),
  )

  const nomePorId = new Map(suprimentos.map((s) => [s.id, s.nome]))
  const usuarioIds = [...new Set((paginaQuery.data ?? []).map((m) => m.usuario_id).filter((v): v is string => !!v))]
  const { data: usuarios } = usuarioIds.length
    ? await supabase.from('usuarios').select('id,nome').in('id', usuarioIds.slice(0, 150))
    : { data: [] as Array<{ id: string; nome: string }> }
  const nomeUsuario = new Map((usuarios ?? []).map((u) => [String(u.id), String(u.nome)]))

  const hoje = new Date()
  const limite30 = new Date(hoje.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  const hojeIso = hoje.toISOString().slice(0, 10)
  const ativos = suprimentos.filter((s) => s.ativo)

  return NextResponse.json({
    data: {
      resumo: ativos
        .filter((s) => !suprimentoId || s.id === suprimentoId)
        .map((s) => ({
          suprimentoId: s.id,
          nome: s.nome,
          quantidade: s.quantidade,
          estoqueMinimo: s.estoqueMinimo,
          validade: s.validade,
          abaixoMinimo: s.estoqueMinimo > 0 && s.quantidade <= s.estoqueMinimo,
          vencendo: !!s.validade && s.validade <= limite30,
          vencido: !!s.validade && s.validade < hojeIso,
          ...(porSuprimento.get(s.id) ?? { entradas: 0, saidas: 0, consumoProcedimentos: 0, custoConsumo: 0 }),
        })),
      totais: {
        ...totais,
        abaixoMinimo: ativos.filter((s) => s.estoqueMinimo > 0 && s.quantidade <= s.estoqueMinimo).length,
        vencendo: ativos.filter((s) => s.validade && s.validade <= limite30).length,
        truncado: (resumoQuery.data?.length ?? 0) >= LIMITE_RESUMO,
      },
      movimentos: (paginaQuery.data ?? []).map((m) => ({
        id: String(m.id),
        suprimento: nomePorId.get(String(m.suprimento_id)) ?? '—',
        tipo: String(m.tipo),
        origem: String(m.origem),
        quantidade: Number(m.quantidade),
        saldoApos: Number(m.saldo_apos),
        motivo: m.motivo ? String(m.motivo) : null,
        criadoEm: String(m.created_at),
        operador: m.usuario_id ? nomeUsuario.get(String(m.usuario_id)) ?? null : null,
        automatico: m.origem === 'procedimento',
      })),
      total: paginaQuery.count ?? 0,
    },
    meta: session,
  })
}
