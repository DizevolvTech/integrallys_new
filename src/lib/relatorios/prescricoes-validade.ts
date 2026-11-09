import type { ClassePrescricao } from '@/lib/prescricao-status'

export type FaixaValidade = 'vencidos' | 'vencem_em_breve' | 'no_prazo' | 'sem_validade'

export interface ResumoValidadeItem {
  faixa: FaixaValidade
  qtd: number
  valor: number
}

interface ItemValidade {
  classe: ClassePrescricao
  situacao: 'no_prazo' | 'limite_prazo' | 'vencido' | 'sem_validade'
  valorTotal: number
}

/**
 * Resumo de validade dos orçamentos/prescrições em aberto (Ativa/Pendente ou Vencida): convertidas e
 * canceladas ficam de fora, porque prazo não importa mais. Vencidos = regra única dos cartões (classe).
 */
export function resumirValidade(itens: ItemValidade[]): ResumoValidadeItem[] {
  const faixas: Record<FaixaValidade, ResumoValidadeItem> = {
    vencidos: { faixa: 'vencidos', qtd: 0, valor: 0 },
    vencem_em_breve: { faixa: 'vencem_em_breve', qtd: 0, valor: 0 },
    no_prazo: { faixa: 'no_prazo', qtd: 0, valor: 0 },
    sem_validade: { faixa: 'sem_validade', qtd: 0, valor: 0 },
  }
  for (const i of itens) {
    let faixa: FaixaValidade | null = null
    if (i.classe === 'vencida') faixa = 'vencidos'
    else if (i.classe === 'ativa') {
      faixa = i.situacao === 'limite_prazo' ? 'vencem_em_breve' : i.situacao === 'sem_validade' ? 'sem_validade' : 'no_prazo'
    }
    if (!faixa) continue
    faixas[faixa].qtd += 1
    faixas[faixa].valor += i.valorTotal
  }
  return [faixas.vencidos, faixas.vencem_em_breve, faixas.no_prazo, faixas.sem_validade]
}
