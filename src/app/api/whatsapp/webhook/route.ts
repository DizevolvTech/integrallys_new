import { NextResponse, type NextRequest } from 'next/server'
import { agendarLembrete } from '@/app/api/whatsapp/disparar/route'
import { getAppSupabase, serverErrorResponse } from '@/lib/app-api'
import {
  getWhatsappConfig,
  normalizeTelefone,
  renderTemplate,
  sendWhatsappMessage,
} from '@/lib/whatsapp.service'

/**
 * Webhook da Evolution API — recebe mensagens dos pacientes e responde
 * automaticamente via máquina de estados (TAREFA-WPP-02).
 *
 * Sem autenticação de sessão. Protegido pelo token obrigatório configurado em
 * `chatbot.webhook_token`: exige `?token=` na URL ou header `x-webhook-token`
 * em todos os requests. Token ausente OU divergente = 401 (fail-closed).
 * Demais requests respondem HTTP 200 rapidamente (Evolution dá timeout).
 *
 * URL a cadastrar na Evolution: https://{dominio}/api/whatsapp/webhook
 */

const SESSAO_EXPIRA_MS = 30 * 60 * 1000

interface ChatbotConfig {
  ativo: boolean
  horarioInicio: string
  horarioFim: string
  diasSemana: number[]
  mensagemForaHorario: string
  mensagemBoasVindas: string
  webhookToken: string
}

interface Sessao {
  id?: string
  telefone: string
  paciente_id: string | null
  estado: string
  contexto: Record<string, unknown>
}

const ok = () => NextResponse.json({ ok: true })

async function getChatbotConfig(): Promise<ChatbotConfig> {
  const supabase = getAppSupabase()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave,valor')
    .eq('categoria', 'chatbot')

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.chave] = row.valor ?? ''

  return {
    ativo: map['chatbot.ativo'] === 'true',
    horarioInicio: map['chatbot.horario_inicio'] || '08:00',
    horarioFim: map['chatbot.horario_fim'] || '18:00',
    diasSemana: (map['chatbot.dias_semana'] || '1,2,3,4,5')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
    mensagemForaHorario:
      map['chatbot.mensagem_fora_horario'] ||
      'Olá! Nosso atendimento automático funciona das {horario_inicio} às {horario_fim}. Retornaremos assim que possível.',
    mensagemBoasVindas:
      map['chatbot.mensagem_boas_vindas'] ||
      'Olá! Sou o assistente de agendamentos. Qual é o seu nome?',
    webhookToken: map['chatbot.webhook_token'] || '',
  }
}

/** Hora e dia-da-semana atuais no fuso America/Sao_Paulo. */
function nowInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const year = get('year')
  const month = get('month')
  const day = get('day')
  let hour = get('hour')
  if (hour === 24) hour = 0
  const minute = get('minute')
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0=dom..6=sab
  return { minutes: hour * 60 + minute, dow }
}

function timeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

function dentroHorarioComercial(cfg: ChatbotConfig): boolean {
  const { minutes, dow } = nowInSaoPaulo()
  if (!cfg.diasSemana.includes(dow)) return false
  return minutes >= timeToMinutes(cfg.horarioInicio) && minutes < timeToMinutes(cfg.horarioFim)
}

function parseDataBr(texto: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(texto.trim())
  if (!match) return null
  const dia = match[1].padStart(2, '0')
  const mes = match[2].padStart(2, '0')
  let ano = match[3]
  if (ano.length === 2) ano = `20${ano}`
  const iso = `${ano}-${mes}-${dia}`
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return iso
}

type Processado = {
  resposta: string
  estado: string
  contexto: Record<string, unknown>
  pacienteId?: string | null
}

