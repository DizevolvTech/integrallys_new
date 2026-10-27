import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { assertPacienteInUnitScope, authErrorResponse, forbiddenResponse, getRequestAuth } from '@/lib/request-auth'

const UUID = /^[0-9a-f-]{36}$/i
const PERFIS = new Set(['master', 'admin', 'gestor', 'recepcao'])

/** POST /api/recibos/pedido-nf { tipo, id, observacao? } — registra o pedido de NF (um pendente por venda/consulta). */
export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  if (!PERFIS.has(session.role)) return forbiddenResponse()

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const tipo = body?.tipo
  const id = typeof body?.id === 'string' ? body.id : ''
  if ((tipo !== 'prescricao' && tipo !== 'agendamento') || !UUID.test(id)) {
    return serverErrorResponse('Pedido inválido', 'INVALID_PEDIDO_NF', 400)
  }
  const denied = await requirePermission(session.userId, tipo === 'prescricao' ? 'prescricoes' : 'agenda', 'update')
  if (denied) return denied

  const supabase = getAppSupabase()
  let pacienteId: string | null = null
  let valor: number | null = null
  if (tipo === 'prescricao') {
    const { data } = await supabase.from('prescricoes').select('paciente_id,valor_total,status').eq('id', id).maybeSingle()
    if (!data) return serverErrorResponse('Venda não encontrada', 'NOT_FOUND', 404)
    if (!/^(convert|conclu|finaliz)/i.test(String(data.status))) {
      return serverErrorResponse('O pedido de NF só vale para venda convertida', 'RECIBO_NAO_DISPONIVEL', 409)
    }
    pacienteId = data.paciente_id ? String(data.paciente_id) : null
    valor = Number(data.valor_total ?? 0)
  } else {
    const { data } = await supabase.from('agendamentos').select('paciente_id,valor_procedimento').eq('id', id).maybeSingle()
    if (!data?.paciente_id) return serverErrorResponse('Agendamento não encontrado', 'NOT_FOUND', 404)
    pacienteId = String(data.paciente_id)
    valor = Number(data.valor_procedimento ?? 0)
  }
  if (pacienteId) {
    const fora = await assertPacienteInUnitScope({ session, pacienteId })
    if (fora) return fora
  }

  const observacao = typeof body?.observacao === 'string' && body.observacao.trim() ? body.observacao.trim().slice(0, 300) : null
  const { error } = await supabase
    .from('pedidos_nf')
    .insert({ origem: tipo, origem_id: id, paciente_id: pacienteId, valor, observacao, solicitado_por: session.userId })
  // 23505: já existe pedido pendente — o clique repetido não duplica.
  if (error && error.code !== '23505') return supabaseErrorResponse(error, 'Falha ao registrar o pedido de NF')

  return NextResponse.json({ data: { pedidoStatus: 'pendente' } }, { status: error ? 200 : 201 })
}
