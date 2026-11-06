// Agregação do resumo do caixa ("Por forma de pagamento"): uma única regra para a tela, o servidor e os testes.

export type FormaCaixaCanonica = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'transferencia'

export interface MovimentoResumo {
  tipo: string
  valor: number
  forma?: string | null
  contaBancariaNome?: string | null
}

export interface LinhaFormaResumo {
  forma: FormaCaixaCanonica
  label: string
  value: number
  /** Só PIX: uma linha por conta (ex.: "PIX · Sicredi"). */
  contas?: { label: string; value: number }[]
}

const ROTULOS: Record<FormaCaixaCanonica, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão crédito',
  cartao_debito: 'Cartão débito',
  transferencia: 'Transferência',
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Aceita o texto antigo ("credito", "Dinheiro", vazio) e devolve a forma canônica do caixa. */
export function normalizarFormaCaixa(forma?: string | null): FormaCaixaCanonica {
  const texto = (forma ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  switch (texto) {
    case 'pix':
      return 'pix'
    case 'cartao_credito':
    case 'credito':
    case 'cartao_de_credito':
      return 'cartao_credito'
    case 'cartao_debito':
    case 'debito':
    case 'cartao_de_debito':
      return 'cartao_debito'
    case 'transferencia':
      return 'transferencia'
    default:
      return 'dinheiro'
  }
}

export const SEM_CONTA_PIX = 'Sem conta informada'

/**
 * Soma das entradas por forma. Dinheiro, PIX, crédito e débito sempre aparecem; Transferência só quando houver valor.
 * A soma das linhas é sempre igual ao total de entradas (nenhuma forma fica de fora).
 */
export function resumoPorForma(movimentos: MovimentoResumo[]): { linhas: LinhaFormaResumo[]; totalEntradas: number } {
  const totais = new Map<FormaCaixaCanonica, number>()
  const pixContas = new Map<string, number>()
  let totalEntradas = 0

  for (const mov of movimentos) {
    if (mov.tipo !== 'entrada') continue
    const forma = normalizarFormaCaixa(mov.forma)
    totais.set(forma, (totais.get(forma) ?? 0) + mov.valor)
    totalEntradas += mov.valor
    if (forma === 'pix') {
      const conta = mov.contaBancariaNome?.trim() || SEM_CONTA_PIX
      pixContas.set(conta, (pixContas.get(conta) ?? 0) + mov.valor)
    }
  }

  const ordem: FormaCaixaCanonica[] = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']
  if ((totais.get('transferencia') ?? 0) > 0) ordem.push('transferencia')

  const linhas = ordem.map((forma): LinhaFormaResumo => {
    const linha: LinhaFormaResumo = { forma, label: ROTULOS[forma], value: round2(totais.get(forma) ?? 0) }
    const temContaNomeada = [...pixContas.keys()].some((nome) => nome !== SEM_CONTA_PIX)
    if (forma === 'pix' && temContaNomeada) {
      linha.contas = [...pixContas.entries()]
        .sort(([a], [b]) => (a === SEM_CONTA_PIX ? 1 : b === SEM_CONTA_PIX ? -1 : a.localeCompare(b, 'pt-BR')))
        .map(([nome, value]) => ({ label: `PIX · ${nome}`, value: round2(value) }))
    }
    return linha
  })

  return { linhas, totalEntradas: round2(totalEntradas) }
}

export const ROTULO_VINCULO: Record<string, string> = {
  paciente: 'Paciente',
  fornecedor: 'Fornecedor',
  prestador: 'Prestador de serviço',
  colaborador: 'Colaborador',
  outro: 'Outro',
}

/** "Paciente: Maria Silva" para a lista de movimentações; vazio quando não há vínculo. */
export function vinculoTexto(item: { vinculoTipo?: string | null; vinculoNome?: string | null }): string {
  if (!item.vinculoNome) return ''
  const rotulo = item.vinculoTipo ? ROTULO_VINCULO[item.vinculoTipo] : null
  return rotulo ? `${rotulo}: ${item.vinculoNome}` : item.vinculoNome
}
