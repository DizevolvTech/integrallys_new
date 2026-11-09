import { formatData } from '@/features/relatorios/format'
import type { GrupoValidade, ValidadeResponse } from '@/features/relatorios/hooks/use-relatorio-estoque'
import type { ResumoLista } from '@/features/relatorios/relatorio-config'

const GRUPOS: Array<{ chave: GrupoValidade; titulo: string }> = [
  { chave: 'vencidos', titulo: 'Vencidos' },
  { chave: 'ate_60', titulo: 'Vencem em até 60 dias' },
  { chave: 'acima_60', titulo: 'Validade acima de 60 dias' },
  { chave: 'sem_validade', titulo: 'Sem validade' },
]

/** Quadros do resumo de validade: quantos produtos em cada faixa e quais (produto, lote, validade). */
export function resumosDeValidade(dados: ValidadeResponse | null): ResumoLista[] {
  if (!dados) return []
  return GRUPOS.map(({ chave, titulo }) => {
    const grupo = dados.grupos[chave]
    const total = grupo?.total ?? 0
    const itens = (grupo?.itens ?? []).map((i) => ({
      nome: i.lote && i.lote !== '—' ? `${i.produto} · lote ${i.lote}` : i.produto,
      valor: i.validade ? `${formatData(i.validade)} · ${i.quantidade} un.` : `${i.quantidade} un.`,
    }))
    if (total > itens.length) itens.push({ nome: `… e mais ${total - itens.length} produtos`, valor: '' })
    return {
      titulo: `${titulo} — ${total} ${total === 1 ? 'produto' : 'produtos'}`,
      itens,
      vazio: 'Nenhum produto nesta faixa.',
    }
  })
}
