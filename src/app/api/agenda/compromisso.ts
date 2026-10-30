import { randomUUID } from 'node:crypto'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { type AgendaRowIntervalo, planejarOcupacao, timeToMinutes } from './agenda-duracao'
import { getLinhasDoDia, liberarIntervaloNaGrade } from './agenda-grade'
import { buildInsertPayload } from './agenda-slot'
import {
  type IntervaloCompromisso,
  normalizarParticipanteIds,
  resolverIntervaloCompromisso,
} from './compromisso-regras'

type Supabase = ReturnType<typeof getAppSupabase>

/** Compromisso pessoal = linha sem paciente que não é vaga livre da grade. */
export function ehCompromisso(row: { paciente_id?: unknown; status?: unknown }) {
  return !row.paciente_id && String(row.status ?? '') !== 'Disponível'
}

type Alvo = { id: string; nome: string; perfil: string; unidade_id: string | null }

type LinhaGrupo = {
  id: string
  profissional_id: string | null
  unidade_id: string | null
  data_agendamento: string
  horario_inicio: string
  horario_fim: string | null
}

const COLUNAS_GRUPO = 'id,profissional_id,unidade_id,data_agendamento,horario_inicio,horario_fim'

type Falha = { response: Response }

/** Valida participantes: usuários ativos (não pacientes) da mesma unidade de quem cria. */
async function carregarAlvos(supabase: Supabase, ids: string[], unidadeEscopo: string | null) {
  const { data, error } = await supabase.from('usuarios').select('id,nome,perfil,status,unidade_id').in('id', ids)
  if (error) return { falha: { response: supabaseErrorResponse(error, 'Falha ao carregar participantes') } as Falha }
  const mapa = new Map((data ?? []).map((u) => [String(u.id), u]))
  const alvos: Alvo[] = []
  for (const id of ids) {
    const u = mapa.get(id)
    const unidade = u?.unidade_id ? String(u.unidade_id) : null
    const invalido =
      !u || String(u.status) !== 'Ativo' || String(u.perfil) === 'paciente' || (unidadeEscopo && unidade && unidade !== unidadeEscopo)
    if (invalido) {
      return {
        falha: {
          response: serverErrorResponse('Participante inválido ou de outra unidade.', 'PARTICIPANTE_INVALIDO', 400),
        } as Falha,
      }
    }
    alvos.push({ id, nome: String(u.nome ?? ''), perfil: String(u.perfil), unidade_id: unidade })
  }
  return { alvos }
}

/** Para cada especialista, confere conflito com atendimentos e junta as vagas livres que o compromisso consome. */
async function planejarEspecialistas(
  supabase: Supabase,
  alvos: Alvo[],
  dataIso: string,
  intervalo: IntervaloCompromisso,
  ignorarIds: string[],
) {
  const liberarSlotIds: string[] = []
  for (const alvo of alvos.filter((a) => a.perfil === 'especialista')) {
    const { rows, error } = await getLinhasDoDia(supabase, alvo.id, dataIso, ignorarIds)
    if (error) return { falha: { response: supabaseErrorResponse(error, 'Falha ao verificar a agenda') } as Falha }
    const plano = planejarOcupacao({
      inicioMin: intervalo.inicioMin,
      fimMin: intervalo.fimMin,
      outros: rows as unknown as AgendaRowIntervalo[],
    })
    if (!plano.ok) {
      const ini = String(plano.conflito.horario_inicio ?? '').slice(0, 5)
      return {
        falha: {
          response: serverErrorResponse(
            `${alvo.nome} já tem um compromisso ou atendimento às ${ini} que conflita com ${intervalo.horarioInicio}–${intervalo.horarioFim}.`,
            'COMPROMISSO_CONFLITA',
            409,
          ),
        } as Falha,
      }
    }
    liberarSlotIds.push(...plano.liberarSlotIds)
  }
  return { liberarSlotIds }
}

function linhaDoCompromisso(params: {
  id: string
  grupoId: string
  alvo: Alvo
  unidadeId: string | null
  criadoPorId: string
  body: Record<string, unknown>
  dataIso: string
  intervalo: IntervaloCompromisso
  participantesTexto: string
}) {
  const { body, intervalo } = params
  return {
    ...buildInsertPayload({
      unidadeId: params.unidadeId ?? params.alvo.unidade_id,
      pacienteId: null,
      profissionalId: params.alvo.id,
      criadoPorId: params.criadoPorId,
      body: {
        ...body,
        data: params.dataIso,
        horario: intervalo.horarioInicio,
        horarioFim: intervalo.horarioFim,
        status: 'Agendado',
        participantes: params.participantesTexto || null,
      },
      foraJanela: false,
      motivoEncaixe: null,
    }),
    id: params.id,
    compromisso_grupo_id: params.grupoId,
  }
}

