import type { SupabaseClient } from '@supabase/supabase-js'
import {
  filtrarRecebimentosCaixa,
  filtrarSaldos,
  mapLancamentoConta,
  recebimentoCaixaConta,
  saldoAgendamentoConta,
  type ContaItem,
  type FiltrosContas,
} from '@/lib/financeiro-contas'
import { hojeClinica } from '@/lib/recebimento-agendamento'

const LIMITE = 1000
const LOTE = 150
const STATUS_SEM_SALDO = ['Cancelado', 'Faltou', 'Disponível', 'Bloqueado', 'Adiado']

const COLUNAS =
  'id,descricao,categoria,valor,tipo,data_lancamento,metodo,status,vencimento,data_emissao,numero_documento,beneficiario,parcelas,parcela_atual,forma_pagamento_id,dre_categoria_id,profissional_id,procedimento_id,data_referencia'

type Contexto = { supabase: SupabaseClient; unidadeId: string | null; hoje: string }

type Recorte = {
  /** Intervalo em data_referencia (quando houver). */
  de: string | null
  ate: string | null
  /** Só contas em aberto e vencidas antes de hoje (card "atrasado" sem período). */
  soAtrasadas?: boolean
}

function seguro(texto: string) {
  return texto.replace(/[%,()*\\]/g, ' ').trim()
}

async function catalogoFormas(supabase: SupabaseClient) {
  const { data } = await supabase.from('formas_pagamento').select('id,nome')
  return new Map((data ?? []).map((row) => [String(row.id), String(row.nome)]))
}

async function contarAnexos(supabase: SupabaseClient, ids: string[]) {
  const contagem = new Map<string, number>()
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data } = await supabase
      .from('financeiro_anexos')
      .select('lancamento_id')
      .in('lancamento_id', ids.slice(i, i + LOTE))
    for (const row of data ?? []) {
      const id = String(row.lancamento_id)
      contagem.set(id, (contagem.get(id) ?? 0) + 1)
    }
  }
  return contagem
}

async function lancamentos(ctx: Contexto, filtros: FiltrosContas, recorte: Recorte, formas: Map<string, string>) {
  let query = ctx.supabase
    .from('financeiro_lancamentos')
    .select(COLUNAS)
    .eq('tipo', filtros.tipo)
    .order('data_referencia', { ascending: false })
    .limit(LIMITE)

  if (ctx.unidadeId) query = query.eq('unidade_id', ctx.unidadeId)
  if (recorte.de) query = query.gte('data_referencia', recorte.de)
  if (recorte.ate) query = query.lte('data_referencia', recorte.ate)
  if (recorte.soAtrasadas) {
    query = query.eq('liquidado', false).eq('cancelado', false).lt('data_referencia', ctx.hoje)
  }
  if (filtros.situacao === 'liquidado') query = query.eq('liquidado', true)
  if (filtros.situacao === 'a_vencer') {
    query = query.eq('liquidado', false).eq('cancelado', false).gte('data_referencia', ctx.hoje)
  }
  if (filtros.situacao === 'atrasado') {
    query = query.eq('liquidado', false).eq('cancelado', false).lt('data_referencia', ctx.hoje)
  }
  const pessoa = seguro(filtros.pessoa)
  if (pessoa) query = query.or(`beneficiario.ilike.%${pessoa}%,descricao.ilike.%${pessoa}%`)
  const produto = seguro(filtros.produto)
  if (produto) query = query.or(`descricao.ilike.%${produto}%,observacoes.ilike.%${produto}%`)
  if (filtros.formaId) {
    const nome = seguro(formas.get(filtros.formaId) ?? '')
    query = query.or(
      nome
        ? `forma_pagamento_id.eq.${filtros.formaId},metodo.ilike.%${nome}%`
        : `forma_pagamento_id.eq.${filtros.formaId}`,
    )
  }
  if (filtros.categoriaId) query = query.eq('dre_categoria_id', filtros.categoriaId)
  if (filtros.profissionalId) query = query.eq('profissional_id', filtros.profissionalId)
  if (filtros.procedimentoId) query = query.eq('procedimento_id', filtros.procedimentoId)

  const { data, error } = await query
  if (error) return { error, itens: [] as ContaItem[] }
  const linhas = (data ?? []) as unknown as Record<string, unknown>[]
  const anexos = filtros.tipo === 'despesa' ? await contarAnexos(ctx.supabase, linhas.map((l) => String(l.id))) : new Map()
  return { error: null, itens: linhas.map((row) => mapLancamentoConta(row, { hoje: ctx.hoje, formas, anexos })) }
}

