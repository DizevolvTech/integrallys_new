import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

const TIPOS_VALIDOS = new Set([
  'formulario',
  'declaracao',
  'laudo',
  'encaminhamento',
  'procedimento',
  'dieta',
  'contrato',
])
const SLUG_REGEX = /^[a-z0-9_]+$/

const TEMPLATE_SELECT =
  'id,unidade_id,slug,nome,tipo,tipo_documento_id,conteudo,ativo,editavel_pelo_especialista,disponivel_portal_paciente,created_at,updated_at'

/**
 * Resolve a unidade de escrita:
 * - Chamador escopado: sempre a unidade do JWT (ignora body — anti IDOR).
 * - master/admin (unidade null): exige `body.unidadeId` no POST; em
 *   PATCH/DELETE o filtro de unidade fica opcional (localiza só por id).
 */
function resolveUnidadeEscopo(
  scopedUnidadeId: string | null,
  bodyUnidadeId: unknown,
): { unidadeId: string } | { error: ReturnType<typeof serverErrorResponse> } {
  if (scopedUnidadeId) {
    return { unidadeId: scopedUnidadeId }
  }
  const fromBody = typeof bodyUnidadeId === 'string' ? bodyUnidadeId.trim() : ''
  if (!fromBody) {
    return {
      error: serverErrorResponse(
        'unidadeId obrigatório (master/admin precisam informar a unidade do template)',
        'INVALID_UNIDADE_ID',
        400,
      ),
    }
  }
  return { unidadeId: fromBody }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'read')
  if (denied) return denied

  // master/admin: getScopedUnitId retorna unidadeId null de propósito ("sem
  // escopo, vê tudo"). Não tratar como NO_UNIT — só filtrar por unidade quando
  // o chamador for escopado (gestor/recepção/especialista).
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade do usuário')
  }

  const url = new URL(request.url)
  const incluirInativos = url.searchParams.get('incluir_inativos') === 'true'

  const supabase = getAppSupabase()
  let query = supabase
    .from('documento_templates')
    .select(TEMPLATE_SELECT)
    .order('nome', { ascending: true })

  if (scopedUnit.unidadeId) {
    query = query.eq('unidade_id', scopedUnit.unidadeId)
  }

  if (!incluirInativos) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar templates de documento')

  return NextResponse.json({ data: data ?? [], meta: session })
}