function bloqueioDoCompromisso(params: {
  alvo: Alvo
  agendamentoId: string
  unidadeId: string | null
  dataIso: string
  intervalo: IntervaloCompromisso
  titulo: string
  criadoPorId: string
}) {
  return {
    profissional_id: params.alvo.id,
    unidade_id: params.unidadeId ?? params.alvo.unidade_id,
    data_inicio: params.dataIso,
    data_fim: params.dataIso,
    horario_inicio: params.intervalo.horarioInicio,
    horario_fim: params.intervalo.horarioFim,
    dia_inteiro: false,
    tipo: 'Compromisso',
    justificativa: params.titulo,
    created_by: params.criadoPorId,
    agendamento_id: params.agendamentoId,
  }
}

/**
 * Cria o compromisso para o organizador e cada participante (uma cópia na agenda Pessoal de cada um)
 * e, para quem é especialista, bloqueia o intervalo inteiro na agenda de atendimentos.
 */
export async function criarCompromisso(params: {
  supabase: Supabase
  userId: string
  organizadorId: string
  unidadeId: string | null
  body: Record<string, unknown>
}): Promise<Response | null> {
  const { supabase, userId, organizadorId, unidadeId, body } = params
  const dataIso = String(body.data)
  const resolvido = resolverIntervaloCompromisso({
    horario: body.horario,
    horarioFim: body.horarioFim,
    duracaoMin: body.duracaoMin,
  })
  if (!resolvido.ok) return serverErrorResponse(resolvido.message, 'INTERVALO_INVALIDO', 400)
  const intervalo = resolvido.intervalo

  const ids = [organizadorId, ...normalizarParticipanteIds(body.participanteIds).filter((id) => id !== organizadorId)]
  const carregado = await carregarAlvos(supabase, ids, unidadeId)
  if (carregado.falha) return carregado.falha.response
  const alvos = carregado.alvos

  const plano = await planejarEspecialistas(supabase, alvos, dataIso, intervalo, [])
  if (plano.falha) return plano.falha.response

  const grupoId = randomUUID()
  const titulo = String(body.titulo).trim()
  const participantesTexto = alvos.map((a) => a.nome).join(', ')
  const linhas = alvos.map((alvo) =>
    linhaDoCompromisso({
      id: alvo.id === organizadorId ? grupoId : randomUUID(),
      grupoId,
      alvo,
      unidadeId,
      criadoPorId: userId,
      body,
      dataIso,
      intervalo,
      participantesTexto: alvos.length > 1 ? participantesTexto : '',
    }),
  )
  const { error } = await supabase.from('agendamentos').insert(linhas)
  if (error) return supabaseErrorResponse(error, 'Falha ao criar compromisso')

  const bloqueios = linhas.flatMap((linha, i) =>
    alvos[i].perfil === 'especialista'
      ? [bloqueioDoCompromisso({ alvo: alvos[i], agendamentoId: linha.id, unidadeId, dataIso, intervalo, titulo, criadoPorId: userId })]
      : [],
  )
  if (bloqueios.length > 0) {
    const { error: bloqueioError } = await supabase.from('agenda_bloqueios').insert(bloqueios)
    if (bloqueioError) {
      await supabase.from('agendamentos').delete().eq('compromisso_grupo_id', grupoId)
      return supabaseErrorResponse(bloqueioError, 'Falha ao bloquear a agenda do compromisso')
    }
  }
  if (plano.liberarSlotIds.length > 0) {
    await supabase.from('agendamentos').delete().in('id', plano.liberarSlotIds)
  }
  return null
}

async function carregarGrupo(supabase: Supabase, existing: { id: unknown; compromisso_grupo_id?: unknown }) {
  const grupoId = String(existing.compromisso_grupo_id ?? existing.id)
  const { data, error } = await supabase
    .from('agendamentos')
    .select(COLUNAS_GRUPO)
    .or(`compromisso_grupo_id.eq.${grupoId},id.eq.${grupoId}`)
  return { grupoId, linhas: (data ?? []) as unknown as LinhaGrupo[], error }
}

async function perfisDosProfissionais(supabase: Supabase, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const { data } = await supabase.from('usuarios').select('id,perfil').in('id', ids)
  return new Map((data ?? []).map((u) => [String(u.id), String(u.perfil)]))
}

