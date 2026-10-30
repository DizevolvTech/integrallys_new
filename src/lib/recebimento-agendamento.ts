import type { SupabaseClient } from '@supabase/supabase-js'
import { buildMetodoLabel, pagamentoAgendamentoRow, type PagamentoAgendamentoResolved } from '@/lib/agendamento-pagamento'
import { getAppSupabase } from '@/lib/app-api'
import { type getRequestAuth, getScopedUnitId, isScopedRole } from '@/lib/request-auth'

type Session = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

export type FormaCaixa = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'transferencia'

/** Método escolhido na cobrança (texto da tela) → forma usada no caixa. */
export function metodoParaFormaCaixa(metodo: string): FormaCaixa {
  const m = metodo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (m.includes('pix')) return 'pix'
  if (m.includes('credito')) return 'cartao_credito'
  if (m.includes('debito')) return 'cartao_debito'
  if (m.includes('transfer')) return 'transferencia'
  return 'dinheiro'
}

export function hojeClinica(agora: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

/**
 * Unidade do caixa da sessão. Perfis com unidade (recepção, gestor…) nunca
 * escolhem outra unidade pelo corpo da requisição.
 */
export async function resolverUnidadeCaixa(session: Session, requestedUnitId: unknown) {
  const scoped = await getScopedUnitId(session)
  if (scoped.error) return { unitId: null as string | null, error: scoped.error }
  if (isScopedRole(session.role)) return { unitId: scoped.unidadeId ?? null, error: null }

  const requested = typeof requestedUnitId === 'string' && requestedUnitId.trim() ? requestedUnitId.trim() : null
  if (requested) return { unitId: requested, error: null }
  if (session.user?.unidadeId) return { unitId: String(session.user.unidadeId), error: null }

  const first = await getAppSupabase()
    .from('unidades')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (first.error) return { unitId: null, error: first.error }
  return { unitId: first.data?.id ? String(first.data.id) : null, error: null }
}

/**
 * Vídeo de 26/10: recepção recebia "Acesso negado" ao confirmar o recebimento
 * na agenda (a tela gravava o lançamento financeiro direto, permissão que a
 * recepção não tem). Agora o servidor registra tudo numa só chamada com a
 * permissão da agenda: pagamento do agendamento, lançamento financeiro pago e,
 * com caixa aberto, a entrada no caixa do dia (para depois sangria/cofre).
 */
export async function registrarRecebimentoAgendamento(
  supabase: SupabaseClient,
  session: Session,
  params: {
    agendamentoId: string
    resolved: PagamentoAgendamentoResolved
    descricao: string
    beneficiario: string | null
  },
) {
  const { agendamentoId, resolved } = params
  const { unitId, error: unitError } = await resolverUnidadeCaixa(session, null)
  if (unitError) return { error: unitError, caixaRegistrado: false }

  const { data: pagamento, error: pagamentoError } = await supabase
    .from('agendamentos_pagamentos')
    .insert(pagamentoAgendamentoRow({ agendamentoId, ...resolved }))
    .select('id')
    .single()
  if (pagamentoError) return { error: pagamentoError, caixaRegistrado: false }

  const agora = new Date().toISOString()
  const forma = metodoParaFormaCaixa(resolved.metodo)
  // Vínculos usados pelos filtros de Recebimentos (cliente, profissional, especialidade, forma).
  const [{ data: agendamento }, { data: formaCatalogo }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('paciente_id,profissional_id,procedimento_id')
      .eq('id', agendamentoId)
      .maybeSingle(),
    supabase.from('formas_pagamento').select('id').eq('tipo', forma).eq('ativo', true).is('cartao_id', null).limit(1).maybeSingle(),
  ])
  const hoje = hojeClinica()
  const { error: lancamentoError } = await supabase.from('financeiro_lancamentos').insert({
    agendamento_id: agendamentoId,
    pagamento_agendamento_id: pagamento?.id ?? null,
    paciente_id: agendamento?.paciente_id ?? null,
    profissional_id: agendamento?.profissional_id ?? null,
    procedimento_id: agendamento?.procedimento_id ?? null,
    forma_pagamento_id: formaCatalogo?.id ?? null,
    data_emissao: hoje,
    data_liquidacao: hoje,
    vencimento: hoje,
    unidade_id: unitId,
    usuario_id: session.userId,
    descricao: params.descricao,
    categoria: 'Consultas',
    valor: resolved.valor,
    tipo: 'receita',
    data_lancamento: agora,
    competencia: hoje,
    metodo: buildMetodoLabel(resolved),
    status: 'Pago',
    observacoes: resolved.observacoes,
    conta_bancaria_id: resolved.contaBancariaId,
    beneficiario: params.beneficiario,
    parcelas: resolved.parcelas ?? 1,
  })
  if (lancamentoError) {
    // Sem lançamento o recebimento ficaria pela metade: desfaz o pagamento.
    if (pagamento?.id) await supabase.from('agendamentos_pagamentos').delete().eq('id', pagamento.id)
    return { error: lancamentoError, caixaRegistrado: false }
  }

  if (!unitId) return { error: null, caixaRegistrado: false }
  const { data: sessao } = await supabase
    .from('caixa_sessoes')
    .select('id,status')
    .eq('unidade_id', unitId)
    .eq('data_operacao', hojeClinica())
    .order('aberto_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sessao?.status !== 'aberto') return { error: null, caixaRegistrado: false }

  const { error: caixaError } = await supabase.from('caixa_movimentos').insert({
    unidade_id: unitId,
    usuario_id: session.userId,
    operador_id: session.userId,
    sessao_id: sessao.id,
    descricao: params.descricao,
    tipo: 'entrada',
    valor: resolved.valor,
    forma,
    origem: 'agendamento',
    pagamento_agendamento_id: pagamento?.id ?? null,
    operador_nome: session.user?.name || null,
    data_movimento: agora,
    bandeira: forma === 'cartao_credito' || forma === 'cartao_debito' ? resolved.bandeira : null,
    parcelas: forma === 'cartao_credito' ? resolved.parcelas : null,
  })
  if (caixaError) {
    console.error('[agenda/pagamentos] recebimento salvo, mas falhou a entrada no caixa', caixaError)
    return { error: null, caixaRegistrado: false }
  }
  return { error: null, caixaRegistrado: true }
}
