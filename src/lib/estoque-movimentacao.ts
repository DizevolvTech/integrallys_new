import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type EstoqueRpcResult =
  | { ok: true; movimentacao_id?: string; quantidade?: number; status?: string }
  | { ok: false; code: string; message: string }

function asRpcResult(data: unknown, error: PostgrestError | null): EstoqueRpcResult {
  if (error) {
    return { ok: false, code: 'SUPABASE_QUERY_FAILED', message: error.message }
  }
  const row = (data ?? null) as EstoqueRpcResult | null
  if (!row || typeof row !== 'object' || !('ok' in row)) {
    return { ok: false, code: 'STOCK_RPC_INVALID', message: 'Resposta inválida do RPC de estoque' }
  }
  if (row.ok === true) return row
  return {
    ok: false,
    code: typeof row.code === 'string' ? row.code : 'STOCK_RPC_FAILED',
    message: typeof row.message === 'string' ? row.message : 'Falha na movimentação de estoque',
  }
}

export async function estoqueAplicarMovimentacao(
  supabase: SupabaseClient,
  params: {
    produtoId: string
    usuarioId: string
    tipo: 'entrada' | 'saida'
    quantidade: number
    tipoMovimentacao?: string | null
    observacoes?: string | null
    vinculoTipo?: string | null
    vinculoId?: string | null
    vinculoNome?: string | null
    numeroNf?: string | null
    cnpjEmitente?: string | null
    quantidadeAlvo?: number | null
    forceNf?: boolean
  },
): Promise<EstoqueRpcResult> {
  const { data, error } = await supabase.rpc('estoque_aplicar_movimentacao', {
    produto_id: params.produtoId,
    usuario_id: params.usuarioId,
    tipo: params.tipo,
    quantidade: params.quantidade,
    tipo_movimentacao: params.tipoMovimentacao ?? null,
    observacoes: params.observacoes ?? null,
    vinculo_tipo: params.vinculoTipo ?? null,
    vinculo_id: params.vinculoId ?? null,
    vinculo_nome: params.vinculoNome ?? null,
    numero_nf: params.numeroNf ?? null,
    cnpj_emitente: params.cnpjEmitente ?? null,
    quantidade_alvo: params.quantidadeAlvo ?? null,
    force_nf: params.forceNf === true,
  })
  return asRpcResult(data, error)
}

export type EntradaEstoqueParams = {
  produtoId: string
  usuarioId: string
  quantidade: number
  numeroNf?: string | null
  cnpjEmitente?: string | null
  fornecedorId?: string | null
  fornecedorNome?: string | null
  dataNf?: string | null
  precoCusto?: number | null
  lote?: string | null
  validade?: string | null
  observacoes?: string | null
  forceNf?: boolean
}

/** Entrada com NF/fornecedor/custo/lote/validade; atualiza o produto na mesma transação (migração 121). */
export async function estoqueRegistrarEntrada(
  supabase: SupabaseClient,
  params: EntradaEstoqueParams,
): Promise<EstoqueRpcResult> {
  const { data, error } = await supabase.rpc('estoque_registrar_entrada', {
    p_produto_id: params.produtoId,
    p_usuario_id: params.usuarioId,
    p_quantidade: params.quantidade,
    p_numero_nf: params.numeroNf ?? null,
    p_cnpj_emitente: params.cnpjEmitente ?? null,
    p_fornecedor_id: params.fornecedorId ?? null,
    p_fornecedor_nome: params.fornecedorNome ?? null,
    p_data_nf: params.dataNf ?? null,
    p_preco_custo: params.precoCusto ?? null,
    p_lote: params.lote ?? null,
    p_validade: params.validade ?? null,
    p_observacoes: params.observacoes ?? null,
    p_force_nf: params.forceNf === true,
  })
  return asRpcResult(data, error)
}

export async function estoqueEstornarMovimentacao(
  supabase: SupabaseClient,
  params: { movimentacaoId: string; usuarioId: string; motivo: string },
): Promise<EstoqueRpcResult> {
  const { data, error } = await supabase.rpc('estoque_estornar_movimentacao', {
    movimentacao_id: params.movimentacaoId,
    usuario_id: params.usuarioId,
    motivo: params.motivo,
  })
  return asRpcResult(data, error)
}

export function estoqueRpcHttpStatus(code: string): number {
  switch (code) {
    case 'PRODUCT_NOT_FOUND':
    case 'MOV_NOT_FOUND':
    case 'SUPRIMENTO_NOT_FOUND':
      return 404
    case 'MOV_ALREADY_REVERSED':
    case 'NF_DUPLICADA':
    case 'INSUFFICIENT_STOCK':
    case 'STOCK_INSUFFICIENT':
      return 409
    case 'SUPABASE_QUERY_FAILED':
    case 'STOCK_RPC_INVALID':
      return 500
    default:
      return 400
  }
}