async function devolverVagas(supabase: Supabase, userId: string, linhas: LinhaGrupo[], perfis: Map<string, string>) {
  for (const linha of linhas) {
    if (!linha.profissional_id || perfis.get(linha.profissional_id) !== 'especialista') continue
    await liberarIntervaloNaGrade(supabase, {
      profissionalId: linha.profissional_id,
      unidadeId: linha.unidade_id,
      dataIso: String(linha.data_agendamento).slice(0, 10),
      horarioInicio: linha.horario_inicio,
      horarioFim: linha.horario_fim,
      ignorarId: '',
      userId,
      somenteGrade: true,
    })
  }
}

/** Edita o compromisso no grupo todo: dados, horário/duração, bloqueios e lista de participantes. */
export async function atualizarCompromisso(params: {
  supabase: Supabase
  userId: string
  unidadeId: string | null
  existing: Record<string, unknown>
  body: Record<string, unknown>
}): Promise<Response | null> {
  const { supabase, userId, unidadeId, existing, body } = params
  const { grupoId, linhas, error: grupoError } = await carregarGrupo(supabase, existing as { id: unknown })
  if (grupoError) return supabaseErrorResponse(grupoError, 'Falha ao carregar o compromisso')
  const organizador = linhas.find((l) => l.id === grupoId) ?? linhas.find((l) => l.id === String(existing.id))
  if (!organizador?.profissional_id) return serverErrorResponse('Compromisso não encontrado', 'APPOINTMENT_NOT_FOUND', 404)

  const dataAnterior = String(organizador.data_agendamento).slice(0, 10)
  const iniAnterior = timeToMinutes(organizador.horario_inicio) ?? 0
  const fimAnterior = timeToMinutes(organizador.horario_fim)
  const dataIso = typeof body.data === 'string' && body.data.trim() ? body.data : dataAnterior
  const horario = typeof body.horario === 'string' && body.horario.trim() ? body.horario : organizador.horario_inicio
  const resolvido = resolverIntervaloCompromisso({
    horario,
    horarioFim: body.horarioFim,
    // sem fim informado (ex.: adiar), preserva a duração anterior
    duracaoMin: body.duracaoMin ?? (fimAnterior !== null && fimAnterior > iniAnterior ? fimAnterior - iniAnterior : undefined),
  })
  if (!resolvido.ok) return serverErrorResponse(resolvido.message, 'INTERVALO_INVALIDO', 400)
  const intervalo = resolvido.intervalo

  const atuais = linhas.map((l) => l.profissional_id).filter((id): id is string => Boolean(id))
  const participantes =
    body.participanteIds !== undefined
      ? normalizarParticipanteIds(body.participanteIds).filter((id) => id !== organizador.profissional_id)
      : atuais.filter((id) => id !== organizador.profissional_id)
  const ids = [organizador.profissional_id, ...participantes]
  const carregado = await carregarAlvos(supabase, ids, unidadeId)
  if (carregado.falha) return carregado.falha.response
  const alvos = carregado.alvos

  const plano = await planejarEspecialistas(supabase, alvos, dataIso, intervalo, linhas.map((l) => l.id))
  if (plano.falha) return plano.falha.response

  const titulo = String(body.titulo ?? existing.titulo ?? '').trim() || String(existing.titulo ?? 'Compromisso')
  const participantesTexto = alvos.length > 1 ? alvos.map((a) => a.nome).join(', ') : ''
  const perfisAntigos = await perfisDosProfissionais(supabase, atuais)

  const removidos = linhas.filter((l) => l.profissional_id && !ids.includes(l.profissional_id))
  const mantidos = linhas.filter((l) => l.profissional_id && ids.includes(l.profissional_id))
  const novos = alvos.filter((a) => !atuais.includes(a.id))

  if (removidos.length > 0) {
    await supabase.from('agendamentos').delete().in('id', removidos.map((l) => l.id))
  }
  if (mantidos.length > 0) {
    const { error } = await supabase
      .from('agendamentos')
      .update({
        titulo,
        local: body.local !== undefined ? body.local : (existing.local ?? null),
        observacoes: body.observacoes !== undefined ? body.observacoes : (existing.observacoes ?? null),
        tipo: body.tipo !== undefined ? body.tipo : (existing.tipo ?? null),
        data_agendamento: dataIso,
        horario_inicio: intervalo.horarioInicio,
        horario_fim: intervalo.horarioFim,
        participantes: participantesTexto || null,
        compromisso_grupo_id: grupoId,
        updated_at: new Date().toISOString(),
      })
      .in('id', mantidos.map((l) => l.id))
    if (error) return supabaseErrorResponse(error, 'Falha ao atualizar o compromisso')
  }
  const novasLinhas = novos.map((alvo) =>
    linhaDoCompromisso({
      id: randomUUID(),
      grupoId,
      alvo,
      unidadeId,
      criadoPorId: userId,
      body: { ...existing, ...body, titulo },
      dataIso,
      intervalo,
      participantesTexto,
    }),
  )
  if (novasLinhas.length > 0) {
    const { error } = await supabase.from('agendamentos').insert(novasLinhas)
    if (error) return supabaseErrorResponse(error, 'Falha ao incluir participantes')
  }

  // Bloqueios sempre refeitos a partir do estado final (um por especialista do grupo).
  const idPorProfissional = new Map<string, string>([
    ...mantidos.map((l) => [l.profissional_id as string, l.id] as const),
    ...novasLinhas.map((l, i) => [novos[i].id, l.id] as const),
  ])
  await supabase.from('agenda_bloqueios').delete().in('agendamento_id', [...idPorProfissional.values()])
  const bloqueios = alvos
    .filter((a) => a.perfil === 'especialista')
    .map((alvo) =>
      bloqueioDoCompromisso({
        alvo,
        agendamentoId: idPorProfissional.get(alvo.id) as string,
        unidadeId,
        dataIso,
        intervalo,
        titulo,
        criadoPorId: userId,
      }),
    )
  if (bloqueios.length > 0) {
    const { error } = await supabase.from('agenda_bloqueios').insert(bloqueios)
    if (error) return supabaseErrorResponse(error, 'Falha ao atualizar o bloqueio da agenda')
  }
  if (plano.liberarSlotIds.length > 0) {
    await supabase.from('agendamentos').delete().in('id', plano.liberarSlotIds)
  }

  // Devolve as vagas da grade dos intervalos que deixaram de ser ocupados (horário antigo e quem saiu).
  const mudouIntervalo = dataAnterior !== dataIso || iniAnterior !== intervalo.inicioMin || fimAnterior !== intervalo.fimMin
  const liberar = [...removidos, ...(mudouIntervalo ? mantidos : [])]
  await devolverVagas(supabase, userId, liberar, perfisAntigos)
  return null
}

