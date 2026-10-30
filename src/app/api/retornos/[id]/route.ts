import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import {
  resolverPrazoDefinido,
  UNIDADES_PRAZO_RETORNO,
  type DefinicaoPrazo,
  type UnidadePrazoRetorno,
} from '@/lib/retorno-prazo'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { hojeIsoSaoPaulo } from '@/lib/retornos-server'

interface PutBody {
  dataPrevista?: unknown
  quantidade?: unknown
  unidade?: unknown
}

function lerDefinicao(body: PutBody): DefinicaoPrazo | null {
  if (typeof body.dataPrevista === 'string') return { modo: 'data', data: body.dataPrevista }
  if (UNIDADES_PRAZO_RETORNO.includes(body.unidade as UnidadePrazoRetorno)) {
    return { modo: 'em', quantidade: Number(body.quantidade), unidade: body.unidade as UnidadePrazoRetorno }
  }
  return null
}

/** PUT /api/retornos/:id — a recepção define/edita o prazo (data prevista ou "em N dias/semanas/meses"). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'retornos', 'update')
  if (denied) return denied

  const { id } = await params
  const body = (await request.json().catch(() => null)) as PutBody | null
  const definicao = body ? lerDefinicao(body) : null
  if (!definicao) return serverErrorResponse('Informe a data ou o prazo do retorno', 'INVALID_BODY', 400)

  const scoped = await getScopedUnitId(session)
  if (scoped.error) return supabaseErrorResponse(scoped.error, 'Falha ao salvar o prazo')

  const supabase = getAppSupabase()
  const { data: atual, error } = await supabase
    .from('retornos_pendentes')
    .select('id,unidade_id,data_base,status')
    .eq('id', id)
    .maybeSingle()
  if (error) return supabaseErrorResponse(error, 'Falha ao salvar o prazo')
  if (!atual || atual.status !== 'pendente') {
    return serverErrorResponse('Retorno não encontrado', 'RETORNO_NOT_FOUND', 404)
  }
  if (scoped.unidadeId && atual.unidade_id && String(atual.unidade_id) !== scoped.unidadeId) {
    return serverErrorResponse('Retorno fora do escopo da unidade', 'RETORNO_UNIT_FORBIDDEN', 403)
  }

  const prazo = resolverPrazoDefinido(definicao, hojeIsoSaoPaulo(), String(atual.data_base))
  if (!prazo.ok) return serverErrorResponse(prazo.message, 'INVALID_PRAZO', 400)

  const { error: updateError } = await supabase
    .from('retornos_pendentes')
    .update({
      prazo_tipo: prazo.prazoTipo,
      prazo_dias: prazo.prazoDias,
      data_prevista: prazo.dataPrevista,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pendente')
  if (updateError) return supabaseErrorResponse(updateError, 'Falha ao salvar o prazo')
  return NextResponse.json({ data: { id, dataPrevista: prazo.dataPrevista } })
}