async function saldosAgendamentos(ctx: Contexto) {
  const { data: resumo, error } = await ctx.supabase
    .from('v_agendamento_pagamento_resumo')
    .select('agendamento_id,total_pago,valor_devido')
    .eq('situacao', 'Parcial')
    .limit(LIMITE)
  if (error) return { error, itens: [] as ContaItem[] }

  const porId = new Map((resumo ?? []).map((row) => [String(row.agendamento_id), row]))
  const ids = [...porId.keys()]
  const itens: ContaItem[] = []
  for (let i = 0; i < ids.length; i += LOTE) {
    let query = ctx.supabase
      .from('agendamentos')
      .select('id,data_agendamento,status,profissional_id,procedimento_id,unidade_id,pacientes(nome),procedimentos(nome)')
      .in('id', ids.slice(i, i + LOTE))
      .not('status', 'in', `(${STATUS_SEM_SALDO.map((s) => `"${s}"`).join(',')})`)
    if (ctx.unidadeId) query = query.eq('unidade_id', ctx.unidadeId)
    const { data, error: agError } = await query
    if (agError) return { error: agError, itens: [] as ContaItem[] }
    for (const ag of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      const valores = porId.get(String(ag.id))
      const paciente = ag.pacientes as { nome?: string } | null
      const procedimento = ag.procedimentos as { nome?: string } | null
      const item = saldoAgendamentoConta({
        agendamentoId: String(ag.id),
        paciente: paciente?.nome ?? null,
        procedimento: procedimento?.nome ?? null,
        procedimentoId: ag.procedimento_id ? String(ag.procedimento_id) : null,
        profissionalId: ag.profissional_id ? String(ag.profissional_id) : null,
        dataAgendamento: String(ag.data_agendamento),
        valorDevido: Number(valores?.valor_devido ?? 0),
        totalPago: Number(valores?.total_pago ?? 0),
        hoje: ctx.hoje,
      })
      if (item) itens.push(item)
    }
  }
  return { error: null, itens }
}

/** Recebimentos lançados direto no Caixa (manual / online). Os da agenda e das vendas já entram por lançamento. */
async function recebimentosCaixa(ctx: Contexto, recorte: Recorte) {
  let query = ctx.supabase
    .from('caixa_movimentos')
    .select('id,descricao,valor,forma,bandeira,parcelas,data_movimento')
    .eq('tipo', 'entrada')
    .in('origem', ['manual', 'pagamento_online'])
    .not('descricao', 'ilike', 'suprimento%')
    .order('data_movimento', { ascending: false })
    .limit(LIMITE)
  if (ctx.unidadeId) query = query.eq('unidade_id', ctx.unidadeId)
  // Recorte em dias de Brasília (UTC-3), não em dias UTC.
  if (recorte.de) query = query.gte('data_movimento', `${recorte.de}T00:00:00-03:00`)
  if (recorte.ate) query = query.lte('data_movimento', `${recorte.ate}T23:59:59.999-03:00`)
  const { data, error } = await query
  if (error) return { error, itens: [] as ContaItem[] }
  const itens = (data ?? []).map((row) =>
    recebimentoCaixaConta({
      id: String(row.id),
      descricao: String(row.descricao ?? 'Recebimento no caixa'),
      valor: Number(row.valor ?? 0),
      forma: row.forma ? String(row.forma) : null,
      bandeira: row.bandeira ? String(row.bandeira) : null,
      parcelas: row.parcelas == null ? null : Number(row.parcelas),
      dia: hojeClinica(new Date(String(row.data_movimento))),
    }),
  )
  return { error: null, itens }
}

/** Contas do tipo pedido dentro do recorte: lançamentos + (recebimentos) saldo de agendamentos. */
export async function buscarContas(ctx: Contexto, filtros: FiltrosContas, recorte: Recorte) {
  const formas = await catalogoFormas(ctx.supabase)
  const receita = filtros.tipo === 'receita'
  const vazio = Promise.resolve({ error: null, itens: [] as ContaItem[] })
  const [lanc, saldos, caixa] = await Promise.all([
    lancamentos(ctx, filtros, recorte, formas),
    receita ? saldosAgendamentos(ctx) : vazio,
    // Recebimento do caixa só é "liquidado": fora de a vencer/atrasado e das contas só de atraso.
    receita && !recorte.soAtrasadas && filtros.situacao !== 'a_vencer' && filtros.situacao !== 'atrasado'
      ? recebimentosCaixa(ctx, recorte)
      : vazio,
  ])
  const error = lanc.error ?? saldos.error ?? caixa.error
  if (error) return { error, itens: [] as ContaItem[], formas }

  const saldosFiltrados = filtrarSaldos(saldos.itens, {
    ...filtros,
    de: recorte.de,
    ate: recorte.ate,
  }).filter((item) => !recorte.soAtrasadas || item.situacao === 'atrasado')
  const caixaFiltrado = filtrarRecebimentosCaixa(caixa.itens, filtros)
  const itens = [...lanc.itens, ...saldosFiltrados, ...caixaFiltrado].sort((a, b) => b.dataReferencia.localeCompare(a.dataReferencia))
  return { error: null, itens, formas }
}