/** Exclui o compromisso de todos os participantes (os bloqueios saem em cascata) e devolve as vagas da grade. */
export async function excluirCompromisso(params: {
  supabase: Supabase
  userId: string
  existing: Record<string, unknown>
}): Promise<Response | null> {
  const { supabase, userId, existing } = params
  const { linhas, error: grupoError } = await carregarGrupo(supabase, existing as { id: unknown })
  if (grupoError) return supabaseErrorResponse(grupoError, 'Falha ao carregar o compromisso')
  const alvo = linhas.length > 0 ? linhas : [existing as unknown as LinhaGrupo]
  const perfis = await perfisDosProfissionais(
    supabase,
    alvo.map((l) => l.profissional_id).filter((id): id is string => Boolean(id)),
  )
  const { error } = await supabase.from('agendamentos').delete().in('id', alvo.map((l) => l.id))
  if (error) return supabaseErrorResponse(error, 'Falha ao excluir o compromisso')
  await devolverVagas(supabase, userId, alvo, perfis)
  return null
}

/** Organizador (cópia com id = grupo) e demais participantes de cada grupo, para a edição mostrar quem já foi escolhido. */
export async function participantesPorGrupo(supabase: Supabase, grupoIds: string[]) {
  const mapa = new Map<string, { organizadorId: string | null; participanteIds: string[] }>()
  const unicos = [...new Set(grupoIds)]
  const LOTE = 150
  const lotes: string[][] = []
  for (let i = 0; i < unicos.length; i += LOTE) lotes.push(unicos.slice(i, i + LOTE))
  const resultados = await Promise.all(
    lotes.map((lote) =>
      supabase.from('agendamentos').select('id,compromisso_grupo_id,profissional_id').in('compromisso_grupo_id', lote),
    ),
  )
  for (const { data } of resultados) {
    for (const row of data ?? []) {
      if (!row.profissional_id) continue
      const grupo = String(row.compromisso_grupo_id)
      const atual = mapa.get(grupo) ?? { organizadorId: null, participanteIds: [] }
      if (String(row.id) === grupo) atual.organizadorId = String(row.profissional_id)
      else atual.participanteIds.push(String(row.profissional_id))
      mapa.set(grupo, atual)
    }
  }
  return mapa
}
