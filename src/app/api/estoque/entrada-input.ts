import type { getAppSupabase } from '@/lib/app-api'
import type { EntradaEstoqueParams } from '@/lib/estoque-movimentacao'

type Supabase = ReturnType<typeof getAppSupabase>

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

const texto = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/**
 * Item 30: valida os campos próprios da entrada (NF, fornecedor do cadastro, data, custo, lote,
 * validade). O fornecedor vem do cadastro de fornecedores — nome e CNPJ são lidos no servidor,
 * não do texto digitado.
 */
export async function montarEntrada(
  supabase: Supabase,
  body: Record<string, unknown>,
  base: Pick<EntradaEstoqueParams, 'produtoId' | 'usuarioId' | 'quantidade' | 'numeroNf' | 'cnpjEmitente' | 'forceNf'>,
): Promise<{ ok: true; params: EntradaEstoqueParams } | { ok: false; error: string; code: string }> {
  const dataNf = texto(body.dataNf, 10)
  if (dataNf && !DATA_ISO.test(dataNf)) return { ok: false, error: 'Data da NF inválida', code: 'INVALID_DATA_NF' }
  const validade = texto(body.validade, 10)
  if (validade && !DATA_ISO.test(validade)) return { ok: false, error: 'Validade inválida', code: 'INVALID_VALIDADE' }

  let precoCusto: number | null = null
  if (body.precoCusto != null && body.precoCusto !== '') {
    precoCusto = Number(body.precoCusto)
    if (!Number.isFinite(precoCusto) || precoCusto < 0 || precoCusto > 9_999_999) {
      return { ok: false, error: 'Preço de custo inválido', code: 'INVALID_CUSTO' }
    }
    precoCusto = Math.round(precoCusto * 100) / 100
  }

  let fornecedorId: string | null = null
  let fornecedorNome: string | null = null
  let cnpjEmitente = base.cnpjEmitente ?? null
  const fornecedorRaw = texto(body.fornecedorId, 40)
  if (fornecedorRaw) {
    if (!UUID.test(fornecedorRaw)) return { ok: false, error: 'Fornecedor inválido', code: 'INVALID_FORNECEDOR' }
    const { data, error } = await supabase
      .from('pacientes')
      .select('id,nome,fornecedor_dados')
      .eq('id', fornecedorRaw)
      .contains('vinculo_tipos', ['fornecedor'])
      .maybeSingle()
    if (error) return { ok: false, error: 'Falha ao validar o fornecedor', code: 'SUPABASE_QUERY_FAILED' }
    if (!data) return { ok: false, error: 'Fornecedor não encontrado no cadastro', code: 'INVALID_FORNECEDOR' }
    fornecedorId = String(data.id)
    fornecedorNome = String(data.nome ?? '')
    const cnpj = (data.fornecedor_dados as { cnpj?: string } | null)?.cnpj
    if (!cnpjEmitente && cnpj) cnpjEmitente = String(cnpj).replace(/\D/g, '') || null
  }

  return {
    ok: true,
    params: {
      ...base,
      cnpjEmitente,
      fornecedorId,
      fornecedorNome,
      dataNf,
      precoCusto,
      lote: texto(body.lote, 60),
      validade,
      observacoes: texto(body.observacoes, 500),
    },
  }
}
