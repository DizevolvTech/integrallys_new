import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, forbiddenResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { resumirPedidosNf } from '@/lib/pedidos-nf'

const PERFIS = new Set(['master', 'admin', 'gestor'])
const POR_PAGINA = 20
const STATUS = ['pendente', 'emitida', 'cancelada']

/** GET /api/pedidos-nf?status=&pagina= — pedidos de nota fiscal registrados (recibo da venda e da consulta). */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  if (!PERFIS.has(session.role)) return forbiddenResponse()
  const denied = await requirePermission(session.userId, 'financeiro', 'read')
  if (denied) return denied

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao carregar pedidos de NF')

  const params = request.nextUrl.searchParams
  const status = params.get('status') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)
  const de = (pagina - 1) * POR_PAGINA

  const supabase = getAppSupabase()
  const colunas = 'id,origem,origem_id,valor,observacao,status,created_at,pacientes!inner(nome,unidade_id),solicitante:usuarios!solicitado_por(nome)'
  const statusFiltro = STATUS.includes(status) ? status : null

  let listaQuery = supabase.from('pedidos_nf').select(colunas, { count: 'exact' })
  let resumoQuery = supabase.from('pedidos_nf').select('status,valor,pacientes!inner(unidade_id)').in('status', ['pendente', 'emitida'])
  if (statusFiltro) listaQuery = listaQuery.eq('status', statusFiltro)
  if (scoped.unidadeId) {
    listaQuery = listaQuery.eq('pacientes.unidade_id', scoped.unidadeId)
    resumoQuery = resumoQuery.eq('pacientes.unidade_id', scoped.unidadeId)
  }

  const [lista, resumoLinhas] = await Promise.all([
    listaQuery.order('created_at', { ascending: false }).range(de, de + POR_PAGINA - 1),
    resumoQuery.limit(1000),
  ])
  if (lista.error) return supabaseErrorResponse(lista.error, 'Falha ao carregar pedidos de NF')

  const linhas = (lista.data ?? []) as unknown as Array<Record<string, unknown>>
  return NextResponse.json({
    data: linhas.map((row) => ({
      id: String(row.id),
      origem: String(row.origem),
      paciente: (row.pacientes as { nome?: string } | null)?.nome ?? '—',
      solicitante: (row.solicitante as { nome?: string } | null)?.nome ?? '—',
      valor: Number(row.valor ?? 0),
      observacao: row.observacao ? String(row.observacao) : null,
      status: String(row.status),
      criadoEm: String(row.created_at),
    })),
    meta: {
      total: lista.count ?? 0,
      pagina,
      porPagina: POR_PAGINA,
      totalPaginas: Math.max(1, Math.ceil((lista.count ?? 0) / POR_PAGINA)),
      resumo: resumirPedidosNf((resumoLinhas.data ?? []) as unknown as Array<{ status: string; valor: number | null }>),
    },
  })
}
