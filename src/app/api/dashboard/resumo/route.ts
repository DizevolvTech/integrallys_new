import { hojeIsoClinica } from '@/lib/fuso-clinica'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppSupabase, getEntityNameMap, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { requirePermission } from '@/lib/authz'
import { authErrorResponse, getRequestAuth } from '@/lib/request-auth'
import {
  RESUMO_CARDS,
  STATUS_DO_CARD,
  STATUS_SEM_ATENDIMENTO,
  brl,
  ehResumoCard,
  montarLinhaAgendamento,
  montarLinhaPrescricao,
  periodoDoMes,
  type AgendamentoResumoRow,
  type NomesResumo,
  type PrescricaoResumoRow,
  type ResumoCard,
  type ResumoLinha,
} from '../resumo'

// Janela de resumo de um card do início do especialista: uma consulta por card, sob demanda.
// Escopo sempre do próprio especialista (session.userId); os valores seguem a regra do painel
// "Minha performance" (receita em R$ já é exibida a ele; nada financeiro novo é aberto).

const PAGE_SIZE = 20
const LIMITE_RECEITA = 1000
const COLUNAS_AGENDAMENTO =
  'id,data_agendamento,horario_inicio,tipo,observacoes,valor_procedimento,atendimento_inicio_em,atendimento_fim_em,paciente_id,procedimento_id'
const FILTRO_PRESCRICAO_VENDA = 'tipo.ilike.%prescri%,tipo.ilike.%venda%'

interface Escopo {
  supabase: SupabaseClient
  userId: string
  de: string
  ate: string
  hoje: string
  page: number
}

function agendamentosDoCard(card: ResumoCard, { supabase, userId, de, ate, hoje }: Escopo) {
  const definicao = RESUMO_CARDS[card]
  const hojeApenas = definicao.periodo === 'hoje'
  let query = supabase
    .from('agendamentos')
    .select(COLUNAS_AGENDAMENTO, { count: 'exact' })
    .eq('profissional_id', userId)
    .not('paciente_id', 'is', null) // horários livres e bloqueios não são atendimento
    .gte('data_agendamento', hojeApenas ? hoje : de)
    .lte('data_agendamento', hojeApenas ? hoje : ate)
  const status = STATUS_DO_CARD[card]
  if (status) query = query.in('status', status)
  if (card === 'retornos') {
    query = query.ilike('tipo', 'retorno').not('status', 'in', `(${STATUS_SEM_ATENDIMENTO.join(',')})`)
  }
  return query
    .order('data_agendamento', { ascending: hojeApenas })
    .order('horario_inicio', { ascending: hojeApenas })
}

async function carregarNomes(supabase: SupabaseClient, userId: string, agendamentos: AgendamentoResumoRow[], prescricoes: PrescricaoResumoRow[]) {
  const [pacientes, procedimentos, especialista] = await Promise.all([
    getEntityNameMap(supabase, 'pacientes', [...agendamentos.map((r) => r.paciente_id ?? ''), ...prescricoes.map((r) => r.paciente_id ?? '')]),
    getEntityNameMap(supabase, 'procedimentos', agendamentos.map((r) => r.procedimento_id ?? '')),
    getEntityNameMap(supabase, 'usuarios', [userId]),
  ])
  const erro = pacientes.error ?? procedimentos.error ?? especialista.error
  const nomes: NomesResumo = { pacientes: pacientes.map, procedimentos: procedimentos.map, especialista: especialista.map[userId] || 'Especialista' }
  return { nomes, erro }
}

const prescricoesConvertidas = (supabase: SupabaseClient, userId: string, de: string, ate: string) =>
  supabase
    .from('prescricoes')
    .select('id,paciente_id,data_prescricao,valor_total', { count: 'exact' })
    .eq('profissional_id', userId)
    .eq('status', 'Convertida')
    .or(FILTRO_PRESCRICAO_VENDA)
    .gte('data_prescricao', de)
    .lte('data_prescricao', ate)

