import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { calcularDinheiroNaGaveta } from '@/features/caixa/fechamento'

// Saldos de caixa para o início (itens 38 e 52).
//  - Caixinha de troco = dinheiro físico que fica na gaveta: com o caixa aberto é
//    o dinheiro na gaveta agora (troco de abertura + entradas/saídas em dinheiro);
//    com o caixa fechado é o `saldo_restante` do fechamento (o que sobrou depois de
//    transferir ao cofre) — o mesmo valor que a tela do caixa chama de "Caixinha de troco".
//  - Cofre é outro saldo: soma de `cofre_movimentos` (transferências do fechamento).

export interface CaixaUnidade {
  unidadeId: string
  sessaoId: string
  status: string
  aberto: boolean
  /** Saldo do caixa (todas as formas): aberto = inicial + entradas − saídas; fechado = saldo final. */
  saldoCaixa: number
  /** Caixinha de troco (dinheiro na gaveta). */
  troco: number
  /** Saldo do cofre da unidade. */
  cofre: number
}

type Sessao = {
  id: string
  unidade_id: string | null
  status: string | null
  saldo_inicial: number | null
  saldo_final: number | null
  saldo_restante: number | null
  aberto_em: string | null
}
type Movimento = { unidade_id: string | null; tipo: string; valor: number; forma: string | null; data_movimento: string }

const round2 = (n: number) => Math.round(n * 100) / 100

export function montarCaixaUnidade(
  sessao: Sessao,
  movimentos: Movimento[],
  cofre: number,
): CaixaUnidade {
  const aberto = String(sessao.status ?? '') === 'aberto'
  const inicial = Number(sessao.saldo_inicial ?? 0)
  let saldoCaixa = Number(sessao.saldo_final ?? inicial)
  let troco = Number(sessao.saldo_restante ?? 0)
  if (aberto) {
    const desde = sessao.aberto_em ? Date.parse(sessao.aberto_em) : 0
    const doDia = movimentos
      .filter((m) => Date.parse(m.data_movimento) >= desde)
      .map((m) => ({ tipo: String(m.tipo), valor: Number(m.valor ?? 0), forma: m.forma }))
    saldoCaixa = round2(
      inicial + doDia.reduce((acc, m) => acc + (m.tipo === 'entrada' ? m.valor : m.tipo === 'saida' ? -m.valor : 0), 0),
    )
    troco = calcularDinheiroNaGaveta(inicial, doDia)
  }
  return {
    unidadeId: String(sessao.unidade_id),
    sessaoId: String(sessao.id),
    status: aberto ? 'aberto' : 'fechado',
    aberto,
    saldoCaixa: round2(saldoCaixa),
    troco: round2(troco),
    cofre: round2(cofre),
  }
}

/** Último caixa de cada unidade (`unidadeIds` null = todas). 3 consultas em paralelo, sem N+1. */
export async function carregarCaixasPorUnidade(
  supabase: SupabaseClient,
  unidadeIds: string[] | null,
): Promise<{ caixas: CaixaUnidade[]; error: PostgrestError | null }> {
  let sessoesQ = supabase
    .from('caixa_sessoes')
    .select('id,unidade_id,status,saldo_inicial,saldo_final,saldo_restante,aberto_em')
    .not('unidade_id', 'is', null)
    .order('aberto_em', { ascending: false })
    .limit(200)
  let cofreQ = supabase.from('cofre_movimentos').select('unidade_id,tipo,valor').not('unidade_id', 'is', null)
  if (unidadeIds) {
    sessoesQ = sessoesQ.in('unidade_id', unidadeIds)
    cofreQ = cofreQ.in('unidade_id', unidadeIds)
  }
  const [sessoesR, cofreR] = await Promise.all([sessoesQ, cofreQ])
  const error = sessoesR.error ?? cofreR.error
  if (error) return { caixas: [], error }

  const ultima = new Map<string, Sessao>()
  for (const row of (sessoesR.data ?? []) as Sessao[]) {
    const key = String(row.unidade_id)
    if (!ultima.has(key)) ultima.set(key, row)
  }
  const cofrePorUnidade = new Map<string, number>()
  for (const row of cofreR.data ?? []) {
    const key = String(row.unidade_id)
    cofrePorUnidade.set(key, (cofrePorUnidade.get(key) ?? 0) + (row.tipo === 'saida' ? -1 : 1) * Number(row.valor ?? 0))
  }

  const abertas = [...ultima.values()].filter((s) => s.status === 'aberto' && s.aberto_em)
  let movimentos: Movimento[] = []
  if (abertas.length > 0) {
    const desde = abertas.map((s) => String(s.aberto_em)).sort()[0] as string
    const movR = await supabase
      .from('caixa_movimentos')
      .select('unidade_id,tipo,valor,forma,data_movimento')
      .in('unidade_id', abertas.map((s) => String(s.unidade_id)))
      .gte('data_movimento', desde)
    if (movR.error) return { caixas: [], error: movR.error }
    movimentos = (movR.data ?? []) as Movimento[]
  }

  const caixas = [...ultima.values()].map((sessao) =>
    montarCaixaUnidade(
      sessao,
      movimentos.filter((m) => String(m.unidade_id) === String(sessao.unidade_id)),
      cofrePorUnidade.get(String(sessao.unidade_id)) ?? 0,
    ),
  )
  return { caixas, error: null }
}
