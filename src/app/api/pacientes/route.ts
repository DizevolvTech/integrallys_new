import bcrypt from 'bcryptjs'
import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { getPasswordSetupRequiredKey } from '@/lib/auth-payload'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const VINCULO_TIPOS_VALIDOS = ['cliente', 'fornecedor', 'prestador', 'profissional', 'usuario', 'outro']

// Item 10: aceita a lista nova (vinculoTipos) e cai para a string única legada
// (vinculoTipo) por compat. Valida contra os tipos conhecidos, dedupe, default cliente.
function normalizeVinculoTipos(body: Record<string, unknown>): string[] {
  const raw = Array.isArray(body.vinculoTipos)
    ? body.vinculoTipos
    : typeof body.vinculoTipo === 'string'
      ? [body.vinculoTipo]
      : []
  const tipos = raw
    .map((tipo) => (typeof tipo === 'string' ? tipo.trim().toLowerCase() : ''))
    .filter((tipo) => VINCULO_TIPOS_VALIDOS.includes(tipo))
  return Array.from(new Set(tipos.length > 0 ? tipos : ['cliente']))
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

// Monta o payload pras colunas novas da tabela pacientes a partir do body
// recebido do formulário. Evita dumping em JSON — cada campo mapeia pra
// uma coluna SQL ou uma coluna JSONB dedicada.
function buildPacientePayload(body: Record<string, unknown>) {
  const addressDetails = body.addressDetails && typeof body.addressDetails === 'object'
    ? (body.addressDetails as Record<string, unknown>)
    : {}

  const payload: Record<string, unknown> = {
    sexo: pickString(body.sexo) || null,
    rg: pickString(body.rg) || null,
    inscricao_estadual: pickString(body.inscricaoEstadual) || null,
    origem: pickString(body.indicacao) || null,
    origem_detalhe: pickString(body.origemDetalhe) || null,
    vinculo_tipos: normalizeVinculoTipos(body),
    precisa_nf: body.precisaNf === true,
    photo_url: (() => {
      const url = pickString(body.photoUrl)
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null
      return url
    })(),
    cep: pickString(addressDetails.zipCode) || null,
    logradouro: pickString(addressDetails.street) || null,
    numero: pickString(addressDetails.number) || null,
    complemento: pickString(addressDetails.complement) || null,
    bairro: pickString(addressDetails.neighborhood) || null,
    cidade: pickString(addressDetails.city) || null,
    estado: pickString(addressDetails.state) || null,
  }

  // Só sobrescreve JSONB quando o client envia o campo — evita wipe silencioso.
  if (body.specialNeeds !== undefined) {
    payload.necessidades_especiais =
      body.specialNeeds && typeof body.specialNeeds === 'object'
        ? (body.specialNeeds as Record<string, unknown>)
        : null
  }
  if (body.responsible !== undefined) {
    payload.responsavel =
      body.responsible && typeof body.responsible === 'object'
        ? (body.responsible as Record<string, unknown>)
        : null
  }
  if (body.financial !== undefined) {
    payload.financeiro =
      body.financial && typeof body.financial === 'object'
        ? (body.financial as Record<string, unknown>)
        : null
  }
  if (body.supplierData !== undefined) {
    payload.fornecedor_dados =
      body.supplierData && typeof body.supplierData === 'object'
        ? (body.supplierData as Record<string, unknown>)
        : null
  }

  return payload
}

async function fetchPatientContext(unidadeId: string | null) {
  const supabase = getAppSupabase()
  let pacientesQuery = supabase
    .from('pacientes')
    .select(
      'id,usuario_id,unidade_id,nome,email,telefone,status,data_nascimento,cpf,sexo,rg,inscricao_estadual,origem,origem_detalhe,vinculo_tipos,precisa_nf,photo_url,cep,logradouro,numero,complemento,bairro,cidade,estado,necessidades_especiais,responsavel,financeiro,fornecedor_dados,created_at,updated_at,' +
        'crm:crm_paciente_estagios(estagio,observacoes,proxima_acao,data_proxima_acao,updated_at)',
    )
    .order('nome', { ascending: true })

  if (unidadeId) {
    pacientesQuery = pacientesQuery.eq('unidade_id', unidadeId)
  }

  const [{ data: pacientes, error: pacientesError }, { data: unidades, error: unidadesError }] = await Promise.all([
    pacientesQuery,
    supabase
      .from('unidades')
      .select('id,nome')
      .order('nome', { ascending: true }),
  ])

  if (pacientesError) return { error: pacientesError, data: null as null }
  if (unidadesError) return { error: unidadesError, data: null as null }

  const unitMap = Object.fromEntries((unidades ?? []).map((unit) => [String(unit.id), String(unit.nome)]))

  // PostgREST devolve a relação embarcada como array (mesmo com UNIQUE no FK).
  // Normalizamos para 1 objeto (ou null).
  const pickCrm = (raw: unknown) => {
    const row = Array.isArray(raw) ? raw[0] ?? null : raw
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    return {
      estagio: typeof r.estagio === 'string' && r.estagio ? r.estagio : 'lead',
      observacoes: typeof r.observacoes === 'string' ? r.observacoes : null,
      proxima_acao: typeof r.proxima_acao === 'string' ? r.proxima_acao : null,
      data_proxima_acao: typeof r.data_proxima_acao === 'string' ? r.data_proxima_acao : null,
      updated_at: typeof r.updated_at === 'string' ? r.updated_at : null,
    }
  }

  return {
    error: null,
    data: {
      // CR-AUTH-01/CR-DASH-01/CR-UI-01 (débito conhecido): o select com embed
      // `crm:crm_paciente_estagios(...)` faz o PostgREST tipar o array de retorno
      // como `GenericStringError[]`. O guard de `pacientesError` acima já garante
      // sucesso, mas o narrowing não propaga pelos types. Cast via `unknown`
      // destrava o build sem mudar comportamento (Agente 20 follow-up, 2026-05-21).
      pacientes: ((pacientes ?? []) as unknown as Record<string, unknown>[]).map((paciente) => ({
        id: String(paciente.id),
        usuarioId: paciente.usuario_id ? String(paciente.usuario_id) : undefined,
        unidadeId: paciente.unidade_id ? String(paciente.unidade_id) : undefined,
        unidadeName: paciente.unidade_id ? unitMap[String(paciente.unidade_id)] ?? '' : '',
        nome: String(paciente.nome ?? ''),
        telefone: String(paciente.telefone ?? ''),
        email: String(paciente.email ?? ''),
        status: String(paciente.status ?? ''),
        cpf: String(paciente.cpf ?? ''),
        birthDate: paciente.data_nascimento ? String(paciente.data_nascimento) : '',
        age: paciente.data_nascimento ? formatDate(String(paciente.data_nascimento)) : '',
        rg: paciente.rg ? String(paciente.rg) : '',
        inscricaoEstadual: paciente.inscricao_estadual ? String(paciente.inscricao_estadual) : '',
        gender: paciente.sexo ? String(paciente.sexo) : '',
        source: paciente.origem ? String(paciente.origem) : '',
        origemDetalhe: paciente.origem_detalhe ? String(paciente.origem_detalhe) : '',
        vinculoTipos: Array.isArray(paciente.vinculo_tipos)
          ? paciente.vinculo_tipos.map(String)
          : ['cliente'],
        precisaNf: paciente.precisa_nf === true,
        photoUrl: paciente.photo_url ? String(paciente.photo_url) : '',
        addressDetails: {
          zipCode: paciente.cep ? String(paciente.cep) : '',
          street: paciente.logradouro ? String(paciente.logradouro) : '',
          number: paciente.numero ? String(paciente.numero) : '',
          complement: paciente.complemento ? String(paciente.complemento) : '',
          neighborhood: paciente.bairro ? String(paciente.bairro) : '',
          city: paciente.cidade ? String(paciente.cidade) : '',
          state: paciente.estado ? String(paciente.estado) : '',
        },
        specialNeeds: paciente.necessidades_especiais ?? undefined,
        responsible: paciente.responsavel ?? undefined,
        financial: paciente.financeiro ?? undefined,
        supplierData: paciente.fornecedor_dados ?? undefined,
        crm: pickCrm(paciente.crm),
      })),
      unidades: (unidades ?? []).map((unit) => ({ id: String(unit.id), nome: String(unit.nome ?? '') })),
    },
  }
}

async function listPacientes(request: NextRequest, session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const scoped = await getScopedUnitId(session)
  if (scoped.error) {
    return supabaseErrorResponse(scoped.error, 'Falha ao carregar pacientes')
  }

  const context = await fetchPatientContext(scoped.unidadeId)
  if (context.error || !context.data) {
    return supabaseErrorResponse(context.error!, 'Falha ao carregar pacientes')
  }

  return NextResponse.json({
    data: context.data.pacientes,
    meta: {
      ...session,
      units: context.data.unidades,
    },
  })
}

async function getImpactoPaciente(pacienteId: string) {
  const supabase = getAppSupabase()
  const [agendamentos, prescricoes, prontuarios] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId),
    supabase
      .from('prescricoes')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId),
    supabase
      .from('prontuarios')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId),
  ])

  if (agendamentos.error) return { error: agendamentos.error, data: null as null }
  if (prescricoes.error) return { error: prescricoes.error, data: null as null }
  if (prontuarios.error) return { error: prontuarios.error, data: null as null }

  return {
    error: null,
    data: {
      agendamentos: agendamentos.count ?? 0,
      prescricoes: prescricoes.count ?? 0,
      prontuarios: prontuarios.count ?? 0,
    },
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'read')
  if (denied) return denied

  // GET /api/pacientes?impacto=<paciente_id> — usado pelo modal de inativar
  // para mostrar o impacto real (agendamentos/prescricoes/prontuarios) antes
  // de confirmar. Não interfere no GET normal de listagem.
  const impactoId = request.nextUrl.searchParams.get('impacto')
  if (impactoId) {
    const impacto = await getImpactoPaciente(String(impactoId))
    if (impacto.error || !impacto.data) {
      return supabaseErrorResponse(impacto.error!, 'Falha ao calcular impacto do paciente')
    }
    return NextResponse.json({ data: impacto.data, meta: session })
  }

  return listPacientes(request, session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const nome = pickString(body?.nome)
  const telefone = pickString(body?.telefone)
  const email = pickString(body?.email).toLowerCase()
  const cpf = pickString(body?.cpf)
  const dataNascimento = pickString(body?.dataNascimento)
  const status = pickString(body?.status) || 'Ativo'
  const criarAcessoPortal = body?.criarAcessoPortal === true

  if (!nome) {
    return serverErrorResponse('Paciente inválido', 'INVALID_PATIENT', 400)
  }

  // SEC: para gestor/recepcao/especialista, força a unidade da sessão;
  // master/admin/paciente recebem `unidadeId: null` do helper e mantêm a
  // flexibilidade de escolher pelo body.
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade')
  }
  const bodyUnidadeId = pickString(body?.unidadeId) || null
  const unidadeId = scopedUnit.unidadeId ?? bodyUnidadeId

  if (criarAcessoPortal && (!email || !cpf)) {
    return serverErrorResponse('Para liberar o portal, informe email e CPF do paciente', 'PORTAL_ACCESS_REQUIRES_EMAIL_AND_CPF', 400)
  }

  const supabase = getAppSupabase()
  let usuarioId: string | null = null
  let portalAccess: { email: string; temporaryPassword: string; firstAccessRequired: boolean } | null = null

  if (criarAcessoPortal) {
    const { data: existingUser, error: existingUserError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUserError) return supabaseErrorResponse(existingUserError, 'Falha ao validar acesso do portal')
    if (existingUser?.id) return serverErrorResponse('Já existe um usuário com este email', 'PATIENT_PORTAL_EMAIL_ALREADY_EXISTS', 409)

    const temporaryPassword = cpf.replace(/\D/g, '')
    const senhaHash = await bcrypt.hash(temporaryPassword, 10)
    const { data: createdUser, error: createdUserError } = await supabase
      .from('usuarios')
      .insert({
        nome,
        email,
        telefone,
        senha_hash: senhaHash,
        perfil: 'paciente',
        status: 'Ativo',
      })
      .select('id,email')
      .single()

    if (createdUserError) return supabaseErrorResponse(createdUserError, 'Falha ao criar acesso do portal')

    usuarioId = String(createdUser.id)
    portalAccess = {
      email: String(createdUser.email),
      temporaryPassword,
      firstAccessRequired: true,
    }

    const { error: configError } = await supabase
      .from('configuracoes')
      .upsert(
        [{
          categoria: 'auth_user',
          chave: getPasswordSetupRequiredKey(usuarioId),
          valor: 'true',
        }],
        { onConflict: 'categoria,chave' },
      )

    if (configError) return supabaseErrorResponse(configError, 'Falha ao preparar primeiro acesso')
  }

  const extra = buildPacientePayload(body ?? {})

  const { data: createdPatient, error } = await supabase
    .from('pacientes')
    .insert({
      usuario_id: usuarioId,
      unidade_id: unidadeId,
      nome,
      telefone,
      email: email || null,
      status,
      data_nascimento: dataNascimento || null,
      cpf: cpf || null,
      observacoes: null,
      ...extra,
    })
    .select('id')
    .single()

  if (error || !createdPatient?.id) {
    if (usuarioId) {
      await supabase.from('configuracoes').delete().eq('categoria', 'auth_user').eq('chave', getPasswordSetupRequiredKey(usuarioId))
      await supabase.from('usuarios').delete().eq('id', usuarioId)
    }
    return supabaseErrorResponse(error!, 'Falha ao salvar paciente')
  }

  const listResponse = await listPacientes(request, session)
  const listPayload = (await listResponse.json()) as { data: unknown[]; meta: unknown }

  return NextResponse.json({
    data: listPayload.data,
    meta: listPayload.meta,
    portalAccess,
    createdId: String(createdPatient.id),
  })
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = pickString(body?.id)
  const nome = pickString(body?.nome)

  if (!id || !nome) {
    return serverErrorResponse('Paciente inválido', 'INVALID_PATIENT', 400)
  }

  const extra = buildPacientePayload(body ?? {})

  const supabase = getAppSupabase()

  // SEC: se a sessão é escopada (gestor/recepcao/especialista), ignora
  // `body.unidadeId` e bloqueia edição de paciente de outra unidade
  // (FORBIDDEN_CROSS_UNIT). master/admin/paciente aceitam o body.
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade')
  }

  let unidadeIdFinal: string | null
  if (scopedUnit.unidadeId) {
    const { data: existing, error: lookupError } = await supabase
      .from('pacientes')
      .select('unidade_id')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) return supabaseErrorResponse(lookupError, 'Falha ao verificar paciente')
    if (!existing) return serverErrorResponse('Paciente não encontrado', 'NOT_FOUND', 404)

    if (existing.unidade_id && String(existing.unidade_id) !== scopedUnit.unidadeId) {
      return serverErrorResponse(
        'Sem permissão para editar paciente de outra unidade',
        'FORBIDDEN_CROSS_UNIT',
        403,
      )
    }
    unidadeIdFinal = scopedUnit.unidadeId
  } else {
    unidadeIdFinal = pickString(body?.unidadeId) || null
  }

  const updatePayload = {
    unidade_id: unidadeIdFinal,
    nome,
    telefone: pickString(body?.telefone) || null,
    email: pickString(body?.email).toLowerCase() || null,
    status: pickString(body?.status) || 'Ativo',
    data_nascimento: pickString(body?.dataNascimento) || null,
    cpf: pickString(body?.cpf) || null,
    updated_at: new Date().toISOString(),
    ...extra,
  }

  const { error } = await supabase
    .from('pacientes')
    .update(updatePayload)
    .eq('id', id)

  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar paciente')

  return listPacientes(request, session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Paciente inválido', 'INVALID_PATIENT', 400)
  }

  const supabase = getAppSupabase()
  const { error } = await supabase
    .from('pacientes')
    .update({
      status: 'Inativo',
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))

  if (error) return supabaseErrorResponse(error, 'Falha ao inativar paciente')

  return listPacientes(request, session)
}

