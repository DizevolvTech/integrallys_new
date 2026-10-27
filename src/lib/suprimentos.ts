import type { SupabaseClient } from '@supabase/supabase-js'

export type SuprimentoRpcResult = { ok: true; quantidade?: number } | { ok: false; code: string; message: string }

export const SUPRIMENTO_COLUNAS =
  'id,unidade_id,nome,categoria,sku,quantidade,estoque_minimo,status,lote,validade,preco_custo,unidade_medida,ativo'

export function mapSuprimento(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    categoria: String(row.categoria ?? 'Suprimento'),
    sku: row.sku ? String(row.sku) : undefined,
    quantidade: Number(row.quantidade ?? 0),
    estoqueMinimo: Number(row.estoque_minimo ?? 0),
    status: String(row.status ?? ''),
    lote: row.lote ? String(row.lote) : undefined,
    validade: row.validade ? String(row.validade).slice(0, 10) : undefined,
    precoCusto: row.preco_custo != null ? Number(row.preco_custo) : undefined,
    unidadeMedida: row.unidade_medida ? String(row.unidade_medida) : undefined,
    ativo: row.ativo !== false,
  }
}

export type SuprimentoItem = ReturnType<typeof mapSuprimento>

export async function suprimentoAplicarMovimentacao(
  supabase: SupabaseClient,
  params: {
    suprimentoId: string
    usuarioId: string
    tipo?: 'entrada' | 'saida'
    quantidade?: number
    motivo?: string | null
    lote?: string | null
    validade?: string | null
    precoCusto?: number | null
    quantidadeAlvo?: number | null
  },
): Promise<SuprimentoRpcResult> {
  const { data, error } = await supabase.rpc('suprimento_aplicar_movimentacao', {
    p_suprimento_id: params.suprimentoId,
    p_usuario_id: params.usuarioId,
    p_tipo: params.tipo ?? 'entrada',
    p_quantidade: params.quantidade ?? 0,
    p_motivo: params.motivo ?? null,
    p_origem: 'manual',
    p_lote: params.lote ?? null,
    p_validade: params.validade ?? null,
    p_preco_custo: params.precoCusto ?? null,
    p_quantidade_alvo: params.quantidadeAlvo ?? null,
  })
  if (error) return { ok: false, code: 'SUPABASE_QUERY_FAILED', message: error.message }
  const row = data as { ok?: boolean; code?: string; message?: string; quantidade?: number } | null
  if (row?.ok === true) return { ok: true, quantidade: row.quantidade }
  return { ok: false, code: row?.code ?? 'STOCK_RPC_FAILED', message: row?.message ?? 'Falha na movimentação' }
}

/** Soma o relatório de controle: entradas, saídas manuais, baixas de procedimento e custo consumido. */
export function resumirMovimentos(
  movimentos: Array<{ suprimento_id: string; tipo: string; origem: string; quantidade: number; custo?: number | null }>,
) {
  const porSuprimento = new Map<string, { entradas: number; saidas: number; consumoProcedimentos: number; custoConsumo: number }>()
  const totais = { entradas: 0, saidas: 0, baixasProcedimento: 0, custoConsumido: 0 }
  for (const m of movimentos) {
    const r = porSuprimento.get(m.suprimento_id) ?? { entradas: 0, saidas: 0, consumoProcedimentos: 0, custoConsumo: 0 }
    const q = Number(m.quantidade)
    if (m.tipo === 'entrada') {
      r.entradas += q
      totais.entradas += q
    } else {
      r.saidas += q
      totais.saidas += q
      const custo = Number(m.custo ?? 0) * q
      r.custoConsumo += custo
      totais.custoConsumido += custo
      if (m.origem === 'procedimento') {
        r.consumoProcedimentos += q
        totais.baixasProcedimento += q
      }
    }
    porSuprimento.set(m.suprimento_id, r)
  }
  totais.custoConsumido = Math.round(totais.custoConsumido * 100) / 100
  return { porSuprimento, totais }
}
