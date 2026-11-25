import type { PostgrestError } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { emLotes } from '@/lib/em-lotes'
import { hojeIsoClinica } from '@/lib/fuso-clinica'
import {
  inicioJanelaPosologia,
  itensMaisRecentesPorProduto,
  MAX_POSOLOGIA,
  type ItemPrescritoBruto,
} from '@/lib/posologia-ajuste'
import {
  assertPacienteInUnitScope,
  authErrorResponse,
  getRequestAuth,
} from '@/lib/request-auth'

const STATUS_FORA = ['Cancelada', 'Rascunho']

async function carregarItens(pacienteId: string): Promise<{ itens: ItemPrescritoBruto[]; erro: PostgrestError | null }> {
  const supabase = getAppSupabase()
  const desde = inicioJanelaPosologia(hojeIsoClinica())
  const prescricoes = await supabase
    .from('prescricoes')
    .select('id,data_prescricao,created_at,status')
    .eq('paciente_id', pacienteId)
    .gte('data_prescricao', desde)
    .limit(200)
  if (prescricoes.error) return { itens: [], erro: prescricoes.error }
  const validas = (prescricoes.data ?? []).filter((p) => !STATUS_FORA.includes(String(p.status)))
  const porId = new Map(validas.map((p) => [String(p.id), p]))
  const resultados = await Promise.all(
    emLotes([...porId.keys()], 150).map((lote) =>
      supabase
        .from('prescricao_itens')
        .select('id,prescricao_id,produto_id,descricao,posologia')
        .in('prescricao_id', lote),
    ),
  )
  const itens: ItemPrescritoBruto[] = []
  for (const r of resultados) {
    if (r.error) return { itens: [], erro: r.error }
    for (const raw of r.data ?? []) {
      const presc = porId.get(String(raw.prescricao_id))
      if (!presc) continue
      itens.push({
        id: String(raw.id),
        prescricaoId: String(raw.prescricao_id),
        produtoId: raw.produto_id ? String(raw.produto_id) : null,
        descricao: String(raw.descricao ?? ''),
        posologia: raw.posologia ? String(raw.posologia) : null,
        dataPrescricao: String(presc.data_prescricao ?? '').slice(0, 10),
        criadoEm: String(presc.created_at ?? ''),
      })
    }
  }
  return { itens, erro: null }
}

/** GET /api/pacientes/posologia?pacienteId= — produtos prescritos nos últimos 30 dias (um por produto, o mais recente). */
export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'prescricoes', 'read')
  if (denied) return denied
  const pacienteId = request.nextUrl.searchParams.get('pacienteId')
  if (!pacienteId) return serverErrorResponse('Paciente não informado', 'INVALID_PATIENT', 400)
  const fora = await assertPacienteInUnitScope({ session, pacienteId })
  if (fora) return fora

  const { itens, erro } = await carregarItens(pacienteId)
  if (erro) return supabaseErrorResponse(erro, 'Falha ao carregar os produtos prescritos')
  return NextResponse.json({ data: itensMaisRecentesPorProduto(itens) })
}

/** PUT /api/pacientes/posologia — { pacienteId, ajustes: [{ itemId, posologia }] }: grava no item e no histórico. */
export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'prescricoes', 'update')
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as {
    pacienteId?: string
    ajustes?: Array<{ itemId?: string; posologia?: string }>
  } | null
  const pacienteId = body?.pacienteId
  const ajustes = Array.isArray(body?.ajustes) ? body.ajustes : []
  if (!pacienteId || ajustes.length === 0 || ajustes.length > 100) {
    return serverErrorResponse('Ajuste inválido', 'INVALID_ADJUSTMENT', 400)
  }
  const fora = await assertPacienteInUnitScope({ session, pacienteId })
  if (fora) return fora

  const permitidos = new Map(
    itensMaisRecentesPorProduto((await carregarItens(pacienteId)).itens).map((i) => [i.itemId, i]),
  )
  const validos: Array<{ itemId: string; posologia: string }> = []
  for (const ajuste of ajustes) {
    const posologia = (ajuste.posologia ?? '').trim()
    if (!ajuste.itemId || !permitidos.has(ajuste.itemId)) {
      return serverErrorResponse('Produto fora dos últimos 30 dias', 'ITEM_FORA_JANELA', 409)
    }
    if (!posologia || posologia.length > MAX_POSOLOGIA) {
      return serverErrorResponse('Informe a nova forma de tomar (até 500 letras)', 'INVALID_POSOLOGIA', 400)
    }
    if (posologia !== permitidos.get(ajuste.itemId)?.posologia) {
      validos.push({ itemId: ajuste.itemId, posologia })
    }
  }

  const supabase = getAppSupabase()
  for (const { itemId, posologia } of validos) {
    const item = permitidos.get(itemId)
    if (!item) continue
    const atualiza = await supabase.from('prescricao_itens').update({ posologia }).eq('id', itemId)
    if (atualiza.error) return supabaseErrorResponse(atualiza.error, 'Falha ao salvar a posologia')
    const historico = await supabase.from('prescricao_item_posologia_historico').insert({
      prescricao_item_id: itemId,
      prescricao_id: item.prescricaoId,
      paciente_id: pacienteId,
      posologia_anterior: item.posologia || null,
      posologia_nova: posologia,
      usuario_id: session.userId,
    })
    if (historico.error) return supabaseErrorResponse(historico.error, 'Falha ao registrar o histórico do ajuste')
  }
  return NextResponse.json({ data: { alterados: validos.length } })
}
