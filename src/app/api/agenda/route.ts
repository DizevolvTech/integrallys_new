import type { PostgrestError } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { agendarLembrete } from '@/app/api/whatsapp/disparar/route'
import {
  getAppSupabase,
  getEntityNameMap,
  serverErrorResponse,
  supabaseErrorResponse,
} from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { registrarRecebimentoAgendamento } from '@/lib/recebimento-agendamento'
import { mapAgendaItem } from '@/lib/domain-mappers'
import { resolveAgendamentoProcedimento } from '@/lib/agendamento-procedimento'
import {
  resolvePagamentoAgendamentoInput,
} from '@/lib/agendamento-pagamento'
import { perfilPodeEmitirRecibo } from '@/lib/recibo-perfis'
import { limparTagRetornoPendente } from '@/lib/retornos-server'
import { addDaysIso } from '@/lib/procedimento-retorno'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import {
  type AgendaRowIntervalo,
  minutesToHHMM,
  planejarOcupacao,
  timeToMinutes,
  vagasDaGradeNoIntervalo,
  duracaoRetornoDaGrade,
  type RegraGradeRetorno,
} from './agenda-duracao'
import { isHorarioPassado, STATUS_ELEGIVEIS_ATRASO } from '@/features/agenda/agenda.utils'
import { bloqueioNoIntervalo, getLinhasDoDia, liberarIntervaloNaGrade, mensagemBloqueio } from './agenda-grade'
import { atualizarCompromisso, criarCompromisso, ehCompromisso, excluirCompromisso, participantesPorGrupo } from './compromisso'
import {
  buildInsertPayload,
  buildOccupyUpdate,
  decidirFluxoAgendamento,
  ocuparSlotDisponivel,
  validateModalidadeOnlineUrl,
} from './agenda-slot'

type ScopedAgendaContext =
  | {
      unidadeId: string | null
      profissionalId: string | null
      especialistasPermitidos: string[] | null
      agendaPessoalPermitidos?: string[] | null
      error: null
    }
  | {
      unidadeId: null
      profissionalId: null
      especialistasPermitidos: null
      error: PostgrestError
    }

async function getScopedAgendaContext(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  if (!session) {
    return {
      unidadeId: null,
      profissionalId: null,
      especialistasPermitidos: null,
      error: null,
    } satisfies ScopedAgendaContext
  }

  if (session.role === 'especialista') {
    return {
      unidadeId: null,
      profissionalId: session.userId,
      especialistasPermitidos: null,
      error: null,
    } satisfies ScopedAgendaContext
  }

  if (!['gestor', 'recepcao'].includes(session.role)) {
    return {
      unidadeId: null,
      profissionalId: null,
      especialistasPermitidos: null,
      error: null,
    } satisfies ScopedAgendaContext
  }

  const supabase = getAppSupabase()
  const { data, error } = await supabase
    .from('usuarios')
    .select('unidade_id, especialistas_permitidos, agenda_pessoal_permitidos')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) {
    return {
      unidadeId: null,
      profissionalId: null,
      especialistasPermitidos: null,
      error,
    } satisfies ScopedAgendaContext
  }

  const especialistasPermitidos =
    session.role === 'recepcao' && Array.isArray(data?.especialistas_permitidos)
      ? (data?.especialistas_permitidos as unknown[])
          .map((value) => String(value))
          .filter((value) => value.length > 0)
      : null

  const agendaPessoalPermitidos =
    session.role === 'recepcao'
      ? Array.isArray(data?.agenda_pessoal_permitidos)
        ? (data?.agenda_pessoal_permitidos as unknown[]).map((value) => String(value))
        : []
      : null

  return {
    unidadeId: data?.unidade_id ? String(data.unidade_id) : null,
    profissionalId: null,
    agendaPessoalPermitidos,
    especialistasPermitidos:
      especialistasPermitidos && especialistasPermitidos.length > 0
        ? especialistasPermitidos
        : null,
    error: null,
  } satisfies ScopedAgendaContext
}

/** Compromisso pessoal dentro do escopo da sessão (especialista: o próprio; unidade; lista liberada ou participante). */
function compromissoNoEscopo(
  row: Record<string, unknown>,
  ctx: { unidadeId: string | null; profissionalId: string | null; especialistasPermitidos: string[] | null },
  userId: string,
) {
  const prof = row.profissional_id ? String(row.profissional_id) : ''
  if (ctx.profissionalId) return prof === ctx.profissionalId
  if (ctx.unidadeId && row.unidade_id && String(row.unidade_id) !== ctx.unidadeId) return false
  if (ctx.especialistasPermitidos?.length && prof !== userId && !ctx.especialistasPermitidos.includes(prof)) return false
  return true
}

/**
 * Resumo de pagamento por agendamento, em lotes. Com ~500 agendamentos a lista de
 * ids na URL estourava o limite do servidor: a chamada falhava após ~7 s e a agenda
 * mostrava "Total já pago: R$ 0,00" (aceite do vídeo de 26/10).
 */
async function buscarResumoPagamentos(supabase: ReturnType<typeof getAppSupabase>, ids: string[]) {
  const LOTE = 150
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE))
  const resultados = await Promise.all(
    lotes.map((lote) =>
      supabase
        .from('v_agendamento_pagamento_resumo')
        .select('agendamento_id,total_pago,valor_devido,situacao,data_ultimo_pagamento')
        .in('agendamento_id', lote),
    ),
  )
  const erro = resultados.find((r) => r.error)?.error ?? null
  if (erro) console.error('[agenda] falha ao carregar resumo de pagamentos', erro)
  return { data: resultados.flatMap((r) => r.data ?? []), error: erro }
}

/**
 * Opções da agenda (pacientes, especialistas e seus procedimentos). Independem das linhas da agenda,
 * então rodam em paralelo com a consulta principal em vez de depois dela.
 */