export async function PATCH(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return serverErrorResponse('Requisição inválida', 'INVALID_BODY', 400)
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return serverErrorResponse('id do template é obrigatório', 'INVALID_TEMPLATE_ID', 400)

  const updates: Record<string, unknown> = {}
  if (typeof body.nome === 'string') updates.nome = body.nome
  if (typeof body.tipo === 'string') updates.tipo = body.tipo
  if (body.conteudo && typeof body.conteudo === 'object') updates.conteudo = body.conteudo
  if (typeof body.ativo === 'boolean') updates.ativo = body.ativo
  if (typeof body.editavel_pelo_especialista === 'boolean') {
    updates.editavel_pelo_especialista = body.editavel_pelo_especialista
  }
  if (typeof body.disponivel_portal_paciente === 'boolean') {
    updates.disponivel_portal_paciente = body.disponivel_portal_paciente
  }

  if (Object.keys(updates).length === 0) {
    return serverErrorResponse('Nada para atualizar', 'NO_UPDATE', 400)
  }

  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade do usuário')
  }

  const supabase = getAppSupabase()
  // Escopado: id + unidade do JWT. master/admin: só id (sem NO_UNIT).
  let query = supabase.from('documento_templates').update(updates).eq('id', id)
  if (scopedUnit.unidadeId) {
    query = query.eq('unidade_id', scopedUnit.unidadeId)
  }

  const { data, error } = await query
    .select(
      'id,unidade_id,slug,nome,tipo,conteudo,ativo,editavel_pelo_especialista,disponivel_portal_paciente,updated_at',
    )
    .maybeSingle()

  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar template')
  if (!data) return serverErrorResponse('Template não encontrado', 'NOT_FOUND', 404)

  return NextResponse.json({ data, meta: session })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return serverErrorResponse('Requisição inválida', 'INVALID_BODY', 400)
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  let tipo = typeof body.tipo === 'string' ? body.tipo : ''
  const tipoDocumentoId =
    typeof body.tipoDocumentoId === 'string' && /^[0-9a-f-]{36}$/i.test(body.tipoDocumentoId)
      ? body.tipoDocumentoId
      : null
  const conteudo = body.conteudo && typeof body.conteudo === 'object' ? body.conteudo : null

  if (!slug || !SLUG_REGEX.test(slug)) {
    return serverErrorResponse(
      'slug inválido (use apenas minúsculas, números e _)',
      'INVALID_SLUG',
      400,
    )
  }
  if (!nome) return serverErrorResponse('nome é obrigatório', 'INVALID_NAME', 400)
  if (!TIPOS_VALIDOS.has(tipo)) return serverErrorResponse('tipo inválido', 'INVALID_TIPO', 400)
  if (!conteudo) return serverErrorResponse('conteudo é obrigatório', 'INVALID_CONTEUDO', 400)

  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade do usuário')
  }

  // Escopado → JWT; master/admin → body.unidadeId (body ignorado se escopado).
  const resolved = resolveUnidadeEscopo(scopedUnit.unidadeId, body.unidadeId)
  if ('error' in resolved) return resolved.error
  const { unidadeId } = resolved

  const supabase = getAppSupabase()
  // Tipo escolhido no cadastro: o modelo base do tipo define como o documento é gerado.
  if (tipoDocumentoId) {
    const { data: tipoCadastro } = await supabase
      .from('documento_tipos')
      .select('base,ativo')
      .eq('id', tipoDocumentoId)
      .maybeSingle()
    if (!tipoCadastro?.ativo) return serverErrorResponse('Tipo de documento inválido', 'INVALID_TIPO', 400)
    tipo = String(tipoCadastro.base)
  }
  const { data, error } = await supabase
    .from('documento_templates')
    .insert({
      tipo_documento_id: tipoDocumentoId,
      unidade_id: unidadeId,
      slug,
      nome,
      tipo,
      conteudo,
      ativo: typeof body.ativo === 'boolean' ? body.ativo : true,
      editavel_pelo_especialista:
        typeof body.editavel_pelo_especialista === 'boolean'
          ? body.editavel_pelo_especialista
          : true,
      disponivel_portal_paciente:
        typeof body.disponivel_portal_paciente === 'boolean'
          ? body.disponivel_portal_paciente
          : false,
    })
    .select(TEMPLATE_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      return serverErrorResponse('Já existe um template com esse slug', 'DUPLICATE_SLUG', 409)
    }
    return supabaseErrorResponse(error, 'Falha ao criar template')
  }

  return NextResponse.json({ data, meta: session }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'documentacao', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return serverErrorResponse('id obrigatório', 'INVALID_ID', 400)

  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade do usuário')
  }

  const supabase = getAppSupabase()

  // Se houver documentos gerados usando este template, preservamos histórico
  // desativando em vez de excluir — evita violação de FK em documentos_gerados.
  // Contagem é global por template_id (uso real do modelo); o filtro de unidade
  // aplica-se só no update/delete do registro do template.
  const { count, error: countError } = await supabase
    .from('documentos_gerados')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)

  if (countError) {
    return supabaseErrorResponse(countError, 'Falha ao checar uso do template')
  }

  if ((count ?? 0) > 0) {
    let deactivate = supabase.from('documento_templates').update({ ativo: false }).eq('id', id)
    if (scopedUnit.unidadeId) {
      deactivate = deactivate.eq('unidade_id', scopedUnit.unidadeId)
    }
    const { error: updateError } = await deactivate
    if (updateError) {
      return supabaseErrorResponse(updateError, 'Falha ao desativar template')
    }
    return NextResponse.json({
      data: {
        id,
        desativado: true,
        motivo: 'Template em uso — foi desativado em vez de excluído.',
      },
    })
  }

  let del = supabase.from('documento_templates').delete().eq('id', id)
  if (scopedUnit.unidadeId) {
    del = del.eq('unidade_id', scopedUnit.unidadeId)
  }
  const { error: deleteError } = await del

  if (deleteError) return supabaseErrorResponse(deleteError, 'Falha ao excluir template')

  return NextResponse.json({ data: { id, excluido: true } })
}
