import { type NextRequest, NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth, getScopedUnitId } from '@/lib/request-auth'
import { gerarSlots, type HorarioRegra } from './gerar-slots'

interface GerarBody {
  especialistaId?: unknown
  dataInicio?: unknown
  dataFim?: unknown
  // diasSemana agora é FILTRO opcional (interseção com a grade do profissional);
  // horarioInicio/horarioFim/intervalos do formulário não são mais usados — a
  // janela e a duração vêm de profissional_horarios (migration 079).
  diasSemana?: unknown
  considerarFeriados?: unknown
  // Dias avulsos YYYY-MM-DD (ex.: só 3 dias do mês). Se informado, substitui período + dias da semana.
  datasAvulsas?: unknown
}

const MAX_DATAS_AVULSAS = 366

function parseDateLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (Number.isNaN(date.getTime())) return null
  return date
}

// Enumera as datas YYYY-MM-DD do período que casam com o filtro de dias da semana
// (null = todos os dias). Espelha o cursor de gerarSlots para alinhar o escopo da
// limpeza (item 13) com o da geração.
function enumerarDatas(
  dataInicio: Date,
  dataFim: Date,
  diasSemanaFiltro: number[] | null,
): string[] {
  const filtro = diasSemanaFiltro && diasSemanaFiltro.length > 0 ? new Set(diasSemanaFiltro) : null
  const datas: string[] = []
  const cursor = new Date(dataInicio.getTime())
  while (cursor.getTime() <= dataFim.getTime()) {
    if (!filtro || filtro.has(cursor.getDay())) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      datas.push(`${y}-${m}-${d}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return datas
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'agenda', 'create')
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as GerarBody | null
  if (!body) return serverErrorResponse('Corpo inválido', 'INVALID_BODY', 400)

  const especialistaId = typeof body.especialistaId === 'string' ? body.especialistaId.trim() : ''
  const dataInicioStr = typeof body.dataInicio === 'string' ? body.dataInicio : ''
  const dataFimStr = typeof body.dataFim === 'string' ? body.dataFim : ''
  const diasSemanaRaw = Array.isArray(body.diasSemana) ? body.diasSemana : []
  const considerarFeriados = body.considerarFeriados !== false

  if (!especialistaId) {
    return serverErrorResponse('Especialista é obrigatório', 'INVALID_PARAMS', 400)
  }

  const avulsasRaw = Array.isArray(body.datasAvulsas) ? body.datasAvulsas : []
  const avulsasStrs = Array.from(
    new Set(avulsasRaw.filter((v): v is string => typeof v === 'string')),
  )
  const datasAvulsas = avulsasStrs.map(parseDateLocal)
  if (avulsasRaw.length > 0 && (datasAvulsas.some((d) => !d) || avulsasStrs.length > MAX_DATAS_AVULSAS)) {
    return serverErrorResponse('Dias avulsos inválidos', 'INVALID_PARAMS', 400)
  }
  const avulsas = datasAvulsas.filter((d): d is Date => d !== null)
  const usaAvulsas = avulsas.length > 0

  // Com dias avulsos o período é derivado do menor/maior dia escolhido.
  const ordenadas = [...avulsas].sort((x, y) => x.getTime() - y.getTime())
  const dataInicio = usaAvulsas ? ordenadas[0] : parseDateLocal(dataInicioStr)
  const dataFim = usaAvulsas ? ordenadas[ordenadas.length - 1] : parseDateLocal(dataFimStr)
  if (!dataInicio || !dataFim) {
    return serverErrorResponse('Datas inválidas', 'INVALID_PARAMS', 400)
  }
  if (dataFim < dataInicio) {
    return serverErrorResponse('Data final anterior à inicial', 'INVALID_PARAMS', 400)
  }

  // diasSemana é apenas FILTRO (interseção). Vazio = sem restrição (toda a grade).
  const diasSemana = diasSemanaRaw
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  const diasSemanaFiltro = !usaAvulsas && diasSemana.length > 0 ? diasSemana : null

  const supabase = getAppSupabase()

  const { data: especialistaRow, error: especialistaError } = await supabase
    .from('usuarios')
    .select('id,unidade_id,perfil')
    .eq('id', especialistaId)
    .maybeSingle()

  if (especialistaError) {
    return supabaseErrorResponse(especialistaError, 'Falha ao localizar especialista')
  }
  if (especialistaRow?.perfil !== 'especialista') {
    return serverErrorResponse('Especialista não encontrado', 'INVALID_PARAMS', 400)
  }

  const unidadeId = especialistaRow.unidade_id ? String(especialistaRow.unidade_id) : null

  // SEC — chamador escopado (gestor/recepção/especialista) só gera agenda da PRÓPRIA
  // unidade. Sem isto, um gestor da Unidade A poderia gerar agenda de um profissional
  // da Unidade B sabendo o especialistaId (mesmo IDOR de excluir/gerar-contrato).
  // master/admin têm scopedUnit null → sem restrição.
  const scopedUnit = await getScopedUnitId(session)
  if (scopedUnit.error) {
    return supabaseErrorResponse(scopedUnit.error, 'Falha ao identificar unidade do usuário')
  }
  if (scopedUnit.unidadeId && scopedUnit.unidadeId !== unidadeId) {
    return serverErrorResponse('Profissional de outra unidade', 'UNIT_MISMATCH', 403)
  }

  // Grade do profissional (migration 079) — fonte dos dias/janelas/duração.
  const { data: horariosRows, error: horariosError } = await supabase
    .from('profissional_horarios')
    .select('dia_semana,turno,hora_inicio,hora_fim,duracao_min,ativo')
    .eq('profissional_id', especialistaId)
    .eq('ativo', true)

  if (horariosError) {
    return supabaseErrorResponse(horariosError, 'Falha ao carregar horários do profissional')
  }

  const horarios: HorarioRegra[] = (horariosRows ?? []).map((row) => ({
    dia_semana: Number(row.dia_semana),
    turno: row.turno === 'tarde' ? 'tarde' : 'manha',
    hora_inicio: String(row.hora_inicio ?? ''),
    hora_fim: String(row.hora_fim ?? ''),
    duracao_min: Number(row.duracao_min),
    ativo: row.ativo !== false,
  }))

  if (horarios.length === 0) {
    return serverErrorResponse(
      'Nenhum horário cadastrado para este profissional. Cadastre a grade de horários em Profissionais antes de gerar a agenda.',
      'SEM_HORARIO_CADASTRADO',
      422,
    )
  }

  const { slots, puladosFeriado, alertas } = gerarSlots({
    horarios,
    dataInicio,
    dataFim,
    diasSemanaFiltro,
    considerarFeriados,
    datasAvulsas: usaAvulsas ? avulsas : null,
  })

  let pulados = puladosFeriado

  if (slots.length === 0) {
    return NextResponse.json({ gerados: 0, pulados, alertas })
  }

  // Item 13 — regeneração idempotente: antes de inserir, remove os slots LIVRES
  // (status='Disponível' E paciente_id null) do profissional no período e dias
  // solicitados. Nunca toca em linha com paciente vinculado nem em outro status,
  // então agendamentos reais ficam preservados. Sem esta limpeza, regerar com uma
  // duração nova deixava os slots antigos (ex.: 60min) intactos ao lado dos novos.
  //
  // Escopo por unidade_id ESPELHA o que a geração grava (unidadeId da unidade
  // principal do profissional). Como um profissional pode atuar em >1 unidade
  // (item 7a / profissional_unidades), limpar sem esse filtro apagaria os
  // 'Disponível' dele em OUTRAS unidades nas mesmas datas. unidadeId null precisa
  // de IS NULL (`.eq(col, null)` nunca casa no PostgREST).
  const datasParaLimpar = usaAvulsas
    ? avulsasStrs
    : enumerarDatas(dataInicio, dataFim, diasSemanaFiltro)
  if (datasParaLimpar.length > 0) {
    const limpezaQuery = supabase
      .from('agendamentos')
      .delete()
      .eq('profissional_id', especialistaId)
      .in('data_agendamento', datasParaLimpar)
      .eq('status', 'Disponível')
      .is('paciente_id', null)
    const { error: limpezaError } = await (unidadeId
      ? limpezaQuery.eq('unidade_id', unidadeId)
      : limpezaQuery.is('unidade_id', null))
    if (limpezaError) {
      return supabaseErrorResponse(limpezaError, 'Falha ao limpar agenda anterior do período')
    }
  }

  const datasUnicas = Array.from(new Set(slots.map((s) => s.data)))
  const { data: existentes, error: existentesError } = await supabase
    .from('agendamentos')
    .select('data_agendamento,horario_inicio')
    .eq('profissional_id', especialistaId)
    .in('data_agendamento', datasUnicas)

  if (existentesError) {
    return supabaseErrorResponse(existentesError, 'Falha ao verificar agendamentos existentes')
  }

  const existentesSet = new Set(
    (existentes ?? []).map(
      (row) =>
        `${String(row.data_agendamento ?? '')}|${String(row.horario_inicio ?? '').slice(0, 5)}`,
    ),
  )

  const novos: Array<Record<string, unknown>> = []
  for (const s of slots) {
    const key = `${s.data}|${s.horario_inicio}`
    if (existentesSet.has(key)) {
      pulados += 1
      continue
    }
    existentesSet.add(key)
    novos.push({
      profissional_id: especialistaId,
      data_agendamento: s.data,
      horario_inicio: s.horario_inicio,
      horario_fim: s.horario_fim,
      status: 'Disponível',
      unidade_id: unidadeId,
      paciente_id: null,
      criado_por_id: session.userId,
      tipo: null,
      titulo: null,
    })
  }

  if (novos.length === 0) {
    return NextResponse.json({ gerados: 0, pulados, alertas })
  }

  const { error: insertError } = await supabase.from('agendamentos').insert(novos)
  if (insertError) {
    return supabaseErrorResponse(insertError, 'Falha ao gerar agenda')
  }

  return NextResponse.json({ gerados: novos.length, pulados, alertas })
}