async function processarMensagem(
  sessao: Sessao,
  texto: string,
  cfg: ChatbotConfig,
): Promise<Processado> {
  const supabase = getAppSupabase()
  const limpo = texto.trim()
  const lower = limpo.toLowerCase()
  const ctx = { ...sessao.contexto }

  if (lower === 'cancelar' || lower === 'sair') {
    return { resposta: 'Atendimento encerrado. Até logo! 👋', estado: 'encerrado', contexto: {} }
  }

  switch (sessao.estado) {
    case 'inicio': {
      return { resposta: cfg.mensagemBoasVindas, estado: 'aguardando_nome', contexto: {} }
    }

    case 'aguardando_nome': {
      ctx.nome = limpo
      const { data: especialistas } = await supabase
        .from('usuarios')
        .select('id,nome')
        .eq('perfil', 'especialista')
        .eq('status', 'Ativo')
        .order('nome', { ascending: true })

      const lista = (especialistas ?? []).map((e) => ({ id: String(e.id), nome: String(e.nome) }))
      if (lista.length === 0) {
        return {
          resposta:
            'No momento não há especialistas disponíveis para agendamento. Tente novamente mais tarde.',
          estado: 'encerrado',
          contexto: {},
        }
      }
      ctx.especialistas = lista
      const numerada = lista.map((e, i) => `${i + 1}) ${e.nome}`).join('\n')
      return {
        resposta: `Obrigado, ${ctx.nome}! Qual especialidade ou profissional você deseja consultar?\n${numerada}\n\nDigite o número da opção.`,
        estado: 'aguardando_especialista',
        contexto: ctx,
      }
    }

    case 'aguardando_especialista': {
      const lista = (ctx.especialistas as Array<{ id: string; nome: string }>) ?? []
      const idx = Number(limpo) - 1
      if (!Number.isInteger(idx) || idx < 0 || idx >= lista.length) {
        return {
          resposta: 'Opção inválida. Digite o número do especialista da lista.',
          estado: 'aguardando_especialista',
          contexto: ctx,
        }
      }
      ctx.especialistaId = lista[idx].id
      ctx.especialistaNome = lista[idx].nome
      return {
        resposta: 'Ótimo! Para qual data você prefere? (Ex: 25/06/2026)',
        estado: 'aguardando_data',
        contexto: ctx,
      }
    }

    case 'aguardando_data': {
      const iso = parseDataBr(limpo)
      if (!iso) {
        return {
          resposta: 'Data inválida. Use o formato DD/MM/AAAA (ex: 25/06/2026).',
          estado: 'aguardando_data',
          contexto: ctx,
        }
      }
      const { data: slots } = await supabase
        .from('agendamentos')
        .select('id,horario_inicio')
        .eq('profissional_id', String(ctx.especialistaId ?? ''))
        .eq('data_agendamento', iso)
        .eq('status', 'Disponível')
        .is('paciente_id', null)
        .order('horario_inicio', { ascending: true })

      const opcoes = (slots ?? []).map((s) => ({
        id: String(s.id),
        hora: String(s.horario_inicio ?? '').slice(0, 5),
      }))
      if (opcoes.length === 0) {
        return {
          resposta: 'Não encontrei horários disponíveis para esta data. Tente outra data.',
          estado: 'aguardando_data',
          contexto: ctx,
        }
      }
      ctx.data = iso
      ctx.slots = opcoes
      const [ano, mes, dia] = iso.split('-')
      const numerada = opcoes.map((o, i) => `${i + 1}) ${o.hora}`).join('\n')
      return {
        resposta: `Horários disponíveis para ${dia}/${mes}/${ano}:\n${numerada}\n\nDigite o número do horário.`,
        estado: 'aguardando_hora',
        contexto: ctx,
      }
    }

    case 'aguardando_hora': {
      const opcoes = (ctx.slots as Array<{ id: string; hora: string }>) ?? []
      const idx = Number(limpo) - 1
      if (!Number.isInteger(idx) || idx < 0 || idx >= opcoes.length) {
        return {
          resposta: 'Opção inválida. Digite o número do horário da lista.',
          estado: 'aguardando_hora',
          contexto: ctx,
        }
      }
      ctx.agendamentoId = opcoes[idx].id
      ctx.hora = opcoes[idx].hora
      const [ano, mes, dia] = String(ctx.data ?? '').split('-')
      return {
        resposta: `Confirmar agendamento?\n👤 ${ctx.nome}\n📅 ${dia}/${mes}/${ano} às ${ctx.hora}\n👨‍⚕️ ${ctx.especialistaNome}\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`,
        estado: 'confirmando',
        contexto: ctx,
      }
    }

    case 'confirmando': {
      if (lower === 'sim' || lower === 's') {
        const { data: paciente } = await supabase
          .from('pacientes')
          .select('id')
          .eq('telefone', sessao.telefone)
          .maybeSingle()
        const pacienteId = paciente?.id ? String(paciente.id) : null

        const { data: atualizado, error } = await supabase
          .from('agendamentos')
          .update({
            paciente_id: pacienteId,
            status: 'Confirmado',
            observacoes: pacienteId
              ? 'Agendado via WhatsApp (chatbot)'
              : `Agendado via WhatsApp — paciente: ${ctx.nome}, tel: ${sessao.telefone}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', String(ctx.agendamentoId ?? ''))
          .eq('status', 'Disponível')
          .select('id')
          .maybeSingle()

        if (error || !atualizado?.id) {
          return {
            resposta: 'Esse horário acabou de ser preenchido. Vamos recomeçar? Qual é o seu nome?',
            estado: 'aguardando_nome',
            contexto: {},
          }
        }

        void agendarLembrete(String(atualizado.id)).catch((err) =>
          console.error('[whatsapp] agendar_lembrete (chatbot)', err),
        )

        return {
          resposta: '✅ Agendamento confirmado! Você receberá um lembrete antes da consulta.',
          estado: 'concluido',
          contexto: {},
          pacienteId,
        }
      }
      if (lower === 'não' || lower === 'nao' || lower === 'n') {
        return {
          resposta:
            'Agendamento cancelado. Posso ajudar com algo mais? (responda com seu nome para recomeçar)',
          estado: 'aguardando_nome',
          contexto: {},
        }
      }
      return {
        resposta: 'Responda *SIM* para confirmar ou *NÃO* para cancelar.',
        estado: 'confirmando',
        contexto: ctx,
      }
    }

    default: {
      // 'concluido' | 'encerrado' | desconhecido → recomeça o fluxo.
      return { resposta: cfg.mensagemBoasVindas, estado: 'aguardando_nome', contexto: {} }
    }
  }
}

export async function POST(request: NextRequest) {
  const cfg = await getChatbotConfig()

  // Fail-closed: token ausente em cfg OU não conferindo no request = 401.
  // Versão anterior (`if (cfg.webhookToken) { ... }`) deixava o endpoint
  // PÚBLICO se `configuracoes.chatbot.webhook_token` estivesse vazio na DB.
  // Configuração é garantida pelo 00-SEC-01-checklist-operacional.md item A.
  const webhookToken = cfg.webhookToken?.trim()
  const provided =
    request.nextUrl.searchParams.get('token') ?? request.headers.get('x-webhook-token') ?? ''

  if (!webhookToken) {
    console.error(
      '[chatbot] webhook_token não configurado em configuracoes — endpoint inacessível até configurar',
    )
    return serverErrorResponse('Não autorizado', 'WEBHOOK_UNAUTHORIZED', 401)
  }

  if (provided !== webhookToken) {
    console.warn('[chatbot] token inválido rejeitado')
    return serverErrorResponse('Não autorizado', 'WEBHOOK_UNAUTHORIZED', 401)
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!payload || payload.event !== 'messages.upsert') return ok()

  const data = (payload.data ?? {}) as Record<string, unknown>
  const key = (data.key ?? {}) as Record<string, unknown>
  const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid : ''
  if (key.fromMe === true || remoteJid.includes('@g.us') || !remoteJid) return ok()

  const message = (data.message ?? {}) as Record<string, unknown>
  const extended = (message.extendedTextMessage ?? {}) as Record<string, unknown>
  const texto =
    (typeof message.conversation === 'string' && message.conversation) ||
    (typeof extended.text === 'string' && extended.text) ||
    ''
  if (!texto.trim()) return ok()

  if (!cfg.ativo) return ok()

  const telefone = normalizeTelefone(remoteJid.split('@')[0])
  const evoConfig = await getWhatsappConfig()
  const supabase = getAppSupabase()

  // Fora do horário comercial: responde mensagem padrão e não cria sessão.
  if (!dentroHorarioComercial(cfg)) {
    if (evoConfig) {
      const msg = renderTemplate(cfg.mensagemForaHorario, {
        horario_inicio: cfg.horarioInicio,
        horario_fim: cfg.horarioFim,
      })
      await sendWhatsappMessage(evoConfig, telefone, msg)
    }
    return ok()
  }

  const { data: existente } = await supabase
    .from('chatbot_sessoes')
    .select('id,telefone,paciente_id,estado,contexto,ultima_interacao')
    .eq('telefone', telefone)
    .maybeSingle()

  let sessao: Sessao
  if (!existente) {
    sessao = { telefone, paciente_id: null, estado: 'inicio', contexto: {} }
  } else {
    const idadeMs = Date.now() - new Date(String(existente.ultima_interacao)).getTime()
    const expirada =
      idadeMs > SESSAO_EXPIRA_MS ||
      existente.estado === 'concluido' ||
      existente.estado === 'encerrado'
    sessao = {
      id: String(existente.id),
      telefone,
      paciente_id: existente.paciente_id ? String(existente.paciente_id) : null,
      estado: expirada ? 'inicio' : String(existente.estado),
      contexto: expirada ? {} : ((existente.contexto as Record<string, unknown>) ?? {}),
    }
  }

  const resultado = await processarMensagem(sessao, texto, cfg)

  await supabase.from('chatbot_sessoes').upsert(
    {
      telefone,
      paciente_id: resultado.pacienteId !== undefined ? resultado.pacienteId : sessao.paciente_id,
      estado: resultado.estado,
      contexto: resultado.contexto,
      ultima_interacao: new Date().toISOString(),
    },
    { onConflict: 'telefone' },
  )

  // Registra o turno (mensagem recebida + resposta do bot) para o histórico de
  // conversa exibido em Comunicação > Chatbot.
  await supabase.from('chatbot_mensagens').insert([
    { telefone, direcao: 'in', conteudo: texto },
    { telefone, direcao: 'out', conteudo: resultado.resposta },
  ])

  if (evoConfig) {
    await sendWhatsappMessage(evoConfig, telefone, resultado.resposta)
  }

  return ok()
}
