import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { limparCacheCurto } from '@/lib/short-cache'
import { mapPermissaoItem } from '@/lib/domain-mappers'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'

async function listPermissoes(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const [{ data, error }, recursosResult, unidadesResult] = await Promise.all([
    supabase
      .from('perfil_permissoes')
      .select('perfil,acao,recurso_id,unidade_id,unidades(nome)'),
    supabase.from('recursos').select('id,codigo,descricao').order('codigo'),
    supabase.from('unidades').select('id,nome').order('nome'),
  ])

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar permissões')
  }

  if (recursosResult.error) {
    return supabaseErrorResponse(recursosResult.error, 'Falha ao carregar permissões')
  }

  if (unidadesResult.error) {
    return supabaseErrorResponse(unidadesResult.error, 'Falha ao carregar permissões')
  }

  const recursosMap = (recursosResult.data ?? []).reduce<Record<string, string>>((acc, row) => {
    acc[String(row.id)] = String(row.codigo ?? '')
    return acc
  }, {})

  const grouped = Object.values(
    (data ?? []).reduce<Record<string, { perfil: string; recurso: string; acoes: string[]; unidadeId?: string; unidadeNome?: string }>>((acc, row) => {
      const unidadeId = row.unidade_id ? String(row.unidade_id) : ''
      const unidadeNome =
        row.unidades && typeof row.unidades === 'object' && 'nome' in row.unidades
          ? String((row.unidades as { nome?: unknown }).nome ?? '')
          : ''
      const key = `${row.perfil}:${unidadeId || 'global'}:${row.recurso_id}`
      if (!acc[key]) {
        acc[key] = {
          perfil: String(row.perfil ?? ''),
          recurso: recursosMap[String(row.recurso_id ?? '')] ?? '',
          acoes: [],
          unidadeId: unidadeId || undefined,
          unidadeNome: unidadeNome || undefined,
        }
      }
      acc[key].acoes.push(String(row.acao ?? ''))
      return acc
    }, {}),
  )

  return NextResponse.json({
    data: grouped.map((row) => mapPermissaoItem(row)),
    meta: {
      ...session,
      resources: (recursosResult.data ?? []).map((row) => ({
        id: String(row.id),
        codigo: String(row.codigo ?? ''),
        descricao: String(row.descricao ?? ''),
      })),
      units: (unidadesResult.data ?? []).map((row) => ({
        id: String(row.id),
        nome: String(row.nome ?? ''),
      })),
    },
  })
}

async function resolveRecursosMap(codigos: string[]) {
  const supabase = getAppSupabase()
  const uniqueCodigos = Array.from(new Set(codigos.filter(Boolean)))
  const { data, error } = await supabase
    .from('recursos')
    .select('id,codigo')
    .in('codigo', uniqueCodigos)

  if (error) {
    return { map: {} as Record<string, string>, error }
  }

  return {
    map: (data ?? []).reduce<Record<string, string>>((acc, row) => {
      acc[String(row.codigo ?? '')] = String(row.id)
      return acc
    }, {}),
    error: null,
  }
}

function normalizePermissions(body: Record<string, unknown>) {
  const perfil = String(body.perfil ?? '').trim().toLowerCase()
  const unidadeIdValue = body.unidadeId
  const unidadeId =
    typeof unidadeIdValue === 'string' && unidadeIdValue.trim() !== '' && unidadeIdValue !== 'global'
      ? unidadeIdValue.trim()
      : null
  const permissions = Array.isArray(body.permissions) ? body.permissions : []
  return {
    perfil,
    unidadeId,
    permissions: permissions
      .map((item) => {
        const recurso = typeof item === 'object' && item && 'recurso' in item ? String((item as { recurso?: unknown }).recurso ?? '') : ''
        const acoes =
          typeof item === 'object' && item && 'acoes' in item && Array.isArray((item as { acoes?: unknown[] }).acoes)
            ? Array.from(new Set(((item as { acoes?: unknown[] }).acoes ?? []).map(String).filter(Boolean)))
            : []

        return { recurso, acoes }
      })
      .filter((item) => item.recurso && item.acoes.length > 0),
  }
}

async function savePermissoes(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
  session: Awaited<ReturnType<typeof getRequestAuth>>,
) {
  const { perfil, unidadeId, permissions } = normalizePermissions(body)
  if (!perfil) {
    return serverErrorResponse('Perfil não informado', 'PERMISSAO_PERFIL_REQUIRED', 400)
  }

  if (permissions.length === 0) {
    return serverErrorResponse('Selecione ao menos um recurso e ação', 'PERMISSAO_RULES_REQUIRED', 400)
  }

  const recursosResult = await resolveRecursosMap(permissions.map((item) => item.recurso))
  if (recursosResult.error) {
    return supabaseErrorResponse(recursosResult.error, 'Falha ao salvar permissões')
  }

  const missingResource = permissions.find((item) => !recursosResult.map[item.recurso])
  if (missingResource) {
    return serverErrorResponse('Recurso informado não existe', 'PERMISSAO_RESOURCE_INVALID', 400)
  }

  const supabase = getAppSupabase()
  if (mode === 'update') {
    let deleteQuery = supabase.from('perfil_permissoes').delete().eq('perfil', perfil)
    deleteQuery = unidadeId ? deleteQuery.eq('unidade_id', unidadeId) : deleteQuery.is('unidade_id', null)
    const { error } = await deleteQuery
    if (error) {
      return supabaseErrorResponse(error, 'Falha ao atualizar permissões')
    }
  }

  const inserts = permissions.flatMap((item) =>
    item.acoes.map((acao) => ({
      perfil,
      recurso_id: recursosResult.map[item.recurso],
      acao,
      unidade_id: unidadeId,
    })),
  )

  const { error } = await supabase.from('perfil_permissoes').insert(inserts)
  if (error) {
    return supabaseErrorResponse(error, mode === 'create' ? 'Falha ao criar perfil de permissões' : 'Falha ao atualizar permissões')
  }

  limparCacheCurto() // sessão/permissão em cache curto: aplica a mudança já
  return listPermissoes(session)
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'permissoes', 'read')
  if (denied) return denied

  return listPermissoes(session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'permissoes', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return serverErrorResponse('Payload inválido', 'INVALID_PERMISSION_PAYLOAD', 400)
  }

  return savePermissoes(body, 'create', session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'permissoes', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return serverErrorResponse('Payload inválido', 'INVALID_PERMISSION_PAYLOAD', 400)
  }

  return savePermissoes(body, 'update', session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'permissoes', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const perfil = String(body?.perfil ?? '').trim().toLowerCase()
  const unidadeIdValue = body?.unidadeId
  const unidadeId =
    typeof unidadeIdValue === 'string' && unidadeIdValue.trim() !== '' && unidadeIdValue !== 'global'
      ? unidadeIdValue.trim()
      : null
  if (!perfil) {
    return serverErrorResponse('Perfil não informado', 'PERMISSAO_PERFIL_REQUIRED', 400)
  }

  const supabase = getAppSupabase()
  let deleteQuery = supabase.from('perfil_permissoes').delete().eq('perfil', perfil)
  deleteQuery = unidadeId ? deleteQuery.eq('unidade_id', unidadeId) : deleteQuery.is('unidade_id', null)
  const { error } = await deleteQuery
  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir perfil de permissões')
  }

  limparCacheCurto() // sessão/permissão em cache curto: aplica a mudança já
  return listPermissoes(session)
}