async function carregarOpcoesAgenda(
  supabase: ReturnType<typeof getAppSupabase>,
  scopedContext: { unidadeId: string | null; especialistasPermitidos: string[] | null },
) {
  let patientOptionsQuery = supabase.from('pacientes').select('id,nome,unidade_id').order('nome', { ascending: true })
  let professionalOptionsQuery = supabase
    .from('usuarios')
    .select('id,nome,unidade_id')
    .eq('perfil', 'especialista')
    .eq('status', 'Ativo')
    .order('nome', { ascending: true })

  if (scopedContext.unidadeId) {
    patientOptionsQuery = patientOptionsQuery.eq('unidade_id', scopedContext.unidadeId)
    professionalOptionsQuery = professionalOptionsQuery.eq('unidade_id', scopedContext.unidadeId)
  }
  if (scopedContext.especialistasPermitidos?.length) {
    professionalOptionsQuery = professionalOptionsQuery.in('id', scopedContext.especialistasPermitidos)
  }

  const [patients, professionals] = await Promise.all([patientOptionsQuery, professionalOptionsQuery])
  if (patients.error) return { error: patients.error }
  if (professionals.error) return { error: professionals.error }

  const profissionalIds = (professionals.data ?? []).map((row) => String(row.id ?? ''))
  const { data: vinculosData, error: vinculosError } = profissionalIds.length
    ? await supabase
        .from('profissional_procedimentos')
        .select('profissional_id,procedimento_id')
        .in('profissional_id', profissionalIds)
    : { data: [] as Array<{ profissional_id: string; procedimento_id: string }>, error: null }
  if (vinculosError) return { error: vinculosError }
  const procedimentosPorProfissional = new Map<string, string[]>()
  for (const vinculo of vinculosData ?? []) {
    const key = String(vinculo.profissional_id)
    procedimentosPorProfissional.set(key, [...(procedimentosPorProfissional.get(key) ?? []), String(vinculo.procedimento_id)])
  }
  return {
    patientOptionsData: patients.data,
    professionalOptionsData: professionals.data,
    procedimentosPorProfissional,
  }
}

async function listAgenda(session: Awaited<ReturnType<typeof getRequestAuth>>) {
  const supabase = getAppSupabase()
  const scopedContext = await getScopedAgendaContext(session)
  if (scopedContext.error) {
    return supabaseErrorResponse(scopedContext.error, 'Falha ao carregar agenda')
  }
  const optionsPromise = carregarOpcoesAgenda(supabase, scopedContext)

  let query = supabase
    .from('agendamentos')
    .select(
      'id,paciente_id,profissional_id,procedimento_id,horario_inicio,horario_fim,status,data_agendamento,tipo,titulo,local,participantes,modalidade_atendimento,plataforma_online,url_online,valor_procedimento,observacoes,tipo_encaixe,fora_janela,motivo_encaixe,criado_por_id,compromisso_grupo_id',
    )
    .order('data_agendamento', { ascending: true })
    .order('horario_inicio', { ascending: true })

  if (scopedContext.profissionalId) {
    query = query.eq('profissional_id', scopedContext.profissionalId)
  } else if (scopedContext.unidadeId) {
    query = query.eq('unidade_id', scopedContext.unidadeId)
  }

  if (scopedContext.especialistasPermitidos?.length) {
    // além dos especialistas liberados, a pessoa sempre enxerga os compromissos em que é participante
    query = query.or(
      `profissional_id.in.(${scopedContext.especialistasPermitidos.join(',')}),profissional_id.eq.${session?.userId}`,
    )
  }

  const { data: rawData, error } = await query

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao carregar agenda')
  }

  // Item 1 — recepcionista só vê compromissos pessoais (sem paciente) dos
  // especialistas liberados em "Acesso à Agenda Pessoal". Slots livres seguem visíveis.
  const pessoalLiberado = scopedContext.agendaPessoalPermitidos
  const data = pessoalLiberado
    ? (rawData ?? []).filter(
        (row) =>
          row.paciente_id ||
          String(row.status) === 'Disponível' ||
          // quem criou o compromisso sempre o enxerga, mesmo sem acesso à agenda pessoal do especialista
          String(row.criado_por_id ?? '') === session?.userId ||
          String(row.profissional_id ?? '') === session?.userId ||
          pessoalLiberado.includes(String(row.profissional_id ?? '')),
      )
    : rawData

  // Em atraso automático: persiste status quando data+hora já passaram.
  const agora = new Date()
  const overdueIds: string[] = []
  for (const row of data ?? []) {
    if (!row.paciente_id) continue
    if (String(row.status) === 'Disponível') continue
    const status = String(row.status ?? '')
    if (!(STATUS_ELEGIVEIS_ATRASO as readonly string[]).includes(status)) continue
    const dataIso = String(row.data_agendamento ?? '').slice(0, 10)
    const hora = String(row.horario_inicio ?? '').slice(0, 5)
    if (isHorarioPassado(dataIso, hora, agora)) {
      overdueIds.push(String(row.id))
      row.status = 'Em Atraso'
    }
  }
  // Persistência do atraso não bloqueia a resposta: o status já foi aplicado nas linhas acima.
  const overduePromise =
    overdueIds.length > 0
      ? supabase
          .from('agendamentos')
          .update({ status: 'Em Atraso', updated_at: new Date().toISOString() })
          .in('id', overdueIds)
          .then(({ error: overdueError }) => {
            if (overdueError) console.error('[agenda] falha ao marcar em atraso', overdueError)
          })
      : Promise.resolve()

  const agendaIds = (data ?? []).map((row) => String(row.id ?? ''))

  const gruposDeCompromisso = (data ?? [])
    .filter((row) => ehCompromisso(row) && row.compromisso_grupo_id)
    .map((row) => String(row.compromisso_grupo_id))

  const [pacientesResult, profissionaisResult, procedimentosResult, pagamentosResult, participantesGrupo] =
    await Promise.all([
      getEntityNameMap(
        supabase,
        'pacientes',
        (data ?? []).map((row) => String(row.paciente_id ?? '')),
      ),
      getEntityNameMap(
        supabase,
        'usuarios',
        (data ?? []).map((row) => String(row.profissional_id ?? '')),
      ),
      getEntityNameMap(
        supabase,
        'procedimentos',
        (data ?? []).map((row) => String(row.procedimento_id ?? '')),
      ),
      buscarResumoPagamentos(supabase, agendaIds),
      participantesPorGrupo(supabase, gruposDeCompromisso),
    ])

  if (pacientesResult.error)
    return supabaseErrorResponse(pacientesResult.error, 'Falha ao carregar agenda')
  if (profissionaisResult.error)
    return supabaseErrorResponse(profissionaisResult.error, 'Falha ao carregar agenda')
  if (procedimentosResult.error)
    return supabaseErrorResponse(procedimentosResult.error, 'Falha ao carregar agenda')

  const pagamentoMap: Record<
    string,
    { situacao: string; total_pago: number; data_ultimo_pagamento?: string }
  > = {}
  if (pagamentosResult.data && !pagamentosResult.error) {
    for (const row of pagamentosResult.data) {
      const r = row as {
        agendamento_id: string
        total_pago: number
        situacao: string
        data_ultimo_pagamento?: string
      }
      pagamentoMap[r.agendamento_id] = {
        situacao: r.situacao,
        total_pago: Number(r.total_pago ?? 0),
        data_ultimo_pagamento: r.data_ultimo_pagamento ?? undefined,
      }
    }
  }

  const [options] = await Promise.all([optionsPromise, overduePromise])
  if (options.error) return supabaseErrorResponse(options.error, 'Falha ao carregar agenda')
  const { patientOptionsData, professionalOptionsData, procedimentosPorProfissional } = options

  return NextResponse.json({
    data: (data ?? []).map((row) => {
      const pag = pagamentoMap[String(row.id ?? '')]
      return mapAgendaItem({
        ...row,
        paciente_nome: pacientesResult.map[String(row.paciente_id ?? '')] ?? '',
        profissional_nome: profissionaisResult.map[String(row.profissional_id ?? '')] ?? '',
        procedimento_nome: procedimentosResult.map[String(row.procedimento_id ?? '')] ?? '',
        horario: String(row.horario_inicio ?? ''),
        participante_ids: row.compromisso_grupo_id
          ? (participantesGrupo.get(String(row.compromisso_grupo_id))?.participanteIds ?? [])
          : undefined,
        organizador_id: row.compromisso_grupo_id
          ? (participantesGrupo.get(String(row.compromisso_grupo_id))?.organizadorId ?? undefined)
          : undefined,
        pagamento_situacao: pag?.situacao,
        total_pago: pag?.total_pago,
        data_ultimo_pagamento: pag?.data_ultimo_pagamento,
      })
    }),
    meta: {
      ...session,
      podeEmitirRecibo: perfilPodeEmitirRecibo(session?.role),
      patients: (patientOptionsData ?? []).map((row) => ({
        id: String(row.id ?? ''),
        nome: String(row.nome ?? ''),
      })),
      professionals: (professionalOptionsData ?? []).map((row) => ({
        id: String(row.id ?? ''),
        nome: String(row.nome ?? ''),
        // Vínculos vêm daqui (e não de /api/profissionais) para que a recepção também veja
        // os procedimentos de cada especialista ao agendar.
        procedimentoIds: procedimentosPorProfissional.get(String(row.id ?? '')) ?? [],
      })),
    },
  })
}