const CRM_ESTAGIOS_VALIDOS = ['lead', 'ativo', 'em_tratamento', 'retorno_pendente', 'inativo', 'vip'] as const

// PATCH /api/pacientes?action=crm&id=<paciente_id>
//   body: { estagio, observacoes?, proxima_acao?, data_proxima_acao? }
// Upsert em crm_paciente_estagios (1 linha por paciente — conflito em paciente_id).
export async function PATCH(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'pacientes', 'update')
  if (denied) return denied

  const url = request.nextUrl
  const action = url.searchParams.get('action')
  const pacienteId = url.searchParams.get('id')

  if (action !== 'crm') {
    return serverErrorResponse('Ação inválida', 'INVALID_PATCH_ACTION', 400)
  }
  if (!pacienteId) {
    return serverErrorResponse('Paciente não informado', 'INVALID_PATIENT', 400)
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const estagio = pickString(body?.estagio) || 'lead'
  if (!CRM_ESTAGIOS_VALIDOS.includes(estagio as (typeof CRM_ESTAGIOS_VALIDOS)[number])) {
    return serverErrorResponse('Estágio CRM inválido', 'INVALID_CRM_STAGE', 400)
  }

  const observacoes = pickString(body?.observacoes) || null
  const proximaAcao = pickString(body?.proxima_acao) || null
  const dataProximaAcao = pickString(body?.data_proxima_acao) || null

  const supabase = getAppSupabase()
  const { error } = await supabase
    .from('crm_paciente_estagios')
    .upsert(
      [{
        paciente_id: pacienteId,
        estagio,
        observacoes,
        proxima_acao: proximaAcao,
        data_proxima_acao: dataProximaAcao,
        responsavel_id: session.userId,
        updated_at: new Date().toISOString(),
      }],
      { onConflict: 'paciente_id' },
    )

  if (error) return supabaseErrorResponse(error, 'Falha ao atualizar CRM do paciente')

  // Devolve a lista atualizada (mesma forma das outras mutations) — o cliente
  // sobrescreve o estado e a coluna do kanban já mostra a mudança.
  return listPacientes(request, session)
}
