import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getPacienteIdByUserId, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { montarCadastroPortal } from '@/lib/portal-cadastro'
import { authErrorResponse, getRequestAuth, requirePatientRole } from '@/lib/request-auth'

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function parseBooleanSetting(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }

  return fallback
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = requirePatientRole(session)
  if (denied) return denied

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao carregar perfil')

  const [{ data: usuario, error: usuarioError }, { data: paciente, error: perfilError }] = await Promise.all([
    supabase.from('usuarios').select('nome,email,telefone').eq('id', session.userId).maybeSingle(),
    pacienteId
      ? supabase
          .from('pacientes')
          .select('nome,email,telefone,cpf,data_nascimento,status,sexo,rg,inscricao_estadual,cep,logradouro,numero,complemento,bairro,cidade,estado,origem,origem_detalhe,precisa_nf,financeiro,necessidades_especiais,responsavel')
          .eq('id', pacienteId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (usuarioError) return supabaseErrorResponse(usuarioError, 'Falha ao carregar perfil')
  if (perfilError) return supabaseErrorResponse(perfilError, 'Falha ao carregar perfil')

  // Preferências de notificação continuam em configuracoes — não são dados de perfil
  const { data: prefs, error: prefsError } = await supabase
    .from('configuracoes')
    .select('chave,valor')
    .eq('categoria', 'portal_paciente_pref')
    .in('chave', [
      `email_${session.userId}`,
      `sms_${session.userId}`,
      `consultas_${session.userId}`,
      `pagamentos_${session.userId}`,
      `promocoes_${session.userId}`,
    ])

  if (prefsError) return supabaseErrorResponse(prefsError, 'Falha ao carregar perfil')

  const prefsMap = Object.fromEntries((prefs ?? []).map((item) => [item.chave, item.valor ?? '']))

  return NextResponse.json({
    data: {
      nome: pickString(paciente?.nome, usuario?.nome),
      cpf: String(paciente?.cpf ?? ''),
      rg: String(paciente?.rg ?? ''),
      inscricaoEstadual: String(paciente?.inscricao_estadual ?? ''),
      dataNascimento: paciente?.data_nascimento ? String(paciente.data_nascimento) : '',
      sexo: String(paciente?.sexo ?? ''),
      status: String(paciente?.status ?? 'Ativo'),
      telefone: pickString(paciente?.telefone, usuario?.telefone),
      email: pickString(paciente?.email, usuario?.email),
      zipCode: String(paciente?.cep ?? ''),
      street: String(paciente?.logradouro ?? ''),
      number: String(paciente?.numero ?? ''),
      complement: String(paciente?.complemento ?? ''),
      neighborhood: String(paciente?.bairro ?? ''),
      city: String(paciente?.cidade ?? ''),
      state: String(paciente?.estado ?? ''),
      indicacao: String(paciente?.origem ?? ''),
      origemDetalhe: String(paciente?.origem_detalhe ?? ''),
      precisaNf: paciente?.precisa_nf === true,
      financial: paciente?.financeiro ?? null,
      specialNeeds: paciente?.necessidades_especiais ?? null,
      responsible: paciente?.responsavel ?? null,
      notificacoesEmail: parseBooleanSetting(prefsMap[`email_${session.userId}`], false),
      notificacoesSms: parseBooleanSetting(prefsMap[`sms_${session.userId}`], false),
      lembretesConsultas: parseBooleanSetting(prefsMap[`consultas_${session.userId}`], true),
      avisosPagamento: parseBooleanSetting(prefsMap[`pagamentos_${session.userId}`], true),
      promocoesNovidades: parseBooleanSetting(prefsMap[`promocoes_${session.userId}`], false),
    },
    meta: session,
  })
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = requirePatientRole(session)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return serverErrorResponse('Perfil inválido', 'INVALID_PROFILE', 400)

  const nome = pickString(body.nome)
  const cpf = pickString(body.cpf)
  const dataNascimento = pickString(body.dataNascimento)
  const sexo = pickString(body.sexo)
  const telefone = pickString(body.telefone)
  const email = pickString(body.email)
  const zipCode = pickString(body.zipCode)
  const street = pickString(body.street)
  const number = pickString(body.number)
  const neighborhood = pickString(body.neighborhood)
  const city = pickString(body.city)
  const state = pickString(body.state)

  if (!nome || !cpf || !dataNascimento || !sexo || !telefone || !email || !zipCode || !street || !number || !neighborhood || !city || !state) {
    return serverErrorResponse('Preencha todos os campos obrigatórios do perfil', 'PROFILE_REQUIRED_FIELDS', 400)
  }

  const cadastro = montarCadastroPortal(body, dataNascimento)
  if (!cadastro.ok) return serverErrorResponse(cadastro.error, cadastro.code, 400)

  const supabase = getAppSupabase()
  const { pacienteId, error: pacienteError } = await getPacienteIdByUserId(supabase, session.userId)
  if (pacienteError) return supabaseErrorResponse(pacienteError, 'Falha ao salvar perfil')

  const userPayload = {
    nome,
    email,
    telefone,
  }

  const patientPayload = {
    nome,
    email,
    telefone,
    cpf,
    data_nascimento: dataNascimento,
    status: String(body.status ?? 'Ativo'),
    sexo,
    rg: String(body.rg ?? '') || null,
    inscricao_estadual: String(body.inscricaoEstadual ?? '') || null,
    cep: zipCode,
    logradouro: street,
    numero: number,
    complemento: String(body.complement ?? '') || null,
    bairro: neighborhood,
    cidade: city,
    estado: state,
    ...cadastro.colunas,
    updated_at: new Date().toISOString(),
  }

  const [userResult, patientResult] = await Promise.all([
    supabase.from('usuarios').update(userPayload).eq('id', session.userId),
    pacienteId ? supabase.from('pacientes').update(patientPayload).eq('id', pacienteId) : Promise.resolve({ error: null }),
  ])

  if (userResult.error) return supabaseErrorResponse(userResult.error, 'Falha ao salvar perfil')
  if ('error' in patientResult && patientResult.error) return supabaseErrorResponse(patientResult.error, 'Falha ao salvar perfil')

  // Preferências de notificação continuam indo pra configuracoes
  const preferenceEntries = [
    { chave: `email_${session.userId}`, valor: String(Boolean(body.notificacoesEmail)) },
    { chave: `sms_${session.userId}`, valor: String(Boolean(body.notificacoesSms)) },
    { chave: `consultas_${session.userId}`, valor: String(Boolean(body.lembretesConsultas)) },
    { chave: `pagamentos_${session.userId}`, valor: String(Boolean(body.avisosPagamento)) },
    { chave: `promocoes_${session.userId}`, valor: String(Boolean(body.promocoesNovidades)) },
  ]

  const { error: prefError } = await supabase.from('configuracoes').upsert(
    preferenceEntries.map((item) => ({ categoria: 'portal_paciente_pref', ...item })),
    { onConflict: 'categoria,chave' },
  )
  if (prefError) return supabaseErrorResponse(prefError, 'Falha ao salvar perfil')

  return NextResponse.json({
    data: {
      nome: userPayload.nome,
      cpf: patientPayload.cpf,
      rg: String(body.rg ?? ''),
      inscricaoEstadual: String(body.inscricaoEstadual ?? ''),
      dataNascimento: patientPayload.data_nascimento ?? '',
      sexo: patientPayload.sexo,
      status: String(patientPayload.status ?? 'Ativo'),
      telefone: userPayload.telefone,
      email: userPayload.email,
      zipCode: patientPayload.cep,
      street: patientPayload.logradouro,
      number: patientPayload.numero,
      complement: String(body.complement ?? ''),
      neighborhood: patientPayload.bairro,
      city: patientPayload.cidade,
      state: patientPayload.estado,
      indicacao: String(cadastro.colunas.origem ?? ''),
      origemDetalhe: String(cadastro.colunas.origem_detalhe ?? ''),
      precisaNf: cadastro.colunas.precisa_nf === true,
      financial: cadastro.colunas.financeiro,
      specialNeeds: cadastro.colunas.necessidades_especiais,
      responsible: cadastro.colunas.responsavel,
      notificacoesEmail: Boolean(body.notificacoesEmail),
      notificacoesSms: Boolean(body.notificacoesSms),
      lembretesConsultas: Boolean(body.lembretesConsultas),
      avisosPagamento: Boolean(body.avisosPagamento),
      promocoesNovidades: Boolean(body.promocoesNovidades),
    },
    meta: session,
  })
}
