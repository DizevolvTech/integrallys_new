import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { normalizarConteudo, SLUG_MODELO_POR_DOCUMENTO } from '@/lib/documentos'

/**
 * Modelo pessoal do especialista para os documentos do atendimento ("Salvar modelo" / "Restaurar padrão").
 * Sempre do usuário logado; nunca altera o modelo da clínica (Configurações > Templates e documentos).
 * `slug` = id do documento da lista do atendimento (dieta, encaminhamento, declaracao…).
 */
async function lerBody(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const slug = typeof body?.slug === 'string' ? body.slug : ''
  if (!(slug in SLUG_MODELO_POR_DOCUMENTO)) {
    return { error: serverErrorResponse('Documento inválido', 'INVALID_SLUG', 400) }
  }
  return { slug, conteudo: body?.conteudo }
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'update')
  if (denied) return denied

  const body = await lerBody(request)
  if ('error' in body) return body.error
  const conteudo = normalizarConteudo(body.conteudo)
  if (!conteudo) return serverErrorResponse('Modelo vazio ou inválido', 'INVALID_CONTEUDO', 400)

  const scopedUnit = await getScopedUnitId(session)
  const unidadeId = scopedUnit.error ? null : scopedUnit.unidadeId
  if (!unidadeId) return serverErrorResponse('Usuário sem unidade vinculada', 'NO_UNIT', 400)

  const { error } = await getAppSupabase()
    .from('documento_modelos_pessoais')
    .upsert(
      { usuario_id: session.userId, unidade_id: unidadeId, slug: body.slug, conteudo },
      { onConflict: 'usuario_id,slug' },
    )
  if (error) return supabaseErrorResponse(error, 'Falha ao salvar o modelo')
  return NextResponse.json({ data: { slug: body.slug, salvo: true } })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'update')
  if (denied) return denied

  const body = await lerBody(request)
  if ('error' in body) return body.error

  const { error } = await getAppSupabase()
    .from('documento_modelos_pessoais')
    .delete()
    .eq('usuario_id', session.userId)
    .eq('slug', body.slug)
  if (error) return supabaseErrorResponse(error, 'Falha ao restaurar o modelo padrão')
  return NextResponse.json({ data: { slug: body.slug, restaurado: true } })
}
