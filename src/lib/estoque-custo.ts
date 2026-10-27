/**
 * Custo e margem de estoque são do gestor: recepção vende, mas não vê quanto o produto custa.
 * A decisão é sempre no servidor — a tela só esconde o que a API omitiu.
 */
const PERFIS_COM_CUSTO = ['master', 'admin', 'gestor']

export function perfilVeCustoEstoque(role?: string | null): boolean {
  return PERFIS_COM_CUSTO.includes(String(role ?? ''))
}

/** Produto de estoque sem custo (preço de venda permanece). */
export function removerCustoProduto<T extends { precoCusto?: number }>(item: T, role?: string | null): T {
  if (perfilVeCustoEstoque(role)) return item
  const { precoCusto: _custo, ...resto } = item
  return resto as T
}

const CHAVES_CUSTO = new Set(['custo', 'margem', 'margemPct', 'totalCusto'])

function semChavesDeCusto(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semChavesDeCusto)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([chave]) => !CHAVES_CUSTO.has(chave))
        .map(([chave, v]) => [chave, semChavesDeCusto(v)]),
    )
  }
  return valor
}

/** Linhas e totais dos relatórios de Estoque sem custo/margem para quem não é da gestão. */
export function removerCustoRelatorio<L extends Record<string, unknown>>(
  rows: L[],
  totais: Record<string, unknown>,
  role?: string | null,
): { rows: L[]; totais: Record<string, unknown>; custoOculto: boolean } {
  if (perfilVeCustoEstoque(role)) return { rows, totais, custoOculto: false }
  return {
    rows: semChavesDeCusto(rows) as L[],
    totais: semChavesDeCusto(totais) as Record<string, unknown>,
    custoOculto: true,
  }
}
