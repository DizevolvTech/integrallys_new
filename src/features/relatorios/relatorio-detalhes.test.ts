import { describe, expect, it } from 'vitest'
import { CONFIG_RELATORIOS } from '@/features/relatorios/relatorio-config'
import { DETALHES_POR_TIPO } from '@/features/relatorios/relatorio-detalhes'

describe('cartões clicáveis dos relatórios', () => {
  it('Recebimentos: todo cartão abre uma lista; situação da tela em conflito deixa a lista vazia', () => {
    const cartoes = CONFIG_RELATORIOS.recebimentos.cartoes?.({ liquidado: {}, aReceber: {}, atrasado: {} }, 0) ?? []
    expect(cartoes.length).toBe(6)
    expect(cartoes.every((c) => ['liquidado', 'a_receber', 'atrasado'].includes(c.detalhe ?? ''))).toBe(true)
    const d = DETALHES_POR_TIPO.recebimentos
    expect(d.filtros({ situacao: 'todos', inicio: '2026-11-01' }, 'atrasado')).toEqual({ situacao: 'atrasado', inicio: '2026-11-01' })
    expect(d.filtros({ situacao: 'liquidado' }, 'liquidado')).toEqual({ situacao: 'liquidado' })
    expect(d.filtros({ situacao: 'liquidado' }, 'atrasado')).toBeNull()
  })

  it('Tarefas: Tarefas, Pendentes, Concluídas e Atrasadas abrem a lista; indicador soma-se ao filtro', () => {
    const cartoes = CONFIG_RELATORIOS.tarefas.cartoes?.({}, 0) ?? []
    expect(cartoes.map((c) => c.detalhe)).toEqual(['todas', 'pendentes', 'concluidas', 'atrasadas'])
    const d = DETALHES_POR_TIPO.tarefas
    expect(d.filtros({ status: 'Pendente' }, 'atrasadas')).toEqual({ status: 'Pendente', indicador: 'atrasadas' })
    expect(d.filtros({ status: 'Pendente' }, 'todas')).toEqual({ status: 'Pendente' })
  })

  it('Desempenho continua com os seis indicadores', () => {
    expect(DETALHES_POR_TIPO.desempenho.filtros({ inicio: 'a' }, 'taxa')).toEqual({ inicio: 'a', metrica: 'taxa' })
    expect(DETALHES_POR_TIPO.desempenho.tipo).toBe('desempenho-detalhe')
  })
})

describe('Estoque (posição): Venda total', () => {
  const cartoes = CONFIG_RELATORIOS['estoque-posicao'].cartoes
  const base = { produtos: 3, quantidade: 10, custo: 5, margem: 1, margemPct: 10 }
  it('aparece quando o servidor envia o total de venda', () => {
    expect(cartoes?.({ ...base, venda: 20 }, 3).map((c) => c.label)).toContain('Venda total')
  })
  it('some quando o servidor omite o total de venda (recepção)', () => {
    expect(cartoes?.(base, 3).map((c) => c.label)).not.toContain('Venda total')
  })
})