async function resumoPaginado(card: ResumoCard, escopo: Escopo) {
  const { supabase, userId, page } = escopo
  const inicio = (page - 1) * PAGE_SIZE
  const ate = inicio + PAGE_SIZE - 1
  if (card === 'prescricoes') {
    const { data, count, error } = await prescricoesConvertidas(supabase, userId, escopo.de, escopo.ate)
      .order('data_prescricao', { ascending: false })
      .range(inicio, ate)
    if (error) return { error }
    const prescricoes = (data ?? []) as PrescricaoResumoRow[]
    const { nomes, erro } = await carregarNomes(supabase, userId, [], prescricoes)
    if (erro) return { error: erro }
    return { linhas: prescricoes.map((r) => montarLinhaPrescricao(r, nomes)), total: count ?? 0 }
  }
  const { data, count, error } = await agendamentosDoCard(card, escopo).range(inicio, ate)
  if (error) return { error }
  const rows = (data ?? []) as unknown as AgendamentoResumoRow[]
  const { nomes, erro } = await carregarNomes(supabase, userId, rows, [])
  if (erro) return { error: erro }
  return { linhas: rows.map((r) => montarLinhaAgendamento(r, nomes)), total: count ?? 0 }
}

/** Receita gerada = atendimentos concluídos + prescrições convertidas do mês (a mesma conta do card). */
async function resumoReceita(escopo: Escopo) {
  const { supabase, userId, page } = escopo
  const [agendamentos, prescricoes] = await Promise.all([
    agendamentosDoCard('receita', escopo).limit(LIMITE_RECEITA),
    prescricoesConvertidas(supabase, userId, escopo.de, escopo.ate).limit(LIMITE_RECEITA),
  ])
  const erro = agendamentos.error ?? prescricoes.error
  if (erro) return { error: erro }
  const rowsAg = (agendamentos.data ?? []) as unknown as AgendamentoResumoRow[]
  const rowsPr = (prescricoes.data ?? []) as PrescricaoResumoRow[]
  const { nomes, erro: erroNomes } = await carregarNomes(supabase, userId, rowsAg, rowsPr)
  if (erroNomes) return { error: erroNomes }
  const todas = [
    ...rowsAg.map((r) => ({ ordem: `${r.data_agendamento}${r.horario_inicio ?? ''}`, valor: Number(r.valor_procedimento ?? 0), linha: montarLinhaAgendamento(r, nomes) })),
    ...rowsPr.map((r) => ({ ordem: `${r.data_prescricao ?? ''}`, valor: Number(r.valor_total ?? 0), linha: montarLinhaPrescricao(r, nomes) })),
  ].sort((a, b) => b.ordem.localeCompare(a.ordem))
  const inicio = (page - 1) * PAGE_SIZE
  return {
    linhas: todas.slice(inicio, inicio + PAGE_SIZE).map((item) => item.linha),
    total: todas.length,
    rodape: `Total: ${brl(todas.reduce((soma, item) => soma + item.valor, 0))}`,
  }
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request)
  if (!session) return authErrorResponse()
  const denied = await requirePermission(session.userId, 'dashboard', 'read')
  if (denied) return denied
  if (session.role !== 'especialista') return serverErrorResponse('Resumo disponível só para o especialista', 'FORBIDDEN', 403)

  const url = new URL(request.url)
  const card = url.searchParams.get('card')
  if (!ehResumoCard(card)) return serverErrorResponse('Card inválido', 'INVALID_CARD', 400)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)

  const hoje = hojeIsoClinica() // mesma data que o card usa (horário de Brasília)
  const { de, ate } = periodoDoMes(hoje)
  const escopo: Escopo = { supabase: getAppSupabase(), userId: session.userId, de, ate, hoje, page }
  const resultado = card === 'receita' ? await resumoReceita(escopo) : await resumoPaginado(card, escopo)
  if ('error' in resultado && resultado.error) return supabaseErrorResponse(resultado.error, 'Falha ao carregar o resumo')

  const definicao = RESUMO_CARDS[card]
  const { linhas, total, rodape } = resultado as { linhas: ResumoLinha[]; total: number; rodape?: string }
  return NextResponse.json({
    card,
    titulo: definicao.titulo,
    vazio: definicao.vazio,
    periodo: definicao.periodo === 'hoje' ? { de: hoje, ate: hoje } : { de, ate },
    colunas: definicao.colunas,
    linhas,
    total,
    page,
    pageSize: PAGE_SIZE,
    rodape,
  })
}
