import { NextResponse, type NextRequest } from 'next/server'
import { getAppSupabase, getEntityNameMap, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { isMaskedValue } from '@/lib/config-secrets'
import { mapDisparoItem } from '@/lib/domain-mappers'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import {
  getWhatsappConfig,
  sendWhatsappMessage,
  renderTemplate,
  normalizeTelefone,
} from '@/lib/whatsapp.service'

async function processarPendentes() {
  const config = await getWhatsappConfig()
  if (!config) return { processados: 0, erros: 0, motivo: 'WhatsApp não configurado ou inativo' }

  const supabase = getAppSupabase()
  const agora = new Date().toISOString()

  const { data: pendentes, error } = await supabase
    .from('whatsapp_disparos')
    .select('id,telefone,mensagem')
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .limit(50)

  if (error) return { processados: 0, erros: 0, motivo: error.message }

  let processados = 0
  let erros = 0

  for (const disparo of pendentes ?? []) {
    const result = await sendWhatsappMessage(config, disparo.telefone, disparo.mensagem)

    if (result.success) {
      await supabase
        .from('whatsapp_disparos')
        .update({ status: 'enviado', enviado_em: new Date().toISOString() })
        .eq('id', disparo.id)
      processados++
    } else {
      await supabase
        .from('whatsapp_disparos')
        .update({ status: 'erro', erro_detalhe: result.error ?? 'Erro desconhecido' })
        .eq('id', disparo.id)
      erros++
    }
  }

  return { processados, erros }
}

async function agendarLembrete(agendamentoId: string) {
  const config = await getWhatsappConfig()
  if (!config?.lembreteAtivo) return

  const supabase = getAppSupabase()

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('id,data_agendamento,horario_inicio,paciente_id,profissional_id')
    .eq('id', agendamentoId)
    .maybeSingle()

  if (!agendamento?.data_agendamento || !agendamento.horario_inicio) return
  if (!agendamento.paciente_id) return

  const [{ data: paciente }, { data: profissional }] = await Promise.all([
    supabase.from('pacientes').select('nome,telefone').eq('id', agendamento.paciente_id).maybeSingle(),
    supabase.from('usuarios').select('nome').eq('id', agendamento.profissional_id ?? '').maybeSingle(),
  ])

  if (!paciente?.telefone) return

  const [ano, mes, dia] = agendamento.data_agendamento.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`
  const hora = agendamento.horario_inicio.slice(0, 5)

  const mensagem = renderTemplate(config.templateLembrete, {
    paciente: paciente.nome ?? '',
    data: dataFormatada,
    hora,
    especialista: profissional?.nome ?? '',
  })

  const agendadoParaMs =
    new Date(`${agendamento.data_agendamento}T${agendamento.horario_inicio}`).getTime() -
    config.lembreteHorasAntes * 60 * 60 * 1000

  if (agendadoParaMs <= Date.now()) return

  const agendadoPara = new Date(agendadoParaMs).toISOString()

  await supabase
    .from('whatsapp_disparos')
    .upsert(
      {
        tipo: 'lembrete_consulta',
        agendamento_id: agendamentoId,
        paciente_id: agendamento.paciente_id,
        telefone: normalizeTelefone(paciente.telefone),
        mensagem,
        status: 'pendente',
        agendado_para: agendadoPara,
      },
      { onConflict: 'agendamento_id,tipo', ignoreDuplicates: false },
    )
}

async function agendarPosConsulta(agendamentoId: string) {
  const config = await getWhatsappConfig()
  if (!config?.posConsultaAtivo) return

  const supabase = getAppSupabase()

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('id,data_agendamento,horario_inicio,paciente_id,profissional_id')
    .eq('id', agendamentoId)
    .maybeSingle()

  if (!agendamento?.paciente_id) return

  const [{ data: paciente }, { data: profissional }] = await Promise.all([
    supabase.from('pacientes').select('nome,telefone').eq('id', agendamento.paciente_id).maybeSingle(),
    supabase.from('usuarios').select('nome').eq('id', agendamento.profissional_id ?? '').maybeSingle(),
  ])

  if (!paciente?.telefone) return

  const mensagem = renderTemplate(config.templatePosConsulta, {
    paciente: paciente.nome ?? '',
    especialista: profissional?.nome ?? '',
  })

  const agendadoPara = new Date(
    new Date(`${agendamento.data_agendamento}T${agendamento.horario_inicio}`).getTime() +
      config.posConsultaHorasApos * 60 * 60 * 1000,
  ).toISOString()

  await supabase.from('whatsapp_disparos').insert({
    tipo: 'pos_consulta',
    agendamento_id: agendamentoId,
    paciente_id: agendamento.paciente_id,
    telefone: normalizeTelefone(paciente.telefone),
    mensagem,
    status: 'pendente',
    agendado_para: agendadoPara,
  })
}

async function agendarAniversarios() {
  const config = await getWhatsappConfig()
  if (!config?.aniversarioAtivo) return { agendados: 0 }

  const supabase = getAppSupabase()
  const hoje = new Date()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')

  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id,nome,telefone,data_nascimento')
    .not('data_nascimento', 'is', null)
    .not('telefone', 'is', null)

  const aniversariantes = (pacientes ?? []).filter((p) => {
    if (!p.data_nascimento) return false
    const partes = String(p.data_nascimento).split('-')
    return partes[1] === mes && partes[2]?.slice(0, 2) === dia
  })

  const hoje9h = new Date()
  hoje9h.setHours(9, 0, 0, 0)
  const agendadoPara = hoje9h.toISOString()

  let agendados = 0
  for (const p of aniversariantes) {
    if (!p.telefone) continue
    const mensagem = renderTemplate(config.templateAniversario, { paciente: p.nome ?? '' })
    const { error } = await supabase.from('whatsapp_disparos').insert({
      tipo: 'aniversario',
      paciente_id: p.id,
      telefone: normalizeTelefone(p.telefone),
      mensagem,
      status: 'pendente',
      agendado_para: agendadoPara,
    })
    if (!error) agendados++
  }

  return { agendados }
}

async function dispararCampanha(pacienteIds: string[], mensagem: string) {
  const config = await getWhatsappConfig()
  if (!config) return { agendados: 0 }

  const supabase = getAppSupabase()

  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id,nome,telefone')
    .in('id', pacienteIds)
    .not('telefone', 'is', null)

  const agora = new Date().toISOString()
  let agendados = 0

  for (const p of pacientes ?? []) {
    if (!p.telefone) continue
    const { error } = await supabase.from('whatsapp_disparos').insert({
      tipo: 'campanha',
      paciente_id: p.id,
      telefone: normalizeTelefone(p.telefone),
      mensagem,
      status: 'pendente',
      agendado_para: agora,
    })
    if (!error) agendados++
  }

  return { agendados }
}

// CR-WPP-03 · item 6.3: campanhas agendadas (Natal, Páscoa, Dia das Mães etc).
// Convocada pelo cron. Difere de `dispararCampanha` (fire-and-forget manual): aqui
// o disparo é programado por data/hora e tem filtro opcional por estágio CRM.
// Envio direto (não enfileira em `whatsapp_disparos`) para que `total_enviados`
// e `total_erros` reflitam o resultado real, consistente com a spec — mesmo
// comportamento do processarPendentes (sem retry automático).
async function processarCampanhas() {
  const config = await getWhatsappConfig()
  if (!config) {
    return { campanhasProcessadas: 0, motivo: 'WhatsApp não configurado ou inativo' }
  }

  const supabase = getAppSupabase()
  const hoje = new Date().toISOString().slice(0, 10)
  const horaAtual = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })

  const { data: campanhas, error: campanhasError } = await supabase
    .from('whatsapp_campanhas')
    .select('id,nome,mensagem_template,filtro_estagio,data_disparo,hora_disparo,status')
    .eq('status', 'agendada')
    .eq('data_disparo', hoje)
    .lte('hora_disparo', horaAtual)

  if (campanhasError) {
    return { campanhasProcessadas: 0, motivo: campanhasError.message }
  }

  let processadas = 0

  for (const campanha of campanhas ?? []) {
    // Lock atômico: só processa se ainda estiver 'agendada' (evita dupla
    // execução se dois crons rodarem em paralelo).
    const lock = await supabase
      .from('whatsapp_campanhas')
      .update({ status: 'processando' })
      .eq('id', campanha.id)
      .eq('status', 'agendada')
      .select('id')

    if (lock.error || !lock.data || lock.data.length === 0) continue

    let pacienteIds: string[] | null = null
    if (campanha.filtro_estagio) {
      const { data: estagioRows } = await supabase
        .from('crm_paciente_estagios')
        .select('paciente_id')
        .eq('estagio', String(campanha.filtro_estagio))
      pacienteIds = (estagioRows ?? []).map((r) => String(r.paciente_id))
      if (pacienteIds.length === 0) {
        await supabase
          .from('whatsapp_campanhas')
          .update({ status: 'concluida', total_enviados: 0, total_erros: 0 })
          .eq('id', campanha.id)
        processadas++
        continue
      }
    }

    let query = supabase
      .from('pacientes')
      .select('id,nome,telefone')
      .eq('status', 'Ativo')
      .not('telefone', 'is', null)
    if (pacienteIds) query = query.in('id', pacienteIds)
    const { data: pacientes } = await query

    let enviados = 0
    let erros = 0

    for (const p of pacientes ?? []) {
      if (!p.telefone) continue
      const primeiroNome = String(p.nome ?? 'Paciente').split(' ')[0] || 'Paciente'
      const mensagem = String(campanha.mensagem_template).replace('{paciente}', primeiroNome)
      const result = await sendWhatsappMessage(
        config,
        normalizeTelefone(String(p.telefone)),
        mensagem,
      )
      if (result.success) enviados++
      else erros++
    }

    await supabase
      .from('whatsapp_campanhas')
      .update({ status: 'concluida', total_enviados: enviados, total_erros: erros })
      .eq('id', campanha.id)

    processadas++
  }

  return { campanhasProcessadas: processadas }
}

async function testarConexao(body: Record<string, unknown>) {
  const supabase = getAppSupabase()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave,valor')
    .eq('categoria', 'whatsapp')

  const stored: Record<string, string> = {}
  for (const row of data ?? []) stored[row.chave] = row.valor ?? ''

  const baseUrl = (typeof body.baseUrl === 'string' && body.baseUrl.trim()) || stored['whatsapp.base_url'] || ''
  const instance = (typeof body.instance === 'string' && body.instance.trim()) || stored['whatsapp.instance'] || ''
  const typedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  // Se o usuário não redigitou a chave (ou veio mascarada), usa a armazenada.
  const apiKey = typedKey && !isMaskedValue(typedKey) ? typedKey : stored['whatsapp.api_key'] || ''

  if (!baseUrl || !instance || !apiKey) {
    return { ok: false, error: 'Preencha URL base, instância e API Key.' }
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/instance/fetchInstances`, {
      method: 'GET',
      headers: { apikey: apiKey },
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'comunicacao', 'read')
  if (denied) return denied

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('whatsapp_disparos')
    .select('id,tipo,status,telefone,paciente_id,agendamento_id,mensagem,erro_detalhe,agendado_para,enviado_em,created_at')
    .order('agendado_para', { ascending: false })
    .limit(500)

  if (error) return supabaseErrorResponse(error, 'Falha ao carregar disparos')

  const { map: pacienteMap, error: nameError } = await getEntityNameMap(
    supabase,
    'pacientes',
    (data ?? []).map((row) => String(row.paciente_id ?? '')),
  )
  if (nameError) return supabaseErrorResponse(nameError, 'Falha ao carregar disparos')

  return NextResponse.json({
    data: (data ?? []).map((row) =>
      mapDisparoItem({ ...row, paciente_nome: pacienteMap[String(row.paciente_id ?? '')] ?? '' }),
    ),
    meta: session,
  })
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()

  const denied = await requirePermission(session.userId, 'comunicacao', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.action) {
    return serverErrorResponse('action obrigatória', 'INVALID_PAYLOAD', 400)
  }

  const action = String(body.action)

  if (action === 'processar_pendentes') {
    const result = await processarPendentes()
    return NextResponse.json(result)
  }

  if (action === 'agendar_lembrete') {
    if (!body.agendamentoId) {
      return serverErrorResponse('agendamentoId obrigatório', 'INVALID_PAYLOAD', 400)
    }
    await agendarLembrete(String(body.agendamentoId))
    return NextResponse.json({ ok: true })
  }

  if (action === 'agendar_pos_consulta') {
    if (!body.agendamentoId) {
      return serverErrorResponse('agendamentoId obrigatório', 'INVALID_PAYLOAD', 400)
    }
    await agendarPosConsulta(String(body.agendamentoId))
    return NextResponse.json({ ok: true })
  }

  if (action === 'agendar_aniversarios') {
    const result = await agendarAniversarios()
    return NextResponse.json(result)
  }

  if (action === 'campanha') {
    const pacienteIds = Array.isArray(body.pacienteIds) ? (body.pacienteIds as string[]) : []
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem : ''
    if (!pacienteIds.length || !mensagem) {
      return serverErrorResponse('pacienteIds e mensagem obrigatórios', 'INVALID_PAYLOAD', 400)
    }
    const result = await dispararCampanha(pacienteIds, mensagem)
    return NextResponse.json(result)
  }

  if (action === 'testar_conexao') {
    const result = await testarConexao(body)
    return NextResponse.json(result)
  }

  return serverErrorResponse('action inválida', 'INVALID_PAYLOAD', 400)
}

export { processarPendentes, agendarLembrete, processarCampanhas }
