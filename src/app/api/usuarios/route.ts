import { hash } from 'bcryptjs'
import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { mapUsuarioItem } from '@/lib/domain-mappers'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import { resolverUnidadeUsuario } from './usuario-input'

type UsuarioBody = Record<string, unknown>

async function listUsuarios(
  request: NextRequest,
  session: Awaited<ReturnType<typeof getRequestAuth>>,
) {
  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id,nome,email,perfil,status,tipo_vinculo,especialistas_permitidos,agenda_pessoal_permitidos,unidade_id')
    .order('nome', { ascending: true })

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar usuários')
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => mapUsuarioItem(row)),
    meta: session,
  })
}

function normalizeEspecialistasPermitidos(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids = (value as unknown[])
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
  return ids.length > 0 ? Array.from(new Set(ids)) : null
}

function validateUsuarioBody(body: UsuarioBody, requirePassword: boolean) {
  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const perfil = String(body.perfil ?? '').trim()
  const status = String(body.status ?? 'Ativo').trim()
  const senha = body.senha == null ? '' : String(body.senha).trim()

  if (!nome || !email || !perfil) {
    return {
      error: serverErrorResponse(
        'Nome, e-mail e perfil são obrigatórios',
        'USER_REQUIRED_FIELDS',
        400,
      ),
    }
  }

  if (requirePassword && senha.length < 4) {
    return {
      error: serverErrorResponse(
        'Informe uma senha com pelo menos 4 caracteres',
        'USER_PASSWORD_REQUIRED',
        400,
      ),
    }
  }

  const tipoVinculoRaw = String(body.tipoVinculo ?? body.tipo_vinculo ?? '')
    .trim()
    .toLowerCase()
  const tipoVinculo =
    tipoVinculoRaw === 'parceiro'
      ? 'parceiro'
      : tipoVinculoRaw === 'interno' || tipoVinculoRaw === 'colaborador'
        ? 'interno'
        : null

  // Resolvido aqui, e não em cada handler, porque POST e PUT têm blocos de
  // payload diferentes — foi justamente uma mudança aplicada só num dos dois
  // que deixou `cidade` sem persistir no item 12. Ponto único, os dois herdam.
  const unidade = resolverUnidadeUsuario(perfil, body)
  if (!unidade.ok) {
    return {
      error: serverErrorResponse(
        'Unidade é obrigatória para gestor, recepção e especialista',
        unidade.codigo,
        400,
      ),
    }
  }

  return {
    payload: {
      nome,
      email,
      perfil,
      status: status || 'Ativo',
      senha,
      tipoVinculo,
      unidadeId: unidade.unidadeId,
    },
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'usuarios', 'read')
  if (denied) return denied

  return listUsuarios(request, session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'usuarios', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as UsuarioBody | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)

  const validated = validateUsuarioBody(body, true)
  if ('error' in validated) return validated.error

  const senhaHash = await hash(validated.payload.senha, 10)
  const supabase = getAppSupabase()
  const insertPayload: Record<string, unknown> = {
    nome: validated.payload.nome,
    email: validated.payload.email,
    perfil: validated.payload.perfil,
    status: validated.payload.status,
    unidade_id: validated.payload.unidadeId,
    senha_hash: senhaHash,
  }
  if (validated.payload.perfil === 'especialista' && validated.payload.tipoVinculo) {
    insertPayload.tipo_vinculo = validated.payload.tipoVinculo
  }
  if (validated.payload.perfil === 'recepcao') {
    insertPayload.especialistas_permitidos = normalizeEspecialistasPermitidos(
      body.especialistasPermitidos,
    )
    insertPayload.agenda_pessoal_permitidos = normalizeEspecialistasPermitidos(
      body.agendaPessoalPermitidos,
    )
  }
  const { error } = await supabase.from('usuarios').insert(insertPayload)

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao criar usuário')
  }

  return listUsuarios(request, session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'usuarios', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as UsuarioBody | null
  if (!body) return serverErrorResponse('Payload inválido', 'INVALID_PAYLOAD', 400)

  const id = String(body.id ?? '').trim()
  if (!id) return serverErrorResponse('Usuário não informado', 'USER_ID_REQUIRED', 400)

  const validated = validateUsuarioBody(body, false)
  if ('error' in validated) return validated.error

  const updatePayload: Record<string, unknown> = {
    nome: validated.payload.nome,
    email: validated.payload.email,
    perfil: validated.payload.perfil,
    status: validated.payload.status,
    unidade_id: validated.payload.unidadeId,
  }

  if (validated.payload.senha) {
    updatePayload.senha_hash = await hash(validated.payload.senha, 10)
  }

  if (validated.payload.perfil === 'especialista' && validated.payload.tipoVinculo) {
    updatePayload.tipo_vinculo = validated.payload.tipoVinculo
  }

  if (validated.payload.perfil === 'recepcao') {
    updatePayload.especialistas_permitidos = normalizeEspecialistasPermitidos(
      body.especialistasPermitidos,
    )
    updatePayload.agenda_pessoal_permitidos = normalizeEspecialistasPermitidos(
      body.agendaPessoalPermitidos,
    )
  } else {
    updatePayload.especialistas_permitidos = null
    updatePayload.agenda_pessoal_permitidos = null
  }

  const supabase = getAppSupabase()
  const { error } = await supabase.from('usuarios').update(updatePayload).eq('id', id)

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao atualizar usuário')
  }

  return listUsuarios(request, session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'usuarios', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as UsuarioBody | null
  const id = String(body?.id ?? '').trim()
  if (!id) return serverErrorResponse('Usuário não informado', 'USER_ID_REQUIRED', 400)

  const supabase = getAppSupabase()
  const { error } = await supabase.from('usuarios').delete().eq('id', id)

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao excluir usuário')
  }

  return listUsuarios(request, session)
}