// Resolve o profissional a partir de um UUID (id) ou nome, validando que existe.
// Retorna null quando não encontra OU é AMBÍGUO (nome duplicado → maybeSingle erra →
// data null): o chamador trata null como "não atribuir", nunca caindo no criador de
// forma silenciosa (item 15a).
async function resolveProfessionalId(
  supabase: ReturnType<typeof getAppSupabase>,
  profissional: unknown,
) {
  if (!profissional) return null
  const candidate = String(profissional).trim()
  if (!candidate) return null
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const base = supabase.from('usuarios').select('id')
  const { data } = uuidPattern.test(candidate)
    ? await base.eq('id', candidate).maybeSingle()
    : await base.eq('nome', candidate).maybeSingle()
  return data?.id ? String(data.id) : null
}

async function resolvePatientUnitId(
  supabase: ReturnType<typeof getAppSupabase>,
  pacienteId: string,
) {
  const { data } = await supabase
    .from('pacientes')
    .select('unidade_id')
    .eq('id', pacienteId)
    .maybeSingle()
  return data?.unidade_id ?? null
}

/** Duração (min) definida no procedimento; null = usa a duração da grade do profissional. */
async function getDuracaoProcedimento(
  supabase: ReturnType<typeof getAppSupabase>,
  procedimentoId: string | null,
): Promise<number | null> {
  if (!procedimentoId) return null
  const { data } = await supabase
    .from('procedimentos')
    .select('duracao_min')
    .eq('id', procedimentoId)
    .maybeSingle()
  const value = Number(data?.duracao_min)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Duração de retorno do turno da grade do profissional no dia/horário; null = não configurada. */
async function getDuracaoRetornoGrade(
  supabase: ReturnType<typeof getAppSupabase>,
  profissionalId: string,
  dataIso: string,
  inicioMin: number,
): Promise<number | null> {
  const dow = new Date(`${dataIso}T12:00:00Z`).getUTCDay()
  const { data } = await supabase
    .from('profissional_horarios')
    .select('hora_inicio,hora_fim,duracao_min,duracao_retorno_min')
    .eq('profissional_id', profissionalId)
    .eq('dia_semana', dow)
    .eq('ativo', true)
  return duracaoRetornoDaGrade((data ?? []) as RegraGradeRetorno[], inicioMin)
}

function mensagemConflitoDuracao(conflito: AgendaRowIntervalo, fimMin: number) {
  const ini = String(conflito.horario_inicio ?? '').slice(0, 5)
  return `A duração prevista (até ${minutesToHHMM(fimMin)}) conflita com o atendimento das ${ini}. Escolha um horário a partir do fim do atendimento anterior.`
}

/** Procedimento de valor R$ 0 (ex.: retorno sem cobrança) não exige pagamento inicial. */
function pagamentoInicialDispensado(body: Record<string, unknown>): boolean {
  const valor = body.valorProcedimento
  if (valor === null || valor === undefined || valor === '' || Number(valor) !== 0) return false
  const raw = body.pagamentoInicial
  const informado = raw && typeof raw === 'object' ? Number((raw as Record<string, unknown>).valor) : 0
  return !(informado > 0)
}

/**
 * Valida o pagamento inicial ANTES de ocupar o horário. Sem isso, um pagamento inválido
 * devolvia erro 400 mas deixava a cliente agendada e o horário preso, sem pagamento.
 */
function validarPagamentoInicial(body: Record<string, unknown>): Response | null {
  if (pagamentoInicialDispensado(body)) return null
  const raw = body.pagamentoInicial
  if (!raw || typeof raw !== 'object') {
    return serverErrorResponse(
      'Informe o pagamento inicial do agendamento (pode ser parcial).',
      'PAGAMENTO_INICIAL_OBRIGATORIO',
      400,
    )
  }
  const pagamento = raw as Record<string, unknown>
  const resolved = resolvePagamentoAgendamentoInput({
    agendamentoId: 'validacao',
    valor: pagamento.valor,
    metodo: pagamento.metodo,
    bandeira: pagamento.bandeira,
    parcelas: pagamento.parcelas,
    contaBancariaId: pagamento.contaBancariaId,
    observacoes: pagamento.observacoes,
  })
  if (!resolved.ok) return serverErrorResponse(resolved.message, resolved.code, 400)
  return null
}

/** Desfaz um agendamento recém-criado quando o pagamento inicial falha depois da validação. */
async function desfazerAgendamentoCriado(
  supabase: ReturnType<typeof getAppSupabase>,
  id: string,
  modo: 'liberar' | 'excluir',
) {
  // Nunca deixa recebimento órfão: o agendamento falhou, então o pagamento/lançamento desta tentativa sai junto.
  await Promise.all([
    supabase.from('agendamentos_pagamentos').delete().eq('agendamento_id', id),
    supabase.from('financeiro_lancamentos').delete().eq('agendamento_id', id),
  ])
  if (modo === 'excluir') {
    await supabase.from('agendamentos').delete().eq('id', id)
    return
  }
  await supabase
    .from('agendamentos')
    .update({
      status: 'Disponível',
      paciente_id: null,
      tipo: null,
      titulo: null,
      procedimento_id: null,
      valor_procedimento: null,
      observacoes: null,
      tipo_encaixe: 'normal',
      fora_janela: false,
      motivo_encaixe: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function registrarPagamentoInicialObrigatorio(params: {
  supabase: ReturnType<typeof getAppSupabase>
  session: NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>
  agendamentoId: string
  body: Record<string, unknown>
}): Promise<Response | null> {
  if (pagamentoInicialDispensado(params.body)) return null
  const raw = params.body.pagamentoInicial
  if (!raw || typeof raw !== 'object') {
    return serverErrorResponse(
      'Informe o pagamento inicial do agendamento (pode ser parcial).',
      'PAGAMENTO_INICIAL_OBRIGATORIO',
      400,
    )
  }
  const pagamento = raw as Record<string, unknown>
  const resolved = resolvePagamentoAgendamentoInput({
    agendamentoId: params.agendamentoId,
    valor: pagamento.valor,
    metodo: pagamento.metodo,
    bandeira: pagamento.bandeira,
    parcelas: pagamento.parcelas,
    contaBancariaId: pagamento.contaBancariaId,
    observacoes: pagamento.observacoes,
  })
  if (!resolved.ok) {
    return serverErrorResponse(resolved.message, resolved.code, 400)
  }

  // Aceite do vídeo de 26/10: o pagamento inicial também vira lançamento pago e,
  // com caixa aberto, entrada no caixa do dia (antes ficava só no agendamento).
  const pacienteId = typeof params.body.pacienteId === 'string' ? params.body.pacienteId : ''
  const { data: paciente } = pacienteId
    ? await params.supabase.from('pacientes').select('nome').eq('id', pacienteId).maybeSingle()
    : { data: null }
  const nome = paciente?.nome ? String(paciente.nome) : ''
  const { error } = await registrarRecebimentoAgendamento(params.supabase, params.session, {
    agendamentoId: params.agendamentoId,
    resolved: resolved.data,
    descricao: nome ? `Pagamento inicial do agendamento – ${nome}` : 'Pagamento inicial do agendamento',
    beneficiario: nome || null,
  })
  if (error) {
    return supabaseErrorResponse(error, 'Falha ao registrar pagamento inicial')
  }
  return null
}

/** Cria as demais sessões de um pacote (2..N) após o primeiro agendamento. */
async function criarSeriePacoteSeSolicitada(params: {
  supabase: ReturnType<typeof getAppSupabase>
  sessionUserId: string
  pacienteId: string
  profissionalId: string
  unidadeId: string | null
  body: Record<string, unknown>
  intervaloFallback: number | null
}) {
  const tipo = typeof params.body.tipo === 'string' ? params.body.tipo.toLowerCase() : ''
  if (tipo === 'retorno') return

  const qtdRaw = Number(params.body.serieQuantidade)
  const quantidade = Number.isFinite(qtdRaw) ? Math.trunc(qtdRaw) : 1
  if (quantidade <= 1) return

  const intervaloBody = Number(params.body.serieIntervaloDias)
  const intervalo =
    Number.isFinite(intervaloBody) && intervaloBody > 0
      ? Math.trunc(intervaloBody)
      : params.intervaloFallback
  if (!intervalo || intervalo <= 0) return

  const dataBase = String(params.body.data)
  const horario = String(params.body.horario)

  for (let i = 1; i < quantidade; i += 1) {
    const nextDate = addDaysIso(dataBase, i * intervalo)
    if (!nextDate) continue

    const serieBody: Record<string, unknown> = {
      ...params.body,
      data: nextDate,
      horario,
      // Sessões 2..N do pacote: valor já quitado na sessão 1.
      valorProcedimento: 0,
      pagamentoInicial: undefined,
    }
    delete serieBody.pagamentoInicial
    delete serieBody.serieQuantidade

    const occupy = await ocuparSlotDisponivel(params.supabase, {
      profissionalId: params.profissionalId,
      data: nextDate,
      horario,
      update: buildOccupyUpdate(serieBody, params.pacienteId),
    })

    if (occupy.kind === 'occupied') {
      void agendarLembrete(occupy.id).catch((err) =>
        console.error('[whatsapp] agendar_lembrete_serie', err),
      )
      continue
    }

    if (occupy.kind === 'error') {
      console.error('[agenda] serie occupy error', occupy.error)
      continue
    }

    const { data: inserted, error } = await params.supabase
      .from('agendamentos')
      .insert(
        buildInsertPayload({
          unidadeId: params.unidadeId,
          pacienteId: params.pacienteId,
          profissionalId: params.profissionalId,
          criadoPorId: params.sessionUserId,
          body: serieBody,
          foraJanela: true,
          motivoEncaixe: 'Pacote recorrente',
        }),
      )
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[agenda] serie insert error', error)
      continue
    }
    if (inserted?.id) {
      void agendarLembrete(String(inserted.id)).catch((err) =>
        console.error('[whatsapp] agendar_lembrete_serie', err),
      )
    }
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'agenda', 'read')
  if (denied) return denied

  return listAgenda(session)
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'agenda', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.data || !body?.horario) {
    return serverErrorResponse('Agendamento inválido', 'INVALID_APPOINTMENT', 400)
  }

  const isCompromissoPessoal = !body.pacienteId
  if (!isCompromissoPessoal && !body.pacienteId) {
    return serverErrorResponse('Agendamento inválido', 'INVALID_APPOINTMENT', 400)
  }
  if (isCompromissoPessoal && !body.titulo) {
    return serverErrorResponse(
      'Título é obrigatório para compromisso pessoal',
      'INVALID_APPOINTMENT',
      400,
    )
  }

  const urlCheck = validateModalidadeOnlineUrl({
    modalidade: body.modalidade,
    urlOnline: body.urlOnline,
  })
  if (!urlCheck.ok) {
    return serverErrorResponse(urlCheck.message, urlCheck.code, 400)
  }

  const supabase = getAppSupabase()
  const pacienteId = body.pacienteId ? String(body.pacienteId) : null

  // Bloqueia agendamento retroativo (consulta com paciente).
  if (pacienteId) {
    const dataIso = String(body.data)
    const horario = String(body.horario)
    if (isHorarioPassado(dataIso, horario)) {
      return serverErrorResponse(
        'Não é possível agendar em horário já passado.',
        'HORARIO_PASSADO',
        400,
      )
    }
  }

  // Item 15a — resolve preferindo o UUID enviado pelo front (body.profissionalId);
  // o nome fica só como compatibilidade. Agendamento COM paciente (consulta/encaixe)
  // EXIGE um profissional resolvido — sem fallback silencioso pro criador, que
  // rotulava o encaixe para outra pessoa. Compromisso pessoal (sem paciente)
  // pertence ao próprio criador (session.userId).
  const profissionalResolvido = await resolveProfessionalId(
    supabase,
    body.profissionalId ?? body.profissional,
  )
  if (pacienteId && !profissionalResolvido) {
    return serverErrorResponse(
      'Selecione um profissional válido para o agendamento.',
      'PROFISSIONAL_INVALIDO',
      400,
    )
  }
  const profissionalId = profissionalResolvido ?? session.userId
  const scopedContext = await getScopedAgendaContext(session)
  if (scopedContext.error) {
    return supabaseErrorResponse(scopedContext.error, 'Falha ao criar agendamento')
  }

  const procResolved = await resolveAgendamentoProcedimento(supabase, {
    procedimentoId: body.procedimentoId,
    valorProcedimento: body.valorProcedimento,
    profissionalId: pacienteId ? profissionalId : null,
    tipo: body.tipo,
    pacienteId,
    dataAgendamento: String(body.data),
  })
  if (!procResolved.ok) {
    return serverErrorResponse(procResolved.message, procResolved.code, 400)
  }
  const enrichedBody: Record<string, unknown> = {
    ...body,
    procedimentoId: procResolved.data.procedimentoId,
    valorProcedimento: procResolved.data.valorProcedimento,
    // Procedimento de retorno sempre grava o tipo Retorno (duração de retorno, fila de retornos).
    tipo: procResolved.data.ehRetorno ? 'retorno' : body.tipo,
  }

  const patientUnitId = pacienteId ? await resolvePatientUnitId(supabase, pacienteId) : null
  const unidadeId = scopedContext.unidadeId ?? patientUnitId

  if (isCompromissoPessoal) {
    const falha = await criarCompromisso({
      supabase,
      userId: session.userId,
      organizadorId: profissionalId,
      unidadeId,
      body: enrichedBody,
    })
    return falha ?? listAgenda(session)
  }

  if (pacienteId) {
    const pagamentoInvalido = validarPagamentoInicial(enrichedBody)
    if (pagamentoInvalido) return pagamentoInvalido
  }

  const foraJanela = enrichedBody.foraJanela === true
  const motivoEncaixe =
    typeof enrichedBody.motivoEncaixe === 'string' && enrichedBody.motivoEncaixe.trim().length > 0
      ? enrichedBody.motivoEncaixe.trim()
      : null

  // CONSULTA (com paciente) sem encaixe: ocupa um slot 'Disponível' gerado (2A),
  // em vez de inserir uma linha nova — fecha a "agenda aberta".
  // O `pacienteId &&` à esquerda é só p/ narrowing de tipo (string|null → string
  // para buildOccupyUpdate); decidirFluxoAgendamento já exige pacienteId.
  if (pacienteId && decidirFluxoAgendamento({ pacienteId, foraJanela }) === 'ocupar') {
    // Regra de duração: o atendimento ocupa [início, início + duração do procedimento ou da grade).
    const dataSlot = String(enrichedBody.data)
    const horarioSlot = String(enrichedBody.horario)
    const inicioMin = timeToMinutes(horarioSlot)
    // Retorno: a duração própria do profissional (grade) vale sobre a do procedimento.
    const duracaoRetorno =
      procResolved.data.ehRetorno && profissionalId && inicioMin !== null
        ? await getDuracaoRetornoGrade(supabase, profissionalId, dataSlot, inicioMin)
        : null
    const duracaoProc =
      duracaoRetorno ?? (await getDuracaoProcedimento(supabase, procResolved.data.procedimentoId))
    const occupyUpdate = buildOccupyUpdate(enrichedBody, pacienteId)
    let liberarSlotIds: string[] = []
    if (profissionalId && inicioMin !== null) {
      const { rows, error: rowsError } = await getLinhasDoDia(
        supabase,
        profissionalId,
        dataSlot,
        [],
      )
      if (rowsError) return supabaseErrorResponse(rowsError, 'Falha ao agendar consulta')
      const slotAlvo = rows.find(
        (row) =>
          String(row.status) === 'Disponível' && timeToMinutes(row.horario_inicio) === inicioMin,
      )
      if (slotAlvo) {
        const fimGrade = timeToMinutes(slotAlvo.horario_fim)
        const fimMin = duracaoProc ? inicioMin + duracaoProc : (fimGrade ?? inicioMin)
        const plano = planejarOcupacao({
          inicioMin,
          fimMin,
          outros: rows.filter((row) => row.id !== slotAlvo.id) as unknown as AgendaRowIntervalo[],
        })
        if (!plano.ok) {
          return serverErrorResponse(
            mensagemConflitoDuracao(plano.conflito, fimMin),
            'DURACAO_CONFLITA',
            409,
          )
        }
        const bloqueio = await bloqueioNoIntervalo(supabase, { profissionalId, dataIso: dataSlot, inicioMin, fimMin })
        if (bloqueio) return serverErrorResponse(mensagemBloqueio(bloqueio), 'BLOQUEIO_CONFLITA', 409)
        liberarSlotIds = plano.liberarSlotIds
        if (duracaoProc) occupyUpdate.horario_fim = minutesToHHMM(fimMin)
      }
    }

    const result = await ocuparSlotDisponivel(supabase, {
      profissionalId,
      data: dataSlot,
      horario: horarioSlot,
      update: occupyUpdate,
    })

    if (result.kind === 'error') {
      return supabaseErrorResponse(result.error, 'Falha ao agendar consulta')
    }
    if (result.kind === 'indisponivel') {
      return serverErrorResponse(
        'Esse horário não está disponível para o profissional. Atualize a agenda e escolha um horário livre, ou use o encaixe fora do horário padrão.',
        'SLOT_INDISPONIVEL',
        409,
      )
    }

    if (liberarSlotIds.length > 0) {
      await supabase.from('agendamentos').delete().in('id', liberarSlotIds)
    }

    void agendarLembrete(result.id).catch((err) =>
      console.error('[whatsapp] agendar_lembrete', err),
    )

    const pagamentoError = await registrarPagamentoInicialObrigatorio({
      supabase,
      session,
      agendamentoId: result.id,
      body: enrichedBody,
    })
    if (pagamentoError) {
      await desfazerAgendamentoCriado(supabase, result.id, 'liberar')
      return pagamentoError
    }

    await criarSeriePacoteSeSolicitada({
      supabase,
      sessionUserId: session.userId,
      pacienteId,
      profissionalId,
      unidadeId,
      body: enrichedBody,
      intervaloFallback: procResolved.data.intervaloRecorrenciaDias,
    })

    if (procResolved.data.ehRetorno) await limparTagRetornoPendente(supabase, pacienteId)
    return listAgenda(session)
  }

  // Encaixe (fora da grade): também respeita bloqueios da agenda do especialista.
  const inicioEncaixe = timeToMinutes(enrichedBody.horario)
  if (inicioEncaixe !== null) {
    const fimEncaixe = timeToMinutes(enrichedBody.horarioFim) ?? inicioEncaixe + 30
    const bloqueio = await bloqueioNoIntervalo(supabase, {
      profissionalId,
      dataIso: String(enrichedBody.data),
      inicioMin: inicioEncaixe,
      fimMin: fimEncaixe,
    })
    if (bloqueio) return serverErrorResponse(mensagemBloqueio(bloqueio), 'BLOQUEIO_CONFLITA', 409)
  }

  // Encaixe (fora da grade): insere.
  const { data: inserted, error } = await supabase
    .from('agendamentos')
    .insert(
      buildInsertPayload({
        unidadeId,
        pacienteId,
        profissionalId,
        criadoPorId: session.userId,
        body: enrichedBody,
        foraJanela,
        motivoEncaixe,
      }),
    )
    .select('id')
    .maybeSingle()

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao criar agendamento')
  }

  // Agenda o lembrete de WhatsApp de forma não-bloqueante — uma falha aqui
  // nunca deve impedir a criação do agendamento.
  if (pacienteId && inserted?.id) {
    void agendarLembrete(String(inserted.id)).catch((err) =>
      console.error('[whatsapp] agendar_lembrete', err),
    )

    const pagamentoError = await registrarPagamentoInicialObrigatorio({
      supabase,
      session,
      agendamentoId: String(inserted.id),
      body: enrichedBody,
    })
    if (pagamentoError) {
      await desfazerAgendamentoCriado(supabase, String(inserted.id), 'excluir')
      return pagamentoError
    }
  }

  if (pacienteId) {
    await criarSeriePacoteSeSolicitada({
      supabase,
      sessionUserId: session.userId,
      pacienteId,
      profissionalId,
      unidadeId,
      body: enrichedBody,
      intervaloFallback: procResolved.data.intervaloRecorrenciaDias,
    })
  }

  if (pacienteId && procResolved.data.ehRetorno) await limparTagRetornoPendente(supabase, pacienteId)
  return listAgenda(session)
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'agenda', 'update')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Agendamento inválido', 'INVALID_APPOINTMENT', 400)
  }

  const supabase = getAppSupabase()

  const { data: existing, error: existingError } = await supabase
    .from('agendamentos')
    .select(
      'id,unidade_id,paciente_id,profissional_id,procedimento_id,data_agendamento,horario_inicio,horario_fim,status,tipo,titulo,local,participantes,modalidade_atendimento,plataforma_online,url_online,valor_procedimento,observacoes,compromisso_grupo_id',
    )
    .eq('id', String(body.id))
    .maybeSingle()

  if (existingError) {
    return supabaseErrorResponse(existingError, 'Falha ao atualizar agendamento')
  }
  if (!existing) {
    return serverErrorResponse('Agendamento não encontrado', 'APPOINTMENT_NOT_FOUND', 404)
  }

  if (ehCompromisso(existing)) {
    const ctx = await getScopedAgendaContext(session)
    if (ctx.error) return supabaseErrorResponse(ctx.error, 'Falha ao atualizar compromisso')
    if (!compromissoNoEscopo(existing, ctx, session.userId)) {
      return serverErrorResponse('Compromisso não encontrado ou fora da sua unidade', 'APPOINTMENT_NOT_FOUND', 404)
    }
    const falha = await atualizarCompromisso({
      supabase,
      userId: session.userId,
      unidadeId: ctx.unidadeId,
      existing,
      body,
    })
    return falha ?? listAgenda(session)
  }

  const profissionalId =
    (await resolveProfessionalId(supabase, body.profissionalId ?? body.profissional)) ??
    (existing.profissional_id ? String(existing.profissional_id) : null)
  const pacienteId = body.pacienteId
    ? String(body.pacienteId)
    : existing.paciente_id
      ? String(existing.paciente_id)
      : null
  const scopedContext = await getScopedAgendaContext(session)
  if (scopedContext.error) {
    return supabaseErrorResponse(scopedContext.error, 'Falha ao atualizar agendamento')
  }

  const dataAgendamento =
    typeof body.data === 'string' && body.data.trim()
      ? String(body.data)
      : String(existing.data_agendamento ?? '').slice(0, 10)
  const horario =
    typeof body.horario === 'string' && body.horario.trim()
      ? String(body.horario)
      : String(existing.horario_inicio ?? '').slice(0, 5)

  const modalidadeFinal =
    body.modalidade !== undefined
      ? body.modalidade
      : (existing.modalidade_atendimento ?? (pacienteId ? 'Presencial' : null))
  const urlOnlineFinal = body.urlOnline !== undefined ? body.urlOnline : existing.url_online
  const urlCheck = validateModalidadeOnlineUrl({
    modalidade: modalidadeFinal,
    urlOnline: urlOnlineFinal,
  })
  if (!urlCheck.ok) {
    return serverErrorResponse(urlCheck.message, urlCheck.code, 400)
  }

  const procedimentoIdInput =
    body.procedimentoId !== undefined
      ? body.procedimentoId
      : existing.procedimento_id
        ? String(existing.procedimento_id)
        : null
  const valorInput =
    body.valorProcedimento !== undefined ? body.valorProcedimento : existing.valor_procedimento
  const tipoInput = body.tipo !== undefined ? body.tipo : existing.tipo

  const existingDate = String(existing.data_agendamento ?? '').slice(0, 10)
  const existingTime = String(existing.horario_inicio ?? '').slice(0, 5)
  const norm = (value: unknown) => String(value ?? '').trim().toLowerCase()
  // Só revalida o retorno quando a edição muda o que o define (data/hora, profissional, paciente, tipo, procedimento).
  const mudouDefinicaoRetorno =
    dataAgendamento !== existingDate ||
    horario !== existingTime ||
    norm(profissionalId) !== norm(existing.profissional_id) ||
    norm(pacienteId) !== norm(existing.paciente_id) ||
    norm(tipoInput) !== norm(existing.tipo) ||
    norm(procedimentoIdInput) !== norm(existing.procedimento_id)

  const procResolved = await resolveAgendamentoProcedimento(supabase, {
    procedimentoId: procedimentoIdInput,
    valorProcedimento: valorInput,
    profissionalId,
    tipo: tipoInput,
    pacienteId,
    dataAgendamento,
    validarRetorno: mudouDefinicaoRetorno,
  })
  if (!procResolved.ok) {
    return serverErrorResponse(procResolved.message, procResolved.code, 400)
  }

  const patientUnitId = pacienteId ? await resolvePatientUnitId(supabase, pacienteId) : null
  const unidadeId = scopedContext.unidadeId ?? patientUnitId

  // Remarcar consulta de paciente: ocupa o horário novo (consome o slot livre), libera o antigo,
  // barra horário passado e dupla marcação. Edições que não mudam data/hora/profissional passam direto.
  const moved =
    Boolean(existing.paciente_id) &&
    (dataAgendamento !== existingDate ||
      horario !== existingTime ||
      profissionalId !== (existing.profissional_id ? String(existing.profissional_id) : null))
  let horarioFimFinal: unknown =
    body.horarioFim !== undefined ? body.horarioFim : existing.horario_fim
  let consumedSlots: Array<Record<string, unknown>> = []
  if (moved) {
    if (isHorarioPassado(dataAgendamento, horario)) {
      return serverErrorResponse(
        'Não é possível remarcar para um horário que já passou.',
        'HORARIO_PASSADO',
        400,
      )
    }
    const inicioMin = timeToMinutes(horario)
    const duracaoOriginal =
      (timeToMinutes(existing.horario_fim) ?? 0) - (timeToMinutes(existing.horario_inicio) ?? 0)
    const { rows, error: rowsError } = await getLinhasDoDia(
      supabase,
      String(profissionalId),
      dataAgendamento,
      [String(existing.id)],
    )
    if (rowsError) {
      return supabaseErrorResponse(rowsError, 'Falha ao remarcar agendamento')
    }
    if (inicioMin !== null) {
      const slotAlvo = rows.find(
        (row) =>
          String(row.status) === 'Disponível' && timeToMinutes(row.horario_inicio) === inicioMin,
      )
      // Duração: procedimento > slot de destino (grade) > duração anterior, só se plausível (≤ 4h;
      // registros antigos podem ter fim inconsistente por causa do remarcar antigo).
      const duracaoRetorno = procResolved.data.ehRetorno
        ? await getDuracaoRetornoGrade(supabase, String(profissionalId), dataAgendamento, inicioMin)
        : null
      const duracaoProc =
        duracaoRetorno ??
        (await getDuracaoProcedimento(
          supabase,
          existing.procedimento_id ? String(existing.procedimento_id) : null,
        ))
      const duracaoSlot = slotAlvo
        ? (timeToMinutes(slotAlvo.horario_fim) ?? inicioMin) - inicioMin
        : 0
      const duracao =
        duracaoProc ??
        (duracaoSlot > 0
          ? duracaoSlot
          : duracaoOriginal > 0 && duracaoOriginal <= 240
            ? duracaoOriginal
            : 40)
      const fimMin = inicioMin + Math.max(duracao, 1)
      const plano = planejarOcupacao({
        inicioMin,
        fimMin,
        outros: rows as unknown as AgendaRowIntervalo[],
      })
      if (!plano.ok) {
        return serverErrorResponse(
          mensagemConflitoDuracao(plano.conflito, fimMin),
          'DURACAO_CONFLITA',
          409,
        )
      }
      const bloqueio = await bloqueioNoIntervalo(supabase, {
        profissionalId: String(profissionalId),
        dataIso: dataAgendamento,
        inicioMin,
        fimMin,
      })
      if (bloqueio) return serverErrorResponse(mensagemBloqueio(bloqueio), 'BLOQUEIO_CONFLITA', 409)
      consumedSlots = rows.filter((row) => plano.liberarSlotIds.includes(String(row.id)))
      if (body.horarioFim === undefined && duracao > 0) {
        horarioFimFinal = minutesToHHMM(fimMin)
      }
    }
    if (consumedSlots.length > 0) {
      const { error: consumeError } = await supabase
        .from('agendamentos')
        .delete()
        .in(
          'id',
          consumedSlots.map((row) => String(row.id)),
        )
      if (consumeError) {
        return supabaseErrorResponse(consumeError, 'Falha ao remarcar agendamento')
      }
    }
  }

  let query = supabase
    .from('agendamentos')
    .update({
      unidade_id: unidadeId,
      paciente_id: pacienteId,
      profissional_id: profissionalId,
      data_agendamento: dataAgendamento,
      horario_inicio: horario,
      horario_fim: horarioFimFinal,
      status: typeof body.status === 'string' && body.status.trim() ? body.status : existing.status,
      tipo: procResolved.data.ehRetorno ? 'retorno' : (tipoInput ?? null),
      titulo: body.titulo !== undefined ? body.titulo : existing.titulo,
      local: body.local !== undefined ? body.local : existing.local,
      participantes: body.participantes !== undefined ? body.participantes : existing.participantes,
      modalidade_atendimento: modalidadeFinal,
      plataforma_online:
        body.plataformaOnline !== undefined ? body.plataformaOnline : existing.plataforma_online,
      url_online: urlOnlineFinal,
      // Resolved já herda do registro atual quando o body omite os campos;
      // não usar `?? existing` aqui — senão limpar procedimento/valor não persiste.
      valor_procedimento: procResolved.data.valorProcedimento,
      procedimento_id: procResolved.data.procedimentoId,
      observacoes: body.observacoes !== undefined ? body.observacoes : existing.observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))

  if (scopedContext.profissionalId) {
    query = query.eq('profissional_id', scopedContext.profissionalId)
  } else if (scopedContext.unidadeId) {
    query = query.eq('unidade_id', scopedContext.unidadeId)
  }
  if (scopedContext.especialistasPermitidos?.length) {
    query = query.in('profissional_id', scopedContext.especialistasPermitidos)
  }

  const { data: updatedRows, error } = await query.select('id')

  const restoreConsumedSlot = async () => {
    if (consumedSlots.length === 0) return
    await supabase.from('agendamentos').insert(
      consumedSlots.map((slot) => ({
        profissional_id: slot.profissional_id,
        unidade_id: slot.unidade_id,
        data_agendamento: slot.data_agendamento,
        horario_inicio: slot.horario_inicio,
        horario_fim: slot.horario_fim,
        status: 'Disponível',
        paciente_id: null,
        criado_por_id: session.userId,
      })),
    )
  }

  if (error) {
    await restoreConsumedSlot()
    return supabaseErrorResponse(error, 'Falha ao atualizar agendamento')
  }
  // Fora do escopo do usuário (unidade/especialista) o update afeta 0 linhas: não devolver
  // sucesso falso, senão a tela mostra "salvo" e nada muda.
  if (!updatedRows || updatedRows.length === 0) {
    await restoreConsumedSlot()
    return serverErrorResponse(
      'Agendamento não encontrado ou fora da sua unidade',
      'APPOINTMENT_NOT_FOUND',
      404,
    )
  }

  if (moved) {
    // Libera o horário antigo devolvendo as vagas da grade (ninguém mais o ocupa).
    await liberarIntervaloNaGrade(supabase, {
      profissionalId: String(existing.profissional_id),
      unidadeId: existing.unidade_id,
      dataIso: existingDate,
      horarioInicio: existing.horario_inicio,
      horarioFim: existing.horario_fim,
      ignorarId: String(existing.id),
      userId: session.userId,
    })
  }

  return listAgenda(session)
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) {
    return authErrorResponse()
  }
  const denied = await requirePermission(session.userId, 'agenda', 'delete')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body?.id) {
    return serverErrorResponse('Agendamento inválido', 'INVALID_APPOINTMENT', 400)
  }

  const supabase = getAppSupabase()
  const scopedContext = await getScopedAgendaContext(session)
  if (scopedContext.error) {
    return supabaseErrorResponse(scopedContext.error, 'Falha ao cancelar agendamento')
  }

  const { data: alvoExclusao } = await supabase
    .from('agendamentos')
    .select('id,paciente_id,status,profissional_id,unidade_id,compromisso_grupo_id')
    .eq('id', String(body.id))
    .maybeSingle()
  if (alvoExclusao && ehCompromisso(alvoExclusao)) {
    if (!compromissoNoEscopo(alvoExclusao, scopedContext, session.userId)) {
      return serverErrorResponse('Agendamento não encontrado', 'APPOINTMENT_NOT_FOUND', 404)
    }
    const falha = await excluirCompromisso({ supabase, userId: session.userId, existing: alvoExclusao })
    return falha ?? listAgenda(session)
  }

  // Item 1 — cancelar mantém o registro da cliente (status Cancelado, cinza na agenda e
  // no histórico) e cria um NOVO horário livre no mesmo intervalo para outro agendamento.
  // Compromissos sem paciente (agenda pessoal) seguem liberando o próprio horário.
  const reasonText = body.reason ? String(body.reason) : ''
  let current = supabase
    .from('agendamentos')
    .select(
      'id,paciente_id,profissional_id,unidade_id,data_agendamento,horario_inicio,horario_fim,status,observacoes',
    )
    .eq('id', String(body.id))
  if (scopedContext.profissionalId) {
    current = current.eq('profissional_id', scopedContext.profissionalId)
  } else if (scopedContext.unidadeId) {
    current = current.eq('unidade_id', scopedContext.unidadeId)
  }
  if (scopedContext.especialistasPermitidos?.length) {
    current = current.in('profissional_id', scopedContext.especialistasPermitidos)
  }
  const { data: row, error: rowError } = await current.maybeSingle()
  if (rowError) {
    return supabaseErrorResponse(rowError, 'Falha ao cancelar agendamento')
  }
  if (!row) {
    return serverErrorResponse('Agendamento não encontrado', 'APPOINTMENT_NOT_FOUND', 404)
  }

  if (row.paciente_id && row.status !== 'Cancelado') {
    const { error: cancelError } = await supabase
      .from('agendamentos')
      .update({
        status: 'Cancelado',
        observacoes: reasonText ? `Cancelado: ${reasonText}` : 'Cancelado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (cancelError) {
      return supabaseErrorResponse(cancelError, 'Falha ao cancelar agendamento')
    }

    await liberarIntervaloNaGrade(supabase, {
      profissionalId: String(row.profissional_id),
      unidadeId: row.unidade_id,
      dataIso: String(row.data_agendamento).slice(0, 10),
      horarioInicio: row.horario_inicio,
      horarioFim: row.horario_fim,
      ignorarId: String(row.id),
      userId: session.userId,
    })
    return listAgenda(session)
  }

  let query = supabase
    .from('agendamentos')
    .update({
      status: 'Disponível',
      paciente_id: null,
      tipo: null,
      titulo: null,
      local: null,
      participantes: null,
      valor_procedimento: null,
      procedimento_id: null,
      modalidade_atendimento: 'Presencial',
      plataforma_online: null,
      url_online: null,
      tipo_encaixe: 'normal', // coluna NOT NULL (default 'normal')
      fora_janela: false,
      motivo_encaixe: null,
      observacoes: reasonText ? `Cancelado: ${reasonText}` : 'Cancelado — horário liberado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(body.id))

  if (scopedContext.profissionalId) {
    query = query.eq('profissional_id', scopedContext.profissionalId)
  } else if (scopedContext.unidadeId) {
    query = query.eq('unidade_id', scopedContext.unidadeId)
  }
  if (scopedContext.especialistasPermitidos?.length) {
    query = query.in('profissional_id', scopedContext.especialistasPermitidos)
  }

  const { error } = await query

  if (error) {
    return supabaseErrorResponse(error, 'Falha ao cancelar agendamento')
  }

  return listAgenda(session)
}
